import { appendFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readAppVersion } from '../shared/app-version.cjs';

const profile = JSON.parse(
  readFileSync(new URL('../../apps/mobile/eas.json', import.meta.url), 'utf8'),
).build.preview.env;

// GitHub 빌드도 수동 빌드와 같은 파일의 버전 번호를 사용한다.
export function androidCiVersion() {
  // 실행 번호나 환경 변수로 파일의 번호를 덮어쓰지 않는다.
  return readAppVersion().versionCode;
}

export function androidCiEnvironment() {
  // 앱 번들에는 공개 설정과 버전만 전달한다.
  return {
    EXPO_PUBLIC_BACKEND: profile.EXPO_PUBLIC_BACKEND,
    EXPO_PUBLIC_API_URL: new URL(profile.EXPO_PUBLIC_API_URL).origin,
    EXPO_PUBLIC_AUTH_WEB_REDIRECT_URL:
      profile.EXPO_PUBLIC_AUTH_WEB_REDIRECT_URL,
    TRIPPRINT_ANDROID_VERSION_CODE: String(androidCiVersion()),
  };
}

function writeCiEnvironment(env) {
  // GitHub의 환경 전달 파일에 공개 빌드 설정을 저장한다.
  return appendFileSync(
    env.GITHUB_ENV,
    Object.entries(androidCiEnvironment())
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
    `version_code=${androidCiVersion()}\n`,
  );
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  writeCiEnvironment(process.env);
  writeCiOutput(process.env);
}
