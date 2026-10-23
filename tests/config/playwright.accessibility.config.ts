import {
  repositoryRoot,
  repositoryPath,
} from '../../scripts/shared/repository-paths.cjs';
import { defineConfig } from '@playwright/test';
import scheduleConfig from './playwright.schedule.config';

// 공통 전환·접근성 검수는 독립된 로컬 번들·포트·결과 폴더를 사용한다.
export default defineConfig({
  ...scheduleConfig,
  outputDir: repositoryPath('outputs/r12-playwright'),
  use: { ...scheduleConfig.use, baseURL: 'http://127.0.0.1:8802' },
  webServer: {
    cwd: repositoryRoot,
    command: 'node scripts/qa/preview-trail.mjs',
    url: 'http://127.0.0.1:8802/login',
    reuseExistingServer: false,
    env: {
      TRIPPRINT_PREVIEW_DIR: 'apps/mobile/.release/r12-ui-web',
      TRIPPRINT_PREVIEW_PORT: '8802',
    },
  },
});
