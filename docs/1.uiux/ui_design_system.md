# Travel App UI Design System

> 문서명: `ui_design_system.md`  
> 버전: v0.1  
> 목적: 여행 계획·공유·기록 서비스의 UI/UX 시각 규격을 통일하고, WEB/APP 공통 컴포넌트 구현 기준을 정의한다.

---

# 1. Design Concept

## 1.1 Concept Name

**Clean Travel Organizer**

여행 중 필요한 일정, 장소, 지도, 지출 정보를 빠르게 확인하고 관리할 수 있는 밝고 경쾌한 여행 도구를 지향한다.

핵심 방향은 다음과 같다.

- 정보성 60~70%
- 감성 30~40%
- 밝고 깨끗한 Surface 중심 UI
- 여행 서비스 특유의 경쾌함은 Coral Orange로 표현
- 지도·이동·링크·위치 정보는 Blue 계열로 보조
- 많은 정보를 한 화면에 보여주되, 정보 위계는 명확하게 구분
- 과도한 장식보다 사용성과 가독성을 우선

---

# 2. Design Principles

## 2.1 정보 우선

여행 중 사용자는 빠르게 정보를 확인해야 한다.

따라서 모든 화면은 아래 우선순위를 따른다.

1. 지금 무엇을 해야 하는가
2. 어디로 가야 하는가
3. 언제 움직여야 하는가
4. 얼마를 사용했는가
5. 어떤 추가 정보가 있는가

---

## 2.2 Primary Action 명확화

Primary Color는 주요 행동에만 사용한다.

예시:

- 일정 추가
- 일정 저장
- 여행 생성
- 영수증 반영
- 수정 완료
- 계획 확정

Primary Action이 아닌 정보성 UI에는 Coral Orange 사용을 최소화한다.

---

## 2.3 여행 중 한 손 조작 고려

모바일 사용 시 주요 행동은 화면 하단 또는 엄지손가락이 접근하기 쉬운 영역에 배치한다.

- Bottom Navigation
- Floating Action Button
- Primary CTA
- Bottom Sheet Action

---

## 2.4 정보 밀도 관리

한 카드 또는 한 화면에 많은 정보를 제공하더라도 다음 계층을 유지한다.

### 1차 정보

- 일정명
- 장소명
- 시간
- 결제 금액
- 현재 선택 상태

### 2차 정보

- 주소
- 교통 정보
- 카테고리
- 평점
- 이동 시간

### 3차 정보

- 메모
- 태그
- OCR 상세 정보
- 부가 링크
- 설명 텍스트

---

# 3. Color System

## 3.1 Primary

| Token                   | Hex       | Usage                          |
| ----------------------- | --------- | ------------------------------ |
| `color-primary`         | `#F45135` | 주요 CTA, 선택 상태, 핵심 행동 |
| `color-primary-pressed` | `#D9402A` | 버튼 Pressed                   |
| `color-primary-soft`    | `#FFF1ED` | 선택 배경, Tag, Highlight      |

---

## 3.2 Secondary

| Token                  | Hex       | Usage                       |
| ---------------------- | --------- | --------------------------- |
| `color-secondary`      | `#3D8DFF` | 지도, 위치, 링크, 교통 정보 |
| `color-secondary-soft` | `#EDF5FF` | 위치/교통 관련 배경         |

---

## 3.3 Neutral

| Token                  | Hex       | Usage               |
| ---------------------- | --------- | ------------------- |
| `color-bg`             | `#F7F8FA` | App Background      |
| `color-surface`        | `#FFFFFF` | Card, Sheet, Header |
| `color-text-primary`   | `#181A20` | Main Text           |
| `color-text-secondary` | `#666B75` | Secondary Text      |
| `color-text-disabled`  | `#A6AAB2` | Disabled            |
| `color-border`         | `#E9EBEF` | Divider, Border     |
| `color-divider`        | `#EFF1F4` | Section Divider     |

---

## 3.4 Semantic

