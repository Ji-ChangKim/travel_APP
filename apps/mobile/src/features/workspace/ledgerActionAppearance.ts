import type { ViewStyle } from 'react-native';
import tokens from '../../../../../docs/02. 디자인/00. 공통규격/ledger-tokens.json';

export interface LedgerActionAppearance {
  emphasized: boolean;
  blocked: boolean;
  filled: boolean;
  checked?: boolean;
  quiet: boolean;
  focused: boolean;
  pressed: boolean;
}

// 버튼의 상태를 현행 토큰으로 표현하며 저장·탐색 동작은 처리하지 않는다.
export function ledgerActionContainer(
  state: LedgerActionAppearance,
): ViewStyle {
  // 높이·테두리는 선택 전후 고정하고 기존 색 조합을 유지한다.
  return {
    minHeight: state.emphasized
      ? tokens.control.primaryHeight
      : tokens.control.minimumHeight,
    backgroundColor: state.blocked
      ? tokens.color.soft
      : state.emphasized
        ? tokens.color.accent
        : state.filled
          ? tokens.color.navy
          : state.checked
            ? tokens.color.selected
            : state.quiet
              ? 'transparent'
              : tokens.color.soft,
    borderColor: state.focused
      ? tokens.color.ink
      : state.pressed
        ? tokens.color.accent
        : 'transparent',
  };
}

// 버튼 글자의 전경색을 같은 상태와 디자인 토큰에서 선택한다.
export function ledgerActionForeground(
  blocked: boolean,
  filled: boolean,
): string {
  // 색상 상수를 화면마다 반복하지 않고 비활성·채움 대비를 유지한다.
  return blocked
    ? tokens.color.muted
    : filled
      ? tokens.color.surface
      : tokens.color.ink;
}
