import AsyncStorage from '@react-native-async-storage/async-storage';

export type CareMode = 'family' | 'professional';

const key = (uid: string) => `gabayra_care_mode_${uid}`;

export async function getCareMode(uid: string): Promise<CareMode> {
  const value = await AsyncStorage.getItem(key(uid));
  return value === 'professional' ? 'professional' : 'family';
}

export async function setCareMode(uid: string, mode: CareMode): Promise<void> {
  await AsyncStorage.setItem(key(uid), mode);
}