| Token           | Usage            |
| --------------- | ---------------- |
| `color-success` | 완료, 정상 처리  |
| `color-warning` | 주의, 예정 변경  |
| `color-error`   | 오류, 삭제, 실패 |
| `color-info`    | 정보 안내        |

Semantic Color는 실제 개발 단계에서 WCAG 대비 기준에 맞춰 최종 확정한다.

---

# 4. Typography

## 4.1 Font Family

### Primary Font

**Pretendard**

적용 이유:

- 한글/영문/숫자 조합 가독성
- APP/WEB 환경 대응
- 시간, 날짜, 금액 표기 안정성
- 다양한 Weight 지원

Fallback:

```css
font-family:
  Pretendard,
  -apple-system,
  BlinkMacSystemFont,
  'Segoe UI',
  Roboto,
  'Noto Sans KR',
  sans-serif;
```

---

## 4.2 Type Scale

| Token      |    Size |  Weight | Usage                 |
| ---------- | ------: | ------: | --------------------- |
| `title-xl` |    22px |     700 | 여행명, 핵심 타이틀   |
| `title-lg` |    20px |     700 | 페이지 제목           |
| `title-md` |    16px | 600~700 | 카드 제목             |
| `body-lg`  |    15px |     500 | 주요 본문             |
| `body-md`  |    15px |     400 | 일반 본문             |
| `body-sm`  |    13px | 400~500 | 설명, 보조 정보       |
| `caption`  |    12px | 400~500 | 날짜, 태그, 부가 정보 |
| `button`   | 15~16px |     600 | 버튼                  |
| `chip`     | 12~13px | 500~600 | Chip / Filter         |

---

## 4.3 Typography Rules

- 기본 본문 최소 13px 이상
- 주요 텍스트는 15px 이상 사용
- 11px 이하 텍스트 사용 금지
- 숫자와 금액은 필요 시 SemiBold 이상 사용
- 카드 안에서는 최대 3단계까지만 텍스트 위계를 사용
- 긴 설명은 최대 2~3줄 이후 말줄임 처리 고려

---

# 5. Spacing System

기본 간격 단위는 **4px**로 한다.

| Token     | Value |
| --------- | ----: |
| `space-1` |   4px |
| `space-2` |   8px |
| `space-3` |  12px |
| `space-4` |  16px |
| `space-5` |  20px |
| `space-6` |  24px |
| `space-8` |  32px |

### 기본 규칙

- Screen Side Padding: `16px`
- Card 내부 Padding: `16px`
- 주요 Section 간 간격: `24~32px`
- 동일 그룹 내부 간격: `8~12px`
- Icon/Text 간격: `6~8px`

---

# 6. Radius System

| Component        |  Radius |
| ---------------- | ------: |
| Small UI         |     8px |
| Small Button     |    10px |
| Secondary Button |    12px |
| Primary Button   | 14~16px |
| Card             |    16px |
| Modal            |    20px |
| Bottom Sheet     |    24px |
| Chip             | 16~17px |
| Circular Icon    |     50% |

---

# 7. Button System

## 7.1 Primary Button

주요 확정 행동에 사용한다.

예시:

- 일정에 추가하기
- 여행 만들기
- 영수증 반영하기
- 저장하기

### Specification

- Height: `52px`
- Radius: `14~16px`
- Horizontal Padding: `20px`
- Font: `16px / 600`
- Background: `color-primary`
- Text: White
- Width: 기본 Full Width
- 좌우 Screen Margin: `16px`

---

## 7.2 Secondary Button

예시:

- 길안내
- 일정 수정
- 영수증 추가
- 상세보기

### Specification

- Height: `40~44px`
- Radius: `10~12px`
- Font: `14px / 600`
- Padding: `16px`

---

## 7.3 Tertiary Button

Text 중심의 보조 Action.

- Height: 최소 Touch Area `44px`
- Background: Transparent
- Text Color: Secondary 또는 Primary
- 필요 시 Icon 포함

---

## 7.4 Disabled

