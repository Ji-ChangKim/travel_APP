import { useState } from 'react';
import { View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Text from '@/components/AppText';
import DesignButton from '@/components/DesignButton';
import { useTripStore } from '@/stores/useTripStore';
import { t } from '@/features/localization/translate';
import { readCreationDrafts as readLegacy } from './legacyCreationDraftStorage';
import { saveCreationDraft } from './creationDraftStorage';

// 이전 기기 자료는 사용자가 선택한 경우에만 업로드하고 이전 앱 탭과의 경합에 대비해 기기 원본은 보존한다.
export default function LegacyDraftImport({ userId }: { userId: string }) {
  const cache = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [imported, setImported] = useState(false);
  const [error, setError] = useState('');
  const query = useQuery({
    queryKey: ['legacy-drafts', userId],
    queryFn: () => readLegacy(userId),
    enabled: Boolean(userId),
    retry: false,
  });
  async function transfer() {
    if (busy || useTripStore.getState().currentUser?.id !== userId) return;
    setBusy(true);
    setError('');
    try {
      for (const draft of query.data || []) {
        if (useTripStore.getState().currentUser?.id !== userId) return;
        await saveCreationDraft({ ...draft, revision: 0 });
      }
      setImported(true);
    } catch {
      setError(
        '가져오지 못한 계획은 이 기기에 보관했어요. 연결 상태와 저장한 계획 수를 확인하고 다시 시도해 주세요.',
      );
    } finally {
      await cache.invalidateQueries({ queryKey: ['creation-drafts', userId] });
      await query.refetch();
      setBusy(false);
    }
  }
  if (imported || !userId || (!query.isError && !query.data?.length))
    return null;
  return (
    <View style={{ gap: 8 }}>
      <Text>
        {t(
          '이 기기에만 저장한 이전 계획이 있어요. 계정으로 가져오면 다른 기기에서도 이어 쓸 수 있어요.',
        )}
      </Text>
      {error && <Text accessibilityRole="alert">{t(error)}</Text>}
      <DesignButton
        label={
          query.isError
            ? t('임시 계획 다시 불러오기')
            : t('이 기기의 이전 계획 가져오기')
        }
        loading={busy}
        onPress={() => (query.isError ? void query.refetch() : void transfer())}
      />
    </View>
  );
}
