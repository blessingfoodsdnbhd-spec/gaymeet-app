import React, { useMemo, useState } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { useQuery } from '@tanstack/react-query';

import { getVersionConfig, type VersionGate } from '../api/config';
import { isOlder } from './versionCompare';
import { ForceUpdateModal, type GateMode } from './ForceUpdateModal';

/** The build's own marketing version, e.g. "3.1.16". */
function currentVersion(): string {
  return (
    Constants.expoConfig?.version ??
    Constants.nativeAppVersion ??
    '0.0.0'
  );
}

type Decision = { mode: GateMode; gate: VersionGate } | null;

/**
 * Decide the gate from the config + this build's version:
 *   current < minimum      → force  (un-dismissable)
 *   current < recommended  → soft   (dismissable nudge)
 *   else                   → no modal
 */
function decide(cfg: { ios: VersionGate; android: VersionGate }): Decision {
  const gate = Platform.OS === 'ios' ? cfg.ios : cfg.android;
  const v = currentVersion();
  if (isOlder(v, gate.minimum)) return { mode: 'force', gate };
  if (isOlder(v, gate.recommended)) return { mode: 'soft', gate };
  return null;
}

/**
 * Mounts once at the App root (alongside AnnouncementBootstrap). Polls the
 * public /config/version gate and shows the force/soft upgrade modal when this
 * build is too old. The query is NOT auth-gated — an ancient build should be
 * blocked even at the login screen.
 *
 * Renders nothing when no upgrade is due, so it's safe anywhere in the tree.
 */
export function VersionGateBootstrap() {
  const [softDismissed, setSoftDismissed] = useState(false);

  const q = useQuery({
    queryKey: ['config', 'version'],
    queryFn: getVersionConfig,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: true, // re-check when the app returns to foreground
    retry: 1,
  });

  const decision = useMemo<Decision>(
    () => (q.isSuccess && q.data ? decide(q.data) : null),
    [q.isSuccess, q.data],
  );

  if (!decision) return null;
  const visible = decision.mode === 'force' || !softDismissed;
  if (!visible) return null;

  return (
    <ForceUpdateModal
      visible={visible}
      mode={decision.mode}
      storeUrl={decision.gate.storeUrl}
      latestVersion={decision.gate.latest}
      message={decision.gate.message}
      onDismiss={decision.mode === 'soft' ? () => setSoftDismissed(true) : undefined}
    />
  );
}
