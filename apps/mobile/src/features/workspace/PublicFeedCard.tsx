import { useState } from 'react';
import { View } from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import Text from '@/components/AppText';
import ActionSheet from '@/components/ActionSheet';
import CommunityPhoto from './CommunityPhoto';
import PublicFeedButton from './PublicFeedButton';
import type { CommunityFeedPostProps } from './communityFeedTypes';
import { communityFeedPeriod } from './communityFeedCard';
import {
  publicFeedStyles as s,
  publicFeedColors as c,
} from './publicFeedStyles';
import { Action, Field } from './ui';
import CommunityImportButton from './CommunityImportButton';

// 실제 공개 원본의 표지·배지·작성자·동선 행동을 표시한다.
export default function PublicFeedCard(props: CommunityFeedPostProps) {
  // 메뉴만 로컬 상태이며 신고 초안은 기존 컨트롤러에 유지한다.
  const [opened, setOpened] = useState(false);
  const {
    post,
    userId,
    router,
    busy,
    setReportId,
    setReason,
    setReasonError,
    setBlock,
  } = props;
  const region = [post.country, post.city].filter(Boolean).join(' · ');
  const month = `${post.startDate.slice(0, 4)}년 ${Number(post.startDate.slice(5, 7))}월 ${post.kind === 'plan' ? '계획' : '여행'}`;
  const companion = resolveCompanionBadge(post.title, post.kind);

  return (
    <View style={s.post} testID={`public-feed-card-${post.id}`}>
      <View style={s.cover}>
        {post.photoPath ? (
          <CommunityPhoto
            path={post.photoPath}
            userId={userId || 'public'}
            coverHeight={208}
            edgeToEdge
          />
        ) : (
          <View style={s.noPhoto}>
            <Ionicons name="map-outline" size={44} color={c.muted} />
            <Text style={s.meta}>공개 사진 없이 담은 여행</Text>
          </View>
        )}
        <View pointerEvents="none" style={s.coverOverlay} />
        <View pointerEvents="none" style={s.location}>
          <View style={s.locationBadge}>
            <MaterialIcons name="location-on" size={14} color={c.pin} />
            <Text style={s.locationText}>{region}</Text>
          </View>
        </View>
      </View>
      <View style={s.body}>
        <View style={s.badges}>
          <View style={[s.badge, s.regionBadge]}>
            <Text style={s.regionText}>{region}</Text>
          </View>
          <View style={[s.badge, s.durationBadge]}>
            <Text style={s.durationText}>{communityFeedPeriod(post)}</Text>
          </View>
          <View style={s.badge}>
            <Text style={s.badgeText}>{companion}</Text>
          </View>
          <View style={s.badge}>
            <Text style={s.badgeText}>{month}</Text>
          </View>
        </View>
        <Text accessibilityRole="header" style={s.title}>
          {post.title}
        </Text>
        <View style={s.footer}>
          <View style={s.author}>
            <View style={s.avatar}>
              <Ionicons name="person" size={16} color={c.muted} />
            </View>
            <Text style={s.authorText}>{post.author}</Text>
          </View>
          <View style={s.actions}>
            <CommunityImportButton postId={post.id} compact />
            <PublicFeedButton
              label={`${post.title} ${post.kind === 'plan' ? '여행계획' : '여행기록'} 보기`}
              style={s.textButton}
              onPress={() => {
                /* 공개한 실제 일정 상세를 연다. */ return router.push({
                  pathname: '/community/[postId]',
                  params: { postId: post.id },
                });
              }}
            >
              <Text style={s.link}>동선 보기</Text>
              <Ionicons name="chevron-forward" size={16} color={c.primary} />
            </PublicFeedButton>
            <PublicFeedButton
              label={`${post.title} 더 보기`}
              style={s.iconButton}
              disabled={busy}
              expanded={opened}
              onPress={() => {
                /* 해당 게시물의 안전 행동만 연다. */ return setOpened(true);
              }}
            >
              <Ionicons name="ellipsis-horizontal" size={20} color={c.muted} />
            </PublicFeedButton>
          </View>
        </View>
        <PublicFeedReport {...props} />
      </View>
      <ActionSheet
        visible={opened}
        title="공개 여행 더 보기"
        onClose={() => {
          /* 서버 변경 없이 메뉴만 닫는다. */ return setOpened(false);
        }}
      >
        <Action
          label="신고"
          disabled={busy}
          onPress={() => {
            /* 이전 사유를 지우고 선택한 게시물 입력을 연다. */ return void (setOpened(
              false,
            ),
            setReportId(post.id),
            setReason(''),
            setReasonError(''));
          }}
        />
        {post.authorId !== userId ? (
          <Action
            label="작성자 차단"
            disabled={busy}
            onPress={() => {
              /* 실제 차단 전에 기존 확인 시트를 연다. */ return void (setOpened(
                false,
              ),
              setBlock({ id: post.authorId, name: post.author }));
            }}
          />
        ) : null}
      </ActionSheet>
    </View>
  );
}

// 신고 입력과 취소·확정은 기존 서버 계약을 그대로 따른다.
function PublicFeedReport({
  post,
  reportId,
  reason,
  reasonError,
  setReason,
  busy,
  moderation,
  setReportId,
}: CommunityFeedPostProps) {
  // 다른 게시물의 입력을 같은 카드에 표시하지 않는다.
  return reportId === post.id ? (
    <View style={s.sheet}>
      <Field
        label="신고 사유"
        value={reason}
        disabled={busy}
        multiline
        onChange={setReason}
      />
      {reasonError ? (
        <Text accessibilityRole="alert" style={s.link}>
          {reasonError}
        </Text>
      ) : null}
      <Action
        label="신고 접수"
        variant="primary"
        loading={busy}
        disabled={!reason.trim()}
        onPress={() => {
          /* 실제 게시물과 입력 사유만 전송한다. */ return moderation(
            '/community/reports',
            { postId: post.id, reason: reason.trim() },
          );
        }}
      />
      <Action
        label="신고 취소"
        disabled={busy}
        onPress={() => {
          /* 서버 변경 없이 입력만 닫는다. */ return setReportId('');
        }}
      />
    </View>
  ) : null;
}

// 제목과 공개 종류에 따라 시안에 맞는 동행 뱃지 문구를 결정한다.
function resolveCompanionBadge(
  title: string,
  kind?: 'plan' | 'record',
): string {
  // 제목에 포함된 동행 키워드를 우선 확인한다.
  if (title.includes('친구')) return '친구와';
  if (title.includes('가족') || title.includes('부모')) return '가족/부모님과';
  if (title.includes('혼자') || title.includes('퇴사')) return '혼자서';
  if (title.includes('연인') || title.includes('커플')) return '연인과';
  // 키워드가 없으면 실제 공개 유형을 기본값으로 반환한다.
  return kind === 'plan' ? '여행계획' : '여행기록';
}
