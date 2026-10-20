// 요청 종류별 제한 시간을 유지하며 화면의 취소 신호와 별도로 관리한다.
export const requestPolicy = Object.freeze({
  defaultTimeoutMs: 15000,
  imageUploadTimeoutMs: 30000,
  receiptScanTimeoutMs: 75000,
});

// 서버의 60초 서명 URL보다 짧게 갱신하며 비활성 캐시는 제한한다.
export const signedPhotoPolicy = Object.freeze({
  staleTime: 30000,
  refetchInterval: 45000,
  gcTime: 60000,
});
