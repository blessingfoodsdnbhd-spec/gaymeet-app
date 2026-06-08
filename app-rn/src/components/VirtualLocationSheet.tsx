import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { MapPin, Check, X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Sheet } from './Sheet';
import { useTheme } from '../theme/ThemeProvider';
import { setVirtualLocation, clearVirtualLocation } from '../api/me';

// Curated major cities (label + coords). A static list keeps this dependency-free
// (no native map lib that could destabilize the EAS build); the backend just
// needs lat/lng + a display label.
const CITIES: Array<{ label: string; lat: number; lng: number }> = [
  { label: '吉隆坡 Kuala Lumpur', lat: 3.139, lng: 101.6869 },
  { label: '新加坡 Singapore', lat: 1.3521, lng: 103.8198 },
  { label: '曼谷 Bangkok', lat: 13.7563, lng: 100.5018 },
  { label: '香港 Hong Kong', lat: 22.3193, lng: 114.1694 },
  { label: '台北 Taipei', lat: 25.033, lng: 121.5654 },
  { label: '东京 Tokyo', lat: 35.6762, lng: 139.6503 },
  { label: '首尔 Seoul', lat: 37.5665, lng: 126.978 },
  { label: '上海 Shanghai', lat: 31.2304, lng: 121.4737 },
  { label: '北京 Beijing', lat: 39.9042, lng: 116.4074 },
  { label: '悉尼 Sydney', lat: -33.8688, lng: 151.2093 },
  { label: '伦敦 London', lat: 51.5074, lng: -0.1278 },
  { label: '纽约 New York', lat: 40.7128, lng: -74.006 },
  { label: '洛杉矶 Los Angeles', lat: 34.0522, lng: -118.2437 },
];

interface Props {
  open: boolean;
  onClose: () => void;
  /** Currently-active virtual location label (null when off). */
  currentLabel?: string | null;
  /** Called after a successful set/clear with the new label (null = reverted). */
  onApplied: (label: string | null) => void;
}

export function VirtualLocationSheet({ open, onClose, currentLabel, onApplied }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);

  const pick = async (c: { label: string; lat: number; lng: number }) => {
    if (busy) return;
    setBusy(true);
    try {
      await setVirtualLocation(c.lat, c.lng, c.label);
      onApplied(c.label);
      onClose();
    } catch (e: any) {
      const detail = e?.response?.data?.error || e?.message || '';
      Alert.alert(t('virtualLocation.failed'), detail);
    } finally {
      setBusy(false);
    }
  };

  const revert = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await clearVirtualLocation();
      onApplied(null);
      onClose();
    } catch (e: any) {
      const detail = e?.response?.data?.error || e?.message || '';
      Alert.alert(t('virtualLocation.failed'), detail);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} maxHeight="70%">
      <Text style={[styles.title, { color: theme.colors.text }]}>
        {t('virtualLocation.title')}
      </Text>
      <Text style={[styles.subtitle, { color: theme.colors.muted }]}>
        {t('virtualLocation.subtitle')}
      </Text>

      {currentLabel ? (
        <Pressable onPress={revert} style={[styles.revertRow, { borderColor: theme.colors.line }]}>
          <X size={16} color={theme.colors.danger ?? '#D14B4B'} strokeWidth={2} />
          <Text style={{ flex: 1, fontSize: 14, color: theme.colors.text }}>
            {t('virtualLocation.revert')}
          </Text>
          <Text style={{ fontSize: 12, color: theme.colors.muted }}>{currentLabel}</Text>
        </Pressable>
      ) : null}

      <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
        {CITIES.map((c) => {
          const active = currentLabel === c.label;
          return (
            <Pressable
              key={c.label}
              onPress={() => pick(c)}
              style={[styles.cityRow, { borderBottomColor: theme.colors.line }]}
            >
              <MapPin size={16} color={theme.colors.primary} strokeWidth={2} />
              <Text style={{ flex: 1, fontSize: 15, color: theme.colors.text }}>{c.label}</Text>
              {active && <Check size={18} color={theme.colors.primary} strokeWidth={2.4} />}
            </Pressable>
          );
        })}
      </ScrollView>

      {busy && (
        <View style={styles.busyOverlay}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
  subtitle: { fontSize: 13, marginBottom: 14, lineHeight: 18 },
  revertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 12,
  },
  cityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  busyOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
});
