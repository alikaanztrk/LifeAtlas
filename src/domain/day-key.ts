export function validDay(input: string): boolean {
  if (!/^\d{4}-\d\d-\d\d$/.test(input) || input < '1899-01-01' || input > '2101-12-31') return false
  const timestamp = Date.parse(input)
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === input
}
