import { planningRuntime } from './runtime.mjs';

// 운영 계정 없이 빈 로컬 D1과 실제 인증 API를 준비하고 검사 뒤 종료한다.
export default async function setup() {
  const runtime = await planningRuntime();
  return async () => {
    runtime.server.kill();
    await runtime.mf.dispose();
  };
}
