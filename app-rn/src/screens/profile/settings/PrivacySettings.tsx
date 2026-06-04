import React, { useState } from 'react';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../../store/auth';
import { setPrivacy } from '../../../api/me';
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
  // toPublicJSON already folds vipLevel into isPremium.
  const isPremium = !!user?.isPremium;

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
        {/* Premium-only. Free users see the row disabled with a Premium badge. */}
        <ToggleRow
          label={t('privacySettings.hideOnlineStatus')}
          value={isPremium ? hideOnline : false}
          onValueChange={flipHideOnline}
          hint={t('privacySettings.hideOnlineStatusHint')}
          disabled={!isPremium}
          badge={isPremium ? undefined : t('privacySettings.premiumBadge')}
        />
      </SettingsCard>

      <SettingsCard flat style={{ paddingVertical: 4 }}>
        <LinkRow label={t('privacySettings.blocklist')} />
      </SettingsCard>
    </SettingsShell>
  );
}
