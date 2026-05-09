import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Crosshair, Zap, Trash2, ChevronRight, SquareActivity, SquarePlay, SquareX } from 'lucide-react-native';
import { neonWebShadow } from '@/constants/colors';

interface TradingPanelProps {
  variant: string;
  glowColor: string;
  isBotActive: boolean;
  onTrade: () => void;
  onQuotes: () => void;
  onRemove: () => void;
}

// ─── Variant A: Pill Bar (current) ───────────────────────────────────
function PanelA({ glowColor, onTrade, onQuotes, onRemove }: TradingPanelProps) {
  const glow = Platform.OS === 'web' ? {
    boxShadow: neonWebShadow(glowColor, 'medium'),
  } as any : {};

  const cardBg = Platform.OS === 'web' ? {
    background: 'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)',
    backgroundColor: '#000000',
    backdropFilter: 'blur(40px) saturate(1.4)',
    WebkitBackdropFilter: 'blur(40px) saturate(1.4)',
    borderTop: '1px solid rgba(255,255,255,0.08)',
    borderLeft: '1px solid rgba(255,255,255,0.04)',
    borderRight: '1px solid rgba(255,255,255,0.03)',
    borderBottom: '1px solid rgba(255,255,255,0.02)',
  } as any : {};

  return (
    <View style={[
      styles.pillBar,
      Platform.OS === 'web' && { borderWidth: 0 },
      { borderColor: glowColor + '33', shadowColor: glowColor },
      glow,
      cardBg,
    ]}>
      <TouchableOpacity style={styles.pillSection} onPress={onQuotes} activeOpacity={0.7}>
        <Crosshair color={glowColor} size={20} strokeWidth={1.8} />
        <Text style={[styles.pillText, { color: glowColor, textShadowColor: glowColor + '80' }]}>QUOTES</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.pillSection} onPress={onTrade} activeOpacity={0.7}>
        <Zap color={glowColor} size={20} strokeWidth={1.8} fill={glowColor + '33'} />
        <Text style={[styles.pillTextBold, { color: glowColor, textShadowColor: glowColor + '80' }]}>TRADE</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.pillSection} onPress={onRemove} activeOpacity={0.7}>
        <Trash2 color={glowColor} size={19} strokeWidth={1.8} />
        <Text style={[styles.pillText, { color: glowColor, textShadowColor: glowColor + '80' }]}>REMOVE</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Variant B: Stacked Cards ─────────────────────────────────────────
function PanelB({ glowColor, onTrade, onQuotes, onRemove }: TradingPanelProps) {
  const glow = (color: string) => Platform.OS === 'web' ? {
    boxShadow: neonWebShadow(color, 'soft'),
  } as any : {};

  return (
    <View style={styles.stackContainer}>
      <TouchableOpacity style={[styles.stackCard, Platform.OS === 'web' && { borderWidth: 0 }, { borderColor: glowColor + '3D' }, glow(glowColor)]} onPress={onQuotes} activeOpacity={0.7}>
        <SquareActivity color={glowColor} size={20} strokeWidth={2} />
        <Text style={[styles.stackText, { color: glowColor }]}>QUOTES</Text>
        <ChevronRight color={glowColor + '4D'} size={16} />
      </TouchableOpacity>
      <TouchableOpacity style={[styles.stackCard, Platform.OS === 'web' && { borderWidth: 0 }, { borderColor: glowColor + '3D' }, glow(glowColor)]} onPress={onTrade} activeOpacity={0.7}>
        <SquarePlay color={glowColor} size={20} strokeWidth={2} />
        <Text style={[styles.stackText, { color: glowColor }]}>TRADE</Text>
        <ChevronRight color={glowColor + '4D'} size={16} />
      </TouchableOpacity>
      <TouchableOpacity style={[styles.stackCard, Platform.OS === 'web' && { borderWidth: 0 }, { borderColor: '#FF444440' }, glow('#FF4444')]} onPress={onRemove} activeOpacity={0.7}>
        <SquareX color="#FF4444" size={20} strokeWidth={2} />
        <Text style={[styles.stackText, { color: '#FF4444' }]}>REMOVE</Text>
        <ChevronRight color="#FF444466" size={16} />
      </TouchableOpacity>
    </View>
  );
}

