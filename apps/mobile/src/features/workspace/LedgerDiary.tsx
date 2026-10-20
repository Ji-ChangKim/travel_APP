import type { WorkspaceSnapshot } from '@wherego/domain';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { renderDiaryContent } from './LedgerDiaryView';

import { useLedgerWide } from './LedgerUI';
import { archiveDetails } from './archiveModel';

// 기록 상세와 태블릿 보조 영역은 같은 여행 원본을 사용한다.
export default function LedgerDiary({
  snapshot,
  userId,
}: {
  snapshot: WorkspaceSnapshot;
  userId: string;
}) {
  // 기록 유형 필터는 서버 원문과 날짜를 바꾸지 않는다.
  const [filter, setFilter] = useState('all');
  const router = useRouter();
  const wide = useLedgerWide();
  const details = archiveDetails(snapshot);
  const canEdit =
    snapshot.myRole !== 'viewer' && snapshot.trip.status !== 'ARCHIVED';
  return renderDiaryContent({
    snapshot,
    details,
    filter,
    setFilter,
    wide,
    userId,
    canEdit,
    router,
  });
}
