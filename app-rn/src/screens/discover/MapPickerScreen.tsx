import React, { useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets, initialWindowMetrics } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import { ChevronLeft, Search, Crown } from 'lucide-react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';

import { useTheme } from '../../theme/ThemeProvider';
import { useAuth } from '../../store/auth';
import { setVirtualLocation, clearVirtualLocation } from '../../api/me';
import { useNominatimSearch } from '../../utils/useNominatimSearch';
import { UpgradePremiumSheet } from '../../components/UpgradePremiumSheet';
import { resolveMomentLocation } from '../../utils/momentLocationBridge';
import type { RootStackParamList } from '../../navigation/types';

// Popular cities for Asian + Western markets (NNNN quick-jump chips).
const CITY_PRESETS: { flag: string; name: string; lat: number; lng: number }[] = [
  { flag: '🇲🇾', name: 'KL', lat: 3.139, lng: 101.6869 },
  { flag: '🇸🇬', name: 'Singapore', lat: 1.3521, lng: 103.8198 },
  { flag: '🇹🇭', name: 'Bangkok', lat: 13.7563, lng: 100.5018 },
  { flag: '🇯🇵', name: 'Tokyo', lat: 35.6762, lng: 139.6503 },
  { flag: '🇰🇷', name: 'Seoul', lat: 37.5665, lng: 126.978 },
  { flag: '🇭🇰', name: 'Hong Kong', lat: 22.3193, lng: 114.1694 },
  { flag: '🇹🇼', name: 'Taipei', lat: 25.033, lng: 121.5654 },
  { flag: '🇺🇸', name: 'SF', lat: 37.7749, lng: -122.4194 },
  { flag: '🇺🇸', name: 'NYC', lat: 40.7128, lng: -74.006 },
  { flag: '🇬🇧', name: 'London', lat: 51.5074, lng: -0.1278 },
  { flag: '🇮🇩', name: 'Bali', lat: -8.4095, lng: 115.1889 },
  { flag: '🇻🇳', name: 'Saigon', lat: 10.8231, lng: 106.6297 },
];

/**
 * Full-screen map picker for the Premium virtual location (SSS). Uses Leaflet +
 * OpenStreetMap tiles inside a WebView — no native map module and (crucially) no
 * Google Maps API key. Tap the map to drop a pin; Save reverse-geocodes the
 * coords for a display label and persists via the teleport endpoint.
 */
