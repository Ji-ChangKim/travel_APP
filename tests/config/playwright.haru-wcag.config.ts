import {
  repositoryRoot,
  repositoryPath,
} from '../../scripts/shared/repository-paths.cjs';
import { defineConfig } from '@playwright/test';
import scheduleConfig from './playwright.schedule.config';

// 같은 앱 번들의 접근성 검사만 별도 결과와 포트로 실행한다.
export default defineConfig({
  ...scheduleConfig,
  outputDir: repositoryPath('outputs/haru-wcag-aa/playwright'),
  use: { ...scheduleConfig.use, baseURL: 'http://127.0.0.1:8801' },
  webServer: {
    cwd: repositoryRoot,
    command: 'node scripts/qa/preview-trail.mjs',
    url: 'http://127.0.0.1:8801/login',
    reuseExistingServer: false,
    env: {
      TRIPPRINT_PREVIEW_DIR: 'apps/mobile/.release/haru-wcag-web',
      TRIPPRINT_PREVIEW_PORT: '8801',
    },
  },
});
