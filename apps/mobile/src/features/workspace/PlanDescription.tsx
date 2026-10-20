import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { SchedulePlanContent } from '@wherego/domain';
import Text from '@/components/AppText';
import { Action } from './ui';
import { styles } from './workspaceStyles';

import { scheduleStyles as s } from './scheduleTheme';
import AppModal from '@/components/AppModal';
import ScreenHeader from '@/components/ScreenHeader';
import { communityStyles } from './communityStyles';

// 개인 일정과 공유 화면에서 같은 장소의 계획 설명을 읽는다.
export default function PlanDescription({
  title,
  content,
  address,
}: {
  title: string;
  content?: SchedulePlanContent | null;
  address?: string | null;
}) {
  // 비공개 일정 메모는 이 컴포넌트에 전달하지 않는다.
  const [opened, setOpened] = useState(false);
  return content ? (
    <View style={{ gap: 8 }}>
      {content.choiceLabel ? (
        <Text style={s.meta}>{content.choiceLabel}</Text>
      ) : null}
      {content.choiceKind === 'backup' ? (
        <Text style={s.meta}>대체 지점</Text>
      ) : null}
      {content.description ? (
        <>
          <Action
            label="장소 설명·팁 보기"
            accessibilityLabel={`${title} 장소 설명·팁 보기`}
            variant="quiet"
            onPress={() => {
              // 목록 위치를 유지한 채 장소의 읽기 상세 화면을 연다.
              return setOpened(true);
            }}
          />
          <AppModal
            native
            visible={opened}
            slideFrom="right"
            accessibilityLabel={`${title} 장소 설명·팁`}
            onRequestClose={() => {
              // Android 뒤로와 웹 Escape도 같은 목록으로 돌아간다.
              return setOpened(false);
            }}
          >
            <SafeAreaView style={styles.screen}>
              <ScreenHeader
                title={title}
                inlineTitle
                backLabel="장소 목록으로 돌아가기"
                onBack={() => {
                  // 닫기 전환 동안 원문을 유지하고 읽던 목록을 복원한다.
                  return setOpened(false);
                }}
              />
              <ScrollView contentContainerStyle={communityStyles.content}>
                <Text style={s.meta}>
                  작성자가 남긴 장소 설명이에요. 가격·영업시간은 방문 전에
                  확인해 주세요.
                </Text>
                {address ? <Text style={s.meta}>{address}</Text> : null}
                {content.choiceLabel ? (
                  <Text style={s.meta}>{content.choiceLabel}</Text>
                ) : null}
                {content.choiceKind === 'backup' ? (
                  <Text style={s.meta}>대체 지점</Text>
                ) : null}
                <Text style={s.body} selectable>
                  {content.description}
                </Text>
              </ScrollView>
            </SafeAreaView>
          </AppModal>
        </>
      ) : null}
    </View>
  ) : null;
}
