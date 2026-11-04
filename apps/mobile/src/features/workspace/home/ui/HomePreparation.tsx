import { useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ActionSheet from '@/components/ui/ActionSheet';
import Text from '@/components/ui/AppText';
import DesignButton from '@/components/ui/DesignButton';
import { t } from '@/features/localization/translate';
import { useLocale } from '@/features/localization/localeState';
import { homeColors as colors } from '../styles/homeTheme';
import { openGuideSource } from '../../community/manager/openGuideSource';

const guides = [
  {
    title: '결제·교통카드',
    icon: 'card-outline',
    region: '일본',
    name: 'Welcome Suica Mobile',
    description:
      '교통카드와 모바일 결제를 준비해요. 지원 기기와 충전 조건은 공식 안내에서 확인해 주세요.',
    source: 'JNTO',
    url: 'https://www.japan.travel/en/plan/cashless-payments-in-japan/',
  },
  {
    title: '택시 앱',
    icon: 'car-outline',
    region: '동남아',
    name: 'Grab',
    description:
      '이동할 도시의 차량 호출 서비스와 결제 방법을 확인해 보세요. 제공 서비스는 지역마다 달라요.',
    source: 'Grab',
    url: 'https://www.grab.com/global/rides/',
  },
  {
    title: '버스·철도',
    icon: 'bus-outline',
    region: '일본',
    name: 'Japan Travel · JR East App',
    description:
      '대중교통 경로와 철도 정보를 찾는 앱을 살펴보세요. 이용할 노선과 지원 언어를 먼저 확인해 주세요.',
    source: 'GO TOKYO',
    url: 'https://www.gotokyo.org/en/plan/useful-apps/index.html',
  },
  {
    title: '현지 여행 정보',
    icon: 'information-circle-outline',
    region: '일본',
    name: 'Travel Japan',
    description: '여행 준비와 현지 이동에 필요한 관광청 안내를 확인해 보세요.',
    source: 'JNTO',
    url: 'https://www.japan.travel/en/responsible-travel-guide/features/traveling-comfortably/',
  },
] as const;

// 지역과 출처를 함께 보여주며 서비스별 최신 조건은 공식 안내로 연결한다.
export default function HomePreparation() {
  useLocale();
  const [selected, setSelected] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const guide = selected === null ? null : guides[selected];
  async function open() {
    if (!guide || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      await openGuideSource(guide.url);
    } catch {
      setError('링크를 열지 못했어요. 다시 시도하거나 닫아 주세요.');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <View testID="home-preparation" style={s.section}>
      <Text accessibilityRole="header" style={s.title}>
        {t('떠나기 전에 챙겨보세요')}
      </Text>
      <View style={s.grid}>
        {guides.map((item, index) => (
          <Pressable
            key={item.title}
            accessibilityRole="button"
            accessibilityLabel={t(item.title)}
            style={s.card}
            onPress={() => {
              setError('');
              setSelected(index);
            }}
          >
            <Ionicons name={item.icon} size={24} color={colors.primary} />
            <Text style={s.label}>{t(item.title)}</Text>
            <Text style={s.meta}>{t(item.region)}</Text>
          </Pressable>
        ))}
      </View>
      <ActionSheet
        visible={Boolean(guide)}
        title={guide ? t(guide.title) : ''}
        onClose={() => setSelected(null)}
        dismissDisabled={busy}
      >
        {guide && (
          <>
            <Text style={s.title}>{guide.name}</Text>
            <Text style={s.meta}>
              {t(guide.region)} · {guide.source}
            </Text>
            <Text style={s.body}>{t(guide.description)}</Text>
            <Text style={s.meta}>
              {t('정보 확인일: {date}', { date: '2026-10-26' })}
            </Text>
            {error && (
              <Text accessibilityRole="alert" style={s.body}>
                {t(error)}
              </Text>
            )}
            <DesignButton
              label={t('공식 안내 보기')}
              loading={busy}
              onPress={() => void open()}
            />
          </>
        )}
      </ActionSheet>
    </View>
  );
}
const s = StyleSheet.create({
  section: { gap: 12 },
  title: { fontSize: 18, lineHeight: 26, fontWeight: '700', color: colors.ink },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: {
    flexBasis: '44%',
    flexGrow: 1,
    padding: 16,
    gap: 8,
    minHeight: 112,
    borderRadius: 16,
    backgroundColor: colors.surface,
  },
  label: { fontSize: 16, lineHeight: 24, fontWeight: '600', color: colors.ink },
  meta: { fontSize: 14, lineHeight: 22, color: colors.muted },
  body: { fontSize: 16, lineHeight: 24, color: colors.ink },
});
