import { Image, View } from 'react-native';
import Text from '@/components/AppText';
import { t } from '@/features/localization/translate';
import { useLocale } from '@/features/localization/localeState';
import type { TrailJourney, TrailPlan, TrailReceipt } from '@wherego/domain';
import type { TrailModel } from './trailTypes';
import {
  deletePlan,
  deleteReceipt,
  flightForm,
  openAttachment,
  openEditor,
} from './trailActions';
import { TrailAction } from './TrailControls';
import { trailStyles as styles } from './trailStyles';

// 여행 기준과 날짜별 계획을 보여준다.
export default function TrailJourneyView({
  model,
  journey,
}: {
  model: TrailModel;
  journey: TrailJourney;
}) {
  useLocale();
  return (
    <View style={styles.section}>
      <View style={styles.card}>
        <Text style={styles.title}>{journey.title}</Text>
        <Text style={styles.small}>
          {journey.city} · {journey.startDate} ~ {journey.endDate}
        </Text>
        <Text style={styles.small}>
          {t(
            '가는 편 출발일 → 오는 편 도착일을 여행 기간으로 사용합니다. 공항별 현지 시각·UTC 오프셋을 함께 기록합니다.',
          )}
        </Text>
      </View>
      <View style={styles.sectionHeader}>
        <Text style={styles.title}>{t('01 항공편 기준표')}</Text>
        <TrailAction
          label={t('편명 검색·등록')}
          secondary
          disabled={model.state.saving}
          onPress={openEditor.bind(null, model, 'flight', {
            direction: 'outbound',
            flightNumber: '',
            departureAirport: '',
            arrivalAirport: '',
            departureDate: journey.startDate,
            arrivalDate: journey.startDate,
            departureTime: '',
            arrivalTime: '',
            departureOffset: '+09:00',
            arrivalOffset: '+09:00',
            searchDate: journey.startDate,
          })}
        />
      </View>
      {journey.flights.length === 0 ? (
        <Text style={styles.small}>
          {t('가는 편과 오는 편을 각각 등록해 출발·귀국의 기준을 세우세요.')}
        </Text>
      ) : (
        journey.flights.map((flight) => {
          // 서로 다른 공항의 현지 시각을 원문으로 표시한다.
          return (
            <View style={styles.card} key={flight.id}>
              <Text style={styles.tag}>
                {flight.direction === 'outbound' ? t('가는 편') : t('오는 편')}{' '}
                · {flight.flightNumber} {t('· 직접 확인')}
              </Text>
              <Text style={styles.title}>
                {flight.departureAirport} → {flight.arrivalAirport}
              </Text>
              <Text style={styles.small}>
                {t('출발')} {flight.departureAt.replace('T', ' ')}
                {'\n'}
                {t('도착')} {flight.arrivalAt.replace('T', ' ')}
              </Text>
              <TrailAction
                label={t('편명·시각 수정')}
                secondary
                disabled={model.state.saving}
                onPress={openEditor.bind(
                  null,
                  model,
                  'flight',
                  flightForm(flight),
                )}
              />
            </View>
          );
        })
      )}
      <View style={styles.sectionHeader}>
        <Text style={styles.title}>{t('02 날짜별 계획')}</Text>
        <TrailAction
          label={t('+ 일정 생성')}
          secondary
          disabled={model.state.saving}
          onPress={openEditor.bind(null, model, 'plan', {
            date: journey.startDate,
            time: '09:00',
            title: '',
            address: '',
            memo: '',
          })}
        />
      </View>
      {journey.plans.length === 0 ? (
        <Text style={styles.small}>
          {t('방문할 장소와 날짜·시각을 적어 계획표를 만드세요.')}
        </Text>
      ) : (
        journey.plans.map((plan) => {
          return (
            <PlanCard
              key={plan.id}
              model={model}
              journey={journey}
              plan={plan}
            />
          );
        })
      )}
      <View style={styles.card}>
        <Text style={styles.title}>{t('03 영수증으로 남긴 발자취')}</Text>
        <Text style={styles.small}>
          {journey.plans.length}
          {t('개 계획 ·')} {journey.receipts.length}
          {t('개 영수증')}
          {'\n'}
          {t(
            '실제 결제 내역은 연결한 장소 카드에 표시됩니다. 통화가 다른 금액은 합산하지 않습니다.',
          )}
        </Text>
      </View>
    </View>
  );
}

// 장소 계획과 연결된 구매 상세를 표시한다.
function PlanCard({
  model,
  journey,
  plan,
}: {
  model: TrailModel;
  journey: TrailJourney;
  plan: TrailPlan;
}) {
  useLocale();
  return (
    <View style={styles.card}>
      <Text style={styles.tag}>
        {plan.date} · {plan.time} {t('계획')}
      </Text>
      <Text style={styles.title}>{plan.title}</Text>
      {plan.address ? <Text style={styles.small}>{plan.address}</Text> : null}
      {plan.memo ? <Text style={styles.body}>{plan.memo}</Text> : null}
      <View style={styles.row}>
        <TrailAction
          label={t('계획 수정')}
          secondary
          onPress={openEditor.bind(null, model, 'plan', { ...plan })}
          disabled={model.state.saving}
        />
        <TrailAction
          label={t('영수증 등록')}
          onPress={openEditor.bind(null, model, 'receipt', {
            planId: plan.id,
            merchant: plan.title,
            date: plan.date,
            time: plan.time,
            amount: '',
            currency: 'KRW',
            details: '',
            note: '',
          })}
          disabled={model.state.saving}
        />
        <TrailAction
          label={t('일정 삭제')}
          secondary
          onPress={deletePlan.bind(null, model, journey, plan.id)}
          disabled={model.state.saving}
        />
      </View>
      {journey.receipts
        .filter((receipt) => {
          return receipt.planId === plan.id;
        })
        .map((receipt) => {
          return (
            <ReceiptCard
              key={receipt.id}
              receipt={receipt}
              model={model}
              journey={journey}
            />
          );
        })}
    </View>
  );
}

// 영수증 등록 내용을 계획과 구분해 표시한다.
function ReceiptCard({
  receipt,
  model,
  journey,
}: {
  receipt: TrailReceipt;
  model: TrailModel;
  journey: TrailJourney;
}) {
  useLocale();
  // JPG/PNG는 미리보기, PDF는 첨부 버튼으로 제공한다.
  return (
    <View style={styles.receipt}>
      <Text style={styles.tag}>{t('영수증 · 사용자 확인')}</Text>
      <Text style={styles.title}>
        {receipt.merchant} · {receipt.amount} {receipt.currency}
      </Text>
      <Text style={styles.small}>
        {t('실제 결제')} {receipt.date} {receipt.time}
      </Text>
      <Text style={styles.body}>{receipt.details}</Text>
      {receipt.note ? <Text style={styles.small}>{receipt.note}</Text> : null}
      {receipt.attachment.mimeType.startsWith('image/') ? (
        <Image
          source={{ uri: receipt.attachment.uri }}
          style={styles.preview}
          resizeMode="contain"
          accessibilityLabel={t('{p0} 영수증 원본', { p0: receipt.merchant })}
        />
      ) : null}
      <Text style={styles.small}>{receipt.attachment.name}</Text>
      <View style={styles.row}>
        <TrailAction
          label={t('원본 열기')}
          secondary
          onPress={openAttachment.bind(null, model, receipt.attachment)}
        />
        <TrailAction
          label={t('기록 삭제')}
          secondary
          disabled={model.state.saving}
          onPress={deleteReceipt.bind(null, model, journey, receipt.id)}
        />
      </View>
    </View>
  );
}
