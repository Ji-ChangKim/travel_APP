import { defineConfig } from '@playwright/test';
import scheduleConfig from './playwright.schedule.config';

// 하루 UI Kit 적용 검수는 별도 로컬 번들과 포트만 사용한다.
export default defineConfig({
  ...scheduleConfig,
  outputDir: 'outputs/haru-v3-app/playwright',
  use: { ...scheduleConfig.use, baseURL: 'http://127.0.0.1:8796' },
  webServer: {
    command: 'node scripts/preview-trail.mjs',
    url: 'http://127.0.0.1:8796/login',
    reuseExistingServer: false,
    env: {
      TRIPPRINT_PREVIEW_DIR: 'apps/mobile/.release/haru-v3-web',
      TRIPPRINT_PREVIEW_PORT: '8796',
    },
  },
});
