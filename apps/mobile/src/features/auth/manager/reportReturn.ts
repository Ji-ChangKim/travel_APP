import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type { z } from 'zod';
import {
  reportReturnSchema as schema,
  validReportReturn,
} from '../model/reportReturn';
const key = 'tripprint.auth.report-return';
let pending: Promise<unknown> = Promise.resolve();
function serialize<T>(action: () => Promise<T>): Promise<T> {
  const next = pending.then(action);
  pending = next.catch(() => undefined);
  return next;
}
async function read(): Promise<string | null> {
  return Platform.OS === 'web'
    ? sessionStorage.getItem(key)
    : SecureStore.getItemAsync(key);
}
async function write(text: string | null): Promise<void> {
  if (Platform.OS === 'web') {
    if (text === null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, text);
  } else if (text === null) await SecureStore.deleteItemAsync(key);
  else await SecureStore.setItemAsync(key, text);
}
// 신고 본문은 URL·분석 로그 대신 같은 기기의 임시 보호 저장소에만 둔다.
export function saveReportReturn(
  input: Omit<z.infer<typeof schema>, 'createdAt'>,
): Promise<void> {
  const text = JSON.stringify(
    schema.parse({ ...input, createdAt: Date.now() }),
  );
  return serialize(() => write(text));
}
export function readReportReturn(account: string, postId: string) {
  return serialize(async () => {
    const text = await read();
    const value = text ? validReportReturn(text, account, postId) : null;
    if (text && !value) await write(null);
    return value;
  });
}
// 이전 복원 처리가 새 초안을 지우지 않게 같은 큐에서 비교한 뒤 정리한다.
export function clearReportReturn(
  value: z.infer<typeof schema>,
): Promise<void> {
  return serialize(async () => {
    const text = await read();
    if (!text) return;
    let current: unknown;
    try {
      current = JSON.parse(text);
    } catch {
      return;
    }
    const parsed = schema.safeParse(current);
    if (
      !parsed.success ||
      parsed.data.createdAt !== value.createdAt ||
      parsed.data.postId !== value.postId ||
      parsed.data.originId !== value.originId
    )
      return;
    await write(null);
  });
}
