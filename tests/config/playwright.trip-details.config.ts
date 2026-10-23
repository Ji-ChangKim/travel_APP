import {
  repositoryRoot,
  repositoryPath,
} from '../../scripts/shared/repository-paths.cjs';
import { defineConfig } from '@playwright/test';
import scheduleConfig from './playwright.schedule.config';

// 여행 정보·기간 검수는 번들·포트·결과 폴더를 독립적으로 사용한다.
export default defineConfig({
  ...scheduleConfig,
  outputDir: repositoryPath('outputs/r07-playwright'),
  use: { ...scheduleConfig.use, baseURL: 'http://127.0.0.1:8797' },
  webServer: {
    cwd: repositoryRoot,
    command: 'node scripts/qa/preview-trail.mjs',
    url: 'http://127.0.0.1:8797/login',
    reuseExistingServer: false,
    env: {
      TRIPPRINT_PREVIEW_DIR: 'apps/mobile/.release/r07-ui-web',
      TRIPPRINT_PREVIEW_PORT: '8797',
    },
  },
});
