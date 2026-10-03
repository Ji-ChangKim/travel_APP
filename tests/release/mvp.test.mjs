import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { getMvpIssues } from '../../scripts/mvp-config.mjs';

const publicSettings = {
  EXPO_PUBLIC_SUPABASE_URL: 'https://abcdefghijk.supabase.co',
  EXPO_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_abcdefghijklmnopqrstuvwxyz',
  EXPO_PUBLIC_API_URL: 'https://travel-stage.workers.dev',
  EXPO_PUBLIC_AUTH_WEB_REDIRECT_URL:
    'https://travel-stage.pages.dev/auth/callback',
};

// 실제 EAS hook 진입점을 실행하여 프로필 조건을 확인한다.
function runHook(profile, settings) {
  // 테스트에 실제 계정·키·원격 요청은 사용하지 않는다.
  return spawnSync(
    process.execPath,
    [
      fileURLToPath(
        new URL('../../scripts/check-mvp-build.mjs', import.meta.url),
      ),
      '--preview-only',
    ],
    {
      encoding: 'utf8',
      env: {
        ...process.env,
        EXPO_PUBLIC_SUPABASE_URL: '',
        EXPO_PUBLIC_SUPABASE_ANON_KEY: '',
        EXPO_PUBLIC_API_URL: '',
        EXPO_PUBLIC_AUTH_WEB_REDIRECT_URL: '',
        ...settings,
        EAS_BUILD_PROFILE: profile,
      },
    },
  );
}

test('기존 development 프로필에는 새 MVP 공개 설정 조건을 적용하지 않는다', () => {
  // 개발 서버를 사용하는 기존 작업을 새 조건으로 차단하지 않는다.
  assert.equal(runHook('development', {}).status, 0);
});

test('preview의 빈 설정은 EAS hook에서 비정상 종료', () => {
  // 실제 APK 생성 전에 설정 오류가 반드시 실패 코드로 전달된다.
  assert.equal(runHook('preview', {}).status, 1);
  // 모바일 템플릿에 없는 릴리스 환경 이름을 요구하지 않는다.
  assert.ok(!runHook('preview', {}).stderr.includes('RELEASE_WEB_ORIGIN'));
});

test('preview의 공개 설정이 맞으면 EAS hook 통과', () => {
  // 형태 검사를 실제 계정 연결 인수로 혼동하지 않는다.
  assert.equal(runHook('preview', publicSettings).status, 0);
});

test('APK 검사는 공개 값 4개로 통과하고 OCR·스토어·Pages 계정 값을 요구하지 않음', () => {
  // EAS 로그인 여부와 공개 설정 검사는 서로 다른 단계다.
  assert.deepEqual(getMvpIssues(publicSettings), []);
});

test('빈 설정과 휴대폰 localhost 및 테스트 키 거부', () => {
  // 설정 없이 기능 테스트 APK 준비 완료로 판단하지 않는다.
  assert.ok(getMvpIssues({}).length);
  // 휴대폰은 PC localhost에 연결할 수 없다.
  assert.ok(
    getMvpIssues({
      ...publicSettings,
      EXPO_PUBLIC_API_URL: 'http://localhost:8787',
    }).length,
  );
  // 브라우저 fixture 키를 설치 앱에 포함하지 않는다.
  assert.ok(
    getMvpIssues({
      ...publicSettings,
      EXPO_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_fixture',
    }).length,
  );
});
