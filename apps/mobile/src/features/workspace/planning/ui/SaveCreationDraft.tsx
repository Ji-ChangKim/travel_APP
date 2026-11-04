import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import Text from '@/components/ui/AppText';
import DesignButton from '@/components/ui/DesignButton';
import { useTripStore } from '@/stores/useTripStore';
import { t } from '@/features/localization/translate';
import { makeCreationDraft } from '../model/creationDraftModel';
import { saveCreationDraft } from '../manager/creationDraftStorage';
import type { PlanForm } from '../../shared/model/forms';
import { requestCreationLogin } from '../model/requestCreationLogin';
import { updateSavedCreation } from '../model/creationAuthHandoff';

// 명시적으로 저장한 입력만 홈에서 이어 쓰며 저장 실패 때는 작성 화면을 유지한다.
export default function SaveCreationDraft({
  userId,
  form,
  step,
  locked,
  onPending,
  onSaved,
}: {
  userId: string;
  form: PlanForm;
  step: string;
  locked: boolean;
  onPending: (pending: boolean) => void;
  onSaved: (revision: number) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [savedValues, setSavedValues] = useState('');
  const currentValues = JSON.stringify(
    Object.fromEntries(
      Object.entries(form.values).filter(([key]) => !key.startsWith('_')),
    ),
  );
  const lock = useRef(false);
  const alive = useRef(true);
  const router = useRouter();
  const cache = useQueryClient();
  const guest = useTripStore(
    (state) => !state.currentUser || state.currentUser.authProvider === 'guest',
  );
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  async function save() {
    if (
      lock.current ||
      locked ||
      useTripStore.getState().currentUser?.id !== userId
    )
      return;
    lock.current = true;
    setBusy(true);
    onPending(true);
    setError('');
    setSavedValues('');
    try {
      const result = await saveCreationDraft(
        makeCreationDraft(userId, form, step),
      );
      if (alive.current && useTripStore.getState().currentUser?.id === userId) {
        onSaved(result.revision);
        updateSavedCreation(form, step, result.revision);
        setSavedValues(currentValues);
      }
      await cache.invalidateQueries({ queryKey: ['creation-drafts', userId] });
    } catch {
      if (alive.current)
        setError(
          '계획을 저장하지 못했어요. 연결 상태와 계획 수(최대 5개)를 확인해 주세요. 다른 기기에서 수정했다면 최신 계획을 다시 열어 주세요.',
        );
    } finally {
      lock.current = false;
      if (alive.current) {
        setBusy(false);
        onPending(false);
      }
    }
  }
  if (guest)
    return (
      <View style={{ gap: 8 }}>
        <DesignButton
          label={t('로그인하고 계획 저장하기')}
          disabled={locked}
          onPress={() => {
            try {
              requestCreationLogin(router, form, step);
            } catch {
              setError(
                '작성 내용을 보관하지 못했어요. 현재 화면에서 다시 시도해 주세요.',
              );
            }
          }}
        />
        {error && <Text accessibilityRole="alert">{t(error)}</Text>}
      </View>
    );
  return (
    <View style={{ gap: 8 }}>
      <DesignButton
        label={t('나중에 계속하기')}
        variant="secondary"
        disabled={locked}
        loading={busy}
        onPress={() => void save()}
      />
      <Text>{t('계정에 저장하고 다른 기기에서도 이어서 작성해요.')}</Text>
      {savedValues === currentValues && (
        <Text accessibilityLiveRegion="polite">
          {t('초안을 저장했어요. 계속 작성할 수 있어요.')}
        </Text>
      )}
      {error && <Text accessibilityRole="alert">{t(error)}</Text>}
    </View>
  );
}
