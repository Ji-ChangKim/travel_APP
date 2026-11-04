export const languages = ['ko', 'en', 'ja'] as const;
export type AppLanguage = (typeof languages)[number];
export const languageLocales: Record<AppLanguage, string> = {
  ko: 'ko-KR',
  en: 'en-US',
  ja: 'ja-JP',
};
export const languageNames: Record<AppLanguage, string> = {
  ko: '한국어 · KR',
  en: 'English · EN',
  ja: '日本語 · JP',
};

// 국가 표시와 구분되는 언어 코드만 저장하며 손상된 값은 한국어로 복구한다.
export function readLanguage(value: unknown): AppLanguage {
  return languages.includes(value as AppLanguage)
    ? (value as AppLanguage)
    : 'ko';
}

// 번역 템플릿의 명시한 변수만 넣고 사용자 입력 자체는 번역하지 않는다.
export function interpolate(
  text: string,
  values: Record<string, string | number> = {},
): string {
  return text.replace(/\{(\w+)\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(values, key)
      ? String(values[key])
      : match,
  );
}
