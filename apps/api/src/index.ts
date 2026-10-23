import { createApp } from './app';
import { purgeRetiredAccounts } from './features/accounts/accountRetirement';
import type {
  ExecutionContext,
  ScheduledController,
} from '@cloudflare/workers-types';

const app = createApp();

// 실제 API와 90일 유예 종료 처리를 같은 Worker 수명으로 제공한다.
export default {
  fetch: app.fetch,
  scheduled(
    controller: ScheduledController,
    env: Env,
    context: ExecutionContext,
  ): void {
    // 만료 시각이 지난 계정만 정리하며 여행 원본과 소유권은 보존한다.
    return context.waitUntil(
      purgeRetiredAccounts(env, controller.scheduledTime),
    );
  },
};
