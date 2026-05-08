// Set to true to bypass login page (e.g. when DB is unreachable). Re-enable when auth is fixed.
export const LOGIN_DISABLED = true;

/** EA APEX brand palette (aligned with ea-apex web) */
export const apex = {
  bg: '#0a0a0c',
  surface: '#121216',
  elevated: '#1a1a20',
  border: 'rgba(255, 255, 255, 0.08)',
  text: '#f4f4f5',
  muted: '#a1a1aa',
  dim: '#71717a',
  accent: '#00FBFF',
  accentDim: 'rgba(0, 251, 255, 0.14)',
  glow: 'rgba(0, 251, 255, 0.45)',
  neonEdge: 'rgba(0, 251, 255, 0.16)',
} as const;

export default {
  primary: apex.accent,
  secondary: apex.surface,
  background: apex.bg,
  surface: apex.surface,
  elevated: apex.elevated,
  text: apex.text,
  textSecondary: apex.muted,
  border: '#2a2a30',
  success: '#16A34A',
  error: '#EF4444',
  warning: '#F59E0B',
};
