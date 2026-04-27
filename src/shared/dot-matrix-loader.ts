// Dot-matrix loader patterns adapted from the MIT-licensed dot/matrix library.
// Source: https://icons.icantcode.fyi/

const DOTS = [
  ['00', 6, 6],
  ['01', 17, 6],
  ['02', 28, 6],
  ['03', 39, 6],
  ['04', 50, 6],
  ['10', 6, 17],
  ['11', 17, 17],
  ['12', 28, 17],
  ['13', 39, 17],
  ['14', 50, 17],
  ['20', 6, 28],
  ['21', 17, 28],
  ['22', 28, 28],
  ['23', 39, 28],
  ['24', 50, 28],
  ['30', 6, 39],
  ['31', 17, 39],
  ['32', 28, 39],
  ['33', 39, 39],
  ['34', 50, 39],
  ['40', 6, 50],
  ['41', 17, 50],
  ['42', 28, 50],
  ['43', 39, 50],
  ['44', 50, 50]
] as const

const BAR_KEYS = new Set([
  '01',
  '02',
  '03',
  '11',
  '12',
  '13',
  '21',
  '22',
  '23',
  '31',
  '32',
  '33',
  '41',
  '42',
  '43'
])

export type DotMatrixLoaderVariant = 'spiral' | 'bar'

export function renderDotMatrixLoader({
  variant = 'spiral',
  className = ''
}: {
  variant?: DotMatrixLoaderVariant
  className?: string
} = {}): string {
  const safeVariant: DotMatrixLoaderVariant = variant === 'bar' ? 'bar' : 'spiral'
  const extraClassName = String(className || '').trim()
  const classes = [
    'dot-matrix-loader',
    `dot-matrix-loader--${safeVariant}`,
    extraClassName
  ]
    .filter(Boolean)
    .join(' ')

  const backgroundDots = DOTS
    .map(([, x, y]) => `<circle class="dot-matrix-loader-bg" cx="${x}" cy="${y}" r="2.4"></circle>`)
    .join('')
  const litDots = DOTS
    .filter(([key]) => safeVariant === 'spiral' || BAR_KEYS.has(key))
    .map(
      ([key, x, y]) =>
        `<circle class="dot-matrix-loader-lit dot-matrix-loader-d${key}" cx="${x}" cy="${y}" r="3.1"></circle>`
    )
    .join('')

  return `<svg class="${classes}" viewBox="0 0 56 56" aria-hidden="true" focusable="false">${backgroundDots}${litDots}</svg>`
}
