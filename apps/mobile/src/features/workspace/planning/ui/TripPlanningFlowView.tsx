import type { RenderTripPlanningProps } from '../model/tripPlanningViewTypes';
import TripPlanningProgress from './TripPlanningProgress';
import TripPlanningBasics from './TripPlanningBasics';
import TripPlanningFlights from './TripPlanningFlights';
import { t } from '@/features/localization/translate';
import Text from '@/components/ui/AppText';
import ScreenHeader from '@/components/navigation/ScreenHeader';

import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ModalBackground from '../../../accessibility/ModalBackground';

import SaveCreationDraft from './SaveCreationDraft';

import { styles } from '../../hub/styles/workspaceStyles';

// 여행 기본 정보와 항공권 단계의 입력을 배치한다.
export function renderTripPlanning({
  step,
  recording,
  back,
  props,
  next,
  create,
  scroll,
  setBasicsError,
  items,
  setSlot,
  basicsError,
}: RenderTripPlanningProps) {
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.modal}>
      <ModalBackground>
        <ScreenHeader
          title={
            step === 'basics'
              ? recording
                ? t('다녀온 여행 기록하기')
                : t('여행 만들기')
              : t('항공편 등록')
          }
          backLabel={
            step === 'basics'
              ? t('내 여행으로 돌아가기')
              : t('여행 만들기로 돌아가기')
          }
          onBack={back}
          disabled={props.locked}
        />
        <ScrollView
          ref={scroll}
          contentContainerStyle={[
            styles.content,
            { maxWidth: 640, paddingBottom: 32 },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          {step !== 'basics' && (
            <TripPlanningProgress step={step} recording={recording} />
          )}
          {step === 'basics' ? (
            <TripPlanningBasics
              props={props}
              recording={recording}
              next={next}
              create={create}
              setBasicsError={setBasicsError}
            />
          ) : (
            <TripPlanningFlights
              props={props}
              items={items}
              setSlot={setSlot}
              recording={recording}
            />
          )}
          {step !== 'basics' && (
            <SaveCreationDraft
              onPending={props.onDraftPending}
              onSaved={props.onDraftSaved}
              userId={props.userId}
              form={props.form}
              step={step}
              locked={props.locked}
            />
          )}
          {basicsError || props.error ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {basicsError || props.error}
            </Text>
          ) : null}
        </ScrollView>
      </ModalBackground>
    </SafeAreaView>
  );
}
