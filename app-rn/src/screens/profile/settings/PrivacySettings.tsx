import React, { useState } from 'react';
import { Alert, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../../store/auth';
import { setPrivacy, patchMe, clearVirtualLocation } from '../../../api/me';
import { UpgradePremiumSheet } from '../../../components/UpgradePremiumSheet';
import {
  SettingsShell,
  SettingsCard,
  ToggleRow,
  Divider,
  LinkRow,
} from './SettingsShell';

function reportFailure(e: any, title: string) {
  const status = e?.response?.status;
  const detail =
    e?.response?.data?.error || e?.response?.data?.message || e?.message || 'unknown';
  Alert.alert(title, `${detail}${status ? ` (HTTP ${status})` : ''}`);
}

export function PrivacySettings() {
  const { t } = useTranslation();
  const nav = useNavigation<any>();
  const user = useAuth((s) => s.user);
  const setUser = useAuth((s) => s.setUser);

  // Optimistic local state — invert hideFromNearby into "visible".
  const [nearbyVisible, setNearbyVisible] = useState(
    user ? !user.preferences?.hideFromNearby : true,
  );
  const [showDistance, setShowDistance] = useState(
    user ? !user.preferences?.hideDistance : true,
  );
  const [hideOnline, setHideOnline] = useState(
    user ? !!user.preferences?.hideOnlineStatus : false,
  );
  const [incognito, setIncognito] = useState(!!user?.incognitoBrowsing);
  // toPublicJSON already folds vipLevel into isPremium.
  const isPremium = !!user?.isPremium;
  const [upsellOpen, setUpsellOpen] = useState(false);
  const virtualLabel = user?.preferences?.virtualLocationLabel ?? null;
  const virtualActive =
    user?.preferences?.virtualLat != null && user?.preferences?.virtualLng != null;

  const resetVirtual = () => {
    Alert.alert(t('virtualLocation.reset'), t('virtualLocation.resetConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('virtualLocation.reset'),
        style: 'destructive',
        onPress: async () => {
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
          } catch (e) {
            reportFailure(e, t('virtualLocation.failed'));
          }
        },
      },
    ]);
  };

  const flipNearby = async (v: boolean) => {
    setNearbyVisible(v);
    try {
      const updated = await setPrivacy({ nearbyVisible: v });
      setUser(updated);
    } catch (e) {
      setNearbyVisible(!v);
      reportFailure(e, t('privacySettings.updateFailed'));
    }
  };
  const flipDistance = async (v: boolean) => {
    setShowDistance(v);
    try {
      const updated = await setPrivacy({ showDistance: v });
      setUser(updated);
    } catch (e) {
      setShowDistance(!v);
      reportFailure(e, t('privacySettings.updateFailed'));
    }
  };
  const flipHideOnline = async (v: boolean) => {
    setHideOnline(v);
    try {
      const updated = await setPrivacy({ hideOnlineStatus: v });
      setUser(updated);
    } catch (e) {
      setHideOnline(!v);
      reportFailure(e, t('privacySettings.updateFailed'));
    }
  };
  const flipIncognito = async (v: boolean) => {
    setIncognito(v);
    try {
      const updated = await patchMe({ incognitoBrowsing: v });
      setUser(updated);
    } catch (e) {
      setIncognito(!v);
      reportFailure(e, t('privacySettings.updateFailed'));
    }
  };

  return (
    <SettingsShell title={t('privacySettings.title')}>
      <SettingsCard flat style={{ paddingVertical: 4 }}>
        <ToggleRow
          label={t('privacySettings.showInNearby')}
          value={nearbyVisible}
          onValueChange={flipNearby}
          hint={t('privacySettings.showInNearbyHint')}
        />
        <Divider />
        <ToggleRow
          label={t('privacySettings.showDistance')}
          value={showDistance}
          onValueChange={flipDistance}
          hint={t('privacySettings.showDistanceHint')}
        />
        <Divider />
        {/* Premium-only. Free users: the disabled Switch lets the tap fall
            through to the Pressable, which opens the upgrade sheet. */}
        <Pressable onPress={isPremium ? undefined : () => setUpsellOpen(true)}>
          <ToggleRow
            label={t('privacySettings.hideOnlineStatus')}
            value={isPremium ? hideOnline : false}
            onValueChange={flipHideOnline}
            hint={t('privacySettings.hideOnlineStatusHint')}
            disabled={!isPremium}
            badge={isPremium ? undefined : t('privacySettings.premiumBadge')}
          />
        </Pressable>
        <Divider />
        {/* Premium-only — incognito browsing keeps you out of others' 谁在看你. */}
        <Pressable onPress={isPremium ? undefined : () => setUpsellOpen(true)}>
          <ToggleRow
            label={t('privacySettings.incognitoBrowsing')}
            value={isPremium ? incognito : false}
            onValueChange={flipIncognito}
            hint={t('privacySettings.incognitoBrowsingHint')}
            disabled={!isPremium}
            badge={isPremium ? undefined : t('privacySettings.premiumBadge')}
          />
        </Pressable>
      </SettingsCard>

      <SettingsCard flat style={{ paddingVertical: 4 }}>
        {/* Premium virtual location (NNNN) — no on/off toggle: it's always on
            once a location is set, and unset by Reset. Free → upgrade sheet. */}
        <LinkRow
          label={t('virtualLocation.myLocation')}
          detail={virtualActive ? (virtualLabel || t('virtualLocation.active')) : t('virtualLocation.notSet')}
          onPress={() => (isPremium ? nav.navigate('MapPicker') : setUpsellOpen(true))}
        />
        {virtualActive && (
          <>
            <Divider />
            <LinkRow label={t('virtualLocation.reset')} destructive onPress={resetVirtual} />
          </>
        )}
        <Divider />
        <LinkRow label={t('privacySettings.blocklist')} onPress={() => nav.navigate('BlockedList')} />
      </SettingsCard>
      <UpgradePremiumSheet open={upsellOpen} onClose={() => setUpsellOpen(false)} reason={t('premium.upsell.privacy')} />
    </SettingsShell>
  );
}
