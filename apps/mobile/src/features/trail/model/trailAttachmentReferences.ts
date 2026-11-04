import type { TrailJourney } from '@wherego/domain';

type AttachmentState = {
  scope: string;
  loading: boolean;
  journeys: readonly TrailJourney[];
};

// 불러오는 중의 빈 목록은 삭제 근거로 쓰지 않고 보존 문서의 참조를 확인한다.
export async function trailAttachmentReferences(
  state: AttachmentState,
  scope: string,
  read: (scope: string) => Promise<readonly TrailJourney[]>,
): Promise<string[]> {
  const journeys =
    state.scope === scope && !state.loading
      ? state.journeys
      : await read(scope);
  return journeys.flatMap((journey) =>
    journey.receipts.map((receipt) => receipt.attachment.uri),
  );
}
