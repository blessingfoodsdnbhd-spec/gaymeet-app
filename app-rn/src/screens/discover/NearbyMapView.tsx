import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import { useTranslation } from 'react-i18next';

import { useTheme } from '../../theme/ThemeProvider';
import { useAuth } from '../../store/auth';
import type { DiscoverCardUser } from '../../api/discover';

/**
 * Privacy-safe "radar" map for Nearby (item 7). The backend never exposes other
 * users' coordinates — only a distance. So each marker is placed at the user's
 * REAL distance from the viewer but a DETERMINISTIC pseudo-random bearing
 * (hashed from their id, stable across renders), centered on the viewer. This
 * reads like a map of nearby people without leaking anyone's actual location.
 * Tapping a marker opens that user's profile sheet.
 */
export function NearbyMapView({
  users,
  onOpenUser,
}: {
  users: DiscoverCardUser[];
  onOpenUser: (u: DiscoverCardUser) => void;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const me = useAuth((s) => s.user);
  const webRef = useRef<WebView>(null);
  const [origin, setOrigin] = useState<{ lat: number; lng: number } | null>(null);

  // Resolve the viewer's centre: Premium virtual location wins, else live GPS,
  // else a sensible default so the map still renders.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const vLat = me?.preferences?.virtualLat;
      const vLng = me?.preferences?.virtualLng;
      if (typeof vLat === 'number' && typeof vLng === 'number') {
        setOrigin({ lat: vLat, lng: vLng });
        return;
      }
      try {
        const perm = await Location.getForegroundPermissionsAsync();
        if (perm.granted) {
          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
          if (!cancelled) setOrigin({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          return;
        }
      } catch {
        // fall through to default
      }
      if (!cancelled) setOrigin({ lat: 3.139, lng: 101.6869 }); // KL default
    })();
    return () => {
      cancelled = true;
    };
  }, [me?.preferences?.virtualLat, me?.preferences?.virtualLng]);

  // Compute marker positions: distance (km) at a deterministic bearing.
  const markers = useMemo(() => {
    if (!origin) return [];
    const latRad = (origin.lat * Math.PI) / 180;
    return users
      .map((u) => {
        const km = u.distKm ?? 0.3;
        // Stable bearing from the user id hash.
        let h = 0;
        const id = String(u.id);
        for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
        const bearing = (h % 360) * (Math.PI / 180);
        const dLat = (km / 111.32) * Math.cos(bearing);
        const dLng = (km / (111.32 * Math.max(0.2, Math.cos(latRad)))) * Math.sin(bearing);
        return {
          id,
          lat: origin.lat + dLat,
          lng: origin.lng + dLng,
          name: (u.nickname || '').replace(/[<>"'\\]/g, ''),
          online: !!(u as any).isOnline,
        };
      });
  }, [users, origin]);

  const html = useMemo(() => {
    if (!origin) return '';
    const pink = theme.colors.primary;
    const green = theme.colors.success;
    const markerJs = markers
      .map(
        (m) =>
          `addUser(${m.lat},${m.lng},${JSON.stringify(m.name)},${JSON.stringify(m.id)},${m.online});`,
      )
      .join('');
    return `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>html,body,#map{height:100%;margin:0;padding:0;background:#eee}
.me{background:${pink};border:3px solid #fff;border-radius:50%;width:18px;height:18px;box-shadow:0 0 0 6px ${pink}33}</style>
</head><body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  var map = L.map('map',{zoomControl:false,attributionControl:false}).setView([${origin.lat}, ${origin.lng}], 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);
  var meIcon = L.divIcon({className:'',html:'<div class="me"></div>',iconSize:[18,18],iconAnchor:[9,9]});
  L.marker([${origin.lat}, ${origin.lng}],{icon:meIcon,interactive:false}).addTo(map);
  var pts=[[${origin.lat},${origin.lng}]];
  function addUser(lat,lng,name,id,online){
    var m=L.circleMarker([lat,lng],{radius:9,color:'#fff',weight:2,fillColor:online?'${green}':'${pink}',fillOpacity:1});
    m.addTo(map); m.bindTooltip(name,{direction:'top'});
    m.on('click',function(){ window.ReactNativeWebView.postMessage(JSON.stringify({userId:id})); });
    pts.push([lat,lng]);
  }
  ${markerJs}
  if(pts.length>1){ try{ map.fitBounds(pts,{padding:[40,40],maxZoom:15}); }catch(e){} }
</script>
</body></html>`;
  }, [origin, markers, theme.colors.primary, theme.colors.success]);

  if (!origin) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={theme.colors.primary} />
        <Text style={{ marginTop: 10, fontSize: 13, color: theme.colors.muted }}>{t('discover.mapLocating')}</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <WebView
        ref={webRef}
        originWhitelist={['*']}
        source={{ html, baseUrl: 'https://unpkg.com/' }}
        style={{ flex: 1, backgroundColor: theme.colors.bg }}
        onMessage={(e) => {
          try {
            const { userId } = JSON.parse(e.nativeEvent.data);
            const u = users.find((x) => String(x.id) === String(userId));
            if (u) onOpenUser(u);
          } catch {
            // ignore malformed messages
          }
        }}
      />
      <Text style={{ position: 'absolute', bottom: 8, left: 12, fontSize: 10.5, color: theme.colors.muted }}>
        {t('discover.mapApproxNote')}
      </Text>
    </View>
  );
}
