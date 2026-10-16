import { defineConfig } from '@playwright/test';
import scheduleConfig from './playwright.schedule.config';

// 여행 상세 네 화면의 검수는 기존 미리보기와 다른 번들·포트를 사용한다.
export default defineConfig({
  ...scheduleConfig,
  outputDir: 'outputs/haru-v3-detail/playwright',
  use: { ...scheduleConfig.use, baseURL: 'http://127.0.0.1:8798' },
  webServer: {
    command: 'node scripts/preview-trail.mjs',
    url: 'http://127.0.0.1:8798/login',
    reuseExistingServer: false,
    env: {
      TRIPPRINT_PREVIEW_DIR: 'apps/mobile/.release/haru-v3-detail-web',
      TRIPPRINT_PREVIEW_PORT: '8798',
    },
  },
});
