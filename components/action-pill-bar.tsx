import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { TrendingUp, Play, Square, Trash2 } from 'lucide-react-native';

const NEON = '#00BFFF';
const PILL_BG = '#080D1A';

interface ActionPillBarProps {
  isBotActive: boolean;
  onTrade: () => void;
  onQuotes: () => void;
  onRemove: () => void;
}

export function ActionPillBar({ isBotActive, onTrade, onQuotes, onRemove }: ActionPillBarProps) {
  return (
    <View style={styles.wrapper}>
      <View style={styles.pill}>
        {/* QUOTES */}
        <TouchableOpacity testID="action-quotes" style={styles.section} onPress={onQuotes} activeOpacity={0.7}>
          <TrendingUp color={NEON} size={18} strokeWidth={2.5} />
          <Text style={styles.label}>QUOTES</Text>
        </TouchableOpacity>

        <View style={styles.dividerWrap}><View style={styles.divider} /></View>

        {/* TRADE / STOP */}
        <TouchableOpacity testID="action-start" style={styles.section} onPress={onTrade} activeOpacity={0.7}>
          {isBotActive ? (
            <Square color={NEON} size={19} fill={NEON} strokeWidth={0} />
          ) : (
            <Play color={NEON} size={19} fill={NEON} strokeWidth={0} />
          )}
          <Text style={[styles.label, styles.labelCenter]}>{isBotActive ? 'STOP' : 'TRADE'}</Text>
        </TouchableOpacity>

        <View style={styles.dividerWrap}><View style={styles.divider} /></View>

        {/* REMOVE */}
        <TouchableOpacity testID="action-remove" style={styles.section} onPress={onRemove} activeOpacity={0.7}>
          <Trash2 color={NEON} size={18} strokeWidth={2.5} />
          <Text style={styles.label}>REMOVE</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 20,
    paddingVertical: 6,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    borderRadius: 28,
    backgroundColor: PILL_BG,
    borderWidth: 1,
    borderColor: 'rgba(0, 191, 255, 0.5)',
    overflow: 'hidden',
    // iOS glow
    shadowColor: NEON,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
    ...Platform.select({
      web: {
        boxShadow: '0 0 6px 1px rgba(0,191,255,0.5), 0 0 18px 4px rgba(0,191,255,0.2)',
      } as any,
    }),
  },
  section: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 8,
    height: '100%',
  },
  label: {
    color: NEON,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 1.2,
    textShadowColor: 'rgba(0, 191, 255, 0.5)',
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
    fontSize: 14,
  },
  dividerWrap: {
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  divider: {
    width: 1,
    height: '55%',
    backgroundColor: 'rgba(0, 191, 255, 0.4)',
    ...Platform.select({
      web: {
        boxShadow: '0 0 4px 1px rgba(0,191,255,0.3)',
      } as any,
    }),
  },
});

export default ActionPillBar;
