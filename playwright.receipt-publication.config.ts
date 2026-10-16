import { defineConfig } from '@playwright/test';
import scheduleConfig from './playwright.schedule.config';

// 영수증·공개 검수는 독립된 로컬 번들·포트·결과 폴더를 사용한다.
export default defineConfig({
  ...scheduleConfig,
  outputDir: 'outputs/r10-playwright',
  use: { ...scheduleConfig.use, baseURL: 'http://127.0.0.1:8800' },
  webServer: {
    command: 'node scripts/preview-trail.mjs',
    url: 'http://127.0.0.1:8800/login',
    reuseExistingServer: false,
    env: {
      TRIPPRINT_PREVIEW_DIR: 'apps/mobile/.release/r10-ui-web',
      TRIPPRINT_PREVIEW_PORT: '8800',
    },
  },
});
