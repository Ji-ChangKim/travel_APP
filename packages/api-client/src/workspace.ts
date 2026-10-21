import { z } from 'zod';
import type {
  CommunityPost,
  PersistedTrip,
  WorkspaceSnapshot,
} from '@wherego/domain';
import {
  communityPostSchema,
  workspaceSnapshotSchema,
  workspaceTripSchema,
  workspaceCommandSchema,
  communityFeedSearch,
  communityImportSchema,
  type CommunityImportInput,
  type CommunityFeedFilters,
  type WorkspaceCommand,
} from '@wherego/validation';
import {
  requestFoundation,
  requestSignal,
  FoundationClientError,
  type FoundationClientOptions,
} from './foundation';

// 공개 일정 담기를 하나의 멱등 저장 요청으로 전송한다.
export function importCommunityPlan(
  options: FoundationClientOptions,
  postId: string,
  input: CommunityImportInput,
  key: string,
): Promise<string> {
  // 클라이언트가 만든 일정 사본 대신 공개 ID와 선택 출발일만 전송한다.
  return requestFoundation(
    options,
    `/community/${encodeURIComponent(postId)}/import`,
    {
      method: 'POST',
      headers: { 'Idempotency-Key': key },
      body: JSON.stringify(communityImportSchema.parse(input)),
    },
  ).then((response) => {
    // 저장을 확정한 실제 여행 ID만 편집 화면으로 연결한다.
    return z.object({ tripId: z.string().uuid() }).parse(response.data).tripId;
  });
}

// 로그인 여부와 무관하게 공개된 원본 한 건을 조회한다.
export function getPublicCommunityPost(
  baseUrl: string,
  postId: string,
  signal?: AbortSignal,
): Promise<CommunityPost> {
  // 비공개 인증 토큰을 공개 조회에 포함하지 않는다.
  return fetch(
    `${baseUrl.replace(/\/$/, '')}/public/community/${encodeURIComponent(postId)}`,
    { signal: requestSignal(signal) },
  ).then((response) => {
    // 공개 중단과 통신 실패를 빈 일정으로 바꾸지 않는다.
    return response.ok
      ? response.json().then((payload: unknown) => {
          // 실제 공개 계약을 통과한 내용만 전달한다.
          return z.object({ data: communityPostSchema }).parse(payload).data;
        })
      : Promise.reject(new FoundationClientError(response.status, null));
  });
}

// 앱과 웹의 원본 여행 목록을 조회한다.
export function listServerTrips(
  options: FoundationClientOptions,
  signal?: AbortSignal,
): Promise<PersistedTrip[]> {
  // 런타임 스키마 검증을 통과한 서버 자료만 반환한다.
  return requestFoundation(options, '/trips', { signal }).then((response) => {
    // 알 수 없는 값을 타입 단언으로 넘기지 않는다.
    return z.array(workspaceTripSchema).parse(response.data);
  });
}
// 저장된 여행의 확장 스냅샷을 읽는다.
export function getWorkspace(
  options: FoundationClientOptions,
  id: string,
  signal?: AbortSignal,
): Promise<WorkspaceSnapshot> {
  // 실제 서버에서 계정 멤버십을 검사한다.
  return requestFoundation(
    options,
    `/trips/${encodeURIComponent(id)}/workspace`,
    { signal },
  ).then((response) => {
    // 사진·영수증·멤버 계약을 함께 검증한다.
    return workspaceSnapshotSchema.parse(response.data);
  });
}
// 원자 명령에 버전과 요청 키를 전달한다.
export function sendWorkspaceCommand(
  options: FoundationClientOptions,
  id: string,
  version: number,
  command: WorkspaceCommand,
  key: string,
) {
  // 같은 입력 재시도는 호출자가 같은 키를 유지한다.
  return requestFoundation(
    options,
    `/trips/${encodeURIComponent(id)}/commands`,
    {
      method: 'POST',
      headers: {
        'Idempotency-Key': key,
        'If-Match': `"trip:${id}:${version}"`,
      },
      body: JSON.stringify(workspaceCommandSchema.parse(command)),
    },
  ).then((response) => {
    // 명령 결과의 공개 필드만 허용한다.
    return z
      .object({
        id: z.string().optional(),
        tripId: z.string(),
        tripVersion: z.number(),
        token: z.string().optional(),
        expiresAt: z.string().optional(),
        path: z.string().optional(),
      })
      .parse(response.data);
  });
}
// 참여 링크의 초대 토큰을 수락한다.
export function acceptServerInvite(
  options: FoundationClientOptions,
  token: string,
  key: string,
): Promise<string> {
  // 토큰은 HTTP 본문에만 넣는다.
  return requestFoundation(options, '/invites/accept', {
    method: 'POST',
    headers: { 'Idempotency-Key': key },
    body: JSON.stringify({ token }),
  }).then((response) => {
    // 서버가 확인한 여행으로만 이동한다.
    return z.object({ tripId: z.string().uuid() }).parse(response.data).tripId;
  });
}
// 로그인 사용자에게 차단 목록을 적용한 공개 피드를 읽는다.
export function getCommunity(
  options: FoundationClientOptions,
  offset = 0,
  filters: Partial<CommunityFeedFilters> = {},
  signal?: AbortSignal,
): Promise<CommunityPost[]> {
  // 서버 페이지 크기에 맞춰 피드를 이어 읽는다.
  return requestFoundation(
    options,
    `/community?${communityFeedSearch(filters, offset)}`,
    { signal },
  ).then((response) => {
    // 공개 스냅샷에 민감한 여행 필드가 들어오지 않게 계약을 제한한다.
    return z.array(communityPostSchema).parse(response.data);
  });
}
// 파일의 짧은 조회 URL을 읽는다.
export function getServerMediaUrl(
  options: FoundationClientOptions,
  tripId: string,
  mediaId: string,
  signal?: AbortSignal,
): Promise<string> {
  // 원본 경로를 임의로 클라이언트가 요청하지 않는다.
  return requestFoundation(
    options,
    `/trips/${encodeURIComponent(tripId)}/media/${encodeURIComponent(mediaId)}/url`,
    { signal },
  ).then((response) => {
    // 성공 URL 형식만 반환한다.
    return z.object({ url: z.string().url() }).parse(response.data).url;
  });
}
