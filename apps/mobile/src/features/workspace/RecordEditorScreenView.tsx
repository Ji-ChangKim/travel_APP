import ActionSheet from '@/components/ActionSheet';
import Text from '@/components/AppText';
import HaruState from '@/components/HaruState';
import type {
  WorkspaceMedia,
  WorkspaceSchedule,
  WorkspaceSnapshot,
} from '@wherego/domain';
import { type ImperativeRouter } from 'expo-router';
import { type Dispatch, type RefObject, type SetStateAction } from 'react';
import { ScrollView, View } from 'react-native';
import { FormFeedback } from './InputFeedback';
import { LedgerAction } from './LedgerUI';
import ServerPhoto from './ServerPhoto';
import type { FormFeedbackState } from './formFeedback';
import { type PlanForm } from './forms';
import { ledgerStyles as s } from './ledgerTheme';
import { requestScheduleExit } from './scheduleExitGuard';
import { Field } from './ui';
// renderRecordEditor이 읽는 값과 실행 가능한 행동의 계약이다.
type RenderRecordEditorProps = {
  form: PlanForm | null;
  busy: boolean;
  retryPending: boolean;
  feedback: FormFeedbackState;
  scroll: RefObject<ScrollView | null>;
  wide: boolean;
  snapshot: WorkspaceSnapshot;
  item: WorkspaceSchedule;
  onChoose: () => void;
  photos: WorkspaceMedia[];
  userId: string;
  setDeleting: Dispatch<SetStateAction<string | null>>;
  run: (task: () => Promise<void>) => Promise<void>;
  photo: () => Promise<void>;
  change: (key: string, value: string) => void;
  costs: { currency: string; amount: string }[];
  router: ImperativeRouter;
  notice: string;
  error: string;
  reload: () => Promise<void>;
  saveRecord: () => void;
  deleting: string | null;
  deletePhoto: () => void;
};

// 기록 편집의 입력·피드백·확인창을 배치한다.
export function renderRecordEditor({
  form,
  busy,
  retryPending,
  feedback,
  scroll,
  wide,
  snapshot,
  item,
  onChoose,
  photos,
  userId,
  setDeleting,
  run,
  photo,
  change,
  costs,
  router,
  notice,
  error,
  reload,
  saveRecord,
  deleting,
  deletePhoto,
}: RenderRecordEditorProps) {
  // 전달받은 값과 행동을 기존 화면 규격으로 표시한다.

  return form ? (
    <FormFeedback
      locked={busy || retryPending}
      feedback={feedback}
      scroll={scroll}
    >
      <ScrollView
        ref={scroll}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[s.content, wide && s.wideContent]}
      >
        <View style={s.tinted}>
          <Text style={s.eyebrow}>{snapshot.trip.title}</Text>
          <Text style={s.meta}>
            나와 동행자만 읽는 원본이에요. 공개할 사진과 장소 설명은 공유할 때
            직접 골라요.
          </Text>
        </View>
        <View style={s.card}>
          <Text style={s.section}>기록할 장소</Text>
          <Text style={s.place}>{item.title}</Text>
          <Text style={s.meta}>{item.address || '주소 없음'}</Text>
          <LedgerAction
            label="다른 장소 선택"
            disabled={busy || retryPending}
            onPress={onChoose}
          />
        </View>
        <View style={{ flexDirection: wide ? 'row' : 'column', gap: 20 }}>
          {renderRecordPhotos({
            photos,
            wide,
            userId,
            snapshot,
            busy,
            retryPending,
            setDeleting,
            run,
            photo,
          })}
          {renderRecordNotes({
            form,
            busy,
            retryPending,
            change,
            costs,
            router,
            snapshot,
          })}
        </View>
        {notice && <Text accessibilityLiveRegion="polite">{notice}</Text>}
        {error && <Text accessibilityRole="alert">{error}</Text>}
        {error && !retryPending && (
          <LedgerAction
            label="최신 원본 확인하고 다시 편집"
            disabled={busy}
            onPress={() => {
              // 기존 초안을 버리는 이동은 공통 확인을 거친다.
              return requestScheduleExit(() => void run(reload));
            }}
          />
        )}
        <LedgerAction
          label={
            retryPending ? '전송한 내용 저장 결과 다시 확인' : '기록 저장하기'
          }
          allowWhileLocked
          primary
          loading={busy}
          onPress={saveRecord}
        />
        <LedgerAction
          label="취소"
          allowWhileLocked
          disabled={busy}
          onPress={() => {
            // 변경한 메모는 사용자 확인 없이 버리지 않는다.
            return requestScheduleExit(() =>
              router.replace(`/diary/${snapshot.trip.id}`),
            );
          }}
        />
      </ScrollView>
      <ActionSheet
        title="사진을 삭제할까요?"
        variant="confirm"
        visible={Boolean(deleting)}
        dismissDisabled={busy}
        onClose={() => {
          // 삭제 확정 전 닫기는 원본 유지다.
          return busy ? undefined : setDeleting(null);
        }}
      >
        <Text>
          이 여행의 원본 사진이 삭제돼요. 이미 공개한 사본의 사진도 더 이상
          열리지 않을 수 있어요.
        </Text>
        <LedgerAction
          label="사진 유지"
          disabled={busy}
          onPress={() => {
            // 취소는 저장 명령을 보내지 않는다.
            return setDeleting(null);
          }}
        />
        <LedgerAction
          label="사진 삭제"
          primary
          loading={busy}
          onPress={deletePhoto}
        />
      </ActionSheet>
    </FormFeedback>
  ) : (
    <HaruState kind="loading" title="저장한 기록으로 돌아가고 있어요" />
  );
}
// renderRecordNotes이 읽는 값과 실행 가능한 행동의 계약이다.
type RenderRecordNotesProps = {
  form: PlanForm;
  busy: boolean;
  retryPending: boolean;
  change: (key: string, value: string) => void;
  costs: { currency: string; amount: string }[];
  router: ImperativeRouter;
  snapshot: WorkspaceSnapshot;
};

