import { getMvpIssues } from './mvp-config.mjs';

// 계정이나 비밀 값 없이 APK에 포함될 공개 설정을 확인한다.
function check() {
  // 기존 개발·운영 프로필의 실행 조건을 이번 MVP 작업으로 바꾸지 않는다.
  if (
    process.argv.includes('--preview-only') &&
    process.env.EAS_BUILD_PROFILE !== 'preview'
  )
    return Promise.resolve('MVP 검사는 preview 프로필에만 적용합니다.');
  // EAS도 동일 검사를 수행하여 빈 로그인 화면 APK를 방지한다.
  return getMvpIssues(process.env).length
    ? Promise.reject(new Error(getMvpIssues(process.env).join('\n')))
    : Promise.resolve(
        'MVP 공개 설정 검사 통과. 실제 계정·서버 연결은 별도 확인해야 합니다.',
      );
}

// 성공 메시지는 원격 서비스 인수를 완료했다는 뜻이 아니다.
check()
  .then((message) => {
    // 검증한 값은 로그에 출력하지 않는다.
    console.info(message);
  })
  .catch((error) => {
    // 실패한 공개 설정의 항목명만 표시한다.
    console.error(error.message);
    // 잘못된 설정으로 APK 클라우드 빌드를 계속하지 않는다.
    process.exitCode = 1;
  });
