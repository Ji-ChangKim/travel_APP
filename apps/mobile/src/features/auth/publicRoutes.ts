// 기본 여행 입력과 스토어 계정 안내·외부 공유 상세만 비인증 상태에서 허용한다.
export function isPublicBrowsePath(path: string): boolean {
  // 기본 입력의 공개 여부와 서버 초안·여행 생성의 정식 회원 검사는 별개다.
  return (
    path === '/new-trip' ||
    path === '/account' ||
    /^\/community\/[0-9a-f-]{36}$/i.test(path)
  );
}
