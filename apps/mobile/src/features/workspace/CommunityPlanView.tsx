import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import type { CommunityPost } from '@wherego/domain';
import Text from '@/components/AppText';
import { Action, styles } from './ui';
import { communityStyles as s } from './communityStyles';
import PlacePhoto from './PlacePhoto';

type Place = CommunityPost['snapshot']['itinerary'][number];

// 공개된 여행계획을 DAY별 방문 순서와 선택지로 읽는다.
export default function CommunityPlanView({
  post,
}: {
  post: Pick<CommunityPost, 'title' | 'body' | 'snapshot'> &
    Partial<Pick<CommunityPost, 'id'>>;
}) {
  // 저장된 날짜 대신 원안의 일차로 탐색한다.
  const days = post.snapshot.days || [];
  const [selected, setSelected] = useState(days[0]?.dayNumber || 1);
  const day = days.find((item) => {
    // 다른 일차의 설명을 현재 선택에 섞지 않는다.
    return item.dayNumber === selected;
  });
  const places = post.snapshot.itinerary
    .filter((item) => {
      // 장소는 공개 스냅샷에 저장된 실제 DAY만 사용한다.
      return item.dayNumber === selected;
    })
    .sort((first, second) => {
      // 공개 선택 버튼을 누른 순서와 관계없이 저장한 방문 순서를 표시한다.
      return (first.sortOrder || 0) - (second.sortOrder || 0);
    });
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{post.title}</Text>
      <Text style={s.meta}>
        {post.snapshot.country} · {post.snapshot.city} · {days.length}일 계획 ·
        장소 {post.snapshot.itinerary.length}곳
      </Text>
      {post.body ? <Text style={s.meta}>{post.body}</Text> : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.row}>
          {days.map((item) => (
            <Action
              key={item.dayNumber}
              label={`DAY ${item.dayNumber}`}
              accessibilityLabel={`DAY ${item.dayNumber} 여행계획`}
              selected={item.dayNumber === selected}
              size="chip"
              onPress={() => {
                // 일차 선택은 원본 여행과 공개 데이터를 변경하지 않는다.
                return setSelected(item.dayNumber);
              }}
            />
          ))}
        </View>
      </ScrollView>
      <Text accessibilityRole="header" style={styles.title}>
        DAY {selected} · {day?.planTitle || '여행계획'}
      </Text>
      {day?.planConcept ? <Text style={s.body}>{day.planConcept}</Text> : null}
      <Text style={s.meta}>
        {places.length}개 장소 · 선택지와 대체 지점이 포함될 수 있어요.
      </Text>
      {places.map((place, index) => (
        <PlanPlace
          key={`${selected}:${place.id || index}`}
          place={place}
          index={index}
          postId={post.id}
        />
      ))}
      <Text style={s.meta}>
        장소 설명·평점·가격·영업 표시는 계획을 작성할 때 입력한 내용입니다.
      </Text>
    </View>
  );
}

// 장소별 원문과 대체 관계를 해당 일정 안에서만 펼친다.
function PlanPlace({
  place,
  index,
  postId,
}: {
  place: Place;
  index: number;
  postId?: string;
}) {
  // 글의 문장을 줄여 저장하지 않고 장소 설명의 표시 상태만 바꾼다.
  const [expanded, setExpanded] = useState(false);
  return (
    <View style={s.itinerary}>
      <Text style={s.time}>
        {index + 1} · {place.timeSlot || '시간 미정'}
        {place.planContent?.choiceLabel
          ? ` · ${place.planContent.choiceLabel}`
          : ''}
        {place.planContent?.choiceKind === 'backup' ? ' · 대체 지점' : ''}
      </Text>
      <Text accessibilityRole="header" style={s.title}>
        {place.title}
      </Text>
      {postId && place.id && place.type === 'PLACE' ? (
        <PlacePhoto postId={postId} scheduleId={place.id} title={place.title} />
      ) : null}
      {place.address ? <Text style={s.meta}>{place.address}</Text> : null}
      {place.planContent?.description ? (
        <>
          <Action
            label={expanded ? '장소 설명·팁 접기' : '장소 설명·팁 보기'}
            accessibilityLabel={`${place.title} ${expanded ? '장소 설명·팁 접기' : '장소 설명·팁 보기'}`}
            variant="quiet"
            onPress={() => {
              // 추천 메뉴와 팁까지 원문을 그대로 읽을 수 있게 한다.
              return setExpanded(!expanded);
            }}
          />
          {expanded && (
            <Text style={s.body} selectable>
              {place.planContent.description}
            </Text>
          )}
        </>
      ) : null}
    </View>
  );
}
