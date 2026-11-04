import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { parseCreationDrafts, type CreationDraft } from './creationDraftModel';

function key(ownerId: string) {
  if (!/^[a-zA-Z0-9_.-]{1,128}$/.test(ownerId) || ownerId === 'public')
    throw new Error('DRAFT_ACCOUNT');
  return `tripprint.creation.${ownerId}.v1`;
}

// 기기 안에서 계정별로 분리하며 서버 여행 목록과 섞지 않는다.
export async function readCreationDrafts(
  ownerId: string,
): Promise<CreationDraft[]> {
  const storageKey = key(ownerId);
  const raw =
    Platform.OS === 'web'
      ? localStorage.getItem(storageKey)
      : await SecureStore.getItemAsync(storageKey);
  return parseCreationDrafts(raw, ownerId);
}

async function write(ownerId: string, drafts: CreationDraft[]) {
  const raw = JSON.stringify(drafts);
  if (raw.length > 100000) throw new Error('DRAFT_SIZE');
  if (Platform.OS === 'web') localStorage.setItem(key(ownerId), raw);
  else await SecureStore.setItemAsync(key(ownerId), raw);
}

// 다른 초안을 덮어쓰지 않고 최대 다섯 개까지 저장한다.
export async function saveCreationDraft(draft: CreationDraft) {
  const previous = await readCreationDrafts(draft.ownerId);
  const next = [
    draft,
    ...previous.filter((item) => item.form.id !== draft.form.id),
  ];
  if (next.length > 5) throw new Error('DRAFT_LIMIT');
  await write(draft.ownerId, next);
}

// 정식 저장이 확인된 멱등 키 또는 사용자가 선택한 초안만 삭제한다.
export async function removeCreationDraft(ownerId: string, id: string) {
  const previous = await readCreationDrafts(ownerId);
  if (previous.some((item) => item.form.id === id))
    await write(
      ownerId,
      previous.filter((item) => item.form.id !== id),
    );
}
