import { defineConfig } from '@playwright/test';
import scheduleConfig from './playwright.schedule.config';

// 헤더 검수는 다른 작업의 번들과 서버를 덮어쓰지 않는 포트를 사용한다.
export default defineConfig({
  ...scheduleConfig,
  timeout: 120000,
  outputDir: 'outputs/header-standard/playwright',
  use: {
    ...scheduleConfig.use,
    baseURL: 'http://127.0.0.1:8810',
    reducedMotion: 'reduce',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'node scripts/preview-trail.mjs',
    url: 'http://127.0.0.1:8810/login',
    reuseExistingServer: false,
    env: {
      TRIPPRINT_PREVIEW_DIR: 'apps/mobile/.release/header-standard-web',
      TRIPPRINT_PREVIEW_PORT: '8810',
    },
  },
});
