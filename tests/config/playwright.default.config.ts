import { defineConfig } from '@playwright/test';
import { repositoryPath } from '../../scripts/shared/repository-paths.cjs';
import scheduleConfig from './playwright.schedule.config';

// 현재 유지하는 시나리오만 읽고 .release의 일회성 캡처는 검사에 포함하지 않는다.
export default defineConfig({
  ...scheduleConfig,
  outputDir: repositoryPath('outputs/playwright/default'),
});
