import { designTokens } from '@/constants/theme';

// 저장된 날짜를 변환하지 않고 여행 기간의 구분 기호만 통일한다.
export function travelDateRange(startDate: string, endDate: string): string {
  // 모든 기간 표기는 같은 YYYY-MM-DD – YYYY-MM-DD 규칙을 따른다.
  return `${startDate}${designTokens.format.dateRangeSeparator}${endDate}`;
}
