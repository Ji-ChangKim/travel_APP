import { getLanguage } from './localeState';
import { interpolate } from './localeModel';
import catalog from './messages.json';

const ENGLISH_SINGULAR_NOUNS: Record<string, string> = {
  items: 'item',
  schedules: 'schedule',
  activities: 'activity',
  days: 'day',
  nights: 'night',
  places: 'place',
  photos: 'photo',
  trips: 'trip',
  expenses: 'expense',
  companions: 'companion',
  footprints: 'footprint',
  characters: 'character',
  posts: 'post',
  records: 'record',
  receipts: 'receipt',
  cities: 'city',
  checklists: 'checklist',
  memos: 'memo',
};

const ENGLISH_PLURAL_PATTERN = new RegExp(
  `\\b1 ((?:saved |selected |personal |shared |actual )?)(${Object.keys(ENGLISH_SINGULAR_NOUNS).join('|')})\\b`,
  'g',
);

export function formatEnglishPlurals(text: string): string {
  return text.replace(
    ENGLISH_PLURAL_PATTERN,
    (_match, modifier: string, pluralNoun: string) =>
      `1 ${modifier}${ENGLISH_SINGULAR_NOUNS[pluralNoun] ?? pluralNoun}`,
  );
}

// 앱이 소유한 고정 문구에만 명시적으로 호출한다. 사용자 기록에는 적용하지 않는다.
export function t(
  source: string,
  values?: Record<string, string | number>,
): string {
  const language = getLanguage();
  const entry = (catalog as Record<string, string[]>)[source];
  const interpolated = interpolate(
    language === 'ko' || !entry
      ? source
      : (entry[language === 'en' ? 0 : 1] ?? source),
    values,
  );
  return language === 'en' ? formatEnglishPlurals(interpolated) : interpolated;
}
