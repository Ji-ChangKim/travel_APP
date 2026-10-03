import { defineConfig } from '@playwright/test';

// 실제 사용자 브라우저 프로필과 분리된 Chrome으로 웹 기능을 검증한다.
export default defineConfig({
  testDir: './tests/web',
  // 서버 앱 검증은 별도 테스트 공개 설정 번들을 사용한다.
  testIgnore: 'workspace.spec.ts',
  workers: 1,
  use: {
    channel: 'chrome',
    baseURL: 'http://127.0.0.1:8788',
    viewport: { width: 430, height: 932 },
  },
  webServer: {
    command: 'node scripts/preview-trail.mjs',
    url: 'http://127.0.0.1:8788/footprints',
    reuseExistingServer: false,
  },
});
