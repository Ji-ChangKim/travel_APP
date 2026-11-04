import type { WorkspaceSnapshot } from '@wherego/domain';
import type { GuestImportInput, GuestImportResult } from '@wherego/validation';

export type ImportMedia = GuestImportResult['media'][number];

// 로컬 UUID를 재발급해 서버의 기존 여행·파일과 참조가 충돌하지 않게 한다.
export function importedSnapshot(
  input: GuestImportInput,
  actor: string,
  nickname: string,
  identify: () => string = crypto.randomUUID.bind(crypto),
) {
  const source = input.trip;
  const ids = new Map<string, string>();
  for (const id of [
    source.trip.id,
    ...source.days.map((item) => item.id),
    ...source.itinerary.map((item) => item.id),
    ...source.expenses.map((item) => item.id),
    ...source.checklists.map((item) => item.id),
    ...source.media.map((item) => item.id),
    ...source.receipts.map((item) => item.id),
    ...(source.trip.destinations || []).map((item) => item.id),
  ])
    if (!ids.has(id)) ids.set(id, identify());
  const copied = replaceIdentifiers(source, ids) as WorkspaceSnapshot;
  const snapshot: WorkspaceSnapshot = {
    ...copied,
    trip: { ...copied.trip, ownerId: actor, version: 1 },
    myRole: 'owner',
    members: [
      {
        memberId: identify(),
        userId: actor,
        nickname,
        role: 'owner',
        isMe: true,
      },
    ],
    // 공개 발행과 초대는 연결 작업만으로 재실행하지 않는다.
    invites: [],
    postId: null,
  };
  const media: ImportMedia[] = source.media.map((item) => ({
    localId: item.id,
    localPath: item.path,
    serverId: ids.get(item.id)!,
    path: null,
  }));
  return { snapshot, media, idMap: Object.fromEntries(ids) };
}

function replaceIdentifiers(
  value: unknown,
  ids: Map<string, string>,
  key = '',
): unknown {
  // 메모·제목에 UUID와 같은 문자열이 있어도 사용자 원문은 바꾸지 않는다.
  if (typeof value === 'string')
    return key === 'id' || key.endsWith('Id') ? ids.get(value) || value : value;
  if (Array.isArray(value))
    return value.map((entry) => replaceIdentifiers(entry, ids, key));
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([field, entry]) => [
        field,
        replaceIdentifiers(entry, ids, field),
      ]),
    );
  return value;
}
