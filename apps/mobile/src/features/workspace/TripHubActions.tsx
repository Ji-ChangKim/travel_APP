import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// 긴 일정에서도 추가·촬영 버튼을 화면 하단에 고정한다.
export default function TripHubActions({
  disabled,
  onAdd,
  onCapture,
  onLibrary,
}: {
  disabled: boolean;
  onAdd: () => void;
  onCapture: () => void;
  onLibrary: () => void;
}) {
  // 갤러리 선택도 보조기기 이름과 충분한 터치 영역을 제공한다.
  return (
    <View style={s.dock}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="일정 추가"
        accessibilityState={{ disabled }}
        disabled={disabled}
        style={[s.primary, disabled && s.disabled]}
        onPress={onAdd}
      >
        <Ionicons name="add" size={18} color="#FFFFFF" />
        <Text style={s.primaryText}>일정 추가</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="영수증 촬영"
        accessibilityState={{ disabled }}
        disabled={disabled}
        style={[s.secondary, disabled && s.disabled]}
        onPress={onCapture}
      >
        <Ionicons name="camera-outline" size={18} color="#203247" />
        <Text style={s.secondaryText}>영수증 촬영</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="영수증 사진 선택"
        accessibilityState={{ disabled }}
        disabled={disabled}
        style={[s.library, disabled && s.disabled]}
        onPress={onLibrary}
      >
        <Ionicons name="images-outline" size={21} color="#203247" />
      </Pressable>
    </View>
  );
}

// 하단 안전 영역은 상위 화면이 보장하며 버튼은 최소 48px 높이를 가진다.
const s = StyleSheet.create({
  dock: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E9EDF0',
    flexDirection: 'row',
    gap: 8,
  },
  primary: {
    flex: 1,
    minHeight: 48,
    borderRadius: 24,
    backgroundColor: '#C84432',
    flexDirection: 'row',
    gap: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondary: {
    flex: 1,
    minHeight: 48,
    borderRadius: 24,
    backgroundColor: '#F0F3F5',
    flexDirection: 'row',
    gap: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  library: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F0F3F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  secondaryText: { color: '#203247', fontSize: 13, fontWeight: '600' },
  disabled: { opacity: 0.45 },
});
