import React from 'react';
import { View, Text, Pressable, StyleSheet, AppState } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { MapPin, ShieldCheck, Clock, EyeOff } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Sheet } from '../../components/Sheet';
import { Button } from '../../components/Button';
import { showToast } from '../../utils/toastBridge';
import { requestLocation, getCurrentLocation } from '../../utils/permissions';
import {
  getNearbyCheckinStatus,
  nearbyCheckIn,
  nearbyCheckOut,
  NEARBY_CHECKIN_DURATIONS,
} from '../../api/me';

/** React-query key for the current user's nearby check-in status. Exported so
 *  other surfaces (e.g. AppState auto-checkout) can invalidate it. */
export const NEARBY_STATUS_KEY = ['nearby', 'checkin', 'status'] as const;

/**
 * Apple Guideline 5.1.2(i) — opt-in, session-based location sharing on 附近.
 *
 * A user is only visible to others on the Nearby grid while a LIVE check-in is
 * active. This bar sits at the top of the Nearby tab and is the single manual
 * entry point: the user must tap "签到" each session, choose a duration
 * (15/30/60 min), and consent — there is deliberately no persistent
 * "always share" toggle. Not checked in ⇒ the user can still browse others,
 * they just don't appear themselves. The session auto-expires server-side.
 */
