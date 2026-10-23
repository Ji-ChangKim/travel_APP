import {
  repositoryRoot,
  repositoryPath,
} from '../../scripts/shared/repository-paths.cjs';
import { defineConfig } from '@playwright/test';
import scheduleConfig from './playwright.schedule.config';

// BI·로딩·인증 복귀 검수는 독립된 로컬 번들·포트·결과 폴더를 사용한다.
export default defineConfig({
  ...scheduleConfig,
  outputDir: repositoryPath('outputs/r13-playwright'),
  use: { ...scheduleConfig.use, baseURL: 'http://127.0.0.1:8803' },
  webServer: {
    cwd: repositoryRoot,
    command: 'node scripts/qa/preview-trail.mjs',
    url: 'http://127.0.0.1:8803/login',
    reuseExistingServer: false,
    env: {
      TRIPPRINT_PREVIEW_DIR: 'apps/mobile/.release/r13-ui-web',
      TRIPPRINT_PREVIEW_PORT: '8803',
    },
  },
});
