import { useEffect, type ReactNode } from 'react';
import { Platform } from 'react-native';
import { restoreLanguage, useLocale } from './localeState';

// 언어 복원은 초기 화면 표시를 막지 않고 완료 시 문구만 즉시 갱신한다.
export default function LanguageProvider({
  children,
}: {
  children: ReactNode;
}) {
  const language = useLocale();
  useEffect(() => {
    void restoreLanguage();
  }, []);
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.documentElement.lang = language;
    }
  }, [language]);
  return children;
}
