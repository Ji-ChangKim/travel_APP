import { Platform, View } from 'react-native';
import Text from '@/components/AppText';
import { Action } from '../workspace/ui';
import { styles } from '../workspace/workspaceStyles';

import type { LocationResult } from './currentLocation';

// 권한·서비스·측정 정확도에 맞는 다음 행동을 안내한다.
export default function LocationFeedback({
  result,
  onSettings,
  disabled,
  manual = true,
}: {
  result?: LocationResult;
  onSettings: () => void;
  disabled: boolean;
  manual?: boolean;
}) {
  // 대략 위치도 실제 측정 반경을 표시하고 사용자가 적용 여부를 고른다.
  const retry = manual
    ? '다시 시도하거나 위치를 직접 선택해 주세요.'
    : '잠시 후 다시 시도해 주세요.';
  return !result ? null : (
    <View style={{ gap: 8 }}>
      <Text
        accessibilityRole={
          result.status === 'located' || result.status === 'ready'
            ? undefined
            : 'alert'
        }
        style={styles.subtitle}
      >
        {result.status === 'located'
          ? `${result.fix.approximate ? '대략 위치예요. ' : ''}위치 오차 반경은 약 ${Math.ceil(result.fix.accuracyMeters)}m예요. 방문할 위치가 맞는지 확인해 주세요.`
          : result.status === 'ready'
            ? manual
              ? '위치 설정을 확인했어요. 현재 위치 사용을 눌러 다시 확인해 주세요.'
              : '위치 설정을 확인했어요. 현재 위치 지도에서 보기를 눌러 다시 확인해 주세요.'
            : result.status === 'services-off'
              ? manual
                ? '위치 서비스가 꺼져 있어요. 기기 설정에서 켜거나 위치를 직접 선택해 주세요.'
                : '위치 서비스가 꺼져 있어요. 기기 설정에서 켠 뒤 다시 확인해 주세요.'
              : result.status === 'denied'
                ? Platform.OS === 'web'
                  ? '브라우저의 사이트 설정에서 위치 권한을 허용하거나 좌표를 직접 입력해 주세요.'
                  : result.canAskAgain
                    ? manual
                      ? '위치 권한을 허용하지 않았어요. 현재 위치 사용을 다시 누르거나 위치를 직접 선택해 주세요.'
                      : '위치 권한을 허용하지 않았어요. 현재 위치 지도에서 보기를 다시 눌러 주세요.'
                    : manual
                      ? '앱 설정에서 위치 권한을 허용하거나 위치를 직접 선택해 주세요.'
                      : '앱 설정에서 위치 권한을 허용한 뒤 다시 확인해 주세요.'
                : result.status === 'inaccurate'
                  ? `현재 위치의 정확도를 확인하지 못했어요. ${retry}`
                  : `현재 위치를 확인하지 못했어요. ${retry}`}
      </Text>
      {Platform.OS !== 'web' &&
      (result.status === 'services-off' ||
        (result.status === 'denied' && !result.canAskAgain)) ? (
        <Action
          label="기기 위치 설정 열기"
          disabled={disabled}
          onPress={onSettings}
        />
      ) : null}
    </View>
  );
}
