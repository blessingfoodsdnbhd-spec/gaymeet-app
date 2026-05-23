import React, { useState } from 'react';
import { Alert } from 'react-native';
import { useAuth } from '../../../store/auth';
import { setPrivacy } from '../../../api/me';
import {
  SettingsShell,
  SettingsCard,
  ToggleRow,
  Divider,
  LinkRow,
} from './SettingsShell';

function reportFailure(e: any, label: string) {
  const status = e?.response?.status;
  const detail =
    e?.response?.data?.error || e?.response?.data?.message || e?.message || 'unknown';
  Alert.alert(`${label}失败`, `${detail}${status ? ` (HTTP ${status})` : ''}`);
}

export function PrivacySettings() {
  const user = useAuth((s) => s.user);
  const setUser = useAuth((s) => s.setUser);

  // Optimistic local state — invert hideFromNearby into "visible".
  const [nearbyVisible, setNearbyVisible] = useState(
    user ? !user.preferences?.hideFromNearby : true,
  );
  const [showDistance, setShowDistance] = useState(
    user ? !user.preferences?.hideDistance : true,
  );

  const flipNearby = async (v: boolean) => {
    setNearbyVisible(v);
    try {
      const updated = await setPrivacy({ nearbyVisible: v });
      setUser(updated);
    } catch (e) {
      setNearbyVisible(!v);
      reportFailure(e, '设置');
    }
  };
  const flipDistance = async (v: boolean) => {
    setShowDistance(v);
    try {
      const updated = await setPrivacy({ showDistance: v });
      setUser(updated);
    } catch (e) {
      setShowDistance(!v);
      reportFailure(e, '设置');
    }
  };

  return (
    <SettingsShell title="隐私">
      <SettingsCard flat style={{ paddingVertical: 4 }}>
        <ToggleRow
          label="在「附近」显示我"
          value={nearbyVisible}
          onValueChange={flipNearby}
          hint="关闭后,你不会出现在其他人的「附近」网格中"
        />
        <Divider />
        <ToggleRow
          label="显示我的距离"
          value={showDistance}
          onValueChange={flipDistance}
          hint="关闭后只显示城市,不显示距离公里数"
        />
      </SettingsCard>

      <SettingsCard flat style={{ paddingVertical: 4 }}>
        <LinkRow label="黑名单" />
      </SettingsCard>
    </SettingsShell>
  );
}
