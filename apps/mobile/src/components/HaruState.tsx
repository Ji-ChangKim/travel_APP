import type { ReactNode } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';

// 상태에 맞는 하루의 포즈와 보조기기 설명을 선택한다.
const poses = {
  loading: {
    source: require('../../assets/brand/haru-v1/TripPrint_Haru_loading_1233x1275.png'),
    label: '캐리어와 함께 걷는 하루',
  },
  error: {
    source: require('../../assets/brand/haru-v1/TripPrint_Haru_error_1024x1536.png'),
    label: '지도를 살펴보는 하루',
  },
  empty: {
    source: require('../../assets/brand/haru-v1/TripPrint_Haru_empty_1024x1536.png'),
    label: '손을 흔드는 하루',
  },
};

// 실제 상태와 안내·복귀 행동을 하루 일러스트로 표현한다.
export default function HaruState({
  kind,
  title,
  description,
  compact = false,
  children,
}: {
  kind: keyof typeof poses;
  title: string;
  description?: string;
  compact?: boolean;
  children?: ReactNode;
}) {
  // 가짜 진행률이나 자동 이동 없이 호출 화면의 상태와 행동만 보여준다.
  return (
    <View style={[styles.card, compact && styles.compact]}>
      <Image
        source={poses[kind].source}
        accessibilityLabel={poses[kind].label}
        resizeMode="contain"
        style={compact ? styles.smallPortrait : styles.portrait}
      />
      <View style={[styles.copy, compact && styles.compactCopy]}>
        <View style={styles.heading}>
          {kind === 'loading' && (
            <ActivityIndicator
              color="#C84432"
              accessibilityLabel="불러오는 중"
            />
          )}
          <Text
            style={[styles.title, compact && styles.compactTitle]}
            accessibilityRole={kind === 'error' ? 'alert' : undefined}
            accessibilityLiveRegion="polite"
          >
            {title}
          </Text>
        </View>
        {description && <Text style={styles.description}>{description}</Text>}
        {children && <View style={styles.actions}>{children}</View>}
      </View>
    </View>
  );
}

// 작은 화면에서도 읽히는 안내를 브랜드의 따뜻한 바탕 위에 배치한다.
const styles = StyleSheet.create({
  card: {
    width: '100%',
    alignItems: 'center',
    padding: 24,
    gap: 12,
    borderRadius: 24,
    backgroundColor: '#FFF9F3',
    borderWidth: 1,
    borderColor: '#F1E7DE',
  },
  compact: { flexDirection: 'row', padding: 14, gap: 14 },
  portrait: { width: 190, height: 210 },
  smallPortrait: { width: 64, height: 72 },
  copy: { width: '100%', gap: 10, alignItems: 'center' },
  compactCopy: { flex: 1, width: undefined, alignItems: 'flex-start' },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: {
    flexShrink: 1,
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '700',
    color: '#203247',
    textAlign: 'center',
  },
  compactTitle: { fontSize: 15, lineHeight: 22, textAlign: 'left' },
  description: {
    color: '#586878',
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 360,
  },
  actions: { width: '100%', alignItems: 'center', gap: 10, marginTop: 4 },
});
