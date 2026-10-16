import { defineConfig } from '@playwright/test';
import scheduleConfig from './playwright.schedule.config';

// 탐색 구조와 주요 행동 위계의 검수는 이전 번들과 분리한다.
export default defineConfig({
  ...scheduleConfig,
  outputDir: 'outputs/haru-hierarchy/playwright',
  use: { ...scheduleConfig.use, baseURL: 'http://127.0.0.1:8799' },
  webServer: {
    command: 'node scripts/preview-trail.mjs',
    url: 'http://127.0.0.1:8799/login',
    reuseExistingServer: false,
    env: {
      TRIPPRINT_PREVIEW_DIR: 'apps/mobile/.release/haru-hierarchy-web',
      TRIPPRINT_PREVIEW_PORT: '8799',
    },
  },
});
