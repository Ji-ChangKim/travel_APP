import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { Buffer } from 'node:buffer';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

// 설정 값 대신 항목명만 반환하여 실패 로그에 키를 노출하지 않는다.
function issue(condition, name) {
  // 정상 항목은 오류 목록에 추가하지 않는다.
  return condition ? [] : [name];
}

// 배포 주소에는 HTTPS와 루트 origin만 허용한다.
function isOrigin(value) {
  // 파싱 실패도 잘못된 설정으로 판정한다.
  try {
    // 사용자 정보·query·fragment·하위 경로가 없는 실제 주소를 확인한다.
    return isDeployUrl(new URL(value)) && new URL(value).origin === value;
  } catch {
    // 입력 값을 오류 메시지에 포함하지 않는다.
    return false;
  }
}

// 로컬·예시·fixture 주소를 릴리스 대상으로 사용하지 않는다.
function isDeployUrl(url) {
  // 실제 연결 가능 여부는 배포 후 인수 검사에서 별도로 확인한다.
  return (
    url.protocol === 'https:' &&
    !url.username &&
    !url.password &&
    !/localhost|127\.0\.0\.1|\[::1\]|example\.|your_|fixture|wherego-test/i.test(
      url.hostname,
    )
  );
}

// 앱에 포함되는 키는 publishable 또는 기존 anon JWT로 제한한다.
function isPublicKey(value = '') {
  // 관리자 키와 테스트 키를 번들에 넣지 않는다.
  return (
    !/fixture|your_|example/i.test(value) &&
    (/^sb_publishable_[A-Za-z0-9_-]{20,}$/.test(value) || isAnonJwt(value))
  );
}

// 기존 Supabase 공개 JWT의 역할과 만료 시간을 확인한다.
function isAnonJwt(value) {
  // 이 검사는 서명이나 원격 프로젝트 존재 여부를 검증하지 않는다.
  try {
    // 서버 관리자 역할의 JWT를 공개 키로 사용할 수 없다.
    return (
      /^[\w-]+\.[\w-]+\.[\w-]+$/.test(value) &&
      JSON.parse(Buffer.from(value.split('.')[1], 'base64url')).role ===
        'anon' &&
      JSON.parse(Buffer.from(value.split('.')[1], 'base64url')).exp >
        Date.now() / 1000
    );
  } catch {
    // 잘못된 JWT는 공개 키로 인정하지 않는다.
    return false;
  }
}

// OAuth 복귀 주소와 초대 링크의 웹 기본 주소를 일치시킨다.
function isCallback(env) {
  // 현재 라우팅은 도메인 루트에 배포하는 구성을 사용한다.
  return (
    isOrigin(env.RELEASE_WEB_ORIGIN) &&
    env.EXPO_PUBLIC_AUTH_WEB_REDIRECT_URL ===
      `${env.RELEASE_WEB_ORIGIN}/auth/callback`
  );
}

// 로컬과 CI가 같은 환경 설정 계약을 검사한다.
export function getReleaseIssues(env) {
  // 앱과 Worker 설정은 검증한 동일 공개 값을 공유한다.
  return [
    ...issue(
      ['staging', 'production'].includes(env.RELEASE_ENV),
      'RELEASE_ENV: staging 또는 production 필요',
    ),
    ...issue(
      isOrigin(env.RELEASE_WEB_ORIGIN),
      'RELEASE_WEB_ORIGIN: HTTPS origin 필요',
    ),
    ...issue(
      isOrigin(env.EXPO_PUBLIC_API_URL),
      'EXPO_PUBLIC_API_URL: HTTPS origin 필요',
    ),
    ...issue(
      isOrigin(env.EXPO_PUBLIC_SUPABASE_URL),
      'EXPO_PUBLIC_SUPABASE_URL: HTTPS origin 필요',
    ),
    ...issue(
      isPublicKey(env.EXPO_PUBLIC_SUPABASE_ANON_KEY),
      'EXPO_PUBLIC_SUPABASE_ANON_KEY: 실제 공개 키 필요',
    ),
    ...issue(
      isCallback(env),
      'EXPO_PUBLIC_AUTH_WEB_REDIRECT_URL: 웹 origin의 /auth/callback 필요',
    ),
    ...issue(
      /^[a-z0-9][a-z0-9-]{0,57}[a-z0-9]$/.test(
        env.CLOUDFLARE_PAGES_PROJECT ?? '',
      ),
      'CLOUDFLARE_PAGES_PROJECT: Pages 프로젝트명 필요',
    ),
  ];
}

