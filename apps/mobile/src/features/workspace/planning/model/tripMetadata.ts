import { countryDefaults } from './countries';

// 국가가 바뀔 때만 해당 폼에서 수정할 수 있는 여행지 필드를 초기화한다.
export function countryChangeValues(
  kind: string,
  previous: string | undefined,
  next: string,
): Record<string, string> {
  // 정보 수정은 도시만 비우고 생성 화면의 통화·시간대 기본값 정책은 유지한다.
  return previous === next
    ? {}
    : kind === 'trip'
      ? countryDefaults(next)
      : kind === 'metadata'
        ? { city: '' }
        : {};
}
