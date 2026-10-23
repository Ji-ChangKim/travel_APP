import {
  repositoryRoot,
  repositoryPath,
} from '../../scripts/shared/repository-paths.cjs';
import { defineConfig } from '@playwright/test';
import scheduleConfig from './playwright.schedule.config';

// 네 화면의 UI Kit 검수는 기존 미리보기와 분리한 번들·포트에서 실행한다.
export default defineConfig({
  ...scheduleConfig,
  outputDir: repositoryPath('outputs/haru-v3-more/playwright'),
  use: { ...scheduleConfig.use, baseURL: 'http://127.0.0.1:8797' },
  webServer: {
    cwd: repositoryRoot,
    command: 'node scripts/qa/preview-trail.mjs',
    url: 'http://127.0.0.1:8797/login',
    reuseExistingServer: false,
    env: {
      TRIPPRINT_PREVIEW_DIR: 'apps/mobile/.release/haru-v3-more-web',
      TRIPPRINT_PREVIEW_PORT: '8797',
    },
  },
});
