import { useState } from 'react';
import ActionSheet from '@/components/ActionSheet';
import { View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import Text from '@/components/AppText';
import DesignButton from '@/components/DesignButton';
import { t } from '@/features/localization/translate';
import { useLocale } from '@/features/localization/localeState';
import {
  removeCreationDraft,
  readCreationDrafts,
} from './creationDraftStorage';
import { homeStyles as s } from './homeStyles';

// 새 여행의 임시 입력과 서버에 이미 저장된 여행 계획을 분리한다.
export default function HomeDraftResume({
  userId,
  onOpen,
}: {
  userId: string;
  onOpen?: () => void;
}) {
  useLocale();
  const router = useRouter();
  const [removing, setRemoving] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function remove() {
    if (!removing || busy) return;
    setBusy(true);
    setError('');
    try {
      await removeCreationDraft(
        userId,
        removing,
        query.data?.find((draft) => draft.form.id === removing)?.revision,
      );
      await query.refetch();
      setRemoving(null);
    } catch {
      setError('임시 계획을 삭제하지 못했어요. 다시 시도해 주세요.');
    } finally {
      setBusy(false);
    }
  }
  const query = useQuery({
    queryKey: ['creation-drafts', userId],
    queryFn: () => readCreationDrafts(userId),
    enabled: Boolean(userId && userId !== 'public'),
    retry: false,
    staleTime: 0,
  });
  if (!userId || userId === 'public') return null;
  if (query.isError)
    return (
      <View style={s.section}>
        <Text>{t('임시 계획을 불러오지 못했어요.')}</Text>
        <DesignButton
          label={t('임시 계획 다시 불러오기')}
          onPress={() => void query.refetch()}
        />
      </View>
    );
  if (!query.data?.length) return null;
  return (
    <View testID="home-draft-resume" style={s.section}>
      <Text accessibilityRole="header" style={s.sectionTitle}>
        {t('작성하던 여행을 이어가세요')}
      </Text>
      {query.data.map((draft) => (
        <View key={draft.form.id} style={s.tripTicket}>
          <Text style={s.linkText}>
            {draft.form.values.title ||
              draft.form.values.city ||
              t('새 여행 계획')}
          </Text>
          {(draft.form.values.country || draft.form.values.city) && (
            <Text style={s.supporting}>
              {[draft.form.values.country, draft.form.values.city]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          )}
          <Text style={s.supporting}>
            {t(
              draft.step === 'flights'
                ? '2 / 2 · 항공권과 내용 확인'
                : '1 / 2 · 날짜와 여행지',
            )}
          </Text>
          <Text style={s.supporting}>{t('계정에 저장한 작성 중인 계획')}</Text>
          <DesignButton
            label={t('작성 이어가기')}
            onPress={() => {
              onOpen?.();
              router.push({
                pathname: '/new-trip',
                params: { resume: draft.form.id },
              });
            }}
          />
          <DesignButton
            label={t('임시 계획 삭제')}
            variant="quiet"
            onPress={() => {
              setError('');
              setRemoving(draft.form.id);
            }}
          />
        </View>
      ))}
      <ActionSheet
        visible={Boolean(removing)}
        title={t('임시 계획을 삭제할까요?')}
        onClose={() => setRemoving(null)}
        dismissDisabled={busy}
      >
        <Text>
          {t(
            '계정에 저장한 작성 내용을 삭제해요. 삭제한 내용은 복구할 수 없어요.',
          )}
        </Text>
        {error && <Text accessibilityRole="alert">{t(error)}</Text>}
        <DesignButton
          label={t('임시 계획 삭제')}
          loading={busy}
          onPress={() => void remove()}
        />
      </ActionSheet>
    </View>
  );
}
