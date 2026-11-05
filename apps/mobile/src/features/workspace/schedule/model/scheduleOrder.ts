import type { WorkspaceSchedule } from '@wherego/domain';

export function moveScheduleOrder(
  ids: readonly string[],
  id: string,
  offset: -1 | 1,
): string[] {
  const index = ids.indexOf(id);
  const target = index + offset;
  if (index < 0 || target < 0 || target >= ids.length) return [...ids];
  const next = [...ids];
  [next[index], next[target]] = [next[target]!, next[index]!];
  return next;
}

export function orderedSchedules(
  items: readonly WorkspaceSchedule[],
  ids: readonly string[],
): WorkspaceSchedule[] {
  const positions = new Map(ids.map((id, index) => [id, index]));
  return [...items].sort(
    (a, b) =>
      (positions.get(a.id) ?? a.sortOrder) -
      (positions.get(b.id) ?? b.sortOrder),
  );
}

export function scheduleDirectionsUrl(item: WorkspaceSchedule): string | null {
  const destination = item.location
    ? `${item.location.latitude},${item.location.longitude}`
    : item.address?.trim();
  return destination
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`
    : null;
}