export function MapPickerScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  // Moment mode opens this as a `fullScreenModal` (RootNavigator), which covers
  // the status bar / Dynamic Island. The live top inset can resolve to 0 inside
  // a full-screen modal, cramming the header under the island — so floor it with
  // the window's own top inset (captured natively, device-accurate: ~59 on
  // Dynamic Island, ~47 notch, 20 older). The card-push (virtual mode) already
  // reports a correct inset, so Math.max is a no-op there.
  const topInset = Math.max(insets.top, initialWindowMetrics?.insets.top ?? 0);
  const nav = useNavigation<any>();
  const route = useRoute<RouteProp<RootStackParamList, 'MapPicker'>>();
  // 'moment' mode returns the picked place to the composer (no virtual-location
  // write, and Save is not Premium-gated — anyone can tag a moment's location).
  const momentMode = route.params?.mode === 'moment';
  const user = useAuth((s) => s.user);
  const setUser = useAuth((s) => s.setUser);
  const queryClient = useQueryClient();
  const webRef = useRef<WebView>(null);

  // After the virtual location changes, the Discover/Nearby results are computed
  // server-side from the new origin (resolveOrigin) — but the nearby query key
  // doesn't include the coords, so it won't refetch on its own. Invalidate it so
  // the grid refreshes to the new location automatically (PPPP).
  const refreshDiscover = () => {
    queryClient.invalidateQueries({ queryKey: ['discover'] });
    queryClient.invalidateQueries({ queryKey: ['users', 'me-self'] });
  };

  const prefs = user?.preferences;
  // Centre on the current virtual location if set, else KL (the user can pan).
  const startLat = prefs?.virtualLat ?? 3.139;
  const startLng = prefs?.virtualLng ?? 101.6869;

  // Default to the start position so the visible marker is ALWAYS saveable —
  // even if Leaflet never loads (inline-HTML scripts over an about:blank origin
  // are flaky in iOS WKWebView) and a map tap never fires onMessage. Before
  // this, `picked` stayed null until a tap registered, so Save sat disabled,
  // the teleport POST was never sent, virtualLat/Lng stayed null, and the 📍
  // indicator never appeared. Tapping or dragging the pin still updates this.
  // `name` rides along when the pick came from a tapped POI pin or a search
  // result, so moment mode can use the place's real name as the label without a
  // reverse-geocode round trip (HHHHH).
  const [picked, setPicked] = useState<{ lat: number; lng: number; name?: string }>({
    lat: startLat,
    lng: startLng,
  });
  const [busy, setBusy] = useState(false);
  const [upsellOpen, setUpsellOpen] = useState(false);
  // toPublicJSON folds vipLevel into isPremium. Free users can browse/search the
  // map but can't Save — the Save button upsells instead (QQQQ).
  const isPremium = !!(user as any)?.isPremium;
  const canSave = momentMode || isPremium;
  const [query, setQuery] = useState('');
  const { results, loading: searching } = useNominatimSearch(query);

  // Move the (WebView) map + marker to coords and arm the pin for saving.
  const goTo = (lat: number, lng: number) => {
    setPicked({ lat, lng });
    webRef.current?.injectJavaScript(
      `try{map.setView([${lat}, ${lng}], 12);marker.setLatLng([${lat}, ${lng}]);}catch(e){};true;`,
    );
  };
  const pickResult = (lat: number, lng: number, name?: string) => {
    Keyboard.dismiss();
    setQuery('');
    goTo(lat, lng);
    // In moment mode, remember the searched place's name as the label.
    if (momentMode && name) setPicked({ lat, lng, name });
  };

  const html = useMemo(
    () => `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>html,body,#map{height:100%;margin:0;padding:0;background:#eee}</style>
</head><body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  var map = L.map('map',{zoomControl:false}).setView([${startLat}, ${startLng}], ${momentMode ? 15 : 12});
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:''}).addTo(map);
  var marker = L.marker([${startLat}, ${startLng}],{draggable:true}).addTo(map);
  function send(ll){ window.ReactNativeWebView.postMessage(JSON.stringify({lat:ll.lat,lng:ll.lng})); }
  map.on('click', function(e){ marker.setLatLng(e.latlng); send(e.latlng); });
  marker.on('dragend', function(){ send(marker.getLatLng()); });
${
      momentMode
        ? `
  // Google-Maps-style POI pins (HHHHH): on pan/zoom, query OpenStreetMap
  // Overpass for the visible bbox and drop a pin per named shop / eatery /
  // landmark. Keyless + CORS-friendly (same as Nominatim). circleMarker needs
  // no icon images, so it renders reliably under the unpkg baseUrl.
  var pois = L.layerGroup().addTo(map);
  var poiTok = 0, poiTimer = null;
  function loadPois(){
    if(map.getZoom() < 15){ pois.clearLayers(); return; }
    var b = map.getBounds(), s=b.getSouth(), w=b.getWest(), n=b.getNorth(), e=b.getEast();
    var bbox='('+s+','+w+','+n+','+e+')';
    var q='[out:json][timeout:25];(node["shop"]'+bbox+';node["amenity"~"restaurant|cafe|bar|pub|fast_food"]'+bbox+';node["leisure"]'+bbox+';node["tourism"]'+bbox+';);out body 60;';
    var my=++poiTok;
    fetch('https://overpass-api.de/api/interpreter',{method:'POST',body:'data='+encodeURIComponent(q)})
      .then(function(r){return r.json();})
      .then(function(d){
        if(my!==poiTok) return;
        pois.clearLayers();
        var els=(d&&d.elements)||[];
        for(var i=0;i<els.length;i++){
          (function(el){
            if(!el.tags||!el.tags.name||typeof el.lat!=='number') return;
            var m=L.circleMarker([el.lat,el.lon],{radius:7,color:'#ffffff',weight:2,fillColor:'#E25CAE',fillOpacity:1}).addTo(pois);
            m.bindTooltip(el.tags.name,{direction:'top'});
            m.on('click',function(){ window.ReactNativeWebView.postMessage(JSON.stringify({lat:el.lat,lng:el.lon,name:el.tags.name})); });
          })(els[i]);
        }
      })
      .catch(function(){});
  }
  map.on('moveend',function(){ if(poiTimer) clearTimeout(poiTimer); poiTimer=setTimeout(loadPois,600); });
  loadPois();
`
        : ''
    }
</script>
</body></html>`,
    [startLat, startLng, momentMode],
  );

  const onSave = async () => {
    if (busy) return;
    setBusy(true);
    try {
      // Resolve a display label. reverseGeocodeAsync is a NATIVE Core Location
      // call that hard-crashes iOS when no location permission has been granted
      // — and a user composing a moment usually hasn't granted it (they just
      // drop a pin; they never hit 我的当前位置, the only flow that requests it).
      // That uncatchable native crash is the "tap 保存 → app exits" bug: it's the
      // only native call in this handler, so the surrounding JS try/catch can't
      // intercept it. Fix: prefer a tapped POI / searched name, and only reverse-
      // geocode when permission is ALREADY granted (never request it here — a
      // permission *check* is always safe; the geocode itself is what crashes).
      let label = picked.name || '';
      if (!label) {
        try {
          const perm = await Location.getForegroundPermissionsAsync();
          if (perm.status === 'granted') {
            const geo = await Location.reverseGeocodeAsync({ latitude: picked.lat, longitude: picked.lng });
            const g = geo[0];
            label = [g?.city || g?.subregion, g?.region].filter(Boolean).join(', ');
          }
        } catch {
          // label is optional — the indicator keys off coords, not the label
        }
      }
      // Moment mode: hand the place back to the composer and return — no
      // virtual-location write. Coordinates are the final fallback so a plain
      // map tap (no POI name, no location permission) still gets a label.
      if (momentMode) {
        resolveMomentLocation({
          lat: picked.lat,
          lng: picked.lng,
          label: label || `${picked.lat.toFixed(3)}, ${picked.lng.toFixed(3)}`,
        });
        nav.goBack();
        return;
      }
      await setVirtualLocation(picked.lat, picked.lng, label);
      if (user) {
        setUser({
          ...user,
          preferences: {
            ...(user.preferences ?? {}),
            virtualLat: picked.lat,
            virtualLng: picked.lng,
            virtualLocationLabel: label || null,
          },
        });
      }
      refreshDiscover();
      nav.goBack();
    } catch (e: any) {
      const code = e?.response?.data?.code;
      if (code === 'PREMIUM_REQUIRED' || e?.response?.status === 403) {
        Alert.alert(t('virtualLocation.premiumOnly'));
      } else {
        Alert.alert(t('virtualLocation.failed'), e?.response?.data?.error || e?.message || '');
      }
    } finally {
      setBusy(false);
    }
  };

  const onClear = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await clearVirtualLocation();
      if (user) {
        setUser({
          ...user,
          preferences: {
            ...(user.preferences ?? {}),
            virtualLat: null,
            virtualLng: null,
            virtualLocationLabel: null,
          },
        });
      }
      refreshDiscover();
      nav.goBack();
    } catch {
      // best-effort
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={[styles.header, { paddingTop: topInset, borderBottomColor: theme.colors.line }]}>
        <Pressable onPress={() => nav.goBack()} hitSlop={12} style={styles.headerBtn}>
          <ChevronLeft size={26} color={theme.colors.text} />
        </Pressable>
        <Text style={{ flex: 1, marginLeft: 8, fontSize: 16, fontWeight: '600', color: theme.colors.text }}>
          {momentMode ? t('moments.compose.location') : t('virtualLocation.title')}
        </Text>
        <Pressable onPress={canSave ? onSave : () => setUpsellOpen(true)} disabled={busy} hitSlop={12} style={styles.headerBtn}>
          {busy ? (
            <ActivityIndicator size="small" color={theme.colors.primary} />
          ) : canSave ? (
            <Text style={{ color: theme.colors.primary, fontSize: 15, fontWeight: '600' }}>
              {t('common.save')}
            </Text>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Crown size={14} color={theme.colors.primaryDeep} strokeWidth={2} />
              <Text style={{ color: theme.colors.primaryDeep, fontSize: 14, fontWeight: '700' }}>
                {t('virtualLocation.unlockPremium')}
              </Text>
            </View>
          )}
        </Pressable>
      </View>

      {/* Address/place search (NNNN) — Nominatim, debounced. */}
      <View style={styles.searchWrap}>
        <View style={[styles.searchBox, { backgroundColor: theme.colors.surface, borderColor: theme.colors.line }]}>
          <Search size={16} color={theme.colors.muted} strokeWidth={1.8} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={momentMode ? t('moments.compose.searchPlace') : t('virtualLocation.searchPlaceholder')}
            placeholderTextColor={theme.colors.muted}
            style={{ flex: 1, fontSize: 14, color: theme.colors.text, padding: 0 }}
            returnKeyType="search"
            autoCorrect={false}
          />
          {searching && <ActivityIndicator size="small" color={theme.colors.muted} />}
        </View>
        {results.length > 0 && (
          <View style={[styles.results, { backgroundColor: theme.colors.surface, borderColor: theme.colors.line }]}>
            {results.map((r, i) => (
              <Pressable
                key={`${r.lat},${r.lng},${i}`}
                onPress={() => pickResult(r.lat, r.lng, r.label)}
                style={({ pressed }) => [
                  styles.resultRow,
                  { borderTopColor: theme.colors.line, opacity: pressed ? 0.6 : 1, borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth },
                ]}
              >
                <Text style={{ fontSize: 13, color: theme.colors.text }} numberOfLines={2}>{r.label}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      {/* Quick city chips. A bare horizontal ScrollView in a flex column
          stretches vertically to fill the column (eating the map's space) —
          flexGrow:0 + a bounded height keep it to one row so the map gets the
          rest (UUUU; TTTT's flex:1 was correct but this ScrollView starved it). */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipScroll}
        contentContainerStyle={styles.chipRow}
        keyboardShouldPersistTaps="handled"
      >
        {CITY_PRESETS.map((c) => (
          <Pressable
            key={c.name}
            onPress={() => goTo(c.lat, c.lng)}
            style={({ pressed }) => [
              styles.cityChip,
              { backgroundColor: theme.colors.surface, borderColor: theme.colors.line, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Text style={{ fontSize: 13, color: theme.colors.text2 }}>{c.flag} {c.name}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Map is the primary content — fills all remaining space (TTTT). The
          "use real location" reset is a floating overlay top-right instead of a
          bottom footer, and the old "tap the map" hint is gone (the pin makes
          it obvious). */}
      <View style={{ flex: 1 }}>
        <WebView
          ref={webRef}
          originWhitelist={['*']}
          // Give the inline HTML a real https base origin so Leaflet's CDN
          // <script>/<link> load reliably (an about:blank origin gets blocked on
          // iOS WKWebView, leaving a dead grey map).
          source={{ html, baseUrl: 'https://unpkg.com/' }}
          style={{ flex: 1 }}
          onMessage={(e) => {
            try {
              const { lat, lng, name } = JSON.parse(e.nativeEvent.data);
              if (typeof lat === 'number' && typeof lng === 'number') {
                const poiName = typeof name === 'string' ? name : undefined;
                setPicked({ lat, lng, name: poiName });
                // POI tap: move the draggable pin onto the selected place so the
                // selection is visible on the map.
                if (poiName) {
                  webRef.current?.injectJavaScript(
                    `try{marker.setLatLng([${lat}, ${lng}]);}catch(e){};true;`,
                  );
                }
              }
            } catch {
              // ignore malformed messages
            }
          }}
        />

        {/* Moment mode: floating confirm chip — shows the picked place name, or
            a "tap a pin" hint until one is chosen (HHHHH). Save is in the header. */}
        {momentMode && (
          <View
            style={[styles.confirmChip, { backgroundColor: theme.colors.surface, borderColor: theme.colors.line }]}
            pointerEvents="none"
          >
            <Text
              numberOfLines={1}
              style={{
                fontSize: 13,
                color: picked.name ? theme.colors.text : theme.colors.muted,
                fontWeight: picked.name ? '700' : '400',
              }}
            >
              {picked.name ? `📍 ${picked.name}` : t('moments.compose.tapPinToSelect')}
            </Text>
          </View>
        )}

        {/* Reset-to-GPS overlay — virtual-location only; hidden in moment mode. */}
        {!momentMode && (isPremium || (prefs?.virtualLat != null && prefs?.virtualLng != null)) && (
          <Pressable
            onPress={onClear}
            disabled={busy}
            style={[styles.mapOverlayBtn, { backgroundColor: theme.colors.surface, borderColor: theme.colors.line }]}
          >
            <Text style={{ color: theme.colors.danger ?? '#D14B4B', fontSize: 12.5, fontWeight: '700' }}>
              📍 {t('virtualLocation.revert')}
            </Text>
          </Pressable>
        )}
      </View>

      <UpgradePremiumSheet
        open={upsellOpen}
        onClose={() => setUpsellOpen(false)}
        reason={t('virtualLocation.subtitle')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  // ≥44pt touch targets for the back / save actions (Apple HIG).
  headerBtn: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  searchWrap: { paddingHorizontal: 16, paddingTop: 10, zIndex: 10 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
  },
  results: {
    marginTop: 6,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  resultRow: { paddingHorizontal: 12, paddingVertical: 10 },
  // flexGrow:0 stops the horizontal ScrollView from expanding vertically; the
  // maxHeight is a belt-and-suspenders bound for Android (UUUU).
  chipScroll: { flexGrow: 0, flexShrink: 0, maxHeight: 56 },
  chipRow: { gap: 8, paddingHorizontal: 16, paddingVertical: 8, alignItems: 'center' },
  cityChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  // Floating place-confirmation chip at the bottom of the map (HHHHH).
  confirmChip: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  // Floating reset-to-GPS button over the map (TTTT).
  mapOverlayBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    // Sits above the WebView (elevation for Android, shadow for iOS).
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
});
