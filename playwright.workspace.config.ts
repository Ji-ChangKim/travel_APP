import { defineConfig } from '@playwright/test';
// 실제 소셜 계정과 분리된 HTTP fixture로 앱 전체 폼 흐름을 검증한다.
export default defineConfig({
  testDir: './tests/web',
  testMatch: 'workspace.spec.ts',
  workers: 1,
  timeout: 90000,
  use: {
    channel: 'chrome',
    baseURL: 'http://127.0.0.1:8788',
    viewport: { width: 430, height: 932 },
  },
  webServer: {
    command: 'node scripts/preview-trail.mjs',
    url: 'http://127.0.0.1:8788/login',
    reuseExistingServer: false,
  },
});