- Background: Neutral Light
- Text: Disabled Color
- Interaction 없음
- Disabled 상태에서도 Label 가독성 유지

---

# 8. Icon System

## 8.1 Icon Size

| Usage      | Size |
| ---------- | ---: |
| Small      | 16px |
| Default    | 20px |
| Navigation | 24px |
| Emphasis   | 28px |

---

## 8.2 Touch Area

아이콘 자체 크기와 무관하게 Interactive 영역은 최소:

**44 × 44px**

---

## 8.3 Icon Style

- Line Icon 기반 권장
- Stroke 두께 통일
- Filled Icon은 선택 상태 또는 강한 강조에 제한
- 한 화면에서 Line/Fill 스타일 혼용 최소화

---

# 9. Chip / Filter

사용 예:

- 장소
- 교통
- 식사
- 예약
- 숙소
- 쇼핑

### Specification

- Height: `32~34px`
- Radius: `16~17px`
- Horizontal Padding: `12~14px`
- Font: `12~13px / 500~600`
- Icon: `16px`
- Icon/Text Gap: `6px`

### State

#### Default

- Background: Neutral Light
- Text: Secondary

#### Selected

- Background: Primary 또는 Primary Soft
- Text: Primary 또는 White

---

# 10. Card System

## 10.1 Default Card

- Background: White
- Radius: `16px`
- Padding: `16px`
- Border: `1px solid color-border`
- Shadow: 최소화
- 카드 간 간격: `12~16px`

---

## 10.2 Timeline Card

### 필수 정보

- 시간
- 카테고리
- 일정명
- 장소
- 주요 비용 또는 이동 정보

### 정보 구조

```text
10:30       관광
시라하마 해변
Wakayama, Japan

[선택적 이미지]

¥ 2,695
```

카드 안에서 강조되는 요소는 최대 2개로 제한한다.

---

## 10.3 Expense Card

우선순위:

1. 금액
2. 장소 또는 사용처
3. 날짜/시간
4. 결제 수단
5. 일정 연결 정보

---

# 11. Header

## 11.1 Standard Header

- Height: `56px`
- 좌우 Padding: `16px`
- Title: `20px / 700`
- Back Button Touch Area: `44px`
- Action Icon Touch Area: `44px`

### 구성

```text
[Back]     페이지 제목          [Action]
```

---

# 12. Bottom Navigation

## 12.1 구조

하단 주요 Navigation은 최대 5개 메뉴를 권장한다.

예시:

- 내 여행
- 탐색
- Quick Add
- 기록/가계부
- 마이

### Specification

- Height: `64~72px + Safe Area`
- Icon: `24px`
- Label: `11~12px`
- Selected Color: Primary 또는 Dark
- Unselected: Secondary Gray

---

## 12.2 Floating Action Button

여행 계획 추가와 같이 서비스 핵심 행동을 담당한다.

- Size: `52~56px`
- Shape: Circle
- Position: Bottom Navigation 중앙
- Icon: `24px`
- Background: Primary

---

# 13. Bottom Sheet

지도, 장소 상세, 일정 선택 등에서 활용한다.

### Specification

- Top Radius: `24px`
- Background: White
- Padding: `20px`
- Drag Handle: 제공 권장
- 기본적으로 화면 하단에서 확장

### Recommended Structure

```text
─────

장소명
카테고리 · 평점

주소
가격 / 예상 비용

[길안내] [일정에 추가]
```

---

# 14. Timeline UI

여행의 핵심 화면으로 정의한다.

## 14.1 구조

```text
DAY Header

09:00 ●──── 일정
       │
10:30 ●──── 일정
       │
12:30 ●──── 일정
```

### Rule

- 시간은 왼쪽
- Timeline Line은 중앙 또는 좌측
- 일정 콘텐츠는 Card
- 현재 일정은 Primary 강조 가능
- 완료된 일정은 Visual Weight 감소

---

# 15. Map UI

## 15.1 역할

지도는 단순 위치 확인이 아닌 다음 행동을 지원해야 한다.

