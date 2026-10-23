import { type RefObject } from 'react';
import PublishSummary from './PublishSummary';
import { usePublishNavigation } from './usePublishNavigation';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { WorkspaceSnapshot } from '@wherego/domain';
import Text from '@/components/AppText';
import ScreenHeader from '@/components/ScreenHeader';
import type { PlanForm } from './forms';
import { Field } from './ui';
import { styles } from './workspaceStyles';

import PublishSelection from './PublishSelection';
import { publicationIssue } from './publication';
import { LedgerAction as Action, useLedgerWide } from './LedgerUI';
import { ledgerStyles as l, ledgerColors } from './ledgerTheme';

// 공개 항목 선택과 실제 공개 화면 확인을 한 번에 섞지 않고 순서대로 진행한다.
export default function PublishFlow({
  form,
  snapshot,
  userId,
  locked,
  busy,
  conflicted,
  error,
  scroll,
  onChange,
  onSave,
  onReload,
  onClose,
  backActionRef,
}: {
  form: PlanForm;
  snapshot: WorkspaceSnapshot;
  userId: string;
  locked: boolean;
  busy: boolean;
  conflicted: boolean;
  error: string;
  scroll: RefObject<ScrollView | null>;
  onChange: (key: string, value: string) => void;
  onSave: () => void;
  onReload: () => void;
  onClose: () => void;
  backActionRef?: RefObject<(() => void) | null>;
}) {
  const { preview, step, goBack } = usePublishNavigation({
    locked,
    scroll,
    onClose,
    backActionRef,
  });
  const wide = useLedgerWide();
  const issue = publicationIssue(snapshot, form.values);
  return (
    <SafeAreaView
      style={[styles.modal, { backgroundColor: ledgerColors.canvas }]}
    >
      <ScreenHeader
        title={preview ? snapshot.trip.title : '공유할 내용 선택'}
        inlineTitle={preview}
        backLabel={preview ? '공유 항목 선택으로' : '공유 화면 닫기'}
        disabled={locked}
        onBack={goBack}
      />
      <ScrollView
        style={publishStyles.scroll}
        ref={scroll}
        contentContainerStyle={[l.content, wide && l.wideContent]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={l.eyebrow}>
          {preview ? '2 / 2 · 공개 화면 미리보기' : '1 / 2 · 공개 항목 선택'}
        </Text>
        <View style={l.private}>
          <Text style={l.body}>
            개인 메모·예약번호·동행 정보·영수증 원본과 품목은 공개하지 않아요.
          </Text>
        </View>
        {snapshot.postId && (
          <Text style={styles.subtitle}>
            다시 공개하면 기존 링크의 내용이 이번 선택으로 바뀌어요. 내 여행
            원본은 그대로 남아요.
          </Text>
        )}
        <View
          style={{
            flexDirection: wide ? 'row' : 'column',
            gap: 24,
            alignItems: 'flex-start',
          }}
        >
          <View style={{ flex: 1, minWidth: 0, width: '100%', gap: 20 }}>
            <PublishSelection
              mode={preview ? 'preview' : 'selection'}
              form={form}
              snapshot={snapshot}
              userId={userId}
              busy={locked}
              onChange={onChange}
            />
            {!preview && (
              <Field
                label="공유 소개 · 선택"
                value={form.values.body || ''}
                multiline
                disabled={locked}
                onChange={(value) => {
                  // 원본 항목을 먼저 고른 뒤 선택 소개만 덧붙일 수 있게 한다.
                  return onChange('body', value);
                }}
              />
            )}
            {(error || (preview && issue)) && (
              <Text style={styles.error} accessibilityRole="alert">
                {error || issue}
              </Text>
            )}
            <View style={styles.row}>
              <Action
                label={
                  busy
                    ? '공개 중…'
                    : locked && !conflicted
                      ? '다시 공개하기'
                      : preview
                        ? '공개 범위 확인'
                        : '미리보기'
                }
                variant="primary"
                loading={busy}
                allowWhileLocked
                disabled={conflicted || (!locked && Boolean(issue))}
                onPress={() => {
                  // 응답 유실 뒤에는 기존 요청을 재개하며 새 공개만 중앙 확인을 거친다.
                  return preview || locked ? onSave() : step(true);
                }}
              />
              {conflicted && (
                <Action
                  label="최신 내용 불러오기"
                  allowWhileLocked
                  disabled={busy}
                  onPress={onReload}
                />
              )}
              {preview && (
                <Action
                  label="선택 내용 수정"
                  disabled={locked}
                  onPress={() => {
                    // 미리보기에서 선택을 바꿔도 원본이나 이전 공개 사본은 수정하지 않는다.
                    return step(false);
                  }}
                />
              )}
            </View>
          </View>
          {wide && <PublishSummary form={form} snapshot={snapshot} />}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const publishStyles = StyleSheet.create({
  scroll: {
    flex: 1,
    ...Platform.select({ web: { scrollbarGutter: 'stable' }, default: {} }),
  },
});
