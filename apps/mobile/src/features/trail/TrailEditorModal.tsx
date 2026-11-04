import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Modal from '@/components/AppModal';
import ScreenHeader from '@/components/ScreenHeader';
import Text from '@/components/AppText';
import { t } from '@/features/localization/translate';
import { useLocale } from '@/features/localization/localeState';
import { closeEditor } from './trailActions';
import type { TrailModel } from './trailTypes';
import TrailEditorView from './TrailEditorView';
import { trailStyles as styles } from './trailStyles';

// 편집창의 표시·닫기와 본문 배치만 맡고 저장은 화면 행동 모듈에 위임한다.
export default function TrailEditorModal({ model }: { model: TrailModel }) {
  useLocale();
  return (
    <Modal
      visible={model.editor[0] !== null}
      animationType="slide"
      onRequestClose={closeEditor.bind(null, model)}
    >
      <SafeAreaView style={styles.screen}>
        <ScreenHeader
          title={
            model.editor[0] === 'journey'
              ? t('새 여행 만들기')
              : model.editor[0] === 'flight'
                ? t('항공편으로 기준 세우기')
                : model.editor[0] === 'plan'
                  ? t('장소 계획 작성')
                  : t('영수증으로 상세 기록')
          }
          onBack={closeEditor.bind(null, model)}
          backLabel={t('닫기')}
        />
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          <TrailEditorView model={model} />
          {model.notice[0] ? (
            <Text accessibilityRole="alert" style={styles.message}>
              {t(model.notice[0])}
            </Text>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
