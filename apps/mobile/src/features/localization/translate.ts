import { getLanguage } from './localeState';
import { interpolate } from './localeModel';
import catalog from './messages.json';

// 앱이 소유한 고정 문구에만 명시적으로 호출한다. 사용자 기록에는 적용하지 않는다.
export function t(
  source: string,
  values?: Record<string, string | number>,
): string {
  const language = getLanguage();
  const entry = (catalog as Record<string, string[]>)[source];
  return interpolate(
    language === 'ko' || !entry
      ? source
      : (entry[language === 'en' ? 0 : 1] ?? source),
    values,
  );
}
