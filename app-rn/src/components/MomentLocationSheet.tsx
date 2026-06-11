import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator, Alert } from 'react-native';
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
}

export function MomentLocationSheet({ open, onClose, current, onPick, onChooseMap }: Props) {
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
    <Sheet open={open} onClose={onClose} maxHeight="70%">
      <Text style={[styles.title, { color: theme.colors.text }]}>
        {t('moments.compose.location')}
      </Text>

      {onChooseMap ? (
        <Pressable onPress={onChooseMap} style={[styles.row, { borderBottomColor: theme.colors.line }]}>
          <Map size={18} color={theme.colors.primary} strokeWidth={2} />
          <Text style={{ flex: 1, fontSize: 15, color: theme.colors.text }}>
            🗺 {t('moments.compose.chooseOnMap')}
          </Text>
        </Pressable>
      ) : null}

      <Pressable onPress={useCurrent} style={[styles.row, { borderBottomColor: theme.colors.line }]}>
        <Navigation size={18} color={theme.colors.primary} strokeWidth={2} />
        <Text style={{ flex: 1, fontSize: 15, color: theme.colors.text }}>
          {t('moments.compose.currentLocation')}
        </Text>
        {busy && <ActivityIndicator size="small" color={theme.colors.primary} />}
      </Pressable>

      {current ? (
        <Pressable
          onPress={() => { onPick(null); onClose(); }}
          style={[styles.row, { borderBottomColor: theme.colors.line }]}
        >
          <X size={18} color={theme.colors.danger ?? '#D14B4B'} strokeWidth={2} />
          <Text style={{ flex: 1, fontSize: 15, color: theme.colors.text }}>
            {t('moments.compose.removeLocation')}
          </Text>
          <Text style={{ fontSize: 12, color: theme.colors.muted }}>{current.label}</Text>
        </Pressable>
      ) : null}

      <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
        {CITIES.map((c) => (
          <Pressable
            key={c.label}
            onPress={() => { onPick(c); onClose(); }}
            style={[styles.row, { borderBottomColor: theme.colors.line }]}
          >
            <MapPin size={16} color={theme.colors.muted} strokeWidth={2} />
            <Text style={{ flex: 1, fontSize: 15, color: theme.colors.text }}>{c.label}</Text>
          </Pressable>
        ))}
      </ScrollView>
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
