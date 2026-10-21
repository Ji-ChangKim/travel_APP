import Text from '@/components/AppText';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { homeColors as colors } from './homeTheme';
import HomeHeroBackground from './HomeHeroBackground';

interface Props {
  disabled: boolean;
  onCreateTrip: () => void;
  onExplore: () => void;
}

// 첨부한 여행 일러스트 위에 실제 여행 생성과 공개 일정 탐색을 연결한다.
export default function HomeEmptyHero({
  disabled,
  onCreateTrip,
  onExplore,
}: Props) {
  // 기본 카드 비율을 따르되 글자가 커지면 내용 높이만큼 확장한다.
  const { width } = useWindowDimensions();
  const [cardWidth, setCardWidth] = useState(0);
  return (
    <View
      testID="home-empty-hero"
      style={[
        styles.card,
        {
          minHeight: Math.min(
            380,
            ((cardWidth || Math.min(width, 640) - 40) * 638) / 716,
          ),
        },
      ]}
      onLayout={(event) => {
        // 안전 영역을 제외한 실제 카드 너비로 시안의 비율을 계산한다.
        return setCardWidth(event.nativeEvent.layout.width);
      }}
    >
      <HomeHeroBackground />
      <View style={styles.copy}>
        <Text
          accessibilityRole="header"
          accessibilityLabel="다음 여행, 어디로 떠나볼까요?"
          style={styles.title}
        >
          다음 여행,
          <Text aria-hidden style={styles.mark}>
            {' '}
            {' ///'}
          </Text>
          {'\n'}어디로 떠나볼까요?
        </Text>
        <Text style={styles.description}>
          하루와 함께 가고 싶은 곳부터{'\n'}담아보세요.
        </Text>
      </View>
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="새 여행 만들기"
          accessibilityState={{ disabled }}
          disabled={disabled}
          onPress={onCreateTrip}
          style={({ pressed }) => {
            // 사용 불가와 눌림은 배경 그림이 아닌 버튼에만 반영한다.
            return [
              styles.create,
              disabled && styles.disabled,
              pressed && styles.pressed,
            ];
          }}
        >
          <Ionicons name="add" size={20} color={colors.surface} />
          <Text style={styles.createText}>새 여행 만들기</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="다른 여행자의 일정 둘러보기"
          onPress={onExplore}
          style={styles.explore}
        >
          <Text style={styles.exploreText}>다른 여행자의 일정 둘러보기</Text>
          <Ionicons name="arrow-forward" size={16} color="#37474F" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 20,
    justifyContent: 'space-between',
    gap: 24,
    overflow: 'hidden',
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 2,
  },
  copy: { paddingTop: 4, paddingLeft: 4, gap: 8 },
  title: {
    color: '#142338',
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  mark: { color: '#FF8A65', fontSize: 18, fontWeight: '700' },
  description: {
    color: '#455A74',
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '500',
  },
  actions: { gap: 10, paddingBottom: 4 },
  create: {
    minHeight: 52,
    borderRadius: 16,
    padding: 12,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 18,
    elevation: 3,
  },
  createText: {
    color: colors.surface,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '700',
    flexShrink: 1,
  },
  explore: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  exploreText: {
    color: '#37474F',
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'center',
  },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.85 },
});
