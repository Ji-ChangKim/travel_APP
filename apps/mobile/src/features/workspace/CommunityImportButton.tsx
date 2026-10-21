import { useRef } from 'react';
import { ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTripStore } from '@/stores/useTripStore';
import Text from '@/components/AppText';
import ActionSheet from '@/components/ActionSheet';
import { Action, Field } from './ui';
import { DateField } from './TravelInputs';
import { FormFeedback } from './InputFeedback';
import { ledgerStyles as s } from './ledgerTheme';
import { useCommunityImport } from './useCommunityImport';
import PublicFeedButton from './PublicFeedButton';
import {
  publicFeedStyles as feedStyles,
  publicFeedColors as feedColors,
} from './publicFeedStyles';

// 공개 카드와 상세에서 동일한 실제 일정 담기 동작을 제공한다.
export default function CommunityImportButton({
  postId,
  compact = false,
}: {
  postId: string;
  compact?: boolean;
}) {
  // 계정이 바뀌면 이전 계정의 저장 키와 완료 표시를 재사용하지 않는다.
  const userId = useTripStore((state) => {
    // 화면의 실제 인증·기기 계정만 읽는다.
    return state.currentUser?.id || '';
  });
  return (
    <ImportContent
      key={`${userId}:${postId}`}
      postId={postId}
      userId={userId}
      compact={compact}
    />
  );
}

// 출발일과 복사 범위를 저장 전에 한 시트에서 확인한다.
function ImportContent({
  postId,
  userId,
  compact = false,
}: {
  postId: string;
  userId: string;
  compact?: boolean;
}) {
  // 날짜 입력에도 저장 중 잠금과 접근성 규격을 공통 적용한다.
  const model = useCommunityImport(postId, userId);
  const scroll = useRef<ScrollView>(null);
  return (
    <>
      {compact ? (
        <PublicFeedButton
          label={model.savedTrip ? '담은 일정 열기' : '일정 담기'}
          onPress={model.open}
          style={feedStyles.actionButton}
        >
          <Ionicons
            name={model.savedTrip ? 'bookmark' : 'bookmark-outline'}
            size={18}
            color={model.savedTrip ? feedColors.primary : feedColors.muted}
          />
          <Text
            style={[
              feedStyles.actionButtonText,
              !model.savedTrip && { color: feedColors.muted },
            ]}
          >
            {model.savedTrip ? '담김' : '저장'}
          </Text>
        </PublicFeedButton>
      ) : (
        <Action
          label={model.savedTrip ? '내 여행에서 열기' : '일정 담기'}
          onPress={model.open}
        />
      )}
      <ActionSheet
        visible={model.opened}
        title="내 여행에 일정 담기"
        dismissDisabled={model.busy}
        onClose={() => {
          // 취소나 닫기는 새 여행을 만들지 않는다.
          return model.setOpened(false);
        }}
      >
        <FormFeedback
          locked={model.busy || model.retryOnly}
          feedback={{ fields: {}, attempt: 0 }}
          scroll={scroll}
        >
          <View style={{ gap: 16 }}>
            {model.post ? (
              <>
                <Text style={s.section}>{model.post.title}</Text>
                <Text style={s.body}>
                  공개된 장소·시간·설명을 내 여행으로 담아요. 원본은 그대로 두고
                  내가 자유롭게 수정할 수 있어요. 항공권·사진·지출·개인 메모는
                  담지 않아요.
                </Text>
                <Field
                  label="담을 여행 이름 · 선택"
                  placeholder={model.post.title.slice(0, 50)}
                  value={model.title}
                  onChange={model.setTitle}
                />
                <DateField
                  label="내 여행 출발일"
                  value={model.startDate}
                  onChange={model.setStartDate}
                />
                {model.endDate && (
                  <Text style={s.meta}>
                    여행 기간 {model.startDate} ~ {model.endDate}
                  </Text>
                )}
                {!model.post.snapshot.itinerary.length && (
                  <Text style={s.body}>담을 수 있는 공개 일정이 없어요.</Text>
                )}
                {model.error && (
                  <Text accessibilityRole="alert" style={s.body}>
                    {model.error}
                  </Text>
                )}
                <Action
                  label={
                    model.retryOnly
                      ? '같은 요청 다시 확인'
                      : '담고 일정 수정하기'
                  }
                  variant="primary"
                  loading={model.busy}
                  disabled={!model.valid}
                  allowWhileLocked
                  onPress={() => {
                    // 성공한 저장의 여행만 기존 편집 화면으로 연다.
                    return void model.save();
                  }}
                />
              </>
            ) : model.query.isError ? (
              <>
                <Text accessibilityRole="alert" style={s.body}>
                  공개 일정을 불러오지 못했어요. 다시 불러오거나 다른 일정을
                  선택해 주세요.
                </Text>
                <Action
                  label="다시 불러오기"
                  loading={model.query.isFetching}
                  onPress={() => {
                    // 실패한 공개 원본 조회만 재시도한다.
                    return void model.query.refetch();
                  }}
                />
              </>
            ) : (
              <Text style={s.body}>담을 일정을 불러오는 중이에요.</Text>
            )}
          </View>
        </FormFeedback>
      </ActionSheet>
    </>
  );
}
