import { returnToScreen } from '@/components/navigationModel';
import { workspaceQueryOptions } from './tripQueries';
import Text from '@/components/AppText';
import HaruState from '@/components/HaruState';
import { useAuthReady } from '@/features/auth/AuthBridge';
import { useTripStore } from '@/stores/useTripStore';
import { useQuery } from '@tanstack/react-query';
import { FoundationClientError } from '@wherego/api-client';
import {
  foundationUuidSchema,
  type WorkspaceCommand,
} from '@wherego/validation';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView } from 'react-native';
import { LedgerAction, LedgerScreen, useLedgerWide } from './LedgerUI';
import { renderRecordEditor } from './RecordEditorScreenView';
import { ledgerStyles as s } from './ledgerTheme';
import { useRecordEditorController } from './useRecordEditorController';

import { authReturn } from '../auth/authReturn';
import TripAccessFeedback from './TripAccessFeedback';
import { requestScheduleExit } from './scheduleExitGuard';

// 실제 여행/일정 원본을 읽은 뒤 기록 편집기를 연다.
export default function RecordEditorScreen() {
  // 계정 전환 시 이전 사진/메모 초안을 재사용하지 않는다.
  const userId = useTripStore((state) => {
    // 인증 계정과 기기 게스트를 기존 소유 ID로 구분한다.
    return state.currentUser?.id || '';
  });
  const { id = '', scheduleId = '' } = useLocalSearchParams<{
    id?: string;
    scheduleId?: string;
  }>();
  return (
    <RecordPage
      key={`${userId}:${id}`}
      userId={userId}
      id={id}
      scheduleId={scheduleId}
    />
  );
}

// 권한이 없는 자료를 예시 데이터로 대체하지 않는다.
function RecordPage({
  userId,
  id,
  scheduleId,
}: {
  userId: string;
  id: string;
  scheduleId: string;
}) {
  // 최초 인증 복원이 끝나야 실제 원본을 조회한다.
  const ready = useAuthReady((state) => {
    // 복원 중 로그인 안내 깜박임을 막는다.
    return state.ready;
  });
  const [selected, setSelected] = useState(scheduleId);
  const [accessError, setAccessError] = useState<FoundationClientError | null>(
    null,
  );
  const router = useRouter();
  const valid = foundationUuidSchema.safeParse(id).success;
  const query = useQuery({
    ...workspaceQueryOptions(userId, id),
    enabled:
      ready && Boolean(userId) && foundationUuidSchema.safeParse(id).success,
  });
  const denied =
    accessError ||
    (query.isError &&
      query.error instanceof FoundationClientError &&
      [401, 403, 404].includes(query.error.status));
  const snapshot = denied ? undefined : query.data;
  const item = snapshot?.itinerary.find((entry) => {
    // 다른 여행의 일정 ID를 임의로 편집하지 않는다.
    return entry.id === selected;
  });
  return (
    <LedgerScreen
      title="여행기록 추가"
      onBack={() => {
        // 변경이 있으면 기존 공통 이탈 확인을 거친다.
        return requestScheduleExit(() =>
          returnToScreen(router, `/diary/${id}`),
        );
      }}
    >
      {!ready || (valid && userId && query.isPending) ? (
        <HaruState kind="loading" title="여행 기록을 불러오고 있어요" />
      ) : null}
      {ready && !valid && (
        <Text style={s.body}>
          여행을 찾을 수 없어요. 내 여행에서 다시 열어 주세요.
        </Text>
      )}
      {ready && !userId && (
        <LedgerAction
          label="로그인하고 기록 편집"
          onPress={() => {
            // 같은 여행의 원본으로 인증 복귀한다.
            return router.push({
              pathname: '/login',
              params: authReturn('record', undefined, id),
            });
          }}
        />
      )}
      {(accessError || query.isError) && (
        <TripAccessFeedback
          error={accessError || query.error}
          target={authReturn('record', undefined, id)}
          busy={query.isFetching}
          onRetry={() => {
            // 권한 상실로 가린 원본은 새 조회가 성공한 경우에만 다시 연다.
            return void query.refetch().then((result) => {
              // 실패하면 이전 원본을 계속 가린다.
              if (result.isSuccess) setAccessError(null);
            });
          }}
        />
      )}
      {snapshot &&
        (snapshot.myRole === 'viewer' || snapshot.trip.status === 'ARCHIVED' ? (
          <Text style={s.body}>이 여행은 읽기만 할 수 있어요.</Text>
        ) : item ? (
          <RecordFields
            key={item.id}
            snapshot={snapshot}
            item={item}
            userId={userId}
            onAccessDenied={setAccessError}
            onChoose={() => {
              // 메모 변경을 확인한 뒤 장소 선택으로 돌아간다.
              return requestScheduleExit(() => setSelected(''));
            }}
          />
        ) : (
          <ScrollView contentContainerStyle={s.content}>
            <Text style={s.section}>기록할 장소 선택</Text>
            {snapshot.itinerary.map((entry) => {
              // 실제 저장한 일정만 선택지로 제공한다.
              return (
                <LedgerAction
                  key={entry.id}
                  label={entry.title}
                  onPress={() => {
                    // 선택한 일정 ID를 유지한다.
                    return setSelected(entry.id);
                  }}
                />
              );
            })}
            {!snapshot.itinerary.length && (
              <LedgerAction
                label="일정 추가하러 가기"
                onPress={() => {
                  // 장소가 없으면 실제 여행 일정에서 먼저 추가한다.
                  return router.replace(`/trips/${id}`);
                }}
              />
            )}
          </ScrollView>
        ))}
    </LedgerScreen>
  );
}

export type PendingRecord = {
  command: WorkspaceCommand;
  version: number;
  key: string;
};

// 기록 메모·장소 설명·사진은 기존 저장 명령으로만 확정한다.
function RecordFields(props: Parameters<typeof useRecordEditorController>[0]) {
  // 기존 컴포넌트 수명을 유지하며 기능 상태를 표현 함수에 연결한다.
  return renderRecordEditor({
    ...useRecordEditorController(props),
    wide: useLedgerWide(),
  });
}

export { useRecordEditorController } from './useRecordEditorController';
