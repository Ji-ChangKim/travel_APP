import { create } from 'zustand';
import type { TrailJourney } from '@wherego/domain';
import { readTrailWorkspace, writeTrailWorkspace } from './storage';

interface TrailState {
  scope: string;
  journeys: TrailJourney[];
  loading: boolean;
  saving: boolean;
  error: string;
}

// 기기 저장과 화면 편집 상태를 분리한다.
export const useTrailStore = create<TrailState>(() => {
  // 읽기 완료 전 저장할 수 없도록 초기 상태를 둔다.
  return { scope: '', journeys: [], loading: true, saving: false, error: '' };
});

// 현재 계정의 콘텐츠를 새로 불러온다.
export function loadTrailWorkspace(scope: string): Promise<void> {
  // 계정 전환 시 먼저 이전 화면 데이터를 비운다.
  return Promise.resolve(
    useTrailStore.setState({
      scope,
      journeys: [],
      loading: true,
      error: '',
      saving: false,
    }),
  )
    .then(() => {
      // 선택된 계정의 기기 파일만 읽는다.
      return readTrailWorkspace(scope);
    })
    .then((journeys) => {
      // 늦은 이전 계정 응답은 새 화면에 적용하지 않는다.
      return applyLoadedWorkspace(scope, journeys);
    })
    .catch((error: unknown) => {
      // 읽기 실패 중 저장을 허용하지 않고 원본을 유지한다.
      return applyStorageError(scope, error, true);
    });
}

// 읽기 결과를 현재 계정에 한 번 반영한다.
function applyLoadedWorkspace(scope: string, journeys: TrailJourney[]): void {
  // 다른 계정으로 전환된 경우 결과를 버린다.
  return useTrailStore.getState().scope === scope
    ? useTrailStore.setState({ journeys, loading: false, error: '' })
    : undefined;
}

// 보존 저장 성공 후에만 새 콘텐츠를 화면에서 확정한다.
export function saveTrailJourney(
  scope: string,
  journey: TrailJourney,
): Promise<void> {
  // 같은 화면의 중복 저장과 읽기 오류 상태를 거부한다.
  return useTrailStore.getState().scope === scope &&
    !useTrailStore.getState().loading &&
    !useTrailStore.getState().saving
    ? persistJourney(scope, journey, useTrailStore.getState().journeys)
    : Promise.reject(
        new Error(
          '기록을 불러오는 중이거나 저장 중입니다. 잠시 후 다시 시도해 주세요.',
        ),
      );
}

// 여행 하나를 기존 콘텐츠에서 교체한다.
function persistJourney(
  scope: string,
  journey: TrailJourney,
  current: TrailJourney[],
): Promise<void> {
  // 저장 상태를 표시한 뒤 동일한 스냅샷을 파일과 화면에 적용한다.
  return Promise.resolve(useTrailStore.setState({ saving: true, error: '' }))
    .then(() => {
      // 현재 여행 이외의 기록은 유지한다.
      return commitJourneys(scope, [
        ...current.filter((record) => {
          // 기존 같은 ID의 콘텐츠 하나만 교체한다.
          return record.id !== journey.id;
        }),
        journey,
      ]);
    })
    .catch((error: unknown) => {
      // 실패를 화면에 전달하며 호출 폼의 입력을 유지한다.
      return Promise.resolve(applyStorageError(scope, error, false)).then(
        () => {
          // 저장 실패를 성공 완료로 처리하지 않는다.
          throw error;
        },
      );
    });
}

// 전체 기기 문서 저장 후 화면 상태를 갱신한다.
function commitJourneys(
  scope: string,
  journeys: TrailJourney[],
): Promise<void> {
  // 성공 이전에 화면 데이터를 낙관적으로 변경하지 않는다.
  return writeTrailWorkspace(scope, journeys).then(() => {
    // 계정 전환 중 결과가 다른 사용자에게 보이지 않게 한다.
    return useTrailStore.getState().scope === scope
      ? useTrailStore.setState({ journeys, saving: false, error: '' })
      : undefined;
  });
}

// 기기 저장소 오류를 해당 계정에만 보여준다.
function applyStorageError(
  scope: string,
  error: unknown,
  keepLoading: boolean,
): void {
  // 읽기 실패 상태를 임의 빈 여행으로 덮어쓰지 않는다.
  return useTrailStore.getState().scope === scope
    ? useTrailStore.setState({
        error:
          error instanceof Error
            ? error.message
            : '기기 저장소를 확인해 주세요.',
        saving: false,
        loading: keepLoading,
      })
    : undefined;
}
