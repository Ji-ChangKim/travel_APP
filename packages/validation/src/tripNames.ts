// 자동 제안 이름만 길이를 제한하며 사용자가 쓴 이름은 저장 검증에서 확인한다.
export function suggestedTripTitle(value: string): string {
  return Array.from(value.trim().normalize('NFC')).slice(0, 60).join('');
}
