import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DesignButton from '@/components/DesignButton';
import { useAppAccessibility } from '@/features/accessibility/appAccessibility';
import { colors } from '@/constants/theme';

// 일정의 고정 행동도 상세 화면과 같은 버튼 상태를 사용한다.
export default function TripHubActions({
  disabled,
  onAdd,
  onCapture,
  onLibrary,
  onMap,
}: {
  disabled: boolean;
  onAdd: () => void;
  onCapture: () => void;
  onLibrary: () => void;
  onMap: () => void;
}) {
  // 큰 글꼴에서는 글자 버튼과 아이콘 버튼을 다른 줄에 배치한다.
  const { largeText } = useAppAccessibility();
  return (
    <View style={s.dock}>
      <View style={[s.action, largeText && s.large]}>
        <DesignButton
          label="지도 보기"
          accessibilityLabel="동선 지도 보기"
          onPress={onMap}
        />
      </View>
      <View style={[s.action, largeText && s.large]}>
        <DesignButton
          label="일정 추가"
          variant="primary"
          disabled={disabled}
          onPress={onAdd}
        />
      </View>
      <DesignButton
        label=""
        size="icon"
        accessibilityLabel="영수증 촬영"
        disabled={disabled}
        onPress={onCapture}
        icon={(color) => {
          /* 촬영 아이콘도 실제 버튼 상태색을 따른다. */ return (
            <Ionicons name="camera-outline" size={20} color={color} />
          );
        }}
      />
      <DesignButton
        label=""
        size="icon"
        accessibilityLabel="영수증 사진 선택"
        disabled={disabled}
        onPress={onLibrary}
        icon={(color) => {
          /* 앨범 아이콘도 실제 버튼 상태색을 따른다. */ return (
            <Ionicons name="images-outline" size={20} color={color} />
          );
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  dock: {
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  action: { flex: 1, minWidth: 0 },
  large: { flexBasis: '45%', flexGrow: 1 },
});
