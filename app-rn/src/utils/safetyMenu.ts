import { ActionSheetIOS, Alert, Platform } from 'react-native';

import { blockUser } from '../api/safety';

// `nav` is structurally typed so we can accept either NavigationProp or the
// stricter NativeStackNavigationProp — both expose `navigate(name, params)`.
type AnyNav = {
  navigate: (name: string, params?: object) => void;
};

interface ShowOptions {
  userId: string;
  userName: string;
  nav: AnyNav;
  /** Optional action that runs after a successful block (e.g. close a sheet). */
  onBlocked?: () => void;
  /** Whether to include an Unmatch entry (Chat-detail context). */
  includeUnmatch?: boolean;
  onUnmatch?: () => void;
}

/**
 * Show the Block / Report (/ Unmatch) action sheet for a target user.
 * Routes Report to the ReportScreen; Block calls /api/users/:id/block with
 * a confirm dialog. Android falls back to a chained Alert.
 */
export function showSafetyMenu({
  userId,
  userName,
  nav,
  onBlocked,
  includeUnmatch,
  onUnmatch,
}: ShowOptions) {
  const labels: string[] = ['举报', '屏蔽 (Block)'];
  if (includeUnmatch) labels.push('解除匹配 (Unmatch)');
  labels.push('取消');
  const cancelIndex = labels.length - 1;
  const destructiveIndices = [1];
  if (includeUnmatch) destructiveIndices.push(2);

  const onSelect = (idx: number) => {
    if (idx === 0) {
      nav.navigate('Report', { userId, userName } as object);
      return;
    }
    if (idx === 1) {
      Alert.alert(
        `屏蔽 ${userName}?`,
        '你们彼此不再可见,聊天和匹配将被移除。',
        [
          { text: '取消', style: 'cancel' },
          {
            text: '屏蔽',
            style: 'destructive',
            onPress: async () => {
              try {
                await blockUser(userId);
                onBlocked?.();
              } catch (e: any) {
                const status = e?.response?.status;
                const detail =
                  e?.response?.data?.error ||
                  e?.response?.data?.message ||
                  e?.message ||
                  'unknown';
                Alert.alert(
                  '屏蔽失败',
                  `${detail}${status ? ` (HTTP ${status})` : ''}`,
                );
              }
            },
          },
        ],
      );
      return;
    }
    if (includeUnmatch && idx === 2) {
      Alert.alert(`解除与 ${userName} 的匹配?`, '聊天将被移除,无法恢复。', [
        { text: '取消', style: 'cancel' },
        { text: '解除', style: 'destructive', onPress: () => onUnmatch?.() },
      ]);
    }
  };

  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: labels,
        cancelButtonIndex: cancelIndex,
        destructiveButtonIndex: destructiveIndices,
        userInterfaceStyle: 'light',
      },
      onSelect,
    );
  } else {
    // Android fallback — present as a single Alert with N+1 buttons.
    const buttons = labels.slice(0, -1).map((label, i) => ({
      text: label,
      style: destructiveIndices.includes(i) ? ('destructive' as const) : undefined,
      onPress: () => onSelect(i),
    }));
    buttons.push({ text: '取消', style: undefined as any, onPress: () => {} });
    Alert.alert(userName, undefined, buttons);
  }
}
