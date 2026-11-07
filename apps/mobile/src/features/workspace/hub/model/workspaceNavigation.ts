export function workspaceEntrySection(section: string | undefined): string {
  // 홈의 기존 링크와 상세의 내부 키를 함께 받아 같은 준비물 화면으로 연결한다.
  if (section === 'checklist' || section === 'preparation')
    return 'preparation';
  return section &&
    ['companions', 'share', 'map', 'expenses', 'photos'].includes(section)
    ? section
    : 'itinerary';
}