- 일정 위치 파악
- 일정 간 이동 관계 확인
- 주변 장소 탐색
- 지도에서 일정 선택
- 장소를 여행 계획에 추가

---

## 15.2 Marker

Marker는 아래 유형을 구분한다.

- 현재 일정
- 일반 일정
- 음식
- 숙소
- 교통
- 사용자 현재 위치

Marker 색상은 과도하게 다양화하지 않는다.

---

## 15.3 Map + Bottom Sheet

지도에서 Marker 선택 시 상세 정보는 Bottom Sheet로 제공한다.

지도 자체 위에 과도한 텍스트 Overlay 사용 금지.

---

# 16. OCR / Receipt UI

## 16.1 목표

영수증 이미지를 여행 지출 데이터로 전환한다.

사용자가 가장 먼저 확인해야 하는 값:

1. 사용처
2. 결제일
3. 결제 금액
4. 일정 연결 여부

---

## 16.2 OCR Result Structure

```text
영수증 이미지

결제처
도레도레 시장

결제일
2026.10.04 12:38

결제금액
¥ 2,695

연결 일정
DAY 2 - 점심

[직접 수정]

[일정 및 여행 비용에 반영]
```

---

## 16.3 OCR UX Rule

- OCR 결과는 자동 저장하지 않는다
- 사용자 확인 후 반영한다
- 신뢰도가 낮은 값은 별도 표시
- 금액/날짜/가맹점명은 직접 수정 가능
- 일정 미연결 상태 허용
- 중복 영수증 탐지 필요

---

# 17. Form / Input

## 17.1 Input Height

- Default: `48px`
- Large Search: `52px`

## 17.2 Radius

- `12px`

## 17.3 Search

장소 검색은 대표 입력 컴포넌트로 정의한다.

```text
[Search Icon] 장소 또는 지역 검색
```

검색 결과에는 최소 다음을 노출한다.

- 장소명
- 주소
- 카테고리
- 거리 또는 위치 정보

---

# 18. State Design

모든 Interactive Component는 다음 State를 고려한다.

- Default
- Hover (WEB)
- Pressed
- Focus
- Selected
- Disabled
- Loading
- Error

---

# 19. Empty State

빈 화면에서도 다음 행동을 명확히 제공한다.

예:

```text
아직 등록된 일정이 없습니다

가고 싶은 장소나
예약한 일정을 추가해보세요

[일정 추가하기]
```

---

# 20. Loading

Skeleton UI를 우선 사용한다.

적용 영역:

- 여행 목록
- Timeline
- 장소 검색
- 지도 장소 정보
- OCR 결과
- 여행 공유 데이터

전체 화면 Spinner는 최소화한다.

---

# 21. Safe Area

모바일 APP에서는 아래 영역을 반드시 고려한다.

- Status Bar
- Dynamic Island / Notch
- Bottom Home Indicator

특히:

- Bottom Navigation
- Bottom CTA
- Modal
- Bottom Sheet

은 Safe Area를 포함해야 한다.

---

# 22. Responsive Rule

## Mobile First

기본 UI는 Mobile을 기준으로 설계한다.

### 권장 기준

- Mobile: `360~430px`
- Tablet: `768px+`
- Desktop Web: `1024px+`

Desktop에서도 Mobile 화면을 단순 확대하지 않고 정보 구조를 재배치한다.

예:

```text
Desktop

┌───────────────┬──────────────────────┐
│ Timeline      │ Map                  │
│               │                      │
│               │                      │
└───────────────┴──────────────────────┘
```

---

# 23. Accessibility

- 핵심 Text Contrast WCAG AA 수준 권장
- Touch Target 최소 44px
- Color만으로 상태를 표현하지 않음
- 아이콘은 필요 시 Label 또는 Accessibility Text 제공
- Error 메시지는 색상 + 텍스트로 표현
- Dynamic Type 확대 대응 검토

---

# 24. Motion

Animation은 기능 이해를 돕는 수준으로 제한한다.

## Recommended

