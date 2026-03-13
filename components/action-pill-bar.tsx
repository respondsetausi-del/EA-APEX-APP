import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { TrendingUp, Play, Square, Trash2 } from 'lucide-react-native';

const NEON = '#00BFFF';
const PILL_BG = '#0A0F1F';

interface ActionPillBarProps {
  isBotActive: boolean;
  onTrade: () => void;
  onQuotes: () => void;
  onRemove: () => void;
}

export function ActionPillBar({ isBotActive, onTrade, onQuotes, onRemove }: ActionPillBarProps) {
  return (
    <View style={styles.outerGlow}>
      <View style={styles.pill}>
        {/* QUOTES */}
        <TouchableOpacity testID="action-quotes" style={styles.section} onPress={onQuotes} activeOpacity={0.7}>
          <View style={styles.iconGlow}>
            <TrendingUp color={NEON} size={19} strokeWidth={2.5} />
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
              <Square color={NEON} size={20} fill={NEON} strokeWidth={0} />
            ) : (
              <Play color={NEON} size={21} fill={NEON} strokeWidth={0} />
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
            <Trash2 color={NEON} size={19} strokeWidth={2.5} />
          </View>
          <Text style={styles.label}>REMOVE</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerGlow: {
    paddingHorizontal: 20,
    paddingVertical: 6,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 60,
    borderRadius: 30,
    backgroundColor: PILL_BG,
    borderWidth: 1,
    borderColor: 'rgba(0, 191, 255, 0.35)',
    // Native shadow (iOS)
    shadowColor: NEON,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 16,
    // Android elevation
    elevation: 12,
    // Web glow
    ...Platform.select({
      web: {
        boxShadow: `0 0 18px 5px rgba(0, 191, 255, 0.55), 0 0 40px 8px rgba(0, 191, 255, 0.2), inset 0 0 12px 1px rgba(0, 191, 255, 0.06)`,
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
  },
  iconGlow: {
    // Icon glow via shadow
    shadowColor: NEON,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 6,
    ...Platform.select({
      web: {
        filter: 'drop-shadow(0 0 6px rgba(0, 191, 255, 0.9))',
      } as any,
    }),
  },
  label: {
    color: NEON,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 1,
    textShadowColor: NEON,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
    fontFamily: Platform.select({
      ios: 'System',
      android: 'Roboto',
      web: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    }),
  },
  labelCenter: {
    fontWeight: '700',
    fontSize: 15,
  },
  dividerContainer: {
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  divider: {
    width: 1,
    height: '55%',
    backgroundColor: 'rgba(0, 191, 255, 0.5)',
    // Divider glow
    shadowColor: NEON,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    ...Platform.select({
      web: {
        boxShadow: '0 0 6px 1px rgba(0, 191, 255, 0.5)',
      } as any,
    }),
  },
});

export default ActionPillBar;
