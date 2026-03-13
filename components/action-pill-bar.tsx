import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { TrendingUp, Play, Square, Trash2 } from 'lucide-react-native';

const NEON = '#00BFFF';
const NEON_BRIGHT = '#40D4FF';
const PILL_BG = '#060B18';

interface ActionPillBarProps {
  isBotActive: boolean;
  onTrade: () => void;
  onQuotes: () => void;
  onRemove: () => void;
}

export function ActionPillBar({ isBotActive, onTrade, onQuotes, onRemove }: ActionPillBarProps) {
  return (
    <View style={styles.glowWrapper}>
      <View style={styles.pill}>
        {/* QUOTES */}
        <TouchableOpacity testID="action-quotes" style={styles.section} onPress={onQuotes} activeOpacity={0.7}>
          <View style={styles.iconGlow}>
            <TrendingUp color={NEON_BRIGHT} size={19} strokeWidth={2.5} />
          </View>
          <Text style={styles.label}>QUOTES</Text>
        </TouchableOpacity>

        {/* Divider */}
        <View style={styles.dividerContainer}>
          <View style={styles.divider} />
        </View>

        {/* TRADE / STOP (center) */}
        <TouchableOpacity testID="action-start" style={styles.section} onPress={onTrade} activeOpacity={0.7}>
          <View style={styles.iconGlow}>
            {isBotActive ? (
              <Square color={NEON_BRIGHT} size={20} fill={NEON_BRIGHT} strokeWidth={0} />
            ) : (
              <Play color={NEON_BRIGHT} size={21} fill={NEON_BRIGHT} strokeWidth={0} />
            )}
          </View>
          <Text style={[styles.label, styles.labelCenter]}>{isBotActive ? 'STOP' : 'TRADE'}</Text>
        </TouchableOpacity>

        {/* Divider */}
        <View style={styles.dividerContainer}>
          <View style={styles.divider} />
        </View>

        {/* REMOVE */}
        <TouchableOpacity testID="action-remove" style={styles.section} onPress={onRemove} activeOpacity={0.7}>
          <View style={styles.iconGlow}>
            <Trash2 color={NEON_BRIGHT} size={19} strokeWidth={2.5} />
          </View>
          <Text style={styles.label}>REMOVE</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  glowWrapper: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    // iOS outer glow (applied to wrapper so it's not clipped)
    shadowColor: NEON,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 24,
    elevation: 20,
    ...Platform.select({
      web: {
        // No shadow here on web — pill handles it directly
        filter: 'drop-shadow(0 0 28px rgba(0, 191, 255, 0.6))',
      } as any,
    }),
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 60,
    borderRadius: 30,
    backgroundColor: PILL_BG,
    // Bright visible border — key to the neon edge
    borderWidth: 1.5,
    borderColor: 'rgba(0, 191, 255, 0.7)',
    ...Platform.select({
      web: {
        // Multi-layer glow: tight bright edge + wide diffuse spread + subtle inner
        boxShadow: [
          '0 0 8px 2px rgba(0, 191, 255, 0.8)',     // tight bright halo
          '0 0 24px 6px rgba(0, 191, 255, 0.5)',     // medium spread
          '0 0 60px 14px rgba(0, 191, 255, 0.25)',   // wide diffuse
          '0 0 100px 24px rgba(0, 191, 255, 0.1)',   // ambient bloom
          'inset 0 0 20px 2px rgba(0, 191, 255, 0.08)', // subtle inner glow
        ].join(', '),
        overflow: 'hidden',
      } as any,
    }),
  },
  section: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 4,
    height: '100%',
  },
  iconGlow: {
    shadowColor: NEON,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 8,
    ...Platform.select({
      web: {
        filter: [
          'drop-shadow(0 0 4px rgba(0, 191, 255, 1))',
          'drop-shadow(0 0 10px rgba(0, 191, 255, 0.7))',
        ].join(' '),
      } as any,
    }),
  },
  label: {
    color: NEON_BRIGHT,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 1.2,
    fontFamily: Platform.select({
      ios: 'System',
      android: 'Roboto',
      web: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    }),
    // Native text glow
    textShadowColor: NEON,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
    ...Platform.select({
      web: {
        // Stacked text-shadow for intense neon text glow
        textShadow: [
          '0 0 4px rgba(0, 191, 255, 1)',
          '0 0 10px rgba(0, 191, 255, 0.8)',
          '0 0 20px rgba(0, 191, 255, 0.4)',
        ].join(', '),
      } as any,
    }),
  },
  labelCenter: {
    fontWeight: '700',
    fontSize: 16,
  },
  dividerContainer: {
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  divider: {
    width: 1,
    height: '55%',
    backgroundColor: 'rgba(0, 191, 255, 0.6)',
    shadowColor: NEON,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 6,
    ...Platform.select({
      web: {
        boxShadow: '0 0 4px 1px rgba(0, 191, 255, 0.6), 0 0 10px 2px rgba(0, 191, 255, 0.3)',
      } as any,
    }),
  },
});

export default ActionPillBar;
