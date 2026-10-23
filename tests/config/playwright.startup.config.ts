import {
  repositoryRoot,
  repositoryPath,
} from '../../scripts/shared/repository-paths.cjs';
import { defineConfig } from '@playwright/test';
import scheduleConfig from './playwright.schedule.config';

// 시작 점검 검수는 다른 작업의 번들·포트·결과와 분리한다.
export default defineConfig({
  ...scheduleConfig,
  outputDir: repositoryPath('outputs/r08-playwright'),
  use: { ...scheduleConfig.use, baseURL: 'http://127.0.0.1:8798' },
  webServer: {
    cwd: repositoryRoot,
    command: 'node scripts/qa/preview-trail.mjs',
    url: 'http://127.0.0.1:8798/login',
    reuseExistingServer: false,
    env: {
      TRIPPRINT_PREVIEW_DIR: 'apps/mobile/.release/r08-ui-web',
      TRIPPRINT_PREVIEW_PORT: '8798',
    },
  },
});
