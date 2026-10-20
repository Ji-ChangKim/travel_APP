import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import ScreenTitle from './ScreenTitle';
import DesignButton from './DesignButton';
import { designTokens } from '@/constants/theme';

// 뒤로가기·제목·우측 행동을 화면마다 같은 순서와 규격으로 표시한다.
export default function ScreenHeader({
  title,
  backLabel,
  onBack,
  disabled = false,
  right,
  inset = true,
  inlineTitle = false,
}: {
  title?: string;
  backLabel?: string;
  onBack?: () => void;
  disabled?: boolean;
  right?: ReactNode;
  inset?: boolean;
  inlineTitle?: boolean;
}) {
  // 글자 확대 여부로 빈 행을 만들지 않고 실제 콘텐츠만 배치한다.
  return (
    <View testID="screen-header" style={[s.header, inset && s.inset]}>
      <View testID="screen-header-row" style={s.row}>
        {onBack ? (
          <DesignButton
            label=""
            accessibilityLabel={backLabel || '이전 화면으로 돌아가기'}
            size="icon"
            variant="quiet"
            disabled={disabled}
            onPress={onBack}
            icon={(color) => {
              /* 모든 뒤로가기는 같은 화살표와 상태색을 사용한다. */ return (
                <Ionicons name="arrow-back" size={24} color={color} />
              );
            }}
          />
        ) : title ? (
          <ScreenTitle style={s.rootTitle}>{title}</ScreenTitle>
        ) : null}
        {onBack && title && inlineTitle ? (
          <ScreenTitle style={s.rootTitle}>{title}</ScreenTitle>
        ) : null}
        {right ? <View style={s.right}>{right}</View> : null}
      </View>
      {onBack && title && !inlineTitle ? (
        <View style={s.heading}>
          <ScreenTitle>{title}</ScreenTitle>
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  header: {
    width: '100%',
    maxWidth: designTokens.navigation.headerMaxWidth,
    alignSelf: 'center',
  },
  inset: { paddingHorizontal: designTokens.layout.screenPaddingMobile },
  row: {
    minHeight: designTokens.navigation.headerMinHeight,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rootTitle: { flex: 1 },
  heading: { paddingTop: 8, paddingBottom: 4 },
  right: {
    marginLeft: 'auto',
    flexShrink: 0,
    justifyContent: 'center',
  },
});
