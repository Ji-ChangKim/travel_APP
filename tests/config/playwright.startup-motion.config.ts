import { defineConfig } from '@playwright/test';
import {
  repositoryRoot,
  repositoryPath,
} from '../../scripts/shared/repository-paths.cjs';

export default defineConfig({
  testDir: repositoryPath('tests/web'),
  testMatch: 'startup-motion.spec.ts',
  outputDir: repositoryPath('outputs/startup-motion-app/playwright'),
  workers: 1,
  timeout: 45000,
  use: {
    channel: 'chrome',
    baseURL: 'http://127.0.0.1:8872',
    viewport: { width: 390, height: 844 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    cwd: repositoryRoot,
    command: 'node scripts/qa/preview-trail.mjs',
    url: 'http://127.0.0.1:8872/welcome',
    reuseExistingServer: false,
    env: {
      TRIPPRINT_PREVIEW_DIR: 'apps/mobile/.release/startup-motion-web',
      TRIPPRINT_PREVIEW_PORT: '8872',
    },
  },
});
