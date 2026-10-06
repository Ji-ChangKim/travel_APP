import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { foundationQueryKey, listServerTrips } from '@wherego/api-client';
import { useTripStore } from '@/stores/useTripStore';
import { serverOptions } from './service';
import { Action, Field, styles } from './ui';
import {
  incomingMapsText,
  pendingMapsShare,
  savePendingMapsShare,
  clearPendingMapsShare,
} from './mapsShare';

type State = { text: string; error: string; busy: boolean };
type Set = Dispatch<SetStateAction<State>>;
type Destination =
  '/login' | '/new-trip?importPlace=1' | `/trips/${string}?importPlace=1`;

// 실제 계정만 가져오기 대상 여행을 읽을 수 있게 한다.
function useImportUser(): string {
  // 게스트는 공유문을 입력할 수 있지만 서버 여행을 읽지 않는다.
  return useTripStore((state) => {
    // 실제 로그인 계정 UUID로 조회와 상태를 분리한다.
    return state.currentUser && state.currentUser.authProvider !== 'guest'
      ? state.currentUser.id
      : '';
  });
}

// 공유 입력은 로그인 전후에 동일한 화면에서 편집한다.
export default function ImportPlaceScreen() {
  // 계정이 바뀌면 이전 요청과 폼을 초기화한다.
  return <ImportContent key={useImportUser()} />;
}

// 현재 공유 입력 상태를 한 항목씩 갱신한다.
function patch(set: Set, values: Partial<State>): void {
  // 다른 필드와 사용자 입력을 유지한다.
  return set((state) => {
    // 같은 요청 흐름의 변경값만 병합한다.
    return { ...state, ...values };
  });
}

// 생성한 정리 함수를 effect 구독 종료에 전달한다.
function cleanupAfter(
  _task: Promise<unknown>,
  cleanup: () => void,
): () => void {
  // 비동기 복원은 이미 시작되었고 종료 함수만 반환한다.
  return cleanup;
}

// 늦게 도착한 임시 공유 후보를 이전 화면에 적용하지 않는다.
function subscribeRestore(set: Set, controller: AbortController): () => void {
  // OS에서 새로 받은 공유 입력을 저장소의 이전 후보로 덮지 않는다.
  return cleanupAfter(
    pendingMapsShare().then((text) => {
      // 현재 입력이 비어 있을 때만 후보를 복원한다.
      return !controller.signal.aborted && text
        ? set((state) => {
            // 복원 이전에 사용자가 입력한 내용은 유지한다.
            return state.text ? state : { ...state, text };
          })
        : undefined;
    }),
    () => {
      // 화면 해제 이후의 비동기 상태 변경을 차단한다.
      return controller.abort();
    },
  );
}

// 인증 리디렉션 전에 저장한 공유 링크를 복원한다.
function useImportRestore(set: Set): void {
  // 상태 setter가 안정적이므로 화면 생명주기에만 복원한다.
  return useEffect(() => {
    // 종료 함수로 복원 요청을 화면 생명주기에 연결한다.
    return subscribeRestore(set, new AbortController());
  }, [set]);
}

// 현재 계정의 서버 여행을 가져오기 후보로 조회한다.
function useImportTrips(userId: string) {
  // 저장된 여행의 읽기 권한은 API 서버가 검사한다.
  return useQuery({
    queryKey: foundationQueryKey(userId, 'trips'),
    enabled: Boolean(userId),
    retry: false,
    queryFn: () => {
      // 여행에 없는 임시 목업을 추가하지 않는다.
      return serverOptions(userId).then(listServerTrips);
    },
  });
}

// 입력·인증·목록 조회를 가져오기 화면에 연결한다.
function useImportController() {
  // 상태 훅은 렌더마다 한 번만 실행한다.
  return useImportState(
    useState<State>(() => {
      // 네이티브 공유 원문은 처음 화면을 열 때만 읽는다.
      return { text: incomingMapsText(), busy: false, error: '' };
    }),
    useImportUser(),
    useRouter(),
  );
}

// 공유 후보의 복원과 서버 여행 조회를 같은 계정 상태에 연결한다.
function useImportState(
  [state, set]: [State, Set],
  userId: string,
  router: ReturnType<typeof useRouter>,
) {
  // 화면 상태와 네비게이션을 한 컨트롤러로 전달한다.
  return {
    state,
    set,
    userId,
    router,
    trips: useImportTrips(userId),
    restore: useImportRestore(set),
  };
}

type Controller = ReturnType<typeof useImportController>;

