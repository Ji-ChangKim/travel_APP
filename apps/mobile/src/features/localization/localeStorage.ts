import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type { AppLanguage } from './localeModel';

const storageKey = 'tripprint.language.v1';

// 번역과 날짜 표현은 기기 저장소 없이도 검사할 수 있도록 입출력을 분리한다.
export async function readStoredLanguage(): Promise<string | null> {
  return Platform.OS === 'web'
    ? localStorage.getItem(storageKey)
    : SecureStore.getItemAsync(storageKey);
}

export async function writeStoredLanguage(
  language: AppLanguage,
): Promise<void> {
  if (Platform.OS === 'web') localStorage.setItem(storageKey, language);
  else await SecureStore.setItemAsync(storageKey, language);
}
