import Text from '@/components/AppText';
import { useState } from 'react';
import { Image, View } from 'react-native';
import type { DiscoveryDestination } from '@wherego/domain';
import { cityGuides } from './cityGuides';
import { discoveryStyles as s } from './discoveryStyles';
import { Action } from './ui';

// 사진이 실패해도 같은 도시의 제목·소개·행동은 그대로 둔다.
export default function CityGuidePhoto({
  city,
  compact = false,
}: {
  city: DiscoveryDestination;
  compact?: boolean;
}) {
  // 재시도는 같은 도시 자산만 새 이미지 요청으로 표시한다.
  const [attempt, setAttempt] = useState(0);
  // 도시 전환과 각 재시도의 실패 상태를 서로 분리한다.
  return (
    <PhotoAttempt
      key={`${city.key}:${attempt}`}
      city={city}
      compact={compact}
      onRetry={() => {
        // 다른 도시 사진으로 교체하지 않고 같은 자산을 다시 읽는다.
        return setAttempt((previous) => {
          // 현재 도시의 재시도 순번만 올린다.
          return previous + 1;
        });
      }}
    />
  );
}

// 이미지 한 번의 성공·실패만 관리한다.
function PhotoAttempt({
  city,
  compact,
  onRetry,
}: {
  city: DiscoveryDestination;
  compact: boolean;
  onRetry: () => void;
}) {
  // 늦게 도착한 이전 이미지 오류는 새 시도의 상태를 바꾸지 못한다.
  const [failed, setFailed] = useState(false);
  // 실패 시 사진 영역만 도시 이름과 대체색으로 바꾼다.
  return failed ? (
    <View
      testID={`city-photo-fallback-${city.key}`}
      style={[
        s.photo,
        s.placeholder,
        {
          height: compact ? 176 : 240,
          borderRadius: compact ? 0 : 18,
          padding: 16,
          gap: 12,
        },
      ]}
    >
      <Text style={s.title}>{city.city}</Text>
      <Text accessibilityRole="alert">
        사진을 불러오지 못했어요. 여행 정보는 계속 볼 수 있어요.
      </Text>
      {!compact && (
        <Action label={`${city.city} 사진 다시 불러오기`} onPress={onRetry} />
      )}
    </View>
  ) : (
    <Image
      testID={`city-photo-${city.key}`}
      accessibilityLabel={cityGuides[city.key].photoDescription}
      source={cityGuides[city.key].photo}
      style={[s.photo, !compact && { height: 240, borderRadius: 18 }]}
      resizeMode="cover"
      onError={() => {
        // 사진 실패가 가이드 전체의 오류나 다른 사진 대체로 이어지지 않는다.
        return setFailed(true);
      }}
    />
  );
}
