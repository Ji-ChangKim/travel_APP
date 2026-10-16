import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useTopModal } from './modalLayers';

// 인라인 창 뒤의 본문도 Android 화면 읽기 탐색에서 제외한다.
export default function ModalBackground({ children }: { children: ReactNode }) {
  // 모달 자체는 이 컨테이너 밖에 두어 읽기 제외를 상속하지 않는다.
  const hidden = Boolean(useTopModal());
  return (
    <View
      style={{ flex: 1 }}
      aria-hidden={hidden}
      accessibilityElementsHidden={hidden}
      importantForAccessibility={hidden ? 'no-hide-descendants' : 'auto'}
    >
      {children}
    </View>
  );
}
