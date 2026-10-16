import { defineConfig } from '@playwright/test';
import schedule from './playwright.schedule.config';

// 계획 공유 검수는 다른 화면 작업의 서버와 번들을 공유하지 않는다.
export default defineConfig({
  ...schedule,
  outputDir: 'outputs/community-osaka/playwright',
  reporter: [
    ['list'],
    ['json', { outputFile: 'outputs/community-osaka/ui-results.json' }],
  ],
  use: {
    ...schedule.use,
    baseURL: 'http://127.0.0.1:8818',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'node scripts/preview-trail.mjs',
    url: 'http://127.0.0.1:8818/community',
    reuseExistingServer: false,
    env: {
      TRIPPRINT_PREVIEW_DIR: 'apps/mobile/.release/community-plan-test-web',
      TRIPPRINT_PREVIEW_PORT: '8818',
    },
  },
});
