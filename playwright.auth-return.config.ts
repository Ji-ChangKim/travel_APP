import { defineConfig } from '@playwright/test';
import scheduleConfig from './playwright.schedule.config';

// 인증 복귀 검증용 번들은 다른 화면 검수 산출물과 분리한다.
export default defineConfig({
  ...scheduleConfig,
  outputDir: 'outputs/r06-playwright',
  use: { ...scheduleConfig.use, baseURL: 'http://127.0.0.1:8796' },
  webServer: {
    command: 'node scripts/preview-trail.mjs',
    url: 'http://127.0.0.1:8796/login',
    reuseExistingServer: false,
    env: {
      TRIPPRINT_PREVIEW_DIR: 'apps/mobile/.release/r06-ui-web',
      TRIPPRINT_PREVIEW_PORT: '8796',
    },
  },
});
