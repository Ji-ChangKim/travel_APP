import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

// 모바일 환경에서만 부드러운 햅틱 피드백을 제공하고 웹 브라우저는 조용히 통과한다.
export function triggerHaptic(
  type: 'light' | 'medium' | 'selection' = 'light',
): void {
  if (Platform.OS === 'web') return;
  try {
    if (type === 'selection') {
      void Haptics.selectionAsync();
    } else if (type === 'medium') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  } catch {
    // 햅틱 미지원 기기 또는 권한 오류는 무시한다.
  }
}
