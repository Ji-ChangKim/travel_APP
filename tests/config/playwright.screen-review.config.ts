import {
  repositoryRoot,
  repositoryPath,
} from '../../scripts/shared/repository-paths.cjs';
import { defineConfig } from '@playwright/test';
import scheduleConfig from './playwright.schedule.config';

// 화면 피드백과 문서 정리 후 회귀의 검수는 이전 번들과 분리한다.
export default defineConfig({
  ...scheduleConfig,
  outputDir: repositoryPath('outputs/screen-review-playwright'),
  use: { ...scheduleConfig.use, baseURL: 'http://127.0.0.1:8804' },
  webServer: {
    cwd: repositoryRoot,
    command: 'node scripts/qa/preview-trail.mjs',
    url: 'http://127.0.0.1:8804/login',
    reuseExistingServer: false,
    env: {
      TRIPPRINT_PREVIEW_DIR: 'apps/mobile/.release/screen-review-web',
      TRIPPRINT_PREVIEW_PORT: '8804',
    },
  },
});
