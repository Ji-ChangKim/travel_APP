import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import type { CommunityPost } from '@wherego/domain';
import Text from '@/components/AppText';
import { useAppAccessibility } from '@/features/accessibility/appAccessibility';
import PlacePhoto from './PlacePhoto';
import PlanDescription from './PlanDescription';
import CommunityPhoto from './CommunityPhoto';
import { LedgerAction } from './LedgerUI';
import { ledgerStyles as s, ledgerColors as c } from './ledgerTheme';

type Place = CommunityPost['snapshot']['itinerary'][number];

// 미리보기와 공개 상세에 동일한 실제 투영을 표시한다.
export default function CommunityPlanView({
  post,
  showTitle = true,
  photoPreview,
}: {
  post: Pick<CommunityPost, 'title' | 'body' | 'snapshot'> &
    Partial<
      Pick<CommunityPost, 'id' | 'author' | 'publishedAt' | 'photoPaths'>
    >;
  showTitle?: boolean;
  photoPreview?: { tripId: string; userId: string };
}) {
  // 선택한 DAY의 소개와 장소만 바꾸며 원문/날짜는 저장값을 유지한다.
  const days = post.snapshot.days || [];
  const [selected, setSelected] = useState(days[0]?.dayNumber || 1);
  const day = days.find((entry) => {
    // 다른 DAY의 원문을 섞지 않는다.
    return entry.dayNumber === selected;
  });
  const duration =
    Math.round(
      (Date.parse(post.snapshot.endDate) -
        Date.parse(post.snapshot.startDate)) /
        86400000,
    ) + 1;
  const places = post.snapshot.itinerary
    .filter((entry) => {
      // 현재 공개된 DAY에 속한 항목만 읽는다.
      return entry.dayNumber === selected;
    })
    .sort((a, b) => {
      // 클릭 순서가 아닌 저장된 일정 순서를 유지한다.
      return (a.sortOrder || 0) - (b.sortOrder || 0);
    });
  return (
    <View style={{ gap: 20 }}>
      <Text style={s.eyebrow}>공개된 여행계획</Text>
      {showTitle && (
        <Text accessibilityRole="header" style={s.title}>
          {post.title}
        </Text>
      )}
      <Text style={s.meta}>
        {post.snapshot.country} · {post.snapshot.city} · {duration}일 여행
        {days.length !== duration ? ` 중 ${days.length}일 공개` : ''}
      </Text>
      {post.author && (
        <View style={s.row}>
          <Text style={s.body}>{post.author}</Text>
          {post.publishedAt && (
            <Text style={s.meta}>{post.publishedAt.slice(0, 10)} 공유</Text>
          )}
        </View>
      )}
      {post.body && <Text style={s.body}>{post.body}</Text>}
      {Object.keys(post.snapshot.costs).length > 0 && (
        <View style={s.tinted}>
          <Text style={s.meta}>선택 공개한 여행 전체 실제 지출</Text>
          {Object.entries(post.snapshot.costs).map(([currency, amount]) => {
            // 통화를 임의 환산하거나 시안의 금액으로 채우지 않는다.
            return (
              <Text key={currency} style={s.section}>
                {currency} {amount}
              </Text>
            );
          })}
          <Text style={s.meta}>영수증 원본과 상세 품목은 공개하지 않아요.</Text>
        </View>
      )}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={[s.row, { flexWrap: 'nowrap' }]}>
          {days.map((entry) => {
            // DAY 선택 전후 체크 공간이나 글꼴 굵기를 바꾸지 않는다.
            return (
              <LedgerAction
                key={entry.dayNumber}
                label={`DAY ${entry.dayNumber}`}
                accessibilityLabel={`DAY ${entry.dayNumber} 여행계획`}
                selected={entry.dayNumber === selected}
                onPress={() => {
                  // 현재 읽는 날짜만 바꾼다.
                  return setSelected(entry.dayNumber);
                }}
              />
            );
          })}
        </View>
      </ScrollView>
      <View style={s.card}>
        <Text style={s.eyebrow}>DAY {selected} THEME</Text>
        <Text accessibilityRole="header" style={s.section}>
          {day?.planTitle || `DAY ${selected} 여행계획`}
        </Text>
        {day?.planConcept && <Text style={s.body}>{day.planConcept}</Text>}
      </View>
      {places.map((place, index) => {
        // 카드에는 공개 스냅샷 필드만 전달한다.
        return (
          <PlanPlace
            key={`${selected}:${place.id || index}`}
            place={place}
            index={index}
            postId={post.id}
            photoPreview={photoPreview}
          />
        );
      })}
      {Boolean(post.photoPaths?.length) && (
        <View style={s.card}>
          <Text style={s.section}>
            여행 갤러리 · {post.photoPaths!.length}장
          </Text>
          {post.photoPaths!.map((path) => {
            // 장소 연결 정보가 없는 공개 사진을 임의 장소에 배정하지 않는다.
            return <CommunityPhoto key={path} path={path} />;
          })}
        </View>
      )}
      <View style={s.tinted}>
        <Text style={s.meta}>
          개인 메모·예약번호·동행 정보·영수증 원본과 품목은 공개하지 않아요.
          장소 설명은 작성자의 원문이며 가격과 영업시간은 방문 전에 확인해
          주세요.
        </Text>
      </View>
    </View>
  );
}

// 실제 장소명·시간·설명과 Google 사진을 신규 카드 규격으로 표시한다.
function PlanPlace({
  place,
  index,
  postId,
  photoPreview,
}: {
  place: Place;
  index: number;
  postId?: string;
  photoPreview?: { tripId: string; userId: string };
}) {
  // 큰 글자에서는 좁은 타임라인 열을 제거한다.
  const large = useAppAccessibility().largeText;
  return (
    <View
      style={{
        flexDirection: large ? 'column' : 'row',
        gap: 12,
        alignItems: 'stretch',
      }}
    >
      {!large && (
        <View
          accessible={false}
          style={{ width: 12, alignItems: 'center', paddingTop: 18 }}
        >
          <View
            style={{
              width: 10,
              height: 10,
              borderRadius: 5,
              backgroundColor: c.accent,
            }}
          />
          <View
            style={{ width: 1, flex: 1, backgroundColor: c.line, marginTop: 8 }}
          />
        </View>
      )}
      <View style={[s.card, { flex: 1, minWidth: 0 }]}>
        <Text style={s.meta}>
          {index + 1} · {place.timeSlot || '시간 미정'}
        </Text>
        <Text accessibilityRole="header" style={s.section}>
          {place.title}
        </Text>
        {place.address && <Text style={s.meta}>{place.address}</Text>}
        {(postId || photoPreview) && place.id && place.type === 'PLACE' && (
          <PlacePhoto
            postId={postId}
            preview={photoPreview}
            scheduleId={place.id}
            title={place.title}
          />
        )}
        <PlanDescription
          title={place.title}
          content={place.planContent}
          address={place.address}
        />
      </View>
    </View>
  );
}
