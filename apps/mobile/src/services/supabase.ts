import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Expo SecureStore를 활용한 모바일 안전 세션 저장소 어댑터를 정의한다.
const ExpoSecureStoreAdapter = {
  // 저장된 키 값을 조회한다.
  getItem: (key: string) => {
    return Platform.OS === 'web'
      ? typeof localStorage !== 'undefined'
        ? localStorage.getItem(key)
        : null
      : SecureStore.getItemAsync(key);
  },
  // 키-값 쌍을 저장한다.
  setItem: (key: string, value: string) => {
    return Platform.OS === 'web'
      ? typeof localStorage !== 'undefined'
        ? localStorage.setItem(key, value)
        : undefined
      : SecureStore.setItemAsync(key, value);
  },
  // 저장된 항목을 삭제한다.
  removeItem: (key: string) => {
    return Platform.OS === 'web'
      ? typeof localStorage !== 'undefined'
        ? localStorage.removeItem(key)
        : undefined
      : SecureStore.deleteItemAsync(key);
  },
};

const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://sample-project.supabase.co';
const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'sample-anon-key';

// Supabase 클라이언트 인스턴스를 생성한다.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
