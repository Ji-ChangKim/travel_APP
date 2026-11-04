import { defineConfig } from '@playwright/test';
import { repositoryPath } from '../../scripts/shared/repository-paths.cjs';

// 기기 기록도 실제 로컬 인증을 통과한 뒤 브라우저 저장소에서 다시 읽는다.
export default defineConfig({
  testDir: repositoryPath('tests/web'),
  testMatch: 'trail.spec.ts',
  globalSetup: '../planning/trailSetup.mjs',
  outputDir: repositoryPath('outputs/final-code-audit/trail-browser'),
  workers: 1,
  timeout: 90000,
  use: {
    channel: 'chrome',
    baseURL: 'http://127.0.0.1:8851',
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
    screenshot: 'only-on-failure',
  },
});
