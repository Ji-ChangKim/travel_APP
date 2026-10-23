import { defineConfig } from '@playwright/test';
import {
  repositoryPath,
  repositoryRoot,
} from '../../scripts/shared/repository-paths.cjs';
import schedule from './playwright.schedule.config';

// 물리 해상도 1080×2340을 DPR 3으로 나눈 검수 가정이며 실기기 측정값은 아니다.
const portrait = { width: 360, height: 780 };
const landscape = { width: 780, height: 360 };
const coreFlows =
  /S24-|R07 |R09 |P0 공통 이탈|항공권 입력:|항공편 목록:|항공편 카드:|여행 생성:|일정 디자인:|내 여행 계획:|로그인 → 여행|저장 복구:|R10 |KF-0|FH-01|CP-0[1345]|기기 게스트|최초 로그인 선택/;

export default defineConfig({
  ...schedule,
  outputDir: repositoryPath('outputs/s24-20261023/playwright'),
  reporter: [
    ['list'],
    [
      'json',
      { outputFile: repositoryPath('outputs/s24-20261023/results.json') },
    ],
  ],
  use: {
    ...schedule.use,
    baseURL: 'http://127.0.0.1:8812',
    viewport: portrait,
    contextOptions: { screen: portrait },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    locale: 'ko-KR',
    userAgent:
      'Mozilla/5.0 (Linux; Android 14; SM-S921N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 's24-portrait', grep: coreFlows, metadata: { fontScale: 1 } },
    {
      name: 's24-portrait-200',
      grep: /S24-/,
      metadata: { fontScale: 2 },
    },
    {
      name: 's24-landscape',
      grep: /S24-/,
      metadata: { fontScale: 1 },
      use: { viewport: landscape, contextOptions: { screen: landscape } },
    },
  ],
  webServer: {
    cwd: repositoryRoot,
    command: 'node scripts/qa/preview-trail.mjs',
    reuseExistingServer: false,
    url: 'http://127.0.0.1:8812/login',
    env: {
      TRIPPRINT_PREVIEW_DIR: 'apps/mobile/.release/s24-web',
      TRIPPRINT_PREVIEW_PORT: '8812',
    },
  },
});