// 목적지 선택 전에 공유 링크를 검증하고 로그인 동안 보관한다.
function proceed(
  { state, set, router }: Controller,
  destination: Destination,
): void {
  // 서버 저장은 다음 일정 확인 화면에서만 수행한다.
  return state.busy
    ? undefined
    : void Promise.resolve(patch(set, { busy: true, error: '' }))
        .then(() => {
          // 링크 형식 오류도 화면 안내로 변환한다.
          return savePendingMapsShare(state.text);
        })
        .then(() => {
          // 인증 복귀 때 같은 가져오기 화면을 중복 쌓지 않는다.
          return destination === '/login'
            ? router.replace(destination)
            : router.push(destination);
        })
        .catch(() => {
          // 저장 목록과 여러 링크를 임의 장소로 등록하지 않는다.
          return patch(set, {
            error: 'Google Maps에서 장소 하나의 공유 링크를 붙여 넣어 주세요.',
          });
        })
        .finally(() => {
          // 실패 후 사용자가 다시 선택할 수 있게 한다.
          return patch(set, { busy: false });
        });
}

// 장소 입력과 여행 선택을 같은 화면에서 안내한다.
function ImportView({ controller }: { controller: Controller }) {
  // 장소 후보는 저장 전에 사용자가 제목·날짜를 확인한다.
  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.header}>저장한 장소를 여행으로</Text>
        <Text style={styles.subtitle}>
          Google Maps에서 찾은 장소를 내 일정에 추가하세요. 장소와 날짜를 확인한
          뒤 직접 저장합니다.
        </Text>
        <Field
          label="받은 Google Maps 링크"
          value={controller.state.text}
          onChange={(text) => {
            // 공유문을 변경하면 이전 오류 안내를 비운다.
            return patch(controller.set, { text, error: '' });
          }}
        />
        {controller.state.error && (
          <Text style={styles.error} accessibilityRole="alert">
            {controller.state.error}
          </Text>
        )}
        {!controller.userId ? (
          <Action
            label="로그인하고 장소 가져오기"
            disabled={controller.state.busy}
            onPress={() => {
              // 공유 입력을 보관한 뒤 실제 인증으로 이동한다.
              return proceed(controller, '/login');
            }}
          />
        ) : (
          <>
            <Text style={styles.title}>추가할 여행 선택</Text>
            {controller.trips.isLoading && (
              <Text>여행 목록을 불러오는 중입니다.</Text>
            )}
            {controller.trips.isError && (
              <>
                <Text style={styles.error}>여행을 불러오지 못했습니다.</Text>
                <Action
                  label="다시 불러오기"
                  onPress={() => {
                    // 여행 목록 조회만 재시도한다.
                    return void controller.trips.refetch();
                  }}
                />
              </>
            )}
            {controller.trips.data
              ?.filter((trip) => {
                // 보관된 여행은 새로운 장소 추가 대상에서 제외한다.
                return trip.status !== 'ARCHIVED';
              })
              .map((trip) => (
                <View key={trip.id} style={styles.card}>
                  <Text style={styles.title}>{trip.title}</Text>
                  <Text>
                    {trip.city} · {trip.startDate} ~ {trip.endDate}
                  </Text>
                  <Action
                    label={`이 여행에 추가: ${trip.title}`}
                    disabled={controller.state.busy}
                    onPress={() => {
                      // 일정 편집 폼에서 날짜와 장소를 확인한다.
                      return proceed(
                        controller,
                        `/trips/${trip.id}?importPlace=1`,
                      );
                    }}
                  />
                </View>
              ))}
            <Action
              label="새 여행 만들기"
              disabled={controller.state.busy}
              onPress={() => {
                // 생성 완료 후 동일 공유 후보로 일정 편집을 이어간다.
                return proceed(controller, '/new-trip?importPlace=1');
              }}
            />
          </>
        )}
        <Action
          label="가져오기 취소"
          disabled={controller.state.busy}
          onPress={() => {
            // 취소 후보를 지우고 여행 허브로 돌아간다.
            return void clearPendingMapsShare()
              .then(() => {
                // 정상 앱 시작 화면으로 복귀한다.
                return controller.router.replace(
                  controller.userId ? '/(tabs)' : '/login',
                );
              })
              .catch(() => {
                // 임시 저장소 오류는 화면에서 재시도할 수 있다.
                return patch(controller.set, {
                  error: '공유 입력을 정리하지 못했습니다. 다시 시도해 주세요.',
                });
              });
          }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

// 계정별 컨트롤러를 가져오기 화면에 전달한다.
function ImportContent() {
  // 조회와 상태는 현재 화면 계정에만 연결한다.
  return <ImportView controller={useImportController()} />;
}
