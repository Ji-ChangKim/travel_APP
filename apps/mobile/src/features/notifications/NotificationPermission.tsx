import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { Linking, Platform, Text, View } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { Action } from '@/features/workspace/ui';
import ReminderBridge from './ReminderBridge';
import { changedPermission } from './permissionState';

const askedKey = 'tripprint.notifications.asked.v1';

// 최초 실행 때만 알림 권한의 이유를 짧은 토스트 카드로 안내한다.
export default function NotificationPermission() {
  // 웹에서는 네이티브 권한 요청과 알림 코드를 실행하지 않는다.
  return Platform.OS === 'web' ? null : <PermissionContent />;
}

// 알림 설명 카드와 운영체제 권한 요청을 연결한다.
function PermissionContent() {
  // 거절하거나 나중에 선택한 사람에게 실행마다 다시 묻지 않는다.
  return (
    <PermissionSurface
      visible={useState(false)}
      busy={useState(false)}
      message={useState(
        '출발하는 날 오전 9시에 여행을 알려드릴게요. 알림을 허용해 주세요.',
      )}
    />
  );
}

type PermissionProps = {
  visible: [boolean, Dispatch<SetStateAction<boolean>>];
  busy: [boolean, Dispatch<SetStateAction<boolean>>];
  message: [string, Dispatch<SetStateAction<string>>];
};

// 최초 안내의 수명과 사용자의 알림 선택만 표시한다.
function PermissionSurface({
  visible: [visible, setVisible],
  busy: [busy, setBusy],
  message: [message, setMessage],
}: PermissionProps) {
  // 화면 해제 이후의 권한 조회가 안내를 다시 열지 않게 한다.
  return (
    useEffect(() => {
      // 최초 권한 확인 작업의 수명만 연결한다.
      return connectPermission(setVisible);
    }, [setVisible]),
    (
      // 토스트 카드는 화면 아래에 표시하되 하단 메뉴 영역을 덮지 않는다.
      <>
        <ReminderBridge />
        {visible ? (
          <View
            accessibilityRole="alert"
            style={{
              position: 'absolute',
              bottom: 12,
              left: 16,
              right: 16,
              padding: 16,
              borderRadius: 16,
              backgroundColor: '#FFFFFF',
              borderWidth: 1,
              borderColor: '#E5E7EB',
              zIndex: 70,
              elevation: 12,
              gap: 10,
            }}
          >
            <Text style={{ fontWeight: '700', fontSize: 16 }}>
              다가오는 여행을 놓치지 않도록
            </Text>
            <Text>{message}</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Action
                label="알림 허용하기"
                variant="primary"
                disabled={busy}
                onPress={() => {
                  /* 알림 권한 요청 하나를 실행한다. */ return allowNotification(
                    busy,
                    setBusy,
                    setVisible,
                    setMessage,
                  );
                }}
              />
              <Action
                label="나중에"
                disabled={busy}
                onPress={() => {
                  // 선택을 보관한 뒤 안내만 닫는다.
                  return void SecureStore.setItemAsync(askedKey, 'true')
                    .then(() => {
                      // 알림 없이도 여행 기능을 계속 사용한다.
                      return setVisible(false);
                    })
                    .catch(() => {
                      // 저장소 실패가 화면 이용을 막지 않도록 한다.
                      return setVisible(false);
                    });
                }}
              />
            </View>
            {message.includes('기기 설정') ? (
              <Action
                label="기기 알림 설정 열기"
                onPress={() => {
                  // 앱 알림 설정을 운영체제에서 직접 선택한다.
                  return void Linking.openSettings();
                }}
              />
            ) : null}
          </View>
        ) : null}
      </>
    )
  );
}

// 화면 해제 후에 권한 안내가 다시 나타나지 않도록 수명을 연결한다.
function connectPermission(
  show: (value: boolean) => void,
  lifetime = { active: true },
) {
  // 현재 권한과 이전 선택을 확인한다.
  return (
    void Promise.all([
      Notifications.getPermissionsAsync(),
      SecureStore.getItemAsync(askedKey),
    ])
      .then(([permission, asked]) => {
        // 아직 선택하지 않은 최초 실행에서만 토스트를 연다.
        return lifetime.active
          ? show(!permission.granted && permission.canAskAgain && !asked)
          : undefined;
      })
      .catch(() => {
        // 권한 확인 실패는 여행 화면을 막지 않는다.
        return undefined;
      }),
    () => {
      // 이전 권한 조회의 화면 갱신을 중단한다.
      return void (lifetime.active = false);
    }
  );
}

// Android 채널을 만든 다음 운영체제 알림 권한을 요청한다.
function requestPermission() {
  // Android 13 이상의 권한 창이 알림 채널을 기준으로 열리게 한다.
  return (
    Platform.OS === 'android'
      ? Notifications.setNotificationChannelAsync('trip-reminders', {
          name: '여행 출발 알림',
          importance: Notifications.AndroidImportance.DEFAULT,
        })
      : Promise.resolve()
  ).then(() => {
    // 사용자의 명시적인 허용 선택 이후에만 권한 창을 연다.
    return Notifications.requestPermissionsAsync();
  });
}

// 권한 요청 작업 하나를 실행한다.
function allowNotification(
  busy: boolean,
  setBusy: Dispatch<SetStateAction<boolean>>,
  setVisible: Dispatch<SetStateAction<boolean>>,
  setMessage: Dispatch<SetStateAction<string>>,
) {
  // 알림 거절이 여행 이용을 막지 않게 한다.
  return busy
    ? undefined
    : (setBusy(true),
      requestPermission()
        .then((permission) => {
          // 결과와 관계없이 최초 안내 선택을 기억한다.
          return SecureStore.setItemAsync(askedKey, 'true').then(() => {
            // 거절 후에는 운영체제 설정으로 다시 허용할 수 있다.
            return (
              changedPermission(),
              permission.granted
                ? setVisible(false)
                : setMessage(
                    '알림이 꺼져 있어요. 기기 설정에서 허용하거나 나중에 계속할 수 있어요.',
                  )
            );
          });
        })
        .catch(() => {
          // 권한 API 실패는 다시 누를 수 있는 안내로 표시한다.
          return setMessage(
            '알림을 설정하지 못했어요. 다시 시도하거나 나중에 계속해 주세요.',
          );
        })
        .finally(() => {
          // 권한 창을 닫은 뒤 버튼을 다시 활성화한다.
          return setBusy(false);
        }));
}
