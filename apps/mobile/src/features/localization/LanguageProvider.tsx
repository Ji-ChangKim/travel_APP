import { useEffect, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import { restoreLanguage, useLocale } from './localeState';

// 언어 복원은 최초 표시 전에 한 번만 기다리며 변경 시 자식 화면을 보존한다.
export default function LanguageProvider({
  children,
}: {
  children: ReactNode;
}) {
  const language = useLocale();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    void restoreLanguage().then(() => setReady(true));
  }, []);
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.documentElement.lang = language;
    }
  }, [language]);
  return ready ? children : null;
}
