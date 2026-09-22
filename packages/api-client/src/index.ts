import type { Place } from '@wherego/domain';

// Hono API 엔드포인트 기본 주소를 정의한다.
const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || 'https://api.wherego.app';

// 외부 장소 검색 Hono API를 호출한다.
export async function searchPlaces(query: string): Promise<Place[]> {
  const response = await fetch(
    `${API_BASE_URL}/api/places/search?q=${encodeURIComponent(query)}`,
  );
  if (!response.ok) {
    throw new Error('장소 검색 중 오류가 발생했습니다.');
  }
  const data = (await response.json()) as { results: Place[] };
  return data.results;
}

// 여행 공유 링크 발급 Hono API를 호출한다.
export async function createShareLink(
  tripId: string,
): Promise<{ token: string; shareUrl: string }> {
  const response = await fetch(`${API_BASE_URL}/api/share/link`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tripId }),
  });
  if (!response.ok) {
    throw new Error('공유 링크 생성 중 오류가 발생했습니다.');
  }
  return response.json();
}

// 영수증 OCR 분석 Hono API를 호출한다.
export async function analyzeReceipt(imageUrl: string): Promise<{
  merchantName: string;
  transactionDate: string;
  totalAmount: number;
  extractedItems: string[];
}> {
  const response = await fetch(`${API_BASE_URL}/api/receipt/ocr`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageUrl }),
  });
  if (!response.ok) {
    throw new Error('영수증 분석 중 오류가 발생했습니다.');
  }
  return response.json();
}
