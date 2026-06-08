import React, { useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import { ChevronLeft } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '../../theme/ThemeProvider';
import { useAuth } from '../../store/auth';
import { setVirtualLocation, clearVirtualLocation } from '../../api/me';

/**
 * Full-screen map picker for the Premium virtual location (SSS). Uses Leaflet +
 * OpenStreetMap tiles inside a WebView — no native map module and (crucially) no
 * Google Maps API key. Tap the map to drop a pin; Save reverse-geocodes the
 * coords for a display label and persists via the teleport endpoint.
 */
export function MapPickerScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const nav = useNavigation<any>();
  const user = useAuth((s) => s.user);
  const setUser = useAuth((s) => s.setUser);
  const webRef = useRef<WebView>(null);

  const prefs = user?.preferences;
  // Centre on the current virtual location if set, else KL (the user can pan).
  const startLat = prefs?.virtualLat ?? 3.139;
  const startLng = prefs?.virtualLng ?? 101.6869;

  const [picked, setPicked] = useState<{ lat: number; lng: number } | null>(
    prefs?.virtualLat != null && prefs?.virtualLng != null
      ? { lat: prefs.virtualLat, lng: prefs.virtualLng }
      : null,
  );
  const [busy, setBusy] = useState(false);

  const html = useMemo(
    () => `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>html,body,#map{height:100%;margin:0;padding:0;background:#eee}</style>
</head><body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  var map = L.map('map',{zoomControl:false}).setView([${startLat}, ${startLng}], 12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:''}).addTo(map);
  var marker = L.marker([${startLat}, ${startLng}],{draggable:true}).addTo(map);
  function send(ll){ window.ReactNativeWebView.postMessage(JSON.stringify({lat:ll.lat,lng:ll.lng})); }
  map.on('click', function(e){ marker.setLatLng(e.latlng); send(e.latlng); });
  marker.on('dragend', function(){ send(marker.getLatLng()); });
</script>
</body></html>`,
    [startLat, startLng],
  );

  const onSave = async () => {
    if (!picked || busy) return;
    setBusy(true);
    try {
      let label = '';
      try {
        const geo = await Location.reverseGeocodeAsync({ latitude: picked.lat, longitude: picked.lng });
        const g = geo[0];
        label = [g?.city || g?.subregion, g?.region].filter(Boolean).join(', ');
      } catch {
        // label is optional — the indicator keys off coords, not the label
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
      nav.goBack();
    } catch {
      // best-effort
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: theme.colors.line }]}>
        <Pressable onPress={() => nav.goBack()} hitSlop={8}>
          <ChevronLeft size={26} color={theme.colors.text} />
        </Pressable>
        <Text style={{ flex: 1, marginLeft: 8, fontSize: 16, fontWeight: '600', color: theme.colors.text }}>
          {t('virtualLocation.title')}
        </Text>
        <Pressable onPress={onSave} disabled={!picked || busy} hitSlop={8}>
          {busy ? (
            <ActivityIndicator size="small" color={theme.colors.primary} />
          ) : (
            <Text style={{ color: picked ? theme.colors.primary : theme.colors.muted, fontSize: 15, fontWeight: '600' }}>
              {t('common.save')}
            </Text>
          )}
        </Pressable>
      </View>

      <Text style={[styles.hint, { color: theme.colors.muted }]}>
        {t('virtualLocation.mapHint')}
      </Text>

      <WebView
        ref={webRef}
        originWhitelist={['*']}
        source={{ html }}
        style={{ flex: 1 }}
        onMessage={(e) => {
          try {
            const { lat, lng } = JSON.parse(e.nativeEvent.data);
            if (typeof lat === 'number' && typeof lng === 'number') setPicked({ lat, lng });
          } catch {
            // ignore malformed messages
          }
        }}
      />

      <View style={[styles.footer, { borderTopColor: theme.colors.line }]}>
        <Pressable onPress={onClear} disabled={busy} hitSlop={6}>
          <Text style={{ color: theme.colors.danger ?? '#D14B4B', fontSize: 14, fontWeight: '600' }}>
            {t('virtualLocation.revert')}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  hint: {
    fontSize: 12.5,
    paddingHorizontal: 16,
    paddingVertical: 8,
    textAlign: 'center',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