// 공동 메모·공개 장소 설명·연결 지출을 표시한다.
export function renderRecordNotes({
  form,
  busy,
  retryPending,
  change,
  costs,
  router,
  snapshot,
}: RenderRecordNotesProps) {
  // 전달받은 값과 행동을 기존 화면 규격으로 표시한다.

  return (
    <View style={{ flex: 1, gap: 16 }}>
      <View style={s.private}>
        <Text style={s.section}>나와 동행자만 보는 메모</Text>
        <Field
          label="기록 메모"
          value={form.values.memo || ''}
          multiline
          disabled={busy || retryPending}
          onChange={(value) => {
            // 공동 원본 메모는 공개 사본에서 제외된다.
            return change('memo', value);
          }}
        />
        <Text style={s.meta}>{(form.values.memo || '').length} / 300자</Text>
      </View>
      <View style={s.card}>
        <Field
          label="장소 설명·팁 · 공유할 때 선택"
          value={form.values.planDescription || ''}
          multiline
          disabled={busy || retryPending}
          onChange={(value) => {
            // 기존 계획 설명과 같은 저장 필드를 사용한다.
            return change('planDescription', value);
          }}
        />
        <Text style={s.meta}>
          {(form.values.planDescription || '').length} / 4,000자 · 공개할 때
          선택한 장소에만 포함돼요.
        </Text>
      </View>
      <View style={s.tinted}>
        <Text style={s.section}>장소 연계 지출</Text>
        {costs.length ? (
          costs.map((cost) => {
            // 추정 비용 없이 실제 연결 지출을 표시한다.
            return (
              <Text key={cost.currency}>
                {cost.currency} {cost.amount}
              </Text>
            );
          })
        ) : (
          <Text style={s.meta}>연결한 실제 지출이 없어요.</Text>
        )}
        <LedgerAction
          label="영수증·지출 보완"
          disabled={busy || retryPending}
          onPress={() => {
            // 미저장 메모는 이탈 보호로 확인한다.
            return requestScheduleExit(() =>
              router.push(`/trips/${snapshot.trip.id}?section=expenses`),
            );
          }}
        />
      </View>
    </View>
  );
}
// renderRecordPhotos이 읽는 값과 실행 가능한 행동의 계약이다.
type RenderRecordPhotosProps = {
  photos: WorkspaceMedia[];
  wide: boolean;
  userId: string;
  snapshot: WorkspaceSnapshot;
  busy: boolean;
  retryPending: boolean;
  setDeleting: Dispatch<SetStateAction<string | null>>;
  run: (task: () => Promise<void>) => Promise<void>;
  photo: () => Promise<void>;
};

// 일정의 실제 사진과 사진 추가 행동만 표시한다.
export function renderRecordPhotos({
  photos,
  wide,
  userId,
  snapshot,
  busy,
  retryPending,
  setDeleting,
  run,
  photo,
}: RenderRecordPhotosProps) {
  // 전달받은 값과 행동을 기존 화면 규격으로 표시한다.

  return (
    <View style={{ flex: 1, gap: 16 }}>
      <Text style={s.section}>현장 사진 · {photos.length}장</Text>
      <View style={s.row}>
        {photos.map((media) => {
          // 사진 원본 권한을 유지하며 삭제는 별도 확인한다.
          return (
            <View
              key={media.id}
              style={{
                width: wide ? '46%' : '100%',
                flexGrow: 1,
                gap: 8,
              }}
            >
              <ServerPhoto
                userId={userId}
                tripId={snapshot.trip.id}
                mediaId={media.id}
              />
              <LedgerAction
                label="이 사진 삭제"
                disabled={busy || retryPending}
                onPress={() => {
                  // 사용자 확인 전에는 원본을 지우지 않는다.
                  return setDeleting(media.id);
                }}
              />
            </View>
          );
        })}
      </View>
      <LedgerAction
        label="사진 추가"
        disabled={busy || retryPending}
        onPress={() => {
          // 실제 앨범 선택부터 서버 저장까지 한 번만 실행한다.
          return void run(photo);
        }}
      />
      <Text style={s.meta}>
        사진은 추가·삭제할 때 저장돼요. 아래 메모는 기록 저장을 누르면 반영돼요.
      </Text>
    </View>
  );
}
