import { defineConfig } from '@playwright/test';
import {
  repositoryRoot,
  repositoryPath,
} from '../../scripts/shared/repository-paths.cjs';

const port = process.env.TRIPPRINT_PREVIEW_PORT || '8788';

export default defineConfig({
  testDir: repositoryPath('tests/web'),
  testMatch: 'planning-pages.spec.ts',
  outputDir: repositoryPath('outputs/playwright/planning-pages'),
  workers: 1,
  timeout: 60000,
  use: {
    channel: 'chrome',
    baseURL: `http://127.0.0.1:${port}`,
    viewport: { width: 390, height: 844 },
  },
  webServer: {
    cwd: repositoryRoot,
    command: 'node scripts/qa/preview-trail.mjs',
    url: `http://127.0.0.1:${port}/login`,
    reuseExistingServer: false,
    env: {
      TRIPPRINT_PREVIEW_DIR: 'apps/mobile/.release/schedule-ui-web',
      TRIPPRINT_PREVIEW_PORT: port,
    },
  },
});
