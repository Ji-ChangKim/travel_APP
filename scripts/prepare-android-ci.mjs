import { appendFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const profile = JSON.parse(
  readFileSync(new URL('../apps/mobile/eas.json', import.meta.url), 'utf8'),
).build.preview.env;

// EAS와 독립된 Gradle 빌드에도 같은 공개 테스트 서버 주소를 사용한다.
export function androidCiVersion(env) {
  // 수동 버전 또는 기준값과 실행 번호의 합이 Play 정수 범위에 있는지 검증한다.
  return checkedVersion(
    env.REQUESTED_VERSION_CODE ||
      String(
        Number(env.ANDROID_VERSION_CODE_BASE || 1000) +
          Number(env.GITHUB_RUN_NUMBER),
      ),
  );
}

function checkedVersion(value) {
  // 소수·음수·문자·범위 초과를 거부하여 기존 Play 버전과 비교할 수 있게 한다.
  return /^[1-9]\d*$/.test(value) && Number(value) <= 2100000000
    ? Number(value)
    : invalidVersion();
}

function invalidVersion() {
  // 토큰이나 환경 변수 원문을 오류에 포함하지 않는다.
  throw new Error('Android versionCode는 1~2100000000 사이의 정수여야 합니다.');
}

export function androidCiEnvironment(env) {
  // 앱 번들에는 공개 설정과 버전만 전달한다.
  return {
    EXPO_PUBLIC_BACKEND: profile.EXPO_PUBLIC_BACKEND,
    EXPO_PUBLIC_API_URL: new URL(profile.EXPO_PUBLIC_API_URL).origin,
    EXPO_PUBLIC_AUTH_WEB_REDIRECT_URL:
      profile.EXPO_PUBLIC_AUTH_WEB_REDIRECT_URL,
    TRIPPRINT_ANDROID_VERSION_CODE: String(androidCiVersion(env)),
  };
}

function writeCiEnvironment(env) {
  // GitHub의 환경 전달 파일에 공개 빌드 설정을 저장한다.
  return appendFileSync(
    env.GITHUB_ENV,
    Object.entries(androidCiEnvironment(env))
      .map(([key, value]) => {
        // 공개 설정 한 항목을 GitHub 환경 파일의 한 줄로 변환한다.
        return `${key}=${value}\n`;
      })
      .join(''),
  );
}

function writeCiOutput(env) {
  // 실행 결과의 산출물 이름에 사용할 버전 코드를 공개 출력으로 전달한다.
  return appendFileSync(
    env.GITHUB_OUTPUT,
    `version_code=${androidCiVersion(env)}\n`,
  );
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  writeCiEnvironment(process.env);
  writeCiOutput(process.env);
}
