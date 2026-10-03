import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { getServerMediaUrl, foundationQueryKey } from '@wherego/api-client';
import { serverOptions } from './service';

// 폼과 읽기 화면에 공통 버튼을 표시한다.
export function Action({
  label,
  onPress,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  // 처리 중 중복 클릭을 실제 disabled 상태로 차단한다.
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={[styles.button, disabled && { opacity: 0.45 }]}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}
// 접근성 이름을 가진 입력 필드 하나를 표시한다.
export function Field({
  label,
  value,
  onChange,
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
}) {
  // 화면의 라벨과 테스트·스크린리더 이름을 일치시킨다.
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        multiline={multiline}
        style={[styles.input, multiline && { minHeight: 90 }]}
        autoCapitalize="none"
      />
    </View>
  );
}
// 서버 권한이 적용된 사진 하나를 표시한다.
export function ServerPhoto({
  userId,
  tripId,
  mediaId,
}: {
  userId: string;
  tripId: string;
  mediaId: string;
}) {
  // 서명 URL은 60초 접근 권한이며 자동 재조회한다.
  const query = useQuery({
    queryKey: foundationQueryKey(userId, 'media', mediaId),
    queryFn: () => {
      // 현재 계정의 세션으로만 파일을 조회한다.
      return serverOptions(userId).then((options) => {
        // 파일 ID를 서버에 확인받는다.
        return getServerMediaUrl(options, tripId, mediaId);
      });
    },
    staleTime: 30000,
    refetchInterval: 45000,
    retry: 1,
  });
  // 실패는 빈 성공 이미지 대신 명시적으로 안내한다.
  return query.data ? (
    <Image
      source={{ uri: query.data }}
      style={{ height: 180, width: '100%', borderRadius: 14 }}
      accessibilityLabel="여행에 등록한 사진"
    />
  ) : (
    <Text>
      {query.isError
        ? '사진을 불러오지 못했습니다.'
        : '사진을 불러오는 중입니다.'}
    </Text>
  );
}
export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F7F6' },
  content: {
    padding: 20,
    gap: 16,
    maxWidth: 780,
    width: '100%',
    alignSelf: 'center',
  },
  header: { fontSize: 28, fontWeight: '800', color: '#182D26' },
  subtitle: { fontSize: 14, lineHeight: 22, color: '#52645D' },
  card: {
    padding: 18,
    gap: 12,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E1E8E4',
  },
  title: { fontSize: 18, fontWeight: '700', color: '#182D26' },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center' },
  button: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#246A54',
  },
  buttonText: { fontWeight: '700', color: '#FFFFFF' },
  label: { fontSize: 13, fontWeight: '600', color: '#52645D' },
  input: {
    borderWidth: 1,
    borderColor: '#CCD8D1',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    backgroundColor: '#FFFFFF',
    color: '#182D26',
  },
  error: { color: '#B42318', lineHeight: 22 },
  badge: {
    padding: 8,
    borderRadius: 9,
    backgroundColor: '#E9F2ED',
    color: '#246A54',
  },
  modal: { flex: 1, backgroundColor: '#F5F7F6' },
});
