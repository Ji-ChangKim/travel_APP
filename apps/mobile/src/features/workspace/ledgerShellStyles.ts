import { StyleSheet } from 'react-native';
import { ledgerColors as c, ledgerLayout, ledgerControl } from './ledgerTheme';

// 셸의 배치 규격만 정의하고 사용자 동작과 서버 상태는 다루지 않는다.
export const ledgerShellStyles = StyleSheet.create({
  button: {
    minHeight: ledgerControl.minimumHeight,
    borderWidth: 2,
    borderRadius: ledgerControl.radius,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  buttonText: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'center',
  },
  sidebar: {
    width: ledgerLayout.sidebar,
    backgroundColor: c.soft,
    padding: 20,
    gap: 16,
  },
  brandBar: {
    minHeight: 64,
    paddingHorizontal: 20,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
