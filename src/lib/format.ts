const dateOnly: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' }
const dateTime: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }

// A date without a time ("2026-09-20") must not shift with the viewer's time zone.
function parse(value: string): Date {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(value + 'T12:00:00') : new Date(value)
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return ''
  return parse(value).toLocaleDateString('en-GB', dateOnly)
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return ''
  return parse(value).toLocaleString('en-GB', dateTime)
}

export function formatPeriod(start: string | null, end: string | null): string {
  if (!start || !end) return ''
  const a = parse(start)
  const b = parse(end)
  const sameMonth = a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()
  const from = sameMonth ? String(a.getDate()) : a.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })
  return `${from} to ${b.toLocaleDateString('en-GB', dateOnly)}`
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/).filter((part) => !/^(ms|mr|mrs|dr)\.?$/i.test(part))[0] || name
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function isoDay(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
