import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { AuthStackParamList } from './types';
import { WelcomeScreen } from '../screens/auth/WelcomeScreen';
import { EmailEntryScreen } from '../screens/auth/EmailEntryScreen';
import { OTPCodeScreen } from '../screens/auth/OTPCodeScreen';
import { InterestTagsPickerScreen } from '../screens/auth/InterestTagsPickerScreen';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthStack({ needsTags }: { needsTags: boolean }) {
  return (
    <Stack.Navigator
      initialRouteName={needsTags ? 'InterestTagsPicker' : 'Welcome'}
      screenOptions={{ headerShown: false, animation: 'slide_from_right' }}
    >
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="EmailEntry" component={EmailEntryScreen} />
      <Stack.Screen name="OTPCode" component={OTPCodeScreen} />
      <Stack.Screen
        name="InterestTagsPicker"
        component={InterestTagsPickerScreen}
        options={{ gestureEnabled: false }}
      />
    </Stack.Navigator>
  );
}
