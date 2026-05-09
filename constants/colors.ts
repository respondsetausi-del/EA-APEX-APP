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

/**
 * Web-only stacked outer glow: crisp highlight + saturated core + soft bloom.
 * Avoids heavy inset rings so edges read as light, not thick UI borders.
 * `colorHex` must be a 6-digit hex including `#`, e.g. `#00FBFF`.
 */
export type NeonTier = 'soft' | 'medium' | 'strong';

export function neonWebShadow(colorHex: string, tier: NeonTier = 'medium'): string {
  const c = colorHex;
  switch (tier) {
    case 'soft':
      return `0 0 1px 0 rgba(255,255,255,0.3), 0 0 2px 0 ${c}CC, 0 0 5px 1px ${c}88, 0 0 10px 2px ${c}44`;
    case 'strong':
      return `0 0 1px 0 rgba(255,255,255,0.7), 0 0 3px 0 ${c}FF, 0 0 8px 2px ${c}EE, 0 0 16px 3px ${c}88, 0 0 24px 5px ${c}44`;
    default:
      return `0 0 1px 0 rgba(255,255,255,0.5), 0 0 2px 0 ${c}FF, 0 0 6px 1px ${c}BB, 0 0 12px 2px ${c}66, 0 0 20px 4px ${c}2B`;
  }
}

/** Left edge of the drawer: thin light line + cyan spill onto the canvas. */
export function neonWebDrawerEdge(colorHex: string): string {
  const c = colorHex;
  return `inset 1px 0 0 rgba(255,255,255,0.06), inset 1px 0 0 ${c}2B, -2px 0 10px 0 ${c}5E, -5px 0 22px 3px ${c}42, -10px 0 38px 9px ${c}1F`;
}

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
