type FontLanguage = 'ko' | 'en' | 'ja';

// 공통 역할 이름은 유지하면서 선택 언어의 LINE Seed 파일로 연결한다.
export function appFontFamily(
  font: string,
  platform: string,
  language: FontLanguage = 'ko',
): string {
  if (
    !['TripPrintRegular', 'TripPrintSemibold', 'TripPrintBold'].includes(font)
  )
    return font;
  const suffix = language === 'ja' ? 'JP' : language === 'en' ? 'EN' : '';
  const primary = `${font}${suffix}`;
  // 웹의 혼합 언어 원문도 같은 계열로 표시한다. 네이티브의 누락 글자는 OS가 보완한다.
  return platform === 'web'
    ? [
        ...new Set([primary, font, `${font}JP`, `${font}EN`]),
        'sans-serif',
      ].join(', ')
    : primary;
}
