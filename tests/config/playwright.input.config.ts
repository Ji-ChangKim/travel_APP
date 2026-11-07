import { defineConfig } from '@playwright/test';
import { repositoryPath } from '../../scripts/shared/repository-paths.cjs';
import headerConfig from './playwright.header.config';

export default defineConfig({
  ...headerConfig,
  testMatch: ['workspace.spec.ts', 'android-input.spec.ts'],
  grep: /입력 정책 검수/,
  outputDir: repositoryPath('outputs/input-policy/playwright'),
  use: { ...headerConfig.use, baseURL: 'http://127.0.0.1:8814' },
  webServer: {
    ...headerConfig.webServer,
    command: 'node scripts/qa/preview-trail.mjs',
    url: 'http://127.0.0.1:8814/login',
    env: {
      TRIPPRINT_PREVIEW_DIR: 'apps/mobile/.release/input-policy-web',
      TRIPPRINT_PREVIEW_PORT: '8814',
    },
  },
});
