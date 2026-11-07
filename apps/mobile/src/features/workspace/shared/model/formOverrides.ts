// 버튼이 전달하는 이벤트 객체를 여행 기간 적용값으로 오인하지 않는다.
export function stringFormOverrides(
  value: unknown,
): Record<string, string> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return undefined;
  const prototype: unknown = Object.getPrototypeOf(value);
  return (prototype === Object.prototype || prototype === null) &&
    Object.values(value).every((field) => typeof field === 'string')
    ? (value as Record<string, string>)
    : undefined;
}
