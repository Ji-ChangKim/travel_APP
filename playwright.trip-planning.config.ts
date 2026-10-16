import { defineConfig } from '@playwright/test';
import schedule from './playwright.schedule.config';

// 여행 생성 검수는 같은 프로젝트의 다른 검수 폴더·포트와 분리한다.
export default defineConfig({
  ...schedule,
  outputDir: '.release/trip-creation-v2-test-results',
  use: { ...schedule.use, baseURL: 'http://127.0.0.1:8792' },
  webServer: {
    command: 'node scripts/preview-trail.mjs',
    url: 'http://127.0.0.1:8792/login',
    reuseExistingServer: false,
    env: {
      TRIPPRINT_PREVIEW_DIR: 'apps/mobile/.release/trip-creation-v2-web',
      TRIPPRINT_PREVIEW_PORT: '8792',
    },
  },
});
