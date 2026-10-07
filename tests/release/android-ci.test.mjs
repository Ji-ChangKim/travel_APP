import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  androidCiEnvironment,
  androidCiVersion,
} from '../../scripts/prepare-android-ci.mjs';

test('직접 Android 빌드의 실행 번호와 수동 버전 코드를 계산한다', () => {
  // EAS 원격 버전 관리 없이 같은 실행의 APK·AAB가 동일한 정수 버전을 사용한다.
  assert.equal(androidCiVersion({ GITHUB_RUN_NUMBER: '23' }), 1023);
  assert.equal(
    androidCiVersion({
      ANDROID_VERSION_CODE_BASE: '5000',
      GITHUB_RUN_NUMBER: '23',
    }),
    5023,
  );
  assert.equal(
    androidCiVersion({ REQUESTED_VERSION_CODE: '2100000000' }),
    2100000000,
  );
});

for (const value of ['0', '-1', '1.5', 'abc', '2100000001', '1\nKEY=value']) {
  test(`Android 버전 범위와 환경 파일 주입을 거부한다: ${JSON.stringify(value)}`, () => {
    // 잘못된 수동 입력은 Gradle 설정이나 GitHub 환경 파일에 전달하지 않는다.
    return assert.throws(() => {
      // 검증 함수가 잘못된 버전 코드를 거부하는지 확인한다.
      return androidCiVersion({ REQUESTED_VERSION_CODE: value });
    }, /versionCode/);
  });
}

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
  assert.equal(env.TRIPPRINT_ANDROID_VERSION_CODE, '1005');
  assert.equal(new URL(env.EXPO_PUBLIC_API_URL).protocol, 'https:');
  assert.equal(
    new URL(env.EXPO_PUBLIC_AUTH_WEB_REDIRECT_URL).pathname,
    '/auth/callback',
  );
  assert.equal(JSON.stringify(env).includes('private-'), false);
});