// 검증된 환경에 대응하는 Worker 설정만 생성한다.
export function workerConfig(env) {
  // 환경별 필수 secret을 포함한 원본 설정을 읽어 조합한다.
  return configureWorker(readWorkerTemplate(), env);
}

// JSONC 원본을 주석과 함께 파싱한다.
function readWorkerTemplate() {
  // 정규식으로 주석을 제거하여 URL을 손상시키지 않는다.
  return ts.parseConfigFileTextToJson(
    'wrangler.jsonc',
    readFileSync(
      new URL('../apps/api/wrangler.jsonc', import.meta.url),
      'utf8',
    ),
  ).config;
}

// 선택 환경의 필수 secret과 검증한 공개 값을 적용한다.
function configureWorker(template, env) {
  // 원본의 호환 날짜와 secret 선언을 재사용하여 설정 차이를 방지한다.
  return {
    ...template,
    $schema: '../node_modules/wrangler/config-schema.json',
    main: '../src/index.ts',
    name: `wherego-api-${env.RELEASE_ENV}`,
    env: undefined,
    secrets: template.env[env.RELEASE_ENV].secrets,
    vars: {
      SUPABASE_URL: env.EXPO_PUBLIC_SUPABASE_URL,
      SUPABASE_ANON_KEY: env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      ALLOWED_ORIGINS: env.RELEASE_WEB_ORIGIN,
    },
  };
}

// 릴리스 파일은 고정된 무시 디렉터리에만 기록한다.
function writeWorkerConfig(env) {
  // OCR 비밀 키나 Cloudflare 토큰은 출력 설정에 포함하지 않는다.
  return writeFileSync(
    new URL('../apps/api/.release/wrangler.json', import.meta.url),
    `${JSON.stringify(workerConfig(env), null, 2)}\n`,
  );
}

// 사전 검사 실패 시 다음 빌드·배포 명령을 실행하지 못하게 한다.
function validateRelease(env) {
  // 값은 숨기고 수정할 항목 이름만 표시한다.
  return getReleaseIssues(env).length
    ? Promise.reject(new Error(getReleaseIssues(env).join('\n')))
    : Promise.resolve();
}

// 배포 실행은 하지 않고 검증 및 선택적인 로컬 설정 생성만 수행한다.
async function main() {
  // 검사에 통과한 환경에 한해 파일 생성을 허용한다.
  await validateRelease(process.env);
  // 옵션이 없으면 읽기 전용 검사로 끝낸다.
  if (process.argv.includes('--write-worker')) {
    // 기존 소스 파일을 덮어쓰지 않는 출력 디렉터리를 준비한다.
    mkdirSync(new URL('../apps/api/.release/', import.meta.url), {
      recursive: true,
    });
    // 검증한 공개 값만 설정에 기록한다.
    writeWorkerConfig(process.env);
  }
  // 원격 인증·DB 준비 여부는 로컬 검사 성공으로 추정하지 않는다.
  console.info('배포 설정 검사 통과 (원격 서비스 인수 검사는 별도 필요)');
}

// 테스트 import 시에는 프로세스 환경을 검사하지 않는다.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  // 실패 코드를 유지하고 비밀 값을 출력하지 않는다.
  main().catch((error) => {
    // 설정 오류 항목만 표준 오류에 기록한다.
    console.error(error.message);
    // 잘못된 설정으로 후속 명령을 진행하지 않는다.
    process.exitCode = 1;
  });
}