- Bottom Sheet Open: `200~300ms`
- Button Press Feedback: `100~150ms`
- Screen Transition: `200~250ms`
- Marker Selection: Scale/Fade

과도한 Bounce 또는 긴 Animation은 사용하지 않는다.

---

# 25. Main Screen Design Rules

## 25.1 Trip Hub

핵심 정보:

- 여행명
- 여행 기간
- D-Day
- 여행 참가자
- 총 지출
- 오늘 일정
- Timeline

가장 중요한 행동:

- 일정 추가
- 지도 보기
- 공유

---

## 25.2 Quick Add

사용자가 빠르게 여행 계획을 추가하는 화면.

추가 유형:

- 장소
- 교통
- 숙소
- 식사
- 예약
- 메모
- 직접 입력

Bottom Sheet 또는 Modal 형태를 기본으로 한다.

---

## 25.3 Map

핵심 정보:

- 전체 여행 Route
- Day별 일정
- Marker
- 선택된 장소 정보

---

## 25.4 Receipt Scan

핵심 구조:

1. 영수증 촬영/업로드
2. OCR 분석
3. 결과 확인
4. 수정
5. 일정 연결
6. 여행 지출 반영

---

# 26. UX Writing

UI Text는 짧고 행동 중심으로 작성한다.

### Good

- 일정 추가
- 여행 만들기
- 지도에서 보기
- 영수증 추가
- 여행 비용에 반영

### Avoid

- 해당 일정을 여행 계획에 추가하시겠습니까?
- 여행 경비 관리 내역으로 등록하기

가능한 짧게 표현한다.

---

# 27. Design Token Summary

```text
FONT
Pretendard

PRIMARY
#F45135

SECONDARY
#3D8DFF

BACKGROUND
#F7F8FA

SURFACE
#FFFFFF

TEXT PRIMARY
#181A20

TEXT SECONDARY
#666B75

BUTTON
Primary   H52 / R14~16
Secondary H40~44 / R10~12

CARD
R16 / P16

CHIP
H32~34 / R16

ICON
20~24
Touch Area 44

BOTTOM SHEET
R24

LAYOUT
Side Margin 16

SPACING
4 / 8 / 12 / 16 / 20 / 24 / 32

BOTTOM NAV
64~72 + Safe Area

FAB
52~56
```

---

# 28. Development Naming Guide

권장 Token Naming:

```text
color.primary
color.primaryPressed
color.primarySoft

color.secondary
color.background
color.surface

text.primary
text.secondary
text.disabled

spacing.4
spacing.8
spacing.12
spacing.16
spacing.20
spacing.24
spacing.32

radius.small
radius.button
radius.card
radius.sheet

font.titleXL
font.titleLG
font.titleMD
font.body
font.caption
```

React / Flutter / React Native 등 플랫폼별 Design Token으로 변환할 수 있도록 Token 중심으로 관리한다.

---

# 29. Current UI Direction Decision

현재 시안에서 다음 요소는 디자인 기준으로 유지한다.

- White / Light Gray 기반의 밝은 UI
- Coral Orange Primary Color
- Timeline 중심 Trip Hub
- 중앙 Floating Quick Add
- Map + Bottom Sheet 구조
- Card 기반 일정 정보
- OCR 기반 여행 지출 기록

다음 요소는 개선 대상으로 정의한다.

- 작은 Text Size
- 카드 내부 정보 위계
- Screen별 Button Size 불일치
- Chip/Filter 규격 불일치
- Icon Touch Area 부족
- 카드 및 Section 간 Spacing 불일치

---

# 30. Next Design System Scope

v0.2에서는 다음을 구체화한다.

1. Color Palette 전체 단계
2. 실제 Component 상태별 UI
3. Timeline Component
4. Place Card
5. Expense Card
6. Receipt Card
7. Map Marker
8. Search Result
9. Bottom Sheet
10. Modal
11. Toast / Snackbar
12. Dialog
13. Date / Time Picker
14. User Avatar
15. Trip Member UI
16. Shared Trip Permission UI
