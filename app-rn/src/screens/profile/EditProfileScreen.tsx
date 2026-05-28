import React from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

/**
 * Legacy redirect — all profile editing is now inline on ProfileScreen
 * (Me tab). This screen exists only so deep links / older callers that
 * still navigate to 'EditProfile' don't crash; on mount we route them
 * straight to the Me tab.
 *
 * Safe to delete after a couple of releases if no callers reappear.
 */
export function EditProfileScreen() {
  const nav = useNavigation<NativeStackNavigationProp<any>>();
  React.useEffect(() => {
    nav.replace('Main', { screen: 'Profile' });
  }, [nav]);
  return <View />;
}
