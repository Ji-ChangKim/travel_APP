import { useRef, useState } from 'react';
import { View } from 'react-native';
import Text from '@/components/ui/AppText';
import DesignButton from '@/components/ui/DesignButton';
import ActionSheet from '@/components/ui/ActionSheet';
import { changeLanguage, useLocale } from './localeState';
import { languageNames, languages, type AppLanguage } from './localeModel';
import { t } from './translate';

// 로그인 전과 MY에서 같은 언어 설정을 사용하고 계정 데이터는 변경하지 않는다.
export default function LanguagePicker() {
  const language = useLocale();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const saving = useRef(false);
  async function select(next: AppLanguage) {
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    setError(false);
    try {
      await changeLanguage(next);
      setOpen(false);
    } catch {
      setError(true);
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  return (
    <View style={{ gap: 12 }}>
      <DesignButton
        label={`${t('언어 / Language')} · ${languageNames[language]}`}
        onPress={() => setOpen(true)}
      />
      <ActionSheet
        visible={open}
        title={t('언어 / Language')}
        onClose={() => setOpen(false)}
        dismissDisabled={busy}
      >
        <View style={{ gap: 12 }}>
          <Text>
            {t(
              '이 기기에서 사용할 언어를 선택해 주세요. 여행 기록은 원문 그대로 유지돼요.',
            )}
          </Text>
          {languages.map((value) => (
            <DesignButton
              key={value}
              label={languageNames[value]}
              selected={language === value}
              disabled={busy}
              onPress={() => {
                void select(value);
              }}
            />
          ))}
          {error ? (
            <Text accessibilityRole="alert">
              {t('언어 설정을 저장하지 못했어요. 다시 시도해 주세요.')}
            </Text>
          ) : null}
        </View>
      </ActionSheet>
    </View>
  );
}
