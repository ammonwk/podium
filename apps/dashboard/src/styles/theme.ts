// Re-export shared theme + dashboard-specific tokens
export { THEME, TOOL_COLORS } from '@apm/shared';

export const ANIMATION = {
  fast: '150ms',
  normal: '200ms',
  slow: '300ms',
  verySlow: '500ms',
  easeOut: 'cubic-bezier(0.16, 1, 0.3, 1)',
  easeInOut: 'cubic-bezier(0.65, 0, 0.35, 1)',
  spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
} as const;

export const RADIUS = {
  sm: '6px',
  md: '10px',
  lg: '12px',
  xl: '16px',
  full: '9999px',
} as const;

export const SPACING = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '20px',
  xxl: '24px',
  xxxl: '32px',
} as const;

export const SHADOW = {
  sm: '0 1px 3px rgba(0,0,0,0.25)',
  md: '0 2px 8px rgba(0,0,0,0.3)',
  lg: '0 4px 16px rgba(0,0,0,0.4)',
  xl: '0 8px 32px rgba(0,0,0,0.5)',
  glow: (color: string, intensity = 0.4) =>
    `0 0 12px rgba(${hexToRgb(color)},${intensity})`,
  glowLg: (color: string, intensity = 0.3) =>
    `0 0 24px rgba(${hexToRgb(color)},${intensity}), 0 0 48px rgba(${hexToRgb(color)},${intensity * 0.5})`,
} as const;

// Helper to convert hex to rgb values
function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return '0,0,0';
  return `${parseInt(result[1], 16)},${parseInt(result[2], 16)},${parseInt(result[3], 16)}`;
}

export { hexToRgb };
