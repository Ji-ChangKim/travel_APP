import {
  repositoryRoot,
  repositoryPath,
} from '../../scripts/shared/repository-paths.cjs';
import { defineConfig } from '@playwright/test';
import scheduleConfig from './playwright.schedule.config';

// 다른 화면의 검수 서버와 분리해 시작 화면의 실제 번들을 확인한다.
export default defineConfig({
  ...scheduleConfig,
  grep: /간단 시작 화면:|인트로:|R13 로딩 오류|목적 로그인은|R06 .*직접 링크|초대 링크를 로그인 과정/,
  outputDir: repositoryPath('outputs/welcome-simple/playwright'),
  use: {
    ...scheduleConfig.use,
    baseURL: 'http://127.0.0.1:8864',
    reducedMotion: 'reduce',
    screenshot: 'only-on-failure',
  },
  webServer: {
    cwd: repositoryRoot,
    command: 'node scripts/qa/preview-trail.mjs',
    url: 'http://127.0.0.1:8864/welcome',
    reuseExistingServer: false,
    env: {
      TRIPPRINT_PREVIEW_DIR: 'apps/mobile/.release/welcome-web',
      TRIPPRINT_PREVIEW_PORT: '8864',
    },
  },
});
