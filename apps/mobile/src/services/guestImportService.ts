import { Platform } from 'react-native';
import { File } from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { z } from 'zod';
import { requestFoundation } from '@wherego/api-client';
import { serverOptions } from '@/features/workspace/shared/manager/service';
import { useTripStore } from '@/stores/useTripStore';
import { loadStoredGuestSession } from './guestAuthService';
import { readGuestWorkspace, guestFileUri } from './guestWorkspaceStorage';
import type { GuestWorkspace } from './guestWorkspaceModel';
import type { WorkspaceSnapshot } from '@wherego/domain';

const importSchema = z.object({
  operationId: z.string().uuid(),
  state: z.enum(['pending', 'confirmed']),
  localTripId: z.string().uuid(),
  serverTripId: z.string().uuid(),
  missingMediaIds: z.array(z.string()),
  media: z.array(
    z.object({
      localId: z.string(),
      localPath: z.string(),
      serverId: z.string(),
      path: z.string().nullable(),
    }),
  ),
  idMap: z.record(z.string()),
});
const linkKey = (account: string, trip: string) =>
  `tripprint.link.${account}.${trip}`;
async function readKey(key: string) {
  return Platform.OS === 'web'
    ? localStorage.getItem(key)
    : SecureStore.getItemAsync(key);
}
async function writeKey(key: string, value: string) {
  if (Platform.OS === 'web') localStorage.setItem(key, value);
  else await SecureStore.setItemAsync(key, value);
}

export async function localGuestTrips() {
  const guest = await loadStoredGuestSession(false);
  return guest ? { guest, document: await readGuestWorkspace(guest.id) } : null;
}

export async function linkedGuestTrip(account: string, tripId: string) {
  const text = await readKey(linkKey(account, tripId));
  if (!text) return null;
  try {
    return (
      z
        .object({
          operationId: z.string().uuid(),
          serverTripId: z.string().uuid().optional(),
        })
        .parse(JSON.parse(text)).serverTripId ?? null
    );
  } catch {
    return null;
  }
}
export async function linkedGuestTarget(
  account: string,
  tripId: string,
  target: string | undefined,
) {
  if (!target) return undefined;
  const text = await readKey(linkKey(account, tripId));
  if (!text) return target;
  const result = z
    .object({ idMap: z.record(z.string()).optional() })
    .parse(JSON.parse(text));
  return result.idMap?.[target] || target;
}

// 여행별 작업 ID를 보관해 재전송으로 중복 여행이 생기지 않게 한다.
export async function importGuestTrip(
  account: string,
  document: GuestWorkspace,
  trip: WorkspaceSnapshot,
) {
  const key = linkKey(account, trip.trip.id);
  let operationId = Crypto.randomUUID();
  const text = await readKey(key);
  if (text) {
    const previous = z
      .object({ operationId: z.string().uuid() })
      .parse(JSON.parse(text));
    operationId = previous.operationId;
  }
  await writeKey(key, JSON.stringify({ operationId }));
  const options = await serverOptions(account);
  const current = () => {
    if (useTripStore.getState().currentUser?.id !== account)
      throw new Error('계정이 변경됐어요. 다시 로그인해 주세요.');
  };
  current();
  const submit = async () =>
    importSchema.parse(
      (
        await requestFoundation(options, `/guest-import/${operationId}`, {
          method: 'POST',
          body: JSON.stringify({ guestContextRef: document.ownerId, trip }),
        })
      ).data,
    );
  let result = await submit();
  operationId = result.operationId;
  await writeKey(key, JSON.stringify({ operationId }));
  for (const localId of result.missingMediaIds) {
    current();
    const media = result.media.find((item) => item.localId === localId);
    const file = media && document.files[media.localPath];
    if (!file)
      throw new Error(
        '사진 원본을 찾지 못했어요. 이 기기의 기록을 확인한 뒤 다시 시도해 주세요.',
      );
    const bytes =
      Platform.OS === 'web'
        ? await (await fetch(file.uri)).arrayBuffer()
        : await new File(guestFileUri(file.uri)).arrayBuffer();
    current();
    await requestFoundation(
      options,
      `/guest-import/${operationId}/files/${localId}`,
      {
        method: 'POST',
        headers: { 'Content-Type': file.mimeType },
        body: bytes,
      },
    );
  }
  current();
  if (result.state !== 'confirmed') result = await submit();
  current();
  if (result.state !== 'confirmed')
    throw new Error('연결 결과를 확인하지 못했어요. 다시 시도해 주세요.');
  await writeKey(
    key,
    JSON.stringify({
      operationId,
      serverTripId: result.serverTripId,
      idMap: result.idMap,
    }),
  );
  return result.serverTripId;
}
