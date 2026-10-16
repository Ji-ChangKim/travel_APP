import { defineConfig } from '@playwright/test';
import schedule from './playwright.schedule.config';

// 고객 흐름 검수는 병행 헤더 작업의 서버·번들·결과를 공유하지 않는다.
export default defineConfig({
  ...schedule,
  outputDir: 'outputs/customer-server-review/playwright',
  reporter: [
    ['list'],
    ['json', { outputFile: 'outputs/customer-server-review/results.json' }],
  ],
  use: {
    ...schedule.use,
    baseURL: 'http://127.0.0.1:8794',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'node scripts/preview-trail.mjs',
    url: 'http://127.0.0.1:8794/login',
    reuseExistingServer: false,
    env: {
      TRIPPRINT_PREVIEW_DIR: 'apps/mobile/.release/customer-server-review-web',
      TRIPPRINT_PREVIEW_PORT: '8794',
    },
  },
});
