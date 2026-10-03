import { readFileSync, readdirSync } from 'node:fs';

// 정적 내보내기의 진입 화면을 확인한다.
function verifyPage(path) {
  // 페이지가 없으면 배포 전에 종료한다.
  return readFileSync(new URL(`../apps/mobile/dist/${path}`, import.meta.url));
}

// 테스트 설정과 서버 키가 정적 청크에 포함되는 것을 차단한다.
function verifyBundle(path) {
  // 발견한 값은 오류 로그에 출력하지 않는다.
  return /wherego-test\.supabase\.co|sb_publishable_fixture|sb_secret_[A-Za-z0-9_-]+/.test(
    readFileSync(path, 'utf8'),
  )
    ? Promise.reject(new Error('릴리스 번들에 테스트 설정 또는 서버 키 포함'))
    : Promise.resolve();
}

// 내보내기 디렉터리의 JavaScript 파일만 검사한다.
function verifyDirectory(path) {
  // 고정 출력 디렉터리 안에서 모든 청크를 확인한다.
  return Promise.all(
    readdirSync(path, { withFileTypes: true }).map((entry) => {
      // 하위 디렉터리도 검사하여 청크 누락을 막는다.
      return entry.isDirectory()
        ? verifyDirectory(new URL(`${entry.name}/`, path))
        : entry.name.endsWith('.js')
          ? verifyBundle(new URL(entry.name, path))
          : Promise.resolve();
    }),
  );
}

// 여행 UUID 주소를 외부 이동 없이 내부 템플릿에 연결한다.
function verifyRewrite() {
  // .html 목적지가 일으키는 경로 이동을 허용하지 않는다.
  return /^\/trips\/\* \/trips\/\[id\] 200$/m.test(
    verifyPage('_redirects').toString(),
  )
    ? Promise.resolve()
    : Promise.reject(new Error('여행 상세 rewrite 누락 또는 잘못된 목적지'));
}

// 원격 서비스 검증과 구분하여 정적 산출물만 확인한다.
await Promise.all([
  ...[
    'index.html',
    'login.html',
    'invite.html',
    'auth/callback.html',
    'community.html',
    'trips/[id].html',
  ].map(verifyPage),
  verifyRewrite(),
  verifyDirectory(new URL('../apps/mobile/dist/', import.meta.url)),
]);
console.info('웹 진입 화면·여행 rewrite·테스트 설정 미포함 검사 통과');
