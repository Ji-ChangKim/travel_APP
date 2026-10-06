import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  releasePages,
  hasReleaseRewrites,
  hasUnsafeReleaseValues,
} from '../../scripts/release-artifact-checks.mjs';

test('가져오기와 발자국 직접 접근 HTML을 필수 산출물로 검사', () => {
  // 새 화면이 빠진 과거 웹 빌드를 공개하지 않도록 한다.
  return assert.ok(
    releasePages.includes('diary/[id].html') &&
      releasePages.includes('import-place.html'),
  );
});

test('여행과 다이어리 모두 URL 유지 rewrite 필요', () => {
  // Windows와 CI의 줄바꿈 차이는 허용한다.
  return assert.equal(
    hasReleaseRewrites(
      '/trips/* /trips/[id] 200\r\n/diary/* /diary/[id] 200\r\n',
    ),
    true,
  );
});

test('다이어리 rewrite 누락과 외부 이동을 거부', () => {
  // 조회 가능한 로컬 화면만으로 실제 호스팅 경로를 판단하지 않는다.
  return assert.ok(
    [
      '/trips/* /trips/[id] 200',
      '/trips/* /trips/[id] 200\n/diary/* /diary/[id].html 302',
    ].every((content) => {
      // 일부 화면만 연결된 빌드는 준비 완료가 아니다.
      return !hasReleaseRewrites(content);
    }),
  );
});

test('테스트 인증 설정과 서버 비밀 키를 배포 청크에서 거부', () => {
  // 공개 키가 필요한 앱에 서버 키나 fixture를 넣지 않는다.
  return assert.ok(
    [
      'https://wherego-test.supabase.co',
      'sb_publishable_fixture',
      'sb_secret_test_only',
    ].every(hasUnsafeReleaseValues),
  );
});

test('일반 공개 설정은 산출물 검사에서 허용', () => {
  // 원격 프로젝트 존재와 실제 인증은 별도 인수에서 확인한다.
  return assert.equal(
    hasUnsafeReleaseValues('https://wherego-staging.pages.dev'),
    false,
  );
});
