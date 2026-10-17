export const chartTheme = {
  grid: 'hsl(var(--chart-grid))',
  axis: 'hsl(var(--chart-axis))',
  tooltip: {
    backgroundColor: 'hsl(var(--chart-tooltip))',
    border: '1px solid hsl(var(--chart-tooltip-border))',
    borderRadius: '8px',
    color: 'hsl(var(--foreground))',
    fontSize: '12px',
    boxShadow: '0 12px 30px hsl(var(--foreground) / 0.08)',
  },
} as const