// ─── Variant C: Circle Buttons ────────────────────────────────────────
function PanelC({ glowColor, onTrade, onQuotes, onRemove }: TradingPanelProps) {
  const glow = (color: string, size: number) => Platform.OS === 'web' ? {
    boxShadow: neonWebShadow(color, size > 60 ? 'medium' : 'soft'),
  } as any : {};

  return (
    <View style={styles.circleRow}>
      <TouchableOpacity style={styles.circleItem} onPress={onQuotes} activeOpacity={0.7}>
        <View style={[styles.circleBtn, Platform.OS === 'web' && { borderWidth: 0 }, { width: 60, height: 60, borderRadius: 30, borderColor: glowColor + '3D' }, glow(glowColor, 60)]}>
          <SquareActivity color={glowColor} size={24} strokeWidth={2} />
        </View>
        <Text style={[styles.circleLabel, { color: glowColor + 'B3' }]}>QUOTES</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.circleItem} onPress={onTrade} activeOpacity={0.7}>
        <View style={[styles.circleBtn, Platform.OS === 'web' && { borderWidth: 0 }, { width: 72, height: 72, borderRadius: 36, borderWidth: Platform.OS === 'web' ? 0 : 2, borderColor: glowColor + '4D' }, glow(glowColor, 72)]}>
          <SquarePlay color={glowColor} size={28} strokeWidth={2} />
        </View>
        <Text style={[styles.circleLabelBold, { color: glowColor }]}>TRADE</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.circleItem} onPress={onRemove} activeOpacity={0.7}>
        <View style={[styles.circleBtn, Platform.OS === 'web' && { borderWidth: 0 }, { width: 60, height: 60, borderRadius: 30, borderColor: '#FF444440' }, glow('#FF4444', 60)]}>
          <SquareX color="#FF4444" size={24} strokeWidth={2} />
        </View>
        <Text style={[styles.circleLabel, { color: '#FF4444B3' }]}>REMOVE</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Variant D: Grid Tiles ────────────────────────────────────────────
function PanelD({ glowColor, onTrade, onQuotes, onRemove }: TradingPanelProps) {
  const glow = (color: string) => Platform.OS === 'web' ? {
    boxShadow: neonWebShadow(color, 'soft'),
  } as any : {};
  const bigGlow = Platform.OS === 'web' ? {
    boxShadow: neonWebShadow(glowColor, 'medium'),
  } as any : {};

  return (
    <View style={styles.gridContainer}>
      <View style={styles.gridTopRow}>
        <TouchableOpacity style={[styles.gridTile, Platform.OS === 'web' && { borderWidth: 0 }, { borderColor: glowColor + '3D' }, glow(glowColor)]} onPress={onQuotes} activeOpacity={0.7}>
          <SquareActivity color={glowColor} size={20} strokeWidth={2} />
          <Text style={[styles.gridText, { color: glowColor }]}>QUOTES</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.gridTile, Platform.OS === 'web' && { borderWidth: 0 }, { borderColor: '#FF444440' }, glow('#FF4444')]} onPress={onRemove} activeOpacity={0.7}>
          <SquareX color="#FF4444" size={20} strokeWidth={2} />
          <Text style={[styles.gridText, { color: '#FF4444' }]}>REMOVE</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity style={[styles.gridWideTile, { borderColor: glowColor + '40', borderWidth: Platform.OS === 'web' ? 0 : 1.5 }, bigGlow]} onPress={onTrade} activeOpacity={0.7}>
        <SquarePlay color={glowColor} size={24} strokeWidth={2} />
        <Text style={[styles.gridWideTileText, { color: glowColor, textShadowColor: glowColor + '80' }]}>TRADE</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Variant E: Floating Bar ──────────────────────────────────────────
