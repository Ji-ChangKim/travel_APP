import { useEffect, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  Image,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppModal from './AppModal';
import Text from './AppText';
import { colors, radii, typography } from '@/constants/theme';

type Props = {
  visible: boolean;
  title: string;
  paragraphs: string[];
  children: ReactNode;
  onClose?: () => void;
  priority?: number;
};

// 문구와 실제 행동은 호출 화면이 맡고, 안내창의 중앙 배치·읽기 순서만 공유한다.
export default function CenteredNoticeModal({
  visible,
  title,
  paragraphs,
  children,
  onClose,
  priority = 100,
}: Props) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // 비대칭 안전 영역에도 카드 중심을 옮기지 않고 양쪽에 같은 최소 여유를 확보한다.
  const vertical = Math.max(20, insets.top, insets.bottom);
  const horizontal = Math.max(20, insets.left, insets.right);
  useEffect(() => {
    if (!visible) return;
    const message = [title, ...paragraphs].filter(Boolean).join('. ');
    if (message) {
      AccessibilityInfo.announceForAccessibility?.(message);
    }
  }, [visible, title, paragraphs]);
  return (
    <AppModal
      native
      transparent
      visible={visible}
      priority={priority}
      animationType="none"
      accessibilityLabel={title}
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.center,
          { paddingVertical: vertical, paddingHorizontal: horizontal },
        ]}
        testID="entry-notice-stage"
      >
        <View
          accessibilityRole="alert"
          accessibilityLiveRegion="assertive"
          style={[
            styles.card,
            { maxHeight: Math.max(0, height - vertical * 2) },
          ]}
          testID="entry-notice-card"
        >
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
          >
            <Image
              source={require('../../../assets/brand/tripprint-v1/tripprint-app-icon-source.png')}
              style={styles.logo}
              resizeMode="contain"
              accessible={false}
            />
            <Text accessibilityRole="header" style={styles.title}>
              {title}
            </Text>
            <View style={styles.paragraphs}>
              {paragraphs.map((paragraph, index) => (
                <Text key={`${index}:${paragraph}`} style={styles.description}>
                  {paragraph}
                </Text>
              ))}
            </View>
            {children}
          </ScrollView>
        </View>
      </View>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: {
    width: '100%',
    maxWidth: 384,
    backgroundColor: colors.surface,
    borderRadius: radii.smallCard,
    overflow: 'hidden',
    boxShadow: '0px 8px 24px #20324726',
  },
  scroll: { flexGrow: 0, flexShrink: 1 },
  body: { padding: 24, gap: 16 },
  logo: { width: 80, height: (80 * 216) / 337, alignSelf: 'center' },
  title: {
    fontSize: typography.headlineSmall.size,
    lineHeight: typography.headlineSmall.lineHeight,
    fontWeight: '700',
    textAlign: 'center',
  },
  paragraphs: { gap: 4 },
  description: {
    fontSize: typography.bodySmall.size,
    lineHeight: typography.bodySmall.lineHeight,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
