import { t } from '@/features/localization/translate';
import { useLocale } from '@/features/localization/localeState';
import { View } from 'react-native';
import type { CommunityPost } from '@wherego/domain';
import Text from '@/components/ui/AppText';
import CommunityPhoto from './CommunityPhoto';
import { travelDateRange } from '../../planning/model/travelDateRange';
import { communityStyles as s } from '../styles/communityStyles';

// 기존 기록 공개 계약의 날짜·장소·일반 사진·합계만 단건 상세로 읽는다.
export default function CommunityRecordView({ post }: { post: CommunityPost }) {
  useLocale();
  // 개인 메모와 계획 전용 설명을 원본 여행에서 보충하지 않는다.
  return (
    <View style={{ gap: 24 }}>
      <Text style={s.meta}>
        {post.snapshot.country} · {post.snapshot.city} {t('· 여행기록')}
      </Text>
      <Text style={s.meta}>
        {travelDateRange(post.snapshot.startDate, post.snapshot.endDate)}
      </Text>
      {post.body ? <Text style={s.body}>{post.body}</Text> : null}
      {post.snapshot.itinerary.map((item, index) => {
        /* 현재 항목의 표시 또는 선택값만 갱신한다. */ return (
          <View key={item.id || `${item.date}:${index}`} style={s.itinerary}>
            <Text style={s.time}>
              {item.date} · {item.timeSlot || t('시간 미정')}
            </Text>
            <Text accessibilityRole="header" style={s.title}>
              {item.title}
            </Text>
            {item.address ? <Text style={s.meta}>{item.address}</Text> : null}
          </View>
        );
      })}
      {post.photoPaths.map((path) => {
        /* 현재 항목의 표시 또는 선택값만 갱신한다. */ return (
          <CommunityPhoto key={path} path={path} />
        );
      })}
      {Object.entries(post.snapshot.costs).map(([currency, amount]) => {
        /* 현재 항목의 표시 또는 선택값만 갱신한다. */ return (
          <Text key={currency} style={s.cost}>
            {t('실제 지출 합계 ·')} {currency} {amount}
          </Text>
        );
      })}
      {!post.snapshot.itinerary.length &&
      !post.photoPaths.length &&
      !Object.keys(post.snapshot.costs).length ? (
        <Text style={s.meta}>{t('작성자가 공개한 소개만 볼 수 있어요.')}</Text>
      ) : null}
    </View>
  );
}
