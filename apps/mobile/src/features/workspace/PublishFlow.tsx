import { useLayoutEffect, useState, type RefObject } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { WorkspaceSnapshot } from '@wherego/domain';
import Text from '@/components/AppText';
import ScreenHeader from '@/components/ScreenHeader';
import type { PlanForm } from './forms';
import { Field } from './ui';
import { styles } from './workspaceStyles';

import PublishSelection from './PublishSelection';
import { publicationIssue, publicationPreview } from './publication';
import { LedgerAction as Action, useLedgerWide } from './LedgerUI';
import { ledgerStyles as l, ledgerColors } from './ledgerTheme';

// 공개 항목 선택과 실제 공개 화면 확인을 한 번에 섞지 않고 순서대로 진행한다.
export default function PublishFlow({
  form,
  snapshot,
  userId,
  locked,
  busy,
  error,
  scroll,
  onChange,
  onSave,
  onClose,
  backActionRef,
}: {
  form: PlanForm;
  snapshot: WorkspaceSnapshot;
  userId: string;
  locked: boolean;
  busy: boolean;
  error: string;
  scroll: RefObject<ScrollView | null>;
  onChange: (key: string, value: string) => void;
  onSave: () => void;
  onClose: () => void;
  backActionRef?: RefObject<(() => void) | null>;
}) {
  // 같은 폼의 선택값은 단계 이동과 저장 실패 뒤에도 그대로 유지한다.
  const [preview, setPreview] = useState(false);
  const wide = useLedgerWide();
  const issue = publicationIssue(snapshot, form.values);
  const chosen = publicationPreview(snapshot, form.values);
  useLayoutEffect(() => {
    // 헤더와 Escape·시스템 뒤로가 같은 단계 규칙을 따르게 한다.
    if (!backActionRef) return;
    const back = () => {
      // 저장 중에는 단계나 원본 선택을 바꾸지 않는다.
      return locked
        ? undefined
        : preview
          ? void (setPreview(false),
            scroll.current?.scrollTo({ y: 0, animated: false }))
          : onClose();
    };
    backActionRef.current = back;
    return () => {
      // 이전 폼이 새 공개 화면의 뒤로 동작을 지우지 않게 한다.
      if (backActionRef.current === back) backActionRef.current = null;
    };
  }, [backActionRef, locked, preview, onClose, scroll]);
  function step(next: boolean): void {
    // 저장 중 단계 이동을 막고 새 단계의 제목부터 읽게 한다.
    return locked
      ? undefined
      : void (setPreview(next),
        scroll.current?.scrollTo({ y: 0, animated: false }));
  }
  return (
    <SafeAreaView
      style={[styles.modal, { backgroundColor: ledgerColors.canvas }]}
    >
      <ScreenHeader
        title={preview ? snapshot.trip.title : '공유할 내용 선택'}
        inlineTitle={preview}
        backLabel={preview ? '공유 항목 선택으로' : '공유 화면 닫기'}
        disabled={locked}
        onBack={() => {
          // 미리보기에서는 선택으로, 선택에서는 기존 이탈 보호로 돌아간다.
          return preview ? step(false) : onClose();
        }}
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
                  busy ? '공개 중…' : preview ? '공개 범위 확인' : '미리보기'
                }
                variant="primary"
                loading={busy}
                allowWhileLocked
                disabled={Boolean(issue) || (locked && !busy)}
                onPress={() => {
                  // 공개 명령의 대상·버전·범위는 다음 중앙 확인에서 다시 고정한다.
                  return preview ? onSave() : step(true);
                }}
              />
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
          {wide && (
            <View style={[l.card, { width: 300 }]}>
              <Text style={l.section}>공개 범위 요약</Text>
              <Text style={l.place}>{snapshot.trip.title}</Text>
              <Text style={l.meta}>
                선택 일정 {chosen?.snapshot.itinerary.length || 0}개 · 사진{' '}
                {chosen?.photoPaths.length || 0}장
              </Text>
              {form.values.body ? (
                <Text style={l.body}>{form.values.body}</Text>
              ) : null}
              <View style={l.tinted}>
                <Text style={l.body}>
                  개인 메모·예약번호·동행 정보·영수증 원본과 품목은 공개하지
                  않아요.
                </Text>
              </View>
              <Text style={l.section}>공개 지출</Text>
              {form.values.includeCosts === 'true' &&
              chosen &&
              Object.entries(chosen.snapshot.costs).length ? (
                Object.entries(chosen.snapshot.costs).map(
                  ([currency, amount]) => {
                    // 원화 환산이나 예시 비용 없이 선택된 실제 통화 합계만 표시한다.
                    return (
                      <Text key={currency} style={l.body}>
                        {currency} {amount}
                      </Text>
                    );
                  },
                )
              ) : (
                <Text style={l.meta}>공개할 지출 합계가 없어요.</Text>
              )}
              <Text style={l.meta}>
                미리보기에서 내용을 확인한 뒤 공개해 주세요. 원본을 수정해도
                공개 사본이 자동으로 바뀌지는 않아요.
              </Text>
            </View>
          )}
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
