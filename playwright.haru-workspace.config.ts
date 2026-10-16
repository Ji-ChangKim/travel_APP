import { defineConfig } from '@playwright/test';
import scheduleConfig from './playwright.schedule.config';

// 새 목록 위계와 상세 리팩토링 검수를 기존 번들과 분리한다.
export default defineConfig({
  ...scheduleConfig,
  outputDir: 'outputs/haru-workspace/playwright',
  use: { ...scheduleConfig.use, baseURL: 'http://127.0.0.1:8800' },
  webServer: {
    command: 'node scripts/preview-trail.mjs',
    url: 'http://127.0.0.1:8800/login',
    reuseExistingServer: false,
    env: {
      TRIPPRINT_PREVIEW_DIR: 'apps/mobile/.release/haru-workspace-web',
      TRIPPRINT_PREVIEW_PORT: '8800',
    },
  },
});
