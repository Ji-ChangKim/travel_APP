import { useEffect, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import {
  Image,
  Modal,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Crypto from 'expo-crypto';
import { z } from 'zod';
import type {
  TrailJourney,
  TrailPlan,
  TrailReceipt,
  Trip,
  ItineraryItem,
  Visit,
} from '@wherego/domain';
import {
  trailFlightSchema,
  trailJourneySchema,
  trailPlanSchema,
  trailReceiptSchema,
  foundationUuidSchema,
  calendarDateSchema,
} from '@wherego/validation';
import { colors } from '@/constants/theme';
import { useTripStore } from '@/stores/useTripStore';
import {
  applyTrailFlight,
  applyTrailPlan,
  applyTrailReceipt,
  flightSearchUrl,
  removeTrailPlan,
} from './model';
import {
  cleanupTrailAttachment,
  openTrailAttachment,
  pickTrailAttachment,
} from './storage';
import { loadTrailWorkspace, saveTrailJourney, useTrailStore } from './store';

type Editor = 'journey' | 'flight' | 'plan' | 'receipt' | null;
type StatePair<T> = [T, Dispatch<SetStateAction<T>>];
type Form = Record<string, string>;
interface Model {
  scope: string;
  ownerId: string;
  state: ReturnType<typeof useTrailStore.getState>;
  active: StatePair<string>;
  editor: StatePair<Editor>;
  form: StatePair<Form>;
  attachment: StatePair<TrailReceipt['attachment'] | null>;
  notice: StatePair<string>;
}

// 현재 계정의 발자취 작업 공간을 렌더링한다.
export default function TrailScreen() {
  // 계정 변경 시 이전 폼과 선택 기록도 함께 분리한다.
  return (
    <TrailSession key={useTripStore(selectOwnerId)} scope="device-draft" />
  );
}

// 로그인 전에는 이 기기의 별도 초안 영역을 사용한다.
function selectOwnerId(
  state: ReturnType<typeof useTripStore.getState>,
): string {
  // 기존 계획 가져오기에만 현재 프로토타입 사용자 ID를 사용한다.
  return state.currentUser?.id ?? '';
}

// 기능별 입력 상태를 단일 화면 모델로 묶는다.
function useTrailModel(scope: string): Model {
  // 개별 상태 훅은 항상 같은 순서로 실행한다.
  return {
    scope,
    ownerId: useTripStore(selectOwnerId),
    state: useTrailStore(),
    active: useState(''),
    editor: useState<Editor>(null),
    form: useState<Form>({}),
    attachment: useState<TrailReceipt['attachment'] | null>(null),
    notice: useState(''),
  };
}

// 세션별 작업 공간을 연결한다.
function TrailSession({ scope }: { scope: string }) {
  // 화면은 하나의 모델만 전달받는다.
  return <Workspace model={useTrailModel(scope)} />;
}

// 계정에 해당하는 기기 저장 내용을 불러온다.
function Hydration({ scope }: { scope: string }) {
  // 비동기 작업을 React effect의 정리 함수로 반환하지 않는다.
  return useHydration(scope) ?? null;
}

// 기기 읽기를 계정 변경에 연결한다.
function useHydration(scope: string): void {
  // 렌더링 중 파일을 읽거나 저장하지 않는다.
  return useEffect(() => {
    // 해당 계정의 읽기 작업을 시작한다.
    return beginHydration(scope);
  }, [scope]);
}

// effect에서 비동기 읽기 작업 하나를 시작한다.
function beginHydration(scope: string): void {
  // 저장소 오류는 store가 처리한다.
  void loadTrailWorkspace(scope);
}

// 선택한 여행 또는 첫 콘텐츠를 반환한다.
function selectedJourney(model: Model): TrailJourney | undefined {
  // 계정의 현재 저장 결과 안에서만 ID를 찾는다.
  return (
    model.state.journeys.find((journey) => {
      // 외부 계정 기록을 선택할 수 없다.
      return journey.id === model.active[0];
    }) ?? model.state.journeys[0]
  );
}

// 발자취의 시작·귀국·계획·실제 기록을 한 화면에 배치한다.
function Workspace({ model }: { model: Model }) {
  // 저장 준비 전에는 입력 액션을 비활성화한다.
  return (
    <SafeAreaView style={styles.screen}>
      <Hydration scope={model.scope} />
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <View>
          <Text style={styles.eyebrow}>PLAN → EXPERIENCE → TRACE</Text>
          <Text style={styles.hero}>나의 발자취</Text>
          <Text style={styles.description}>
            항공편으로 여행의 기준을 잡고,{'\n'}계획한 장소에 영수증과 경험을
            남겨보세요.
          </Text>
        </View>
        <View style={styles.banner}>
          <Text style={styles.bannerTitle}>이 기기에 남긴 여행</Text>
          <Text style={styles.small}>
            여기에 남긴 기록은 이 기기에서만 볼 수 있어요.
          </Text>
        </View>
        <View style={styles.row}>
          <Action
            label="+ 새 여행 계획"
            disabled={model.state.loading || model.state.saving}
            onPress={openEditor.bind(null, model, 'journey', {})}
          />
        </View>
        <ExistingPlans
          model={model}
          trips={ownedTrips(useTripStore(selectTrips), model.ownerId)}
        />
        {model.state.error || model.notice[0] ? (
          <Text accessibilityRole="alert" style={styles.message}>
            {model.state.error || model.notice[0]}
          </Text>
        ) : null}
        {model.state.loading ? (
          <Text style={styles.small}>기록을 불러오는 중입니다.</Text>
        ) : null}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.row}>
            {model.state.journeys.map((journey) => {
              // 저장된 여행을 카드 탭으로 선택한다.
              return (
                <Action
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
          <JourneyContent model={model} journey={selectedJourney(model)!} />
        ) : !model.state.loading ? (
          <View style={styles.card}>
            <Text style={styles.title}>여행의 첫 줄을 작성해 보세요</Text>
            <Text style={styles.small}>
              여행을 만든 뒤 가는 편·오는 편을 등록하고 날짜별 장소 계획을
              추가합니다. 영수증은 해당 계획에 연결해 기록합니다.
            </Text>
          </View>
        ) : null}
        <LegacyVisits
          visits={ownedVisits(useTripStore(selectVisits), model.ownerId)}
        />
      </ScrollView>
      <Modal
        visible={model.editor[0] !== null}
        animationType="slide"
        onRequestClose={closeEditor.bind(null, model)}
      >
        <SafeAreaView style={styles.screen}>
          <ScrollView
            contentContainerStyle={styles.container}
            keyboardShouldPersistTaps="handled"
          >
            <EditorPanel model={model} />
            {model.notice[0] ? (
              <Text accessibilityRole="alert" style={styles.message}>
                {model.notice[0]}
              </Text>
            ) : null}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

// 입력 패널이 열리면 아래쪽 편집 영역을 보여준다.
function closeEditor(model: Model): void {
  // 저장 중 폼이 닫혀 완료 여부를 놓치지 않게 한다.
  return model.state.saving
    ? undefined
    : runAction(model, () => {
        // 저장하지 않은 선택 원본은 닫을 때 정리한다.
        return cleanupTrailAttachment(
          model.attachment[0],
          attachmentReferences(),
        ).then(() => {
          // 이미 저장된 원본은 참조 검사로 보존된다.
          return model.editor[1](null);
        });
      });
}

// 현재 저장된 모든 영수증 원본 참조를 확인한다.
function attachmentReferences(): string[] {
  // 같은 파일이 다른 콘텐츠에 연결되어 있으면 보존한다.
  return useTrailStore.getState().journeys.flatMap((journey) => {
    // 기록 메타데이터의 원본 경로만 선택한다.
    return journey.receipts.map((receipt) => {
      // 사진 내용 자체는 검사나 로그에 노출하지 않는다.
      return receipt.attachment.uri;
    });
  });
}

// 기존 여행 데이터 중 현재 화면의 계획을 읽는다.
function selectTrips(state: ReturnType<typeof useTripStore.getState>): Trip[] {
  // 기존 메모리 여행은 가져오기 대상으로만 사용한다.
  return state.trips;
}

// 조회 결과에서 해당 사용자의 여행만 고른다.
function ownedTrips(trips: Trip[], scope: string): Trip[] {
  // Zustand selector 안에서 새 배열을 생성하지 않는다.
  return trips.filter((trip) => {
    // 현재 사용자 소유 계획만 기기 콘텐츠로 가져온다.
    return trip.userId === scope;
  });
}

// 기존 체크인 데이터는 별도 영역에 보존한다.
function selectVisits(
  state: ReturnType<typeof useTripStore.getState>,
): Visit[] {
  // 다른 계정의 메모리 기록은 보여주지 않는다.
  return state.visits;
}

// 계정이 다른 체크인을 분리한다.
function ownedVisits(visits: Visit[], scope: string): Visit[] {
  // 기존 기록 배열을 변경하지 않는다.
  return visits.filter((visit) => {
    // 저장 당시 사용자 ID를 현재 계정과 비교한다.
    return visit.userId === scope;
  });
}

// 이미 작성한 여행 계획을 영수증 기록에 활용하게 한다.
function ExistingPlans({ model, trips }: { model: Model; trips: Trip[] }) {
  // 기존 여행 원본은 변경하지 않고 복사해 확장한다.
  return trips.length ? (
    <View style={styles.card}>
      <Text style={styles.title}>내 여행 계획 가져오기</Text>
      <Text style={styles.small}>
        기존 장소 계획을 복사해 영수증을 연결합니다. 이후 두 계획은 자동
        동기화되지 않습니다.
      </Text>
      <View style={styles.row}>
        {trips.map((trip) => {
          // 이미 작성된 콘텐츠는 중복 가져오기를 막는다.
          return (
            <Action
              key={trip.id}
              label={trip.title}
              secondary
              disabled={
                model.state.loading ||
                model.state.saving ||
                model.state.journeys.some((journey) => {
                  // 복사 원본 ID가 같은 여행은 한 번만 가져온다.
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
  // 영수증 확인을 예전 인증 배지로 바꾸지 않는다.
  return visits.length ? (
    <View style={styles.card}>
      <Text style={styles.title}>기존 체크인 기록</Text>
      <Text style={styles.small}>기존 내 여행에서 기록한 체크인입니다.</Text>
      {visits.map((visit) => {
        // 장소명과 기록 날짜만 표시한다.
        return (
          <Text style={styles.body} key={visit.id}>
            {visit.place?.name ?? '방문 장소'} · {visit.visitedAt.slice(0, 10)}
          </Text>
        );
      })}
    </View>
  ) : null;
}

// 기존 여행의 장소 계획을 콘텐츠로 복사한다.
function importTrip(model: Model, trip: Trip): void {
  // 날짜나 장소가 잘못된 원본은 숨겨서 가져오지 않는다.
  return runAction(model, () => {
    // 저장 완료 후 가져온 여행을 선택한다.
    return saveTrailJourney(model.scope, importedJourney(trip)).then(() => {
      // 실제 저장 완료를 안내한다.
      return savedEditor(model);
    });
  });
}

// 복사할 여행과 하위 일정의 계약을 구성한다.
function importedJourney(trip: Trip): TrailJourney {
  // 제목·기간은 동일 검증을 통과해야 한다.
  return {
    ...trailJourneySchema.parse(trip),
    id: Crypto.randomUUID(),
    sourceTripId: trip.id,
    flights: [],
    receipts: [],
    plans: (useTripStore.getState().itineraries[trip.id] ?? []).map((item) => {
      // 예전 DAY 번호를 실제 여행 날짜로 변환한다.
      return importedPlan(trip, item);
    }),
  };
}

// 예전 DAY 번호와 장소 정보를 새 계획에 매핑한다.
function importedPlan(trip: Trip, item: ItineraryItem): TrailPlan {
  // 임의 좌표는 복사하지 않고 사용자 장소 정보만 유지한다.
  return {
    id: Crypto.randomUUID(),
    ...trailPlanSchema.parse({
      date: importedPlanDate(trip, item),
      time: item.timeSlot ?? '09:00',
      title: item.title || item.place?.name || '장소 계획',
      address: item.place?.address ?? '',
      memo: item.memo ?? '',
    }),
  };
}

// 기존 계획의 DAY 번호를 범위 안에서 검증한다.
function importedPlanDate(trip: Trip, item: ItineraryItem): string {
  // 알 수 없는 DAY ID를 DAY1로 조용히 변환하지 않는다.
  return new Date(
    Date.parse(trip.startDate) +
      (z.coerce
        .number()
        .int()
        .min(1)
        .max(
          (Date.parse(trip.endDate) - Date.parse(trip.startDate)) / 86400000 +
            1,
        )
        .parse(/^day-([1-9]\d*)$/.exec(item.tripDayId)?.[1]) -
        1) *
        86400000,
  )
    .toISOString()
    .slice(0, 10);
}

// 여행 선택과 폼 닫기를 순서대로 연결한다.
function selectJourney(model: Model, id: string): void {
  // 이전 여행의 입력이 다음 여행에 저장되지 않게 한다.
  return completeSelection(model, model.active[1](id));
}

// 선택 변경 후 편집 화면만 닫는다.
function completeSelection(model: Model, _selected: void): void {
  // 폼을 열 때 입력과 첨부를 초기화한다.
  return model.editor[1](null);
}

// 여행 기준과 날짜별 계획을 보여준다.
function JourneyContent({
  model,
  journey,
}: {
  model: Model;
  journey: TrailJourney;
}) {
  // 항공편 기준과 실제 기록을 같은 여행에 유지한다.
  return (
    <View style={styles.section}>
      <View style={styles.card}>
        <Text style={styles.title}>{journey.title}</Text>
        <Text style={styles.small}>
          {journey.city} · {journey.startDate} ~ {journey.endDate}
        </Text>
        <Text style={styles.small}>
          가는 편 출발일 → 오는 편 도착일을 여행 기간으로 사용합니다. 공항별
          현지 시각·UTC 오프셋을 함께 기록합니다.
        </Text>
      </View>
      <View style={styles.sectionHeader}>
        <Text style={styles.title}>01 항공편 기준표</Text>
        <Action
          label="편명 검색·등록"
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
          가는 편과 오는 편을 각각 등록해 출발·귀국의 기준을 세우세요.
        </Text>
      ) : (
        journey.flights.map((flight) => {
          // 서로 다른 공항의 현지 시각을 원문으로 표시한다.
          return (
            <View style={styles.card} key={flight.id}>
              <Text style={styles.tag}>
                {flight.direction === 'outbound' ? '가는 편' : '오는 편'} ·{' '}
                {flight.flightNumber} · 직접 확인
              </Text>
              <Text style={styles.title}>
                {flight.departureAirport} → {flight.arrivalAirport}
              </Text>
              <Text style={styles.small}>
                출발 {flight.departureAt.replace('T', ' ')}
                {'\n'}도착 {flight.arrivalAt.replace('T', ' ')}
              </Text>
              <Action
                label="편명·시각 수정"
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
        <Text style={styles.title}>02 날짜별 계획</Text>
        <Action
          label="+ 일정 생성"
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
          방문할 장소와 날짜·시각을 적어 계획표를 만드세요.
        </Text>
      ) : (
        journey.plans.map((plan) => {
          // 계획과 해당 장소의 실제 영수증을 함께 표시한다.
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
        <Text style={styles.title}>03 영수증으로 남긴 발자취</Text>
        <Text style={styles.small}>
          {journey.plans.length}개 계획 · {journey.receipts.length}개 영수증
          {'\n'}실제 결제 내역은 연결한 장소 카드에 표시됩니다. 통화가 다른
          금액은 합산하지 않습니다.
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
  model: Model;
  journey: TrailJourney;
  plan: TrailPlan;
}) {
  // 영수증이 여러 개여도 각각 원본 기록을 유지한다.
  return (
    <View style={styles.card}>
      <Text style={styles.tag}>
        {plan.date} · {plan.time} 계획
      </Text>
      <Text style={styles.title}>{plan.title}</Text>
      {plan.address ? <Text style={styles.small}>{plan.address}</Text> : null}
      {plan.memo ? <Text style={styles.body}>{plan.memo}</Text> : null}
      <View style={styles.row}>
        <Action
          label="계획 수정"
          secondary
          onPress={openEditor.bind(null, model, 'plan', { ...plan })}
          disabled={model.state.saving}
        />
        <Action
          label="영수증 등록"
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
        <Action
          label="일정 삭제"
          secondary
          onPress={deletePlan.bind(null, model, journey, plan.id)}
          disabled={model.state.saving}
        />
      </View>
      {journey.receipts
        .filter((receipt) => {
          // 해당 계획의 실제 기록만 연결한다.
          return receipt.planId === plan.id;
        })
        .map((receipt) => {
          // 원본 첨부와 사용자 확인 내용을 보여준다.
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
  model: Model;
  journey: TrailJourney;
}) {
  // JPG/PNG는 미리보기, PDF는 첨부 버튼으로 제공한다.
  return (
    <View style={styles.receipt}>
      <Text style={styles.tag}>영수증 · 사용자 확인</Text>
      <Text style={styles.title}>
        {receipt.merchant} · {receipt.amount} {receipt.currency}
      </Text>
      <Text style={styles.small}>
        실제 결제 {receipt.date} {receipt.time}
      </Text>
      <Text style={styles.body}>{receipt.details}</Text>
      {receipt.note ? <Text style={styles.small}>{receipt.note}</Text> : null}
      {receipt.attachment.mimeType.startsWith('image/') ? (
        <Image
          source={{ uri: receipt.attachment.uri }}
          style={styles.preview}
          resizeMode="contain"
          accessibilityLabel={`${receipt.merchant} 영수증 원본`}
        />
      ) : null}
      <Text style={styles.small}>{receipt.attachment.name}</Text>
      <View style={styles.row}>
        <Action
          label="원본 열기"
          secondary
          onPress={openAttachment.bind(null, model, receipt.attachment)}
        />
        <Action
          label="기록 삭제"
          secondary
          disabled={model.state.saving}
          onPress={deleteReceipt.bind(null, model, journey, receipt.id)}
        />
      </View>
    </View>
  );
}

// 웹 data URI는 새 브라우저 창에서 원본을 연다.
function openAttachment(
  model: Model,
  attachment: TrailReceipt['attachment'],
): void {
  // 네이티브 URI 열기 오류도 입력 화면에 안내한다.
  return runAction(model, () => {
    // 플랫폼 기본 뷰어로 선택 원본을 연다.
    return openTrailAttachment(attachment);
  });
}

// 입력 폼을 새로운 여행 행동에 맞춰 초기화한다.
function openEditor(model: Model, editor: Editor, form: Form): void {
  // 단계별 초기화를 작은 상태 명령으로 연결한다.
  return initializedForm(model, editor, model.form[1](form));
}

// 새 폼의 첨부 선택을 비운다.
function initializedForm(model: Model, editor: Editor, _form: void): void {
  // 이전 영수증 원본이 새 계획에 연결되지 않게 한다.
  return initializedAttachment(model, editor, model.attachment[1](null));
}

// 폼 모드를 표시한다.
function initializedAttachment(
  model: Model,
  editor: Editor,
  _attachment: void,
): void {
  // 입력 오류는 다시 저장할 때 갱신한다.
  return model.editor[1](editor);
}

const fields: Record<Exclude<Editor, null>, [string, string, string][]> = {
  journey: [
    ['title', '여행 제목', '예: 와카야마에서 남기는 발자취'],
    ['city', '도시', '예: 와카야마'],
    ['startDate', '출발일', 'YYYY-MM-DD'],
    ['endDate', '귀국일', 'YYYY-MM-DD'],
  ],
  flight: [
    ['flightNumber', '항공편명', '예: KE123'],
    ['searchDate', '검색할 운항일', 'YYYY-MM-DD'],
    ['departureAirport', '출발 공항 코드', '예: ICN'],
    ['arrivalAirport', '도착 공항 코드', '예: KIX'],
    ['departureDate', '출발 공항 현지 날짜', 'YYYY-MM-DD'],
    ['departureTime', '출발 공항 현지 시각', 'HH:mm'],
    ['departureOffset', '출발 공항 시간대 (한국·일본 +09:00)', '+09:00'],
    ['arrivalDate', '도착 공항 현지 날짜', 'YYYY-MM-DD'],
    ['arrivalTime', '도착 공항 현지 시각', 'HH:mm'],
    ['arrivalOffset', '도착 공항 시간대 (한국·일본 +09:00)', '+09:00'],
  ],
  plan: [
    ['date', '계획 날짜', 'YYYY-MM-DD'],
    ['time', '계획 시각', 'HH:mm'],
    ['title', '장소·일정 이름', '방문할 식당·숙소·장소'],
    ['address', '주소', '확인한 주소'],
    ['memo', '계획·메모', '예약·하고 싶은 일·예상 메뉴'],
  ],
  receipt: [
    ['merchant', '영수증 상호', '영수증에 표시된 상호'],
    ['date', '실제 결제 날짜', 'YYYY-MM-DD'],
    ['time', '실제 결제 시각', 'HH:mm'],
    ['amount', '영수증 총액', '예: 2500'],
    ['details', '구매·방문 상세', '메뉴, 수량, 단가, 이용한 서비스'],
    ['note', '실제 경험·다음 방문 팁', '계획과 달랐던 점, 예약·결제 팁'],
  ],
};

// 각 단계의 입력과 파일 선택을 제공한다.
function EditorPanel({ model }: { model: Model }) {
  // 편명 검색은 외부 조회, 등록은 확인한 시각 입력으로 구분한다.
  return (
    <View style={styles.card}>
      <Text style={styles.title}>
        {model.editor[0] === 'journey'
          ? '새 여행 만들기'
          : model.editor[0] === 'flight'
            ? '항공편으로 기준 세우기'
            : model.editor[0] === 'plan'
              ? '장소 계획 작성'
              : '영수증으로 상세 기록'}
      </Text>
      {model.editor[0] === 'flight' ? (
        <View>
          <View style={styles.row}>
            <Action
              label="가는 편"
              secondary={model.form[0].direction !== 'outbound'}
              onPress={updateField.bind(null, model, 'direction', 'outbound')}
            />
            <Action
              label="오는 편"
              secondary={model.form[0].direction !== 'return'}
              onPress={updateField.bind(null, model, 'direction', 'return')}
            />
          </View>
          <Text style={styles.small}>
            편명+날짜 웹 검색으로 항공사 정보를 확인한 뒤 시각을 입력하세요.
            검색 결과는 항공권 구매·예약 확정이 아닙니다.
          </Text>
        </View>
      ) : null}
      {fields[model.editor[0] ?? 'journey'].map(([key, label, placeholder]) => {
        // 모든 입력에 이름을 제공해 접근성과 오류 확인을 돕는다.
        return (
          <View key={key} style={styles.field}>
            <Text style={styles.label}>{label}</Text>
            <TextInput
              editable={!model.state.saving}
              accessibilityLabel={label}
              style={[
                styles.input,
                ['details', 'note', 'memo'].includes(key) && styles.multiline,
              ]}
              placeholder={placeholder}
              value={model.form[0][key] ?? ''}
              onChangeText={updateField.bind(null, model, key)}
              multiline={['details', 'note', 'memo'].includes(key)}
              autoCapitalize="none"
            />
          </View>
        );
      })}
      {model.editor[0] === 'flight' ? (
        <Action
          label="편명·운항일 검색 열기 ↗"
          secondary
          onPress={searchFlight.bind(null, model)}
        />
      ) : null}
      {model.editor[0] === 'receipt' ? (
        <View style={styles.section}>
          <Text style={styles.small}>
            영수증 사진과 결제 내역을 남겨 지난 여행을 정리해 보세요.
          </Text>
          <View style={styles.row}>
            {(['KRW', 'JPY', 'USD'] as const).map((currency) => {
              // 통화가 다른 기록을 합산하지 않는다.
              return (
                <Action
                  key={currency}
                  label={currency}
                  secondary={model.form[0].currency !== currency}
                  onPress={updateField.bind(null, model, 'currency', currency)}
                />
              );
            })}
          </View>
          <Action
            label={
              model.attachment[0]
                ? '영수증 원본 다시 선택'
                : '영수증 사진·PDF 선택 (2MB 이하)'
            }
            secondary
            onPress={pickAttachment.bind(null, model)}
          />
          {model.attachment[0] ? (
            <Text style={styles.small}>{model.attachment[0].name}</Text>
          ) : null}
        </View>
      ) : null}
      <View style={styles.row}>
        <Action
          label={model.state.saving ? '기기에 저장 중…' : '저장하기'}
          disabled={model.state.loading || model.state.saving}
          onPress={submitEditor.bind(null, model)}
        />
        <Action
          label="닫기"
          secondary
          disabled={model.state.saving}
          onPress={closeEditor.bind(null, model)}
        />
      </View>
    </View>
  );
}

// 입력 필드 하나만 수정한다.
function updateField(model: Model, key: string, value: string): void {
  // 다른 필드와 첨부는 유지한다.
  return model.form[1]((current) => {
    // 사용자가 작성한 최신 폼을 기준으로 변경한다.
    return { ...current, [key]: value };
  });
}

// 취소와 파일 선택 실패를 구분한다.
function pickAttachment(model: Model): void {
  // 실제 사용자 파일 선택 결과만 첨부로 기록한다.
  return runAction(model, () => {
    // 취소 시 이전 첨부는 유지한다.
    return pickTrailAttachment().then((attachment) => {
      // 선택한 파일만 폼에 연결한다.
      return attachment
        ? cleanupTrailAttachment(
            model.attachment[0],
            attachmentReferences(),
          ).then(() => {
            // 교체한 임시 원본 정리가 끝난 뒤 새 파일을 선택한다.
            return model.attachment[1](attachment);
          })
        : undefined;
    });
  });
}

// 편명과 실제 운항 날짜를 검색한다.
function searchFlight(model: Model): void {
  // 편명 없이 임의 항공편 결과를 만들지 않는다.
  return runAction(model, () => {
    // 날짜와 편명만 검증해 외부 검색을 연다.
    return Linking.openURL(
      flightSearchUrl(
        z
          .string()
          .trim()
          .toUpperCase()
          .regex(/^[A-Z0-9]{2,3}\s?\d{1,4}[A-Z]?$/)
          .parse(model.form[0].flightNumber),
        calendarDateSchema.parse(model.form[0].searchDate),
      ),
    );
  });
}

// 폼을 검증하고 콘텐츠 한 개를 저장한다.
function submitEditor(model: Model): void {
  // 실패 시 폼을 유지하고 성공 후에만 닫는다.
  return runAction(model, () => {
    // 현재 화면 입력에서 새로운 콘텐츠 스냅샷을 만든다.
    return saveTrailJourney(model.scope, editedJourney(model)).then(() => {
      // 원본 저장이 확인된 뒤 완료 메시지를 표시한다.
      return savedEditor(model);
    });
  });
}

// 모드에 맞는 저장 결과를 생성한다.
function editedJourney(model: Model): TrailJourney {
  // 새 여행은 다른 콘텐츠를 참조하지 않는다.
  return model.editor[0] === 'journey'
    ? {
        ...trailJourneySchema.parse(model.form[0]),
        id: Crypto.randomUUID(),
        flights: [],
        plans: [],
        receipts: [],
      }
    : editSelectedJourney(model, requiredJourney(model));
}

// 편집 대상 여행이 실제로 선택되어 있는지 확인한다.
function requiredJourney(model: Model): TrailJourney {
  // 선택 없이 영수증이나 항공편을 생성하지 않는다.
  return selectedJourney(model) ?? missingJourney();
}

// 선택 누락 오류를 전달한다.
function missingJourney(): never {
  // 입력을 잃지 않고 다시 여행을 선택하게 한다.
  throw new Error('먼저 여행을 선택해 주세요.');
}

// 여행 내부의 한 유형만 수정한다.
function editSelectedJourney(
  model: Model,
  journey: TrailJourney,
): TrailJourney {
  // 항공·일정·영수증마다 독립 검증과 반영 함수를 사용한다.
  return model.editor[0] === 'flight'
    ? applyTrailFlight(journey, {
        ...trailFlightSchema.parse(flightInput(model.form[0])),
        id: model.form[0].id
          ? foundationUuidSchema.parse(model.form[0].id)
          : Crypto.randomUUID(),
        source: 'user-confirmed',
      })
    : model.editor[0] === 'plan'
      ? applyTrailPlan(journey, {
          ...trailPlanSchema.parse(model.form[0]),
          id: model.form[0].id
            ? foundationUuidSchema.parse(model.form[0].id)
            : Crypto.randomUUID(),
        })
      : applyTrailReceipt(journey, {
          ...trailReceiptSchema.parse(model.form[0]),
          id: Crypto.randomUUID(),
          attachment: requiredAttachment(model),
          createdAt: new Date().toISOString(),
        });
}

// 공항 현지 날짜·시각 입력을 저장용 시각으로 변환한다.
function flightInput(form: Form): Form {
  // 사용자에게 기계용 ISO 문자열 입력을 요구하지 않는다.
  return {
    ...form,
    departureAt: `${form.departureDate}T${form.departureTime}:00${form.departureOffset}`,
    arrivalAt: `${form.arrivalDate}T${form.arrivalTime}:00${form.arrivalOffset}`,
  };
}

// 기존 항공 시각을 읽기 쉬운 수정 필드로 나눈다.
function flightForm(flight: TrailJourney['flights'][number]): Form {
  // 출발·도착 공항의 오프셋을 서로 독립적으로 유지한다.
  return {
    ...flight,
    searchDate: flight.departureAt.slice(0, 10),
    departureDate: flight.departureAt.slice(0, 10),
    departureTime: flight.departureAt.slice(11, 16),
    departureOffset: flight.departureAt.slice(-6),
    arrivalDate: flight.arrivalAt.slice(0, 10),
    arrivalTime: flight.arrivalAt.slice(11, 16),
    arrivalOffset: flight.arrivalAt.slice(-6),
  };
}

// 영수증은 원본 첨부 없이 등록하지 않는다.
function requiredAttachment(model: Model): TrailReceipt['attachment'] {
  // 카드에 입력 상세만 있는데 원본 등록 완료라고 표시하지 않는다.
  return model.attachment[0] ?? missingAttachment();
}

// 첨부 누락을 안내한다.
function missingAttachment(): never {
  // 사용자가 작성한 구매 내역은 화면에 유지한다.
  throw new Error('영수증 원본 사진 또는 PDF를 선택해 주세요.');
}

// 저장 후 해당 콘텐츠를 선택한다.
function savedEditor(model: Model): void {
  // 새 여행은 방금 저장된 마지막 레코드를 선택한다.
  return completedEditor(
    model,
    model.active[1](useTrailStore.getState().journeys.at(-1)?.id ?? ''),
  );
}

// 저장 완료 후 폼을 닫는다.
function completedEditor(model: Model, _selected: void): void {
  // 성공 안내를 별도 상태 명령에 연결한다.
  return completedNotice(model, model.editor[1](null));
}

// 사용자에게 실제 저장 범위를 알려준다.
function completedNotice(model: Model, _closed: void): void {
  // 원격 저장 완료라고 표현하지 않는다.
  return model.notice[1]('이 기기에 저장했습니다.');
}

// 영수증 없는 일정 하나를 제거한다.
function deletePlan(model: Model, journey: TrailJourney, planId: string): void {
  // 연결 기록이 있으면 삭제를 거부한다.
  return runAction(model, () => {
    // 콘텐츠 원본을 저장한 뒤 화면에 반영한다.
    return saveTrailJourney(model.scope, removeTrailPlan(journey, planId));
  });
}

// 영수증 등록 하나를 콘텐츠에서 제거한다.
function deleteReceipt(
  model: Model,
  journey: TrailJourney,
  receiptId: string,
): void {
  // 구매 내역만 삭제하고 장소 계획은 유지한다.
  return runAction(model, () => {
    // 같은 영수증 ID의 연결만 제거한다.
    return saveTrailJourney(model.scope, {
      ...journey,
      receipts: journey.receipts.filter((receipt) => {
        // 삭제한 기록은 비용으로 다시 집계하지 않는다.
        return receipt.id !== receiptId;
      }),
    }).then(() => {
      // 저장된 연결을 제거한 뒤 참조 없는 원본을 정리한다.
      return cleanupTrailAttachment(
        journey.receipts.find((receipt) => {
          // 삭제한 영수증 하나의 원본만 대상으로 한다.
          return receipt.id === receiptId;
        })?.attachment ?? null,
        attachmentReferences(),
      );
    });
  });
}

// 사용자 행동의 동기·비동기 오류를 하나의 흐름으로 처리한다.
function runAction(model: Model, action: () => unknown): void {
  // 검증 실패에서도 폼을 닫지 않는다.
  void Promise.resolve()
    .then(action)
    .catch((error: unknown) => {
      // 검증 필드 메시지 또는 저장 실패 메시지를 표시한다.
      return model.notice[1](
        error instanceof z.ZodError
          ? error.issues
              .map((issue) => {
                // 필요한 입력 이름과 원인을 보여준다.
                return `${issue.path.join('.') || '입력'}: ${issue.message}`;
              })
              .join('\n')
          : error instanceof Error
            ? error.message
            : '작업을 다시 확인해 주세요.',
      );
    });
}

// 공통 접근성 버튼을 렌더링한다.
function Action({
  label,
  onPress,
  disabled = false,
  secondary = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
}) {
  // 중복 저장 중에는 버튼 동작을 막는다.
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.button,
        secondary && styles.secondary,
        disabled && styles.disabled,
      ]}
    >
      <Text style={[styles.buttonText, secondary && styles.secondaryText]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// 발자취 화면은 기존 디자인 색상을 사용한다.
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  container: { padding: 20, gap: 20, paddingBottom: 80 },
  hero: { fontSize: 32, fontWeight: '800', color: colors.text, marginTop: 8 },
  eyebrow: {
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: '700',
    color: colors.accent,
  },
  description: {
    fontSize: 15,
    color: colors.muted,
    lineHeight: 24,
    marginTop: 10,
  },
  banner: {
    backgroundColor: colors.secondarySoft,
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  bannerTitle: { fontWeight: '700', color: colors.secondaryDark },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 18,
    gap: 12,
  },
  section: { gap: 16 },
  sectionHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  title: { fontSize: 17, fontWeight: '700', color: colors.text },
  tag: { fontSize: 12, fontWeight: '700', color: colors.accent },
  small: { fontSize: 12, color: colors.muted, lineHeight: 20 },
  body: { fontSize: 14, color: colors.text, lineHeight: 22 },
  button: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: colors.accent,
  },
  secondary: { backgroundColor: colors.accentSoft },
  buttonText: { color: colors.textLight, fontSize: 12, fontWeight: '700' },
  secondaryText: { color: colors.accent },
  disabled: { opacity: 0.4 },
  message: { color: colors.danger, fontSize: 13, lineHeight: 20 },
  field: { gap: 6 },
  label: { color: colors.text, fontSize: 12, fontWeight: '700' },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    borderRadius: 10,
    padding: 12,
    color: colors.text,
    fontSize: 14,
  },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  receipt: {
    padding: 14,
    backgroundColor: colors.tagGreen,
    borderRadius: 12,
    gap: 10,
  },
  preview: { width: '100%', height: 200 },
});
