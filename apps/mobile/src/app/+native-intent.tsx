// 외부 초대·인증 링크를 Router에서 해석하기 전에 검사한다.
export function redirectSystemPath({
  path,
}: {
  path: string;
  initial: boolean;
}): string {
  // 과도한 크기와 잘못된 퍼센트 인코딩을 조기 차단한다.
  return path.length <= 16384 && isEncodedPath(path)
    ? shareDestination(path)
    : '/';
}

// OS 공유 인텐트만 전용 가져오기 페이지로 연결한다.
function shareDestination(path: string): string {
  // 인증·초대 원문은 변경하지 않는다.
  try {
    // 완전한 OS 공유 주소만 별도 화면으로 보낸다.
    return new URL(path).hostname === 'expo-sharing' ? '/import-place' : path;
  } catch {
    // 앱 내부 상대 경로는 기존 Router 해석을 유지한다.
    return path;
  }
}

// 잘못된 입력이 의존 라이브러리의 복잡한 복구 파싱에 도달하지 않게 한다.
function isEncodedPath(path: string): boolean {
  // 원문을 수정하거나 토큰을 디코딩한 결과로 치환하지 않는다.
  try {
    // 네이티브 표준 디코더로 형식만 확인한다.
    return typeof decodeURIComponent(path) === 'string';
  } catch {
    // 비정상 딥링크는 기본 화면으로 복귀시킨다.
    return false;
  }
}
