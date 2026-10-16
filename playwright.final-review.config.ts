import { defineConfig } from '@playwright/test';
import schedule from './playwright.schedule.config';

// 최종 후보는 다른 작업의 번들·서버·결과 폴더와 분리해 검수한다.
export default defineConfig({
  ...schedule,
  outputDir: '.release/final-review-test-results',
  use: { ...schedule.use, baseURL: 'http://127.0.0.1:8794' },
  webServer: {
    command: 'node scripts/preview-trail.mjs',
    url: 'http://127.0.0.1:8794/login',
    reuseExistingServer: false,
    env: {
      TRIPPRINT_PREVIEW_DIR: 'apps/mobile/.release/final-review-web',
      TRIPPRINT_PREVIEW_PORT: '8794',
    },
  },
});
