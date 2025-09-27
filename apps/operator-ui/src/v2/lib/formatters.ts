const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

export const formatCurrency = (value: number) => {
  if (!Number.isFinite(value)) return '$0'
  return currencyFormatter.format(value)
}

export const formatPercent = (value: number) => {
  if (!Number.isFinite(value)) return '0%'
  return `${Math.round(value)}%`
}

export const formatRelativeTime = (timestampMs: number) => {
  if (!Number.isFinite(timestampMs)) return '—'
  const diffMs = Date.now() - timestampMs
  const diffMinutes = Math.round(diffMs / 60_000)
  if (Math.abs(diffMinutes) < 1) return 'just now'
  if (diffMinutes < 60) return `${diffMinutes} min ago`
  const diffHours = Math.round(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours} hr ago`
  const diffDays = Math.round(diffHours / 24)
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`
  const diffWeeks = Math.round(diffDays / 7)
  if (diffWeeks < 5) return `${diffWeeks} wk${diffWeeks === 1 ? '' : 's'} ago`
  const diffMonths = Math.round(diffDays / 30)
  if (diffMonths < 12) return `${diffMonths} mo${diffMonths === 1 ? '' : 's'} ago`
  const diffYears = Math.round(diffDays / 365)
  return `${diffYears} yr${diffYears === 1 ? '' : 's'} ago`
}
