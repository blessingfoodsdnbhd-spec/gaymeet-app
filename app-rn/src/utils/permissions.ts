import * as Location from 'expo-location';

export async function requestLocation(): Promise<'granted' | 'denied' | 'blocked'> {
  const { status, canAskAgain } = await Location.requestForegroundPermissionsAsync();
  if (status === 'granted') return 'granted';
  if (canAskAgain) return 'denied';
  return 'blocked';
}

export async function getCurrentLocation() {
  return Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
}