function PanelE({ glowColor, onTrade, onQuotes, onRemove }: TradingPanelProps) {
  const glow = Platform.OS === 'web' ? {
    boxShadow: neonWebShadow(glowColor, 'medium'),
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
  } as any : {};

  const tradeBtnGlow = Platform.OS === 'web' ? {
    boxShadow: neonWebShadow(glowColor, 'strong'),
  } as any : {};

  return (
    <View style={[styles.floatBar, Platform.OS === 'web' && { borderWidth: 0 }, { borderColor: glowColor + '33' }, glow]}>
      <TouchableOpacity style={styles.floatItem} onPress={onQuotes} activeOpacity={0.7}>
        <SquareActivity color={glowColor} size={20} strokeWidth={2} />
        <Text style={[styles.floatLabel, { color: glowColor + 'B3' }]}>QUOTES</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.floatItem} onPress={onTrade} activeOpacity={0.7}>
        <View style={[styles.floatTradeBtn, Platform.OS === 'web' && { borderWidth: 0 }, { borderColor: glowColor + '40', backgroundColor: glowColor + '1C' }, tradeBtnGlow]}>
          <SquarePlay color={glowColor} size={20} strokeWidth={2} />
        </View>
        <Text style={[styles.floatLabelBold, { color: glowColor }]}>TRADE</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.floatItem} onPress={onRemove} activeOpacity={0.7}>
        <SquareX color="#FF4444B3" size={20} strokeWidth={2} />
        <Text style={[styles.floatLabel, { color: '#FF4444B3' }]}>REMOVE</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────
export function TradingPanel(props: TradingPanelProps) {
  switch (props.variant) {
    case 'B': return <PanelB {...props} />;
    case 'C': return <PanelC {...props} />;
    case 'D': return <PanelD {...props} />;
    case 'E': return <PanelE {...props} />;
    default:  return <PanelA {...props} />;
  }
}

// ─── Styles ───────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // A: Pill Bar
  pillBar: {
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    height: 58,
    borderWidth: 1,
    overflow: 'hidden',
    marginHorizontal: 20,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
    backgroundColor: '#000000',
  },
  pillSection: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 8,
  },
  pillDivider: {
    width: 1,
    height: '55%',
  },
  pillText: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 1.2,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
  pillTextBold: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1.2,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },

  // B: Stacked Cards
  stackContainer: {
    gap: 8,
    marginHorizontal: 20,
  },
  stackCard: {
    backgroundColor: '#000000',
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    height: 50,
    paddingHorizontal: 20,
    borderWidth: 1,
    gap: 14,
  },
  stackText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1,
  },

  // C: Circle Buttons
  circleRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginHorizontal: 20,
  },
  circleItem: {
    alignItems: 'center',
    gap: 8,
  },
  circleBtn: {
    backgroundColor: '#000000',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  circleLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
  },
  circleLabelBold: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },

  // D: Grid Tiles
  gridContainer: {
    gap: 8,
    marginHorizontal: 20,
  },
  gridTopRow: {
    flexDirection: 'row',
    gap: 8,
  },
  gridTile: {
    flex: 1,
    backgroundColor: '#000000',
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    borderWidth: 1,
    gap: 10,
  },
  gridText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
  },
  gridWideTile: {
    backgroundColor: '#000000',
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 60,
    gap: 12,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  gridWideTileText: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1.5,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },

  // E: Floating Bar
  floatBar: {
    backgroundColor: 'rgba(0,0,0,0.9)',
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    height: 64,
    borderWidth: 1,
    marginHorizontal: 20,
    paddingHorizontal: 12,
  },
  floatItem: {
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
  },
  floatTradeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -18,
  },
  floatLabel: {
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 1,
  },
  floatLabelBold: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: -2,
  },
});

export default TradingPanel;
