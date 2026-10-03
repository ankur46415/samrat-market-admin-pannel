/** Brand/tag must be empty or one of the names created under Manage Dropdown. */
export function isRegisteredDropdownValue(value: string, options: string[]): boolean {
  const v = value.trim()
  if (!v) return true
  return options.some((o) => o.trim() === v)
}