export function NearbyCheckInBar() {
  const theme = useTheme();
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [minutes, setMinutes] = React.useState<number>(30);
  const [submitting, setSubmitting] = React.useState(false);

  const statusQ = useQuery({
    queryKey: NEARBY_STATUS_KEY,
    queryFn: getNearbyCheckinStatus,
    // Keep the remaining-time label reasonably fresh + re-sync on focus (so a
    // session expired while backgrounded flips the bar back to "hidden").
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    staleTime: 15_000,
  });

  const status = statusQ.data;
  const checkedIn = !!status?.checkedIn;

  // Local countdown so "剩余 N 分钟" ticks down between server refetches.
  const [remainingMs, setRemainingMs] = React.useState(0);
  React.useEffect(() => {
    setRemainingMs(status?.remainingMs ?? 0);
  }, [status?.remainingMs]);
  React.useEffect(() => {
    if (!checkedIn) return;
    const id = setInterval(() => {
      setRemainingMs((ms) => {
        const next = ms - 30_000;
        if (next <= 0) {
          // Session lapsed — re-pull authoritative status (flips to hidden) and
          // refresh the grid so an expired self drops off.
          qc.invalidateQueries({ queryKey: NEARBY_STATUS_KEY });
          qc.invalidateQueries({ queryKey: ['discover', 'nearby'] });
          return 0;
        }
        return next;
      });
    }, 30_000);
    return () => clearInterval(id);
  }, [checkedIn, qc]);

  const refreshAll = React.useCallback(() => {
    qc.invalidateQueries({ queryKey: NEARBY_STATUS_KEY });
    qc.invalidateQueries({ queryKey: ['discover', 'nearby'] });
  }, [qc]);

  // Auto check-out when the app has been backgrounded > 5 min (Apple 5.1.2(i):
  // location sharing shouldn't silently persist while the app is away). The
  // server session also auto-expires (≤60 min) as the hard backstop.
  const bgSinceRef = React.useRef<number | null>(null);
  const checkedInRef = React.useRef(checkedIn);
  checkedInRef.current = checkedIn;
  React.useEffect(() => {
    const BG_LIMIT_MS = 5 * 60 * 1000;
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        const since = bgSinceRef.current;
        bgSinceRef.current = null;
        if (since != null && Date.now() - since > BG_LIMIT_MS && checkedInRef.current) {
          nearbyCheckOut()
            .catch(() => {})
            .finally(refreshAll);
        } else {
          // Re-sync in case the session lapsed server-side while away.
          qc.invalidateQueries({ queryKey: NEARBY_STATUS_KEY });
        }
      } else if (next === 'background' || next === 'inactive') {
        if (bgSinceRef.current == null) bgSinceRef.current = Date.now();
      }
    });
    return () => sub.remove();
  }, [qc, refreshAll]);

  const doCheckIn = async () => {
    setSubmitting(true);
    try {
      // Refresh GPS in the same call so the point we share is current. Best
      // effort — a denied permission still checks the user in at their stored
      // location (the server keeps the last known point).
      let coords: { latitude: number; longitude: number } | undefined;
      try {
        const perm = await requestLocation();
        if (perm === 'granted') {
          const pos = await getCurrentLocation();
          if (pos?.coords) {
            coords = {
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
            };
          }
        }
      } catch {
        /* ignore — check in with stored location */
      }
      await nearbyCheckIn(minutes, coords);
      refreshAll();
      setSheetOpen(false);
      showToast(t('nearby.checkin.toastOn', { min: minutes }), 'success');
    } catch {
      showToast(t('nearby.checkin.failed'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const doCheckOut = async () => {
    try {
      await nearbyCheckOut();
      refreshAll();
      showToast(t('nearby.checkin.toastOff'), 'info');
    } catch {
      showToast(t('nearby.checkin.failed'), 'error');
    }
  };

  const remainingMin = Math.max(1, Math.round(remainingMs / 60000));

  return (
    <>
      <View
        style={[
          styles.bar,
          {
            backgroundColor: checkedIn ? theme.colors.primarySoft : theme.colors.surface,
            borderColor: checkedIn ? theme.colors.primary : theme.colors.line,
          },
        ]}
      >
        <View style={styles.left}>
          {checkedIn ? (
            <MapPin size={18} color={theme.colors.primaryDeep} strokeWidth={2.2} />
          ) : (
            <EyeOff size={18} color={theme.colors.muted} strokeWidth={2} />
          )}
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13.5, fontWeight: '700', color: theme.colors.text }}>
              {checkedIn ? t('nearby.checkin.visibleTitle') : t('nearby.checkin.hiddenTitle')}
            </Text>
            <Text style={{ fontSize: 11.5, color: theme.colors.text2 }} numberOfLines={1}>
              {checkedIn
                ? t('nearby.checkin.visibleSub', { min: remainingMin })
                : t('nearby.checkin.hiddenSub')}
            </Text>
          </View>
        </View>

        {checkedIn ? (
          <Pressable
            onPress={doCheckOut}
            hitSlop={8}
            style={[styles.action, { borderColor: theme.colors.line, backgroundColor: theme.colors.surface }]}
          >
            <Text style={{ fontSize: 12.5, fontWeight: '700', color: theme.colors.text2 }}>
              {t('nearby.checkin.checkout')}
            </Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={() => setSheetOpen(true)}
            hitSlop={8}
            style={[styles.actionPrimary, { backgroundColor: theme.colors.primary }]}
          >
            <Text style={{ fontSize: 12.5, fontWeight: '800', color: '#FFFFFF' }}>
              {t('nearby.checkin.cta')}
            </Text>
          </Pressable>
        )}
      </View>

      {/* Check-in sheet doubles as the consent dialog (Apple 5.1.2(i)): it
          explains exactly what's shared and requires a deliberate confirm. */}
      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} maxHeight="72%">
        <View style={styles.sheet}>
          <View style={[styles.sheetIcon, { backgroundColor: theme.colors.primarySoft }]}>
            <MapPin size={26} color={theme.colors.primaryDeep} strokeWidth={2} />
          </View>
          <Text style={[styles.sheetTitle, { color: theme.colors.text }]}>
            {t('nearby.checkin.sheetTitle')}
          </Text>
          <Text style={[styles.sheetBody, { color: theme.colors.text2 }]}>
            {t('nearby.checkin.sheetBody')}
          </Text>

          {/* Privacy reassurance bullets */}
          <View style={{ gap: 10, alignSelf: 'stretch', marginTop: 4, marginBottom: 18 }}>
            <Bullet icon={<Clock size={16} color={theme.colors.success} strokeWidth={2} />} text={t('nearby.checkin.bulletSession')} />
            <Bullet icon={<ShieldCheck size={16} color={theme.colors.success} strokeWidth={2} />} text={t('nearby.checkin.bulletPrecise')} />
            <Bullet icon={<EyeOff size={16} color={theme.colors.success} strokeWidth={2} />} text={t('nearby.checkin.bulletOff')} />
          </View>

          {/* Duration chips */}
          <Text style={[styles.durLabel, { color: theme.colors.text2 }]}>
            {t('nearby.checkin.durationLabel')}
          </Text>
          <View style={styles.durRow}>
            {NEARBY_CHECKIN_DURATIONS.map((m) => {
              const active = minutes === m;
              return (
                <Pressable
                  key={m}
                  onPress={() => setMinutes(m)}
                  style={[
                    styles.durChip,
                    {
                      borderColor: active ? theme.colors.primary : theme.colors.line,
                      backgroundColor: active ? theme.colors.primarySoft : theme.colors.surface,
                    },
                  ]}
                >
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: '700',
                      color: active ? theme.colors.primaryDeep : theme.colors.text2,
                    }}
                  >
                    {t('nearby.checkin.minutes', { min: m })}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Button
            label={t('nearby.checkin.confirm')}
            onPress={doCheckIn}
            loading={submitting}
            style={{ alignSelf: 'stretch', marginTop: 18 }}
          />
          <Pressable onPress={() => setSheetOpen(false)} hitSlop={8} style={{ paddingVertical: 12 }}>
            <Text style={{ fontSize: 13.5, color: theme.colors.muted, fontWeight: '600' }}>
              {t('nearby.checkin.notNow')}
            </Text>
          </Pressable>
        </View>
      </Sheet>
    </>
  );
}

function Bullet({ icon, text }: { icon: React.ReactNode; text: string }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      {icon}
      <Text style={{ flex: 1, fontSize: 13, color: theme.colors.text2, lineHeight: 18 }}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginHorizontal: 20,
    marginBottom: 12,
    paddingVertical: 10,
    paddingLeft: 14,
    paddingRight: 10,
    borderRadius: 16,
    borderWidth: 1,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  action: {
    paddingHorizontal: 14,
    height: 34,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionPrimary: {
    paddingHorizontal: 18,
    height: 34,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheet: { alignItems: 'center', paddingHorizontal: 24, paddingTop: 8, paddingBottom: 8 },
  sheetIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  sheetTitle: { fontSize: 19, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  sheetBody: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  durLabel: { fontSize: 12, fontWeight: '700', alignSelf: 'flex-start', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  durRow: { flexDirection: 'row', gap: 10, alignSelf: 'stretch' },
  durChip: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
