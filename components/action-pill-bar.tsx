import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { TrendingUp, Play, Square, Trash2 } from 'lucide-react-native';

const PILL_BG = '#080D1A';

interface ActionPillBarProps {
  isBotActive: boolean;
  onTrade: () => void;
  onQuotes: () => void;
  onRemove: () => void;
  glowColor?: string;
}

export function ActionPillBar({ isBotActive, onTrade, onQuotes, onRemove, glowColor = '#00BFFF' }: ActionPillBarProps) {
  const c = glowColor;

  return (
    <View style={styles.wrapper}>
      <View style={[
        styles.pill,
        {
          borderColor: c + '80',
          shadowColor: c,
        },
        Platform.OS === 'web' ? {
          boxShadow: `0 0 6px 1px ${c}80, 0 0 18px 4px ${c}33`,
        } as any : {},
      ]}>
        <TouchableOpacity testID="action-quotes" style={styles.section} onPress={onQuotes} activeOpacity={0.7}>
          <TrendingUp color={c} size={18} strokeWidth={2.5} />
          <Text style={[styles.label, { color: c, textShadowColor: c + '80' }]}>QUOTES</Text>
        </TouchableOpacity>

        <View style={styles.dividerWrap}>
          <View style={[
            styles.divider,
            { backgroundColor: c + '66' },
            Platform.OS === 'web' ? { boxShadow: `0 0 4px 1px ${c}4D` } as any : {},
          ]} />
        </View>

        <TouchableOpacity testID="action-start" style={styles.section} onPress={onTrade} activeOpacity={0.7}>
          {isBotActive ? (
            <Square color={c} size={19} fill={c} strokeWidth={0} />
          ) : (
            <Play color={c} size={19} fill={c} strokeWidth={0} />
          )}
          <Text style={[styles.label, styles.labelCenter, { color: c, textShadowColor: c + '80' }]}>
            {isBotActive ? 'STOP' : 'TRADE'}
          </Text>
        </TouchableOpacity>

        <View style={styles.dividerWrap}>
          <View style={[
            styles.divider,
            { backgroundColor: c + '66' },
            Platform.OS === 'web' ? { boxShadow: `0 0 4px 1px ${c}4D` } as any : {},
          ]} />
        </View>

        <TouchableOpacity testID="action-remove" style={styles.section} onPress={onRemove} activeOpacity={0.7}>
          <Trash2 color={c} size={18} strokeWidth={2.5} />
          <Text style={[styles.label, { color: c, textShadowColor: c + '80' }]}>REMOVE</Text>
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
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
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
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 1.2,
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
  },
});

export default ActionPillBar;
