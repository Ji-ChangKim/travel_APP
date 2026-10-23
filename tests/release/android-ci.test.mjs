import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readAppVersion } from '../../scripts/shared/app-version.cjs';
import {
  androidCiEnvironment,
  androidCiVersion,
} from '../../scripts/android/prepare-android-ci.mjs';

test('GitHub 실행 번호나 과거 입력값이 ver.text의 버전을 덮어쓰지 않는다', () => {
  // 수동 빌드·CI 산출물·Expo 설정이 같은 파일 번호를 사용한다.
  assert.equal(
    androidCiVersion({
      GITHUB_RUN_NUMBER: '23',
      REQUESTED_VERSION_CODE: '9999',
    }),
    readAppVersion().versionCode,
  );
});

test('Gradle 빌드 환경에서 Expo 토큰과 업로드 서명 비밀을 제외한다', () => {
  // 환경에는 공개 주소와 버전만 포함되어 JS 번들에 서명 비밀이 섞이지 않는다.
  const env = androidCiEnvironment({
    GITHUB_RUN_NUMBER: '5',
    EXPO_TOKEN: 'private-expo-token',
    ANDROID_KEYSTORE_BASE64: 'private-keystore',
    ANDROID_KEYSTORE_PASSWORD: 'private-password',
    GOOGLE_PLAY_SERVICE_ACCOUNT_JSON: 'private-service-account',
  });
  assert.deepEqual(Object.keys(env).sort(), [
    'EXPO_PUBLIC_API_URL',
    'EXPO_PUBLIC_AUTH_WEB_REDIRECT_URL',
    'EXPO_PUBLIC_BACKEND',
    'TRIPPRINT_ANDROID_VERSION_CODE',
  ]);
  assert.equal(env.EXPO_PUBLIC_BACKEND, 'cloudflare');
  assert.equal(
    env.TRIPPRINT_ANDROID_VERSION_CODE,
    String(readAppVersion().versionCode),
  );
  assert.equal(new URL(env.EXPO_PUBLIC_API_URL).protocol, 'https:');
  assert.equal(
    new URL(env.EXPO_PUBLIC_AUTH_WEB_REDIRECT_URL).pathname,
    '/auth/callback',
  );
  assert.equal(JSON.stringify(env).includes('private-'), false);
});
