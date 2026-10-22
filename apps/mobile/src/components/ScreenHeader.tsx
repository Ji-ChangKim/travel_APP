import { View, StyleSheet } from 'react-native';
import ScreenTitle from './ScreenTitle';
import HeaderAction from './HeaderAction';
import HeaderActions, { type HeaderActionItem } from './HeaderActions';
import { designTokens } from '@/constants/theme';

// 뒤로가기·제목·우측 행동을 화면마다 같은 순서와 규격으로 표시한다.
export default function ScreenHeader({
  title,
  backLabel,
  onBack,
  disabled = false,
  actions,
  inset = true,
  inlineTitle = true,
}: {
  title?: string;
  backLabel?: string;
  onBack?: () => void;
  disabled?: boolean;
  actions?: readonly HeaderActionItem[];
  inset?: boolean;
  inlineTitle?: boolean;
}) {
  // 글자 확대 여부로 빈 행을 만들지 않고 실제 콘텐츠만 배치한다.
  return (
    <View testID="screen-header" style={[s.header, inset && s.inset]}>
      <View testID="screen-header-row" style={s.row}>
        {onBack ? (
          <HeaderAction
            icon="back"
            label={backLabel || '이전 화면으로 돌아가기'}
            disabled={disabled}
            onPress={onBack}
          />
        ) : title ? (
          <ScreenTitle grow>{title}</ScreenTitle>
        ) : null}
        {onBack && title && inlineTitle ? (
          <ScreenTitle grow>{title}</ScreenTitle>
        ) : null}
        {actions?.length ? (
          <View style={s.right}>
            <HeaderActions actions={actions} disabled={disabled} />
          </View>
        ) : null}
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
    paddingVertical: designTokens.navigation.headerPaddingVertical,
    flexDirection: 'row',
    alignItems: 'center',
    gap: designTokens.navigation.headerActionGap,
  },
  heading: { paddingTop: 8, paddingBottom: 4 },
  right: {
    marginLeft: 'auto',
    flexShrink: 0,
    justifyContent: 'center',
  },
});
