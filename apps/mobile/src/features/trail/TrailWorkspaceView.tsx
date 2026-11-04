import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { t } from '@/features/localization/translate';
import { useLocale } from '@/features/localization/localeState';
import { returnToScreen } from '@/components/navigationModel';
import ScreenHeader from '@/components/ScreenHeader';
import Text from '@/components/AppText';
import type { Trip, Visit } from '@wherego/domain';
import type { TrailModel } from './trailTypes';
import { importTrip, openEditor, selectJourney } from './trailActions';
import { selectedJourney } from './trailSelectors';
import { TrailAction } from './TrailControls';
import TrailJourneyView from './TrailJourneyView';
import TrailEditorModal from './TrailEditorModal';
import { trailStyles as styles } from './trailStyles';

// 발자취의 시작·귀국·계획·실제 기록을 한 화면에 배치한다.
export default function TrailWorkspaceView({ model }: { model: TrailModel }) {
  useLocale();
  const router = useRouter();
  return (
    <SafeAreaView style={styles.screen}>
      <ScreenHeader
        title={t('나의 발자취')}
        backLabel={t('MY로 돌아가기')}
        onBack={() => {
          return returnToScreen(router, '/(tabs)/my');
        }}
      />
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <View>
          <Text style={styles.eyebrow}>{t('계획부터 여행 기록까지')}</Text>
          <Text style={styles.description}>
            {t(
              '날짜와 장소로 여행을 계획하고, 사진과 영수증으로 경험을 남겨보세요.',
            )}
          </Text>
        </View>
        <View style={styles.banner}>
          <Text style={styles.bannerTitle}>{t('이 기기에 남긴 여행')}</Text>
          <Text style={styles.small}>
            {t('여기에 남긴 기록은 이 기기에서만 볼 수 있어요.')}
          </Text>
        </View>
        <View style={styles.row}>
          <TrailAction
            label={t('+ 새 여행 계획')}
            disabled={model.state.loading || model.state.saving}
            onPress={openEditor.bind(null, model, 'journey', {})}
          />
        </View>
        <ExistingPlans model={model} trips={model.sourceTrips} />
        {model.state.error || model.notice[0] ? (
          <Text accessibilityRole="alert" style={styles.message}>
            {t(model.state.error || model.notice[0])}
          </Text>
        ) : null}
        {model.state.loading ? (
          <Text style={styles.small}>{t('기록을 불러오는 중입니다.')}</Text>
        ) : null}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.row}>
            {model.state.journeys.map((journey) => {
              return (
                <TrailAction
                  key={journey.id}
                  label={journey.title}
                  secondary={selectedJourney(model)?.id !== journey.id}
                  onPress={selectJourney.bind(null, model, journey.id)}
                  disabled={model.state.saving}
                />
              );
            })}
          </View>
        </ScrollView>
        {selectedJourney(model) ? (
          <TrailJourneyView model={model} journey={selectedJourney(model)!} />
        ) : !model.state.loading ? (
          <View style={styles.card}>
            <Text style={styles.title}>
              {t('첫 여행 계획을 만들어 보세요')}
            </Text>
            <Text style={styles.small}>
              {t(
                '여행 날짜와 장소를 정한 뒤 항공편을 추가해 보세요. 영수증도 일정에 연결해 보관할 수 있어요.',
              )}
            </Text>
          </View>
        ) : null}
        <LegacyVisits visits={model.legacyVisits} />
      </ScrollView>
      <TrailEditorModal model={model} />
    </SafeAreaView>
  );
}

// 이미 작성한 여행 계획을 영수증 기록에 활용하게 한다.
function ExistingPlans({ model, trips }: { model: TrailModel; trips: Trip[] }) {
  useLocale();
  // 기존 여행 원본은 변경하지 않고 복사해 확장한다.
  return trips.length ? (
    <View style={styles.card}>
      <Text style={styles.title}>{t('내 여행 계획 가져오기')}</Text>
      <Text style={styles.small}>
        {t(
          '기존 장소 계획을 복사해 영수증을 연결합니다. 이후 두 계획은 자동 동기화되지 않습니다.',
        )}
      </Text>
      <View style={styles.row}>
        {trips.map((trip) => {
          return (
            <TrailAction
              key={trip.id}
              label={trip.title}
              secondary
              disabled={
                model.state.loading ||
                model.state.saving ||
                model.state.journeys.some((journey) => {
                  return journey.sourceTripId === trip.id;
                })
              }
              onPress={importTrip.bind(null, model, trip)}
            />
          );
        })}
      </View>
    </View>
  ) : null;
}

// 예전 체크인 목록은 읽기 전용으로 유지한다.
function LegacyVisits({ visits }: { visits: Visit[] }) {
  useLocale();
  // 영수증 확인을 예전 인증 배지로 바꾸지 않는다.
  return visits.length ? (
    <View style={styles.card}>
      <Text style={styles.title}>{t('기존 체크인 기록')}</Text>
      <Text style={styles.small}>
        {t('기존 내 여행에서 기록한 체크인입니다.')}
      </Text>
      {visits.map((visit) => {
        return (
          <Text style={styles.body} key={visit.id}>
            {visit.place?.name ?? t('방문 장소')} ·{' '}
            {visit.visitedAt.slice(0, 10)}
          </Text>
        );
      })}
    </View>
  ) : null;
}
