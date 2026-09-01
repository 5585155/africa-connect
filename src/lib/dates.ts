/**
 * Safely formats a harvest date for display. Live listing data isn't
 * guaranteed to have a valid (or any) date — seeded/imported rows can leave
 * it null or in an unparseable format — so this always falls back to a
 * clean label instead of rendering `new Date(bad value)` as "Invalid Date".
 */
export function formatHarvestDate(
  value: string | null | undefined,
  options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' },
): string {
  if (!value) return 'Not specified'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not specified'
  return date.toLocaleDateString(undefined, options)
}
