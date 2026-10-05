import { Modal, ScrollView, Text, View } from 'react-native';
import type { ReactNode } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { WorkspaceSnapshot } from '@wherego/domain';
import { Action, Field, ServerPhoto, styles } from './ui';
import type { PlanForm } from './forms';
import { DateField, DestinationFields, FlightFields } from './TravelInputs';
import PlaceSearch from './PlaceSearch';
import GooglePlace from './GooglePlace';

const labels: Record<string, string> = {
  title: '제목',
  country: '국가',
  city: '도시·지역',
  startDate: '시작일',
  endDate: '종료일',
  timezone: '현지 시간대',
  defaultCurrency: '기본 통화',
  timeSlot: '일정 시간 (HH:mm)',
  sortOrder: '일정 순서',
  address: '지역명·주소',
  memo: '일정 메모',
  amount: '금액',
  merchant: '영수증 상호',
  transactionDate: '실제 결제 날짜',
  details: '구매 내역',
  body: '커뮤니티 본문',
};
// 여행 생성만 일반 페이지로 표시하고 기존 편집 화면의 모달을 유지한다.
function EditorSurface({
  form,
  onClose,
  children,
}: {
  form: PlanForm | null;
  onClose: () => void;
  children: ReactNode;
}) {
  // 생성 페이지는 모달 계층 없이 내비게이션 스택에 표시한다.
  return form?.kind === 'trip' ? (
    children
  ) : (
    <Modal
      visible={Boolean(form)}
      animationType="slide"
      onRequestClose={onClose}
    >
      {children}
    </Modal>
  );
}
// 명령 종류에 맞춘 입력·선택·공개 미리보기를 제공한다.
export default function PlanEditor({
  userId,
  form,
  snapshot,
  busy,
  error,
  onChange,
  onSave,
  onReload,
  onClose,
  onReceipt,
}: {
  userId: string;
  form: PlanForm | null;
  snapshot?: WorkspaceSnapshot;
  busy: boolean;
  error: string;
  onChange: (key: string, value: string) => void;
  onSave: () => void;
  onReload: () => void;
  onClose: () => void;
  onReceipt: (camera: boolean) => void;
}) {
  // 실패해도 같은 폼 입력값과 원본을 유지한다.
  return (
    <EditorSurface form={form} onClose={onClose}>
      <SafeAreaView style={styles.modal}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.header}>
            {form?.kind === 'trip'
              ? '새 여행 시작하기'
              : form?.kind === 'publish'
                ? '커뮤니티 공개'
                : form?.kind === 'receipt'
                  ? '영수증 확인'
                  : '여행 내용 작성'}
          </Text>
          {form?.kind === 'trip' && (
            <Action
              label="내 여행으로 돌아가기"
              disabled={busy}
              onPress={onClose}
            />
          )}
          {form && (
            <>
              {form.kind === 'receipt' && snapshot && (
                <ServerPhoto
                  userId={userId}
                  tripId={snapshot.trip.id}
                  mediaId={form.values.mediaId!}
                />
              )}
              {form.kind === 'trip' && (
                <>
                  <FlightFields values={form.values} onChange={onChange} />
                  <DestinationFields values={form.values} onChange={onChange} />
                </>
              )}
              {form.kind === 'schedule' && (
                <>
                  <View style={styles.card}>
                    <Text style={styles.title}>장소를 어떻게 추가할까요?</Text>
                    <View style={styles.row}>
                      <Action
                        label="영수증 촬영으로 추가"
                        disabled={busy}
                        onPress={() => {
                          // 등록된 영수증 인식 흐름으로 연결한다.
                          onReceipt(true);
                        }}
                      />
                      <Action
                        label="영수증 사진으로 추가"
                        disabled={busy}
                        onPress={() => {
                          // 저장된 영수증 사진을 선택한다.
                          onReceipt(false);
                        }}
                      />
                    </View>
                  </View>
                  <PlaceSearch
                    key={form.id}
                    userId={userId}
                    city={snapshot?.trip.city || ''}
                    disabled={busy}
                    onSelect={(placeId, authoredTitle) => {
                      // 사용자 제목과 구글 장소 ID만 영구 기록에 포함한다.
                      onChange('googlePlaceId', placeId);
                      onChange('title', authoredTitle);
                    }}
                  />
                  {form.values.googlePlaceId && (
                    <>
                      <GooglePlace
                        userId={userId}
                        placeId={form.values.googlePlaceId}
                        label={form.values.title || ''}
                      />
                      <Action
                        label="선택한 구글 장소 연결 해제"
                        disabled={busy}
                        onPress={() => {
                          // 사용자 작성 내용은 유지하고 장소 참조만 해제한다.
                          onChange('googlePlaceId', '');
                        }}
                      />
                    </>
                  )}
                </>
              )}
              {Object.entries(form.values)
                .filter(([key]) => {
                  // 식별자와 선택 필드는 자유 입력으로 노출하지 않는다.
                  return (
                    Boolean(labels[key]) &&
                    !(
                      form.kind === 'trip' &&
                      ['country', 'city', 'title'].includes(key)
                    ) &&
                    key !== 'sortOrder'
                  );
                })
                .map(([key, value]) =>
                  [
                    'startDate',
                    'endDate',
                    'transactionDate',
                    'timeSlot',
                  ].includes(key) ? (
                    <DateField
                      key={key}
                      label={labels[key]!}
                      value={value}
                      mode={key === 'timeSlot' ? 'time' : 'date'}
                      minimumDate={
                        key === 'endDate' ? form.values.startDate : undefined
                      }
                      maximumDate={
                        key === 'startDate' ? form.values.endDate : undefined
                      }
                      onChange={(next) => {
                        // 달력에서 선택한 날짜만 폼에 반영한다.
                        onChange(key, next);
                      }}
                    />
                  ) : (
                    <Field
                      key={key}
                      label={labels[key]!}
                      value={value}
                      multiline={['memo', 'body', 'details'].includes(key)}
                      onChange={(next) => {
                        // 해당 필드 하나만 변경한다.
                        onChange(key, next);
                      }}
                    />
                  ),
                )}
              {form.kind === 'trip' && (
                <Field
                  label="여행 타이틀 (비우면 자동 생성)"
                  value={form.values.title || ''}
                  onChange={(next) => {
                    // 제목은 목적지와 날짜를 선택한 뒤 선택적으로 지정한다.
                    onChange('title', next);
                  }}
                />
              )}
              {['schedule', 'receipt'].includes(form.kind) && (
                <View style={styles.card}>
                  <Text style={styles.title}>여행 날짜 선택</Text>
                  {snapshot?.days.map((day) => (
                    <Action
                      key={day.id}
                      label={`${form.values.dayId === day.id ? '✓ ' : ''}DAY ${day.dayNumber} · ${day.tripDate}`}
                      disabled={busy}
                      onPress={() => {
                        // 수동 날짜 선택에서 기존 일정 연결은 해제한다.
                        onChange('dayId', day.id);
                      }}
                    />
                  ))}
                </View>
              )}
              {form.kind === 'schedule' && (
                <View style={styles.row}>
                  {[
                    'PLACE',
                    'TRANSPORT',
                    'STAY',
                    'RESERVATION',
                    'TODO',
                    'MEMO',
                  ].map((type) => (
                    <Action
                      key={type}
                      label={`${form.values.type === type ? '✓ ' : ''}${{ PLACE: '장소', TRANSPORT: '이동', STAY: '숙소', RESERVATION: '예약', TODO: '할 일', MEMO: '메모' }[type]}`}
                      disabled={busy}
                      onPress={() => {
                        // 일정 유형을 하나 선택한다.
                        onChange('type', type);
                      }}
                    />
                  ))}
                </View>
              )}
              {['trip', 'expense', 'receipt'].includes(form.kind) && (
                <View style={styles.row}>
                  {['KRW', 'JPY', 'USD'].map((currency) => (
                    <Action
                      key={currency}
                      label={`${(form.values.currency || form.values.defaultCurrency) === currency ? '✓ ' : ''}${currency}`}
                      disabled={busy}
                      onPress={() => {
                        // 금액은 선택 통화의 정밀도로 검사한다.
                        onChange(
                          form.kind === 'trip' ? 'defaultCurrency' : 'currency',
                          currency,
                        );
                      }}
                    />
                  ))}
                </View>
              )}
              {['expense', 'receipt'].includes(form.kind) && (
                <View style={styles.card}>
                  <Text style={styles.title}>연결할 일정</Text>
                  <Action
                    label="새 기록 / 일정 연결 없이"
                    disabled={busy}
                    onPress={() => {
                      // 영수증은 새 일정을 생성하고 수동 비용은 여행 전체에 연결한다.
                      onChange('scheduleId', '');
                    }}
                  />
                  {snapshot?.itinerary.map((item) => (
                    <Action
                      key={item.id}
                      label={`${form.values.scheduleId === item.id ? '✓ ' : ''}${item.title}`}
                      disabled={busy}
                      onPress={() => {
                        // 일정의 실제 DAY도 함께 연결한다.
                        onChange('scheduleId', item.id);
                      }}
                    />
                  ))}
                </View>
              )}
              {form.kind === 'expense' && (
                <View style={styles.row}>
                  <Action
                    label={`${form.values.isActual === 'true' ? '✓ ' : ''}실제 지출`}
                    onPress={() => {
                      // 실제 지출로 명시한다.
                      onChange('isActual', 'true');
                    }}
                  />
                  <Action
                    label={`${form.values.isActual === 'false' ? '✓ ' : ''}예상 비용`}
                    onPress={() => {
                      // 예상 비용과 실제 지출은 합계를 분리한다.
                      onChange('isActual', 'false');
                    }}
                  />
                </View>
              )}
              {form.kind === 'metadata' && (
                <View style={styles.row}>
                  {['PLANNED', 'IN_PROGRESS', 'COMPLETED'].map((status) => (
                    <Action
                      key={status}
                      label={`${form.values.status === status ? '✓ ' : ''}${{ PLANNED: '예정', IN_PROGRESS: '여행 중', COMPLETED: '여행 종료' }[status]}`}
                      onPress={() => {
                        // 종료 여부는 소유자가 명시적으로 확인한다.
                        onChange('status', status);
                      }}
                    />
                  ))}
                </View>
              )}
              {form.kind === 'publish' && (
                <View style={styles.card}>
                  <Text style={styles.title}>공개 내용 미리보기</Text>
                  <Text>
                    {snapshot?.trip.country} · {snapshot?.trip.city}
                  </Text>
                  <Text>{form.values.title}</Text>
                  <Text>{form.values.body}</Text>
                  <Text>
                    공개할 일정과 사진을 직접 선택해 주세요. 영수증 원본과 동행
                    정보는 공개되지 않습니다.
                  </Text>
                  {snapshot?.itinerary.map((item) => (
                    <Action
                      key={item.id}
                      label={`${selected(form.values.scheduleIds || '', item.id) ? '✓ ' : ''}일정: ${item.title}`}
                      onPress={() => {
                        // 선택한 일정만 게시 스냅샷에 포함한다.
                        onChange(
                          'scheduleIds',
                          toggle(form.values.scheduleIds || '', item.id),
                        );
                      }}
                    />
                  ))}
                  {snapshot?.media
                    .filter((media) => {
                      // 영수증 원본은 공개 선택지에서 제외한다.
                      return media.purpose === 'photo';
                    })
                    .map((media, index) => (
                      <Action
                        key={media.id}
                        label={`${selected(form.values.photoIds || '', media.id) ? '✓ ' : ''}사진 ${index + 1}`}
                        onPress={() => {
                          // 사용자가 선택한 사진만 공개한다.
                          onChange(
                            'photoIds',
                            toggle(form.values.photoIds || '', media.id),
                          );
                        }}
                      />
                    ))}
                  <Action
                    label={`${form.values.includeCosts === 'true' ? '✓ ' : ''}실제 비용 합계 공개`}
                    onPress={() => {
                      // 금액 공개는 명시적 선택이다.
                      onChange(
                        'includeCosts',
                        form.values.includeCosts === 'true' ? 'false' : 'true',
                      );
                    }}
                  />
                  <Text>
                    선택 일정{' '}
                    {form.values.scheduleIds?.split(',').filter(Boolean)
                      .length || 0}
                    개 · 사진{' '}
                    {form.values.photoIds?.split(',').filter(Boolean).length ||
                      0}
                    장
                  </Text>
                </View>
              )}
              {form.kind === 'receipt' && (
                <Text style={styles.subtitle}>
                  OCR 후보의 상호·결제 날짜·금액·통화를 확인해 주세요. 확인 저장
                  시에만 일정과 실제 지출에 반영됩니다.
                </Text>
              )}
              {form.kind === 'period' && (
                <Text style={styles.subtitle}>
                  DAY 순서와 일정은 유지되며 날짜가 이동합니다. 기록이 있는
                  DAY를 없애는 기간 축소, 확정 영수증 날짜가 범위를 벗어나는
                  변경은 저장되지 않습니다.
                </Text>
              )}
            </>
          )}
          {error && (
            <Text style={styles.error} accessibilityRole="alert">
              {error}
            </Text>
          )}
          <View style={styles.row}>
            <Action
              label={
                busy
                  ? '저장 중…'
                  : form?.kind === 'publish'
                    ? '확인하고 게시'
                    : '확인하고 저장'
              }
              disabled={busy}
              onPress={onSave}
            />
            <Action
              label={form?.kind === 'trip' ? '취소' : '닫기'}
              disabled={busy}
              onPress={onClose}
            />
            {error.includes('동행') && (
              <Action
                label="최신 내용 불러오기"
                disabled={busy}
                onPress={onReload}
              />
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </EditorSurface>
  );
}
// 공개 선택 목록에서 특정 항목을 확인한다.
function selected(value: string, id: string): boolean {
  // ID 경계를 유지해 부분 문자열 오판정을 피한다.
  return value.split(',').includes(id);
}
// 공개 선택 목록의 항목 하나만 변경한다.
function toggle(value: string, id: string): string {
  // 선택 상태를 UUID 목록으로 유지한다.
  return (
    selected(value, id)
      ? value.split(',').filter((item) => {
          // 지정한 항목만 제외한다.
          return item !== id;
        })
      : [...value.split(',').filter(Boolean), id]
  ).join(',');
}
