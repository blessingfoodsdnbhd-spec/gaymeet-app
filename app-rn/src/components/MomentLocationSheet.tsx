import React, { useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert } from 'react-native';
// Pressable + ScrollView from react-native-gesture-handler (NOT react-native).
// Inside the Sheet's GestureHandlerRootView on Android, RN-core's JS-responder
// Pressable / ScrollView don't share RNGH's native gesture system: the FIRST
// touch after the sheet opens is consumed waking the gesture pipeline, so the
// map/current/city buttons "need several taps — UNLESS you first scroll the
// list". RNGH's own Pressable + ScrollView coordinate with the gesture tree and
// respond on the first tap (regression of the Build 61 fix; restored Build 76).
import { Pressable, ScrollView } from 'react-native-gesture-handler';
import { Map, MapPin, Navigation, X } from 'lucide-react-native';
import * as Location from 'expo-location';
import { useTranslation } from 'react-i18next';
import { Sheet } from './Sheet';
import { useTheme } from '../theme/ThemeProvider';

export interface MomentPlace {
  lat: number;
  lng: number;
  label: string;
}

// Curated cities — dependency-free fallback alongside the device's GPS location.
const CITIES: MomentPlace[] = [
  { label: '吉隆坡 Kuala Lumpur', lat: 3.139, lng: 101.6869 },
  { label: '新加坡 Singapore', lat: 1.3521, lng: 103.8198 },
  { label: '槟城 Penang', lat: 5.4164, lng: 100.3327 },
  { label: '新山 Johor Bahru', lat: 1.4927, lng: 103.7414 },
  { label: '香港 Hong Kong', lat: 22.3193, lng: 114.1694 },
  { label: '台北 Taipei', lat: 25.033, lng: 121.5654 },
  { label: '东京 Tokyo', lat: 35.6762, lng: 139.6503 },
  { label: '曼谷 Bangkok', lat: 13.7563, lng: 100.5018 },
];

interface Props {
  open: boolean;
  onClose: () => void;
  current?: MomentPlace | null;
  onPick: (place: MomentPlace | null) => void;
  /** Open the full map picker with POI search (HHHHH). Parent closes the sheet
   *  + navigates; restored after the DDDDD removal stripped this entry. */
  onChooseMap?: () => void;
  /** iOS-only: fires after this Sheet's Modal has fully dismissed. The composer
   *  chains the MapPicker fullScreenModal present off this so it never presents
   *  while the Sheet's Modal is still dismissing (which tangles the iOS VC chain
   *  and makes Save → goBack collapse the Composer too). Forwarded to Sheet. */
  onDismiss?: () => void;
}

export function MomentLocationSheet({ open, onClose, current, onPick, onChooseMap, onDismiss }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);

  const useCurrent = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        Alert.alert(t('moments.compose.locationPermTitle'), t('moments.compose.locationPermBody'));
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = pos.coords;
      let label = '';
      try {
        const geo = await Location.reverseGeocodeAsync({ latitude, longitude });
        const g = geo[0];
        label = [g?.city || g?.subregion, g?.region].filter(Boolean).join(', ');
      } catch {
        // keep label empty → fall back to coords below
      }
      onPick({ lat: latitude, lng: longitude, label: label || `${latitude.toFixed(3)}, ${longitude.toFixed(3)}` });
      onClose();
    } catch (e: any) {
      Alert.alert(t('moments.compose.locationFailed'), e?.message ?? '');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} onDismiss={onDismiss} maxHeight="70%">
      {/* __DEV__-only tap diagnostics (stripped from release builds). On a dev
          build, watch Metro logs while tapping the map button on a real device:
            • SHEET_TOUCH every tap + MAP_PRESS_IN every tap + MAP_CLICK every tap
              → the tap fully works; any "needs N taps" is a DOWNSTREAM nav/anim
                race, not interception (this is the expected case — see #224).
            • SHEET_TOUCH/PRESS_IN fire but MAP_CLICK is dropped
              → the press is being cancelled mid-gesture (a parent responder).
            • SHEET_TOUCH does not fire on every tap
              → an overlay is intercepting above the sheet (statically: none found). */}
      <View onTouchStart={() => { if (__DEV__) console.log('LOCATION_SHEET_TOUCH', Date.now()); }}>
      <Text style={[styles.title, { color: theme.colors.text }]}>
        {t('moments.compose.location')}
      </Text>

      {onChooseMap ? (
        <Pressable
          onPressIn={() => { if (__DEV__) console.log('LOCATION_MAP_PRESS_IN', Date.now()); }}
          onPress={() => { if (__DEV__) console.log('LOCATION_MAP_CLICK', Date.now()); onChooseMap(); }}
          hitSlop={10}
          style={[styles.row, { borderBottomColor: theme.colors.line }]}
        >
          <Map size={18} color={theme.colors.primary} strokeWidth={2} />
          <Text style={{ flex: 1, fontSize: 15, color: theme.colors.text }}>
            🗺 {t('moments.compose.chooseOnMap')}
          </Text>
        </Pressable>
      ) : null}

      <Pressable onPress={useCurrent} hitSlop={8} style={[styles.row, { borderBottomColor: theme.colors.line }]}>
        <Navigation size={18} color={theme.colors.primary} strokeWidth={2} />
        <Text style={{ flex: 1, fontSize: 15, color: theme.colors.text }}>
          {t('moments.compose.currentLocation')}
        </Text>
        {busy && <ActivityIndicator size="small" color={theme.colors.primary} />}
      </Pressable>

      {current ? (
        <Pressable
          onPress={() => { onPick(null); onClose(); }}
          hitSlop={8}
          style={[styles.row, { borderBottomColor: theme.colors.line }]}
        >
          <X size={18} color={theme.colors.danger ?? '#D14B4B'} strokeWidth={2} />
          <Text style={{ flex: 1, fontSize: 15, color: theme.colors.text }}>
            {t('moments.compose.removeLocation')}
          </Text>
          <Text style={{ fontSize: 12, color: theme.colors.muted }}>{current.label}</Text>
        </Pressable>
      ) : null}

      <ScrollView
        style={{ maxHeight: 320 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
      >
        {CITIES.map((c) => (
          <Pressable
            key={c.label}
            onPress={() => { onPick(c); onClose(); }}
            hitSlop={8}
            style={[styles.row, { borderBottomColor: theme.colors.line }]}
          >
            <MapPin size={16} color={theme.colors.muted} strokeWidth={2} />
            <Text style={{ flex: 1, fontSize: 15, color: theme.colors.text }}>{c.label}</Text>
          </Pressable>
        ))}
      </ScrollView>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 17, fontWeight: '700', marginBottom: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
