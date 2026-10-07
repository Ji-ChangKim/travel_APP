import { useEffect } from 'react';
import { BackHandler, StyleSheet, View, type ModalProps } from 'react-native';

// 앱 내부 대화창을 화면 영역에만 표시해 하단 메뉴를 가리지 않는다.
export default function AppModal({
  visible = true,
  children,
  onRequestClose,
  transparent,
}: Omit<ModalProps, 'onRequestClose'> & { onRequestClose?: () => void }) {
  // Android 뒤로가기는 현재 대화창을 먼저 닫는다.
  return (
    useEffect(() => {
      // 대화창이 닫히거나 화면을 떠날 때 구독을 제거한다.
      return visible ? connectBack(onRequestClose) : undefined;
    }, [visible, onRequestClose]),
    visible ? (
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            zIndex: 50,
            elevation: 10,
            backgroundColor: transparent ? 'transparent' : '#FFF9F3',
          },
        ]}
      >
        {children}
      </View>
    ) : null
  );
}

// 대화창의 뒤로가기 이벤트 수명만 연결한다.
function connectBack(close: (() => void) | undefined) {
  // 닫기 동작이 있는 대화창에서만 시스템 뒤로가기를 소비한다.
  return removeBack(
    BackHandler.addEventListener('hardwareBackPress', () => {
      // 화면 자체를 떠나기 전에 대화창을 닫는다.
      return close ? (close(), true) : false;
    }),
  );
}

// 등록한 뒤로가기 리스너의 정리 함수를 반환한다.
function removeBack(
  subscription: ReturnType<typeof BackHandler.addEventListener>,
) {
  // 리스너 해제를 화면 수명에 맡긴다.
  return subscription.remove.bind(subscription);
}
