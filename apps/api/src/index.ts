import { createApp } from './app';
import { runAccountMaintenance } from './features/accounts/accountMaintenance';
import type {
  ExecutionContext,
  ScheduledController,
} from '@cloudflare/workers-types';
const app = createApp();
export default {
  fetch: app.fetch,
  scheduled(
    controller: ScheduledController,
    env: Env,
    context: ExecutionContext,
  ): void {
    context.waitUntil(runAccountMaintenance(env, controller.scheduledTime));
  },
};
