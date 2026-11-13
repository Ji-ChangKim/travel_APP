export function scrollProgress(scrollTop: number, scrollableHeight: number) {
  if (scrollableHeight <= 0) return 0;
  return Math.min(1, Math.max(0, scrollTop / scrollableHeight));
}
