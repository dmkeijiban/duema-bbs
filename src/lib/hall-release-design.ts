export const HALL_RELEASE_LABEL_LINES = ['殿堂解除', '予想'] as const

export const HALL_RELEASE_DESIGN = {
  labelWidth: {
    compactClass: 'grid-cols-[56px_1fr]',
    standardClass: 'grid-cols-[64px_1fr]',
    canvas: 96,
  },
  rowClassName: 'overflow-hidden border-amber-300 bg-orange-50 text-slate-900',
  labelClassName: 'border-r border-amber-300 bg-amber-400 px-1 text-center text-[13px] leading-tight text-amber-950',
  canvas: {
    background: '#fff7ed',
    border: '#fdba74',
    label: '#9a3412',
    labelBackground: '#fbbf24',
    labelFontSize: 22,
    labelLineHeight: 1.2,
  },
} as const
