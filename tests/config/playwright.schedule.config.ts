import {
  repositoryRoot,
  repositoryPath,
} from '../../scripts/shared/repository-paths.cjs';
import { defineConfig } from '@playwright/test';

// 일정 검수는 실제 계정과 분리된 로컬 번들에서 수행한다.
export default defineConfig({
  testDir: repositoryPath('tests/web'),
  outputDir: repositoryPath('outputs/playwright/schedule'),
  testMatch: 'workspace.spec.ts',
  workers: 1,
  timeout: 90000,
  use: {
    channel: 'chrome',
    baseURL: 'http://127.0.0.1:8788',
    viewport: { width: 390, height: 844 },
  },
  webServer: {
    cwd: repositoryRoot,
    command: 'node scripts/qa/preview-trail.mjs',
    url: 'http://127.0.0.1:8788/login',
    reuseExistingServer: false,
    env: { TRIPPRINT_PREVIEW_DIR: 'apps/mobile/.release/schedule-ui-web' },
  },
});
