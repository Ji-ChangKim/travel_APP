import { Image, View, StyleSheet } from 'react-native';
import Text from '@/components/AppText';
import { Action } from './ui';

// 준비된 이미지·상태·행동만 표시하고 인증·조회·캐시를 변경하지 않는다.
export default function PrivatePhotoView({
  uri,
  failed,
  fetching,
  attempt,
  fit,
  onFailure,
  onRetry,
}: {
  uri?: string;
  failed: boolean;
  fetching: boolean;
  attempt: number;
  fit: 'cover' | 'contain';
  onFailure: () => void;
  onRetry: () => void;
}) {
  // 기존 이미지 비율·문구·터치 동작을 그대로 유지한다.
  return uri ? (
    <Image
      key={`${attempt}:${uri}`}
      source={{ uri }}
      resizeMode={fit}
      resizeMethod="resize"
      style={photoStyles.image}
      accessibilityLabel="여행에 등록한 사진"
      onError={onFailure}
    />
  ) : (
    <View style={photoStyles.status}>
      <Text accessibilityRole={failed ? 'alert' : undefined}>
        {failed
          ? '사진을 불러오지 못했어요. 연결을 확인하고 다시 시도해 주세요.'
          : '사진을 불러오는 중입니다.'}
      </Text>
      {failed && (
        <Action
          label={fetching ? '사진을 다시 불러오는 중…' : '사진 다시 불러오기'}
          disabled={fetching}
          onPress={onRetry}
        />
      )}
    </View>
  );
}

// 원본 이미지를 바꾸지 않고 현행 사진 표시 치수를 유지한다.
const photoStyles = StyleSheet.create({
  image: { height: 180, width: '100%', borderRadius: 14 },
  status: { gap: 8 },
});
