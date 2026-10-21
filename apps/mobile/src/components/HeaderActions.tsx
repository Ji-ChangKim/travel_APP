import { View, StyleSheet } from 'react-native';
import type { ComponentProps } from 'react';
import HeaderAction from './HeaderAction';
import DesignButton from './DesignButton';
import { designTokens } from '@/constants/theme';
import { useFormScope } from '@/features/workspace/InputFeedback';

type IconAction = ComponentProps<typeof HeaderAction>;
type TextAction = {
  icon?: never;
  label: string;
  onPress: () => void;
  disabled?: boolean;
};
export type HeaderActionItem = IconAction | TextAction;

// 페이지는 행동만 전달하며 버튼의 모양과 간격은 공통 헤더가 소유한다.
export default function HeaderActions({
  actions,
  disabled,
}: {
  actions: readonly HeaderActionItem[];
  disabled: boolean;
}) {
  const locked = useFormScope().locked;
  return (
    <View style={s.actions}>
      {actions.map((action) =>
        action.icon ? (
          <HeaderAction
            key={action.icon}
            icon={action.icon}
            label={action.label}
            expanded={action.expanded}
            disabled={disabled || action.disabled}
            onPress={action.onPress}
          />
        ) : (
          <DesignButton
            key={action.label}
            label={action.label}
            size="header"
            variant="quiet"
            disabled={disabled || locked || action.disabled}
            onPress={action.onPress}
          />
        ),
      )}
    </View>
  );
}

const s = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: designTokens.navigation.headerActionGap,
  },
});
