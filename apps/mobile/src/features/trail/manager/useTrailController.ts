import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { TrailReceipt } from '@wherego/domain';
import { useTripStore } from '@/stores/useTripStore';
import {
  loadTrailWorkspace,
  releaseTrailEditorAttachment,
  useTrailStore,
} from './store';
import {
  ownedTrips,
  ownedVisits,
  selectOwnerId,
  selectTrips,
  selectVisits,
} from '../model/trailSelectors';
import type { TrailEditor, TrailForm, TrailModel } from '../model/trailTypes';

// 기기 기록의 읽기 수명과 현재 화면의 입력·선택 상태를 연결한다.
export function useTrailController(scope: string): TrailModel {
  const ownerId = useTripStore(selectOwnerId);
  const trips = useTripStore(selectTrips);
  const visits = useTripStore(selectVisits);
  const [attachment, setAttachment] = useState<
    TrailReceipt['attachment'] | null
  >(null);
  const latestAttachment = useRef(attachment);
  useLayoutEffect(() => {
    latestAttachment.current = attachment;
  }, [attachment]);
  const editorSession = useRef({ active: true, revision: 0, picking: false });
  useEffect(() => {
    const session = editorSession.current;
    session.active = true;
    return () => {
      // 다른 계정이나 화면으로 이동한 뒤 도착한 파일은 편집에 연결하지 않는다.
      session.active = false;
      session.revision += 1;
      void releaseTrailEditorAttachment(scope, latestAttachment.current);
    };
  }, [scope]);
  useEffect(() => {
    // 저장소의 실패 처리는 store가 맡으며 effect에 비동기 정리 함수를 반환하지 않는다.
    void loadTrailWorkspace(scope);
  }, [scope]);
  return {
    scope,
    ownerId,
    state: useTrailStore(),
    sourceTrips: ownedTrips(trips, ownerId),
    legacyVisits: ownedVisits(visits, ownerId),
    active: useState(''),
    editor: useState<TrailEditor>(null),
    form: useState<TrailForm>({}),
    attachment: [attachment, setAttachment],
    notice: useState(''),
    attachmentPending: useState(false),
    editorSession,
  };
}
