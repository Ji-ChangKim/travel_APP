import type {
  D1Database as RuntimeDatabase,
  D1PreparedStatement as RuntimeStatement,
  R2Bucket as RuntimeBucket,
  Ai as RuntimeAi,
} from '@cloudflare/workers-types';

// Wrangler가 생성한 바인딩 이름에 실제 Workers 런타임 타입만 연결한다.
declare global {
  type D1Database = RuntimeDatabase;
  type D1PreparedStatement = RuntimeStatement;
  type R2Bucket = RuntimeBucket;
  type Ai = RuntimeAi;
}
