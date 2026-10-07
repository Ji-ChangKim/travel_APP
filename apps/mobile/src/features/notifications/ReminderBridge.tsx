import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useQuery } from '@tanstack/react-query';
import { useTripStore } from '@/stores/useTripStore';
import { foundationQueryKey, listServerTrips } from '@wherego/api-client';
import { serverOptions } from '@/features/workspace/service';
import { usePermissionRevision } from './permissionState';

type Trips = Awaited<ReturnType<typeof listServerTrips>>;
let work: Promise<unknown> = Promise.resolve();
let revision = 0;

// 현재 계정의 실제 여행만 기기에 출발 알림으로 예약한다.
export default function ReminderBridge() {
  // 계정과 여행 조회의 수명을 연결한다.
  return useReminderQuery(
    useTripStore((state) => {
      // 로그아웃이나 계정 변경 때 기존 예약도 정리한다.
      return state.currentUser?.id || '';
    }),
    usePermissionRevision((state) => {
      // 기기 권한을 허용한 시점에만 예약을 갱신한다.
      return state.revision;
    }),
  );
}

// 여행 조회를 현재 회원의 알림 예약 효과에 연결한다.
function useReminderQuery(id: string, permissionRevision: number) {
  // 홈과 같은 서버 원본 캐시를 사용한다.
  return useReminderEffects(
    id,
    useQuery({
      queryKey: foundationQueryKey(id, 'trips'),
      enabled: Boolean(id),
      queryFn: () => {
        // 확인된 계정의 서버 여행만 읽는다.
        return serverOptions(id).then(listServerTrips);
      },
      retry: false,
    }).data,
    permissionRevision,
  );
}

// 확인한 여행과 권한 선택의 수명만 알림 예약에 연결한다.
function useReminderEffects(
  id: string,
  trips: Trips | undefined,
  permissionRevision: number,
) {
  // 권한을 허용하거나 앱이 전경으로 돌아오면 예약을 갱신한다.
  return (
    useEffect(() => {
      // 동일한 알림 ID를 사용해 중복 출발 알림을 만들지 않는다.
      return connectReminders(id, trips);
    }, [id, trips, permissionRevision]),
    null
  );
}

// 계정 변경과 권한 변경 시에만 알림 동기화를 연결한다.
function connectReminders(id: string, trips: Trips | undefined) {
  // 권한이 새로 허용된 뒤에도 실제 여행으로 예약한다.
  return cleanupPermission(
    AppState.addEventListener('change', (state) => {
      // 기기 설정에서 돌아온 경우 실제 권한을 다시 읽는다.
      return state === 'active' ? syncReminders(id, trips) : undefined;
    }),
    (Notifications.setNotificationHandler({
      handleNotification: () => {
        // 앱을 사용 중인 출발 알림도 배너와 알림 목록에 표시한다.
        return Promise.resolve({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: false,
          shouldSetBadge: false,
        });
      },
    }),
    syncReminders(id, trips)),
  );
}

// 알림 권한 이벤트의 구독만 정리한다.
function cleanupPermission(
  subscription: ReturnType<typeof AppState.addEventListener>,
  _initial: void,
) {
  // 이전 계정의 이벤트 수명을 화면에 맞춰 종료한다.
  return subscription.remove.bind(subscription);
}

// 알림 변경 작업을 직렬화하고 오래된 계정의 요청을 건너뛴다.
function syncReminders(
  id: string,
  trips: Trips | undefined,
  started = ++revision,
): void {
  // 조회 오류 때문에 현재 계정의 정상 예약을 지우지 않는다.
  return void (work = work
    .catch(() => {
      // 이전 예약 실패가 새로운 동기화를 막지 않는다.
      return undefined;
    })
    .then(() => {
      // 마지막으로 요청한 계정과 실제 화면 계정이 같은지 확인한다.
      return started === revision &&
        (useTripStore.getState().currentUser?.id || '') === id &&
        (!id || trips)
        ? replaceReminders(id, trips || [])
        : undefined;
    })
    .catch(() => {
      // 알림 실패가 일정 저장을 실패로 바꾸지 않는다.
      return undefined;
    }));
}

// 이 앱이 만든 출발 알림만 정리한 뒤 최신 여행을 예약한다.
function replaceReminders(id: string, trips: Trips): Promise<unknown> {
  // 운영체제 권한을 확인하고 다른 종류의 알림은 건드리지 않는다.
  return Notifications.getAllScheduledNotificationsAsync()
    .then((pending) =>
      Promise.all(
        pending
          .filter((item) => {
            // 여행 출발 알림의 고정 접두사만 선택한다.
            return item.identifier.startsWith('tripprint:');
          })
          .map((item) => {
            // 로그아웃 시 개인정보가 포함된 예약도 철회한다.
            return Notifications.cancelScheduledNotificationAsync(
              item.identifier,
            );
          }),
      ),
    )
    .then(ensureReminderChannel)
    .then(() => {
      // 설정에서 허용한 최신 알림 권한을 읽는다.
      return Notifications.getPermissionsAsync();
    })
    .then((permission) => {
      // 거절된 권한을 반복 요청하지 않는다.
      return permission.granted && id
        ? Promise.all(
            trips
              .filter((trip) => {
                // 예정되었으며 아직 출발 알림 시간이 지나지 않은 여행만 예약한다.
                return (
                  ['DRAFT', 'PLANNED'].includes(trip.status) &&
                  reminderDate(trip.startDate).getTime() > Date.now()
                );
              })
              .map((trip) => {
                // 알림은 실제 사용자의 여행 제목과 시작 날짜만 사용한다.
                return Notifications.scheduleNotificationAsync({
                  identifier: `tripprint:${id}:${trip.id}`,
                  content: {
                    title: '오늘 여행을 떠나요',
                    body: `${trip.title} · ${trip.city} 일정을 확인해 보세요.`,
                    data: { tripId: trip.id },
                  },
                  trigger: {
                    type: Notifications.SchedulableTriggerInputTypes.DATE,
                    date: reminderDate(trip.startDate),
                    ...(Platform.OS === 'android'
                      ? { channelId: 'trip-reminders' }
                      : {}),
                  },
                });
              }),
          )
        : undefined;
    });
}

// 이미 권한이 허용된 기기에도 여행 알림 채널을 준비한다.
function ensureReminderChannel(): Promise<unknown> {
  // Android의 출발 알림을 같은 채널로 묶는다.
  return Platform.OS === 'android'
    ? Notifications.setNotificationChannelAsync('trip-reminders', {
        name: '여행 출발 알림',
        importance: Notifications.AndroidImportance.DEFAULT,
      })
    : Promise.resolve();
}

// 사용 기기의 달력과 시간대로 출발일 오전 9시를 계산한다.
function reminderDate(date: string): Date {
  // UTC 변환으로 출발 날짜가 전날로 바뀌지 않게 한다.
  return new Date(`${date}T09:00:00`);
}
