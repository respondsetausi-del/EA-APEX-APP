import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Animated } from 'react-native';
import { TrendingUp } from 'lucide-react-native';

interface ScannerCardProps {
  variant?: string;
  glowColor: string;
  onPress: () => void;
}

export function ScannerCard({ variant = 'F', glowColor, onPress }: ScannerCardProps) {
  const bar1 = useRef(new Animated.Value(10)).current;
  const bar2 = useRef(new Animated.Value(16)).current;
  const bar3 = useRef(new Animated.Value(22)).current;
  const bar4 = useRef(new Animated.Value(14)).current;
  const bar5 = useRef(new Animated.Value(8)).current;
  const powerWidth = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const barsArr = [bar1, bar2, bar3, bar4, bar5];
    const anims = barsArr.map((bar, i) =>
      Animated.loop(Animated.sequence([
        Animated.timing(bar, { toValue: 6 + Math.random() * 18, duration: 400 + i * 80, useNativeDriver: false }),
        Animated.timing(bar, { toValue: 4 + Math.random() * 10, duration: 400 + i * 80, useNativeDriver: false }),
      ]))
    );
    anims.forEach(a => a.start());
    Animated.timing(powerWidth, { toValue: 62, duration: 2500, useNativeDriver: false }).start();
    Animated.loop(Animated.sequence([
      Animated.timing(glowAnim, { toValue: 0.8, duration: 1500, useNativeDriver: false }),
      Animated.timing(glowAnim, { toValue: 0.3, duration: 1500, useNativeDriver: false }),
    ])).start();
    return () => { anims.forEach(a => a.stop()); };
  }, []);

  const webGlow = Platform.OS === 'web' ? {
    boxShadow: `0 0 10px 2px ${glowColor}80, 0 0 24px 6px ${glowColor}33`,
  } as any : {};

  const bars = [bar1, bar2, bar3, bar4, bar5];

  const renderBars = () => (
    <View style={s.barsCol}>
      <View style={s.barsRow}>
        {bars.map((bar, i) => (
          <Animated.View key={i} style={{ width: 3, borderRadius: 1.5, backgroundColor: glowColor, height: bar }} />
        ))}
      </View>
      <View style={s.liveRow}>
        <View style={[s.liveDot, { backgroundColor: '#00FF88' }]} />
        <Text style={[s.liveText, { color: glowColor + '80' }]}>LIVE</Text>
      </View>
    </View>
  );

  // ── A: Simple Pill ──
  if (variant === 'A') {
    return (
      <TouchableOpacity activeOpacity={0.7} onPress={onPress} style={[s.pill, { borderColor: glowColor + '80', shadowColor: glowColor }, webGlow]}>
        <View style={[s.pillIcon, { borderColor: glowColor + '50', backgroundColor: glowColor + '12' }]}>
          <TrendingUp color={glowColor} size={20} />
        </View>
        <View style={s.textCol}>
          <Text style={[s.title, { color: glowColor, textShadowColor: glowColor + '80' }]}>CHART SCANNER</Text>
          <Text style={[s.subtitle, { color: glowColor + '8C' }]}>AI-POWERED CHART ANALYSIS</Text>
        </View>
      </TouchableOpacity>
    );
  }

  // ── F: Radar Scanner ──
  if (variant === 'F') {
    return (
      <TouchableOpacity activeOpacity={0.7} onPress={onPress} style={[s.card, { borderColor: glowColor + '66' }, webGlow]}>
        <View style={[s.radarCircle1, { borderColor: glowColor + '0F' }]} />
        <View style={[s.radarCircle2, { borderColor: glowColor + '0A' }]} />
        <View style={[s.radarIcon, { borderColor: glowColor + '80', backgroundColor: glowColor + '0F' }]}>
          <TrendingUp color={glowColor} size={22} />
          <Animated.View style={[s.radarPing, { backgroundColor: glowColor, opacity: glowAnim }]} />
        </View>
        <View style={s.textCol}>
          <Text style={[s.title, { color: glowColor, textShadowColor: glowColor + '80' }]}>CHART SCANNER</Text>
          <Text style={[s.subtitle, { color: 'rgba(255,255,255,0.4)' }]}>Scanning markets with AI precision</Text>
        </View>
        {renderBars()}
      </TouchableOpacity>
    );
  }

  if (variant === 'H') {
    return (
      <TouchableOpacity activeOpacity={0.7} onPress={onPress} style={[s.termCard, { borderColor: glowColor + '4D' }, webGlow]}>
        <View style={[s.termHeader, { borderBottomColor: glowColor + '25', backgroundColor: glowColor + '0F' }]}>
          <View style={[s.termDot, { backgroundColor: '#FF4444' }]} />
          <View style={[s.termDot, { backgroundColor: '#FFD700' }]} />
          <View style={[s.termDot, { backgroundColor: '#00FF88' }]} />
          <Text style={[s.termFile, { color: glowColor + '66' }]}>chart_scanner.ai</Text>
          <Text style={[s.termVer, { color: glowColor + '40' }]}>v2.0</Text>
        </View>
        <View style={s.termBody}>
          <Text style={{ color: '#00FF88', fontSize: 14, fontFamily: 'monospace' }}>$</Text>
          <Text style={{ color: glowColor, fontSize: 14, fontWeight: '600', fontFamily: 'monospace', flex: 1 }}>scan --chart --ai</Text>
          <Animated.View style={{ width: 2, height: 18, borderRadius: 1, backgroundColor: glowColor, opacity: glowAnim }} />
        </View>
      </TouchableOpacity>
    );
  }

  if (variant === 'I') {
    return (
      <TouchableOpacity activeOpacity={0.7} onPress={onPress} style={[s.card, { borderColor: glowColor + '66', paddingBottom: 16 }, webGlow]}>
        <View style={s.meterRow}>
          <TrendingUp color={glowColor} size={22} />
          <Text style={[s.title, { color: glowColor, flex: 1 }]}>CHART SCANNER</Text>
          <View style={s.liveRow}>
            <View style={[s.liveDot, { backgroundColor: '#00FF88' }]} />
            <Text style={{ color: '#00FF88', fontSize: 10, fontWeight: '700' }}>READY</Text>
          </View>
        </View>
        <View style={[s.meterTrack, { backgroundColor: glowColor + '14' }]}>
          <Animated.View style={[s.meterFill, { backgroundColor: glowColor, width: powerWidth.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }) }]}>
            <Animated.View style={[s.meterDot, { backgroundColor: glowColor, opacity: glowAnim }]} />
          </Animated.View>
        </View>
        <View style={s.meterLabels}>
          <Text style={[s.meterLabel, { color: glowColor + '59' }]}>AI POWERED</Text>
          <Text style={[s.meterLabel, { color: glowColor + '59' }]}>TAP TO SCAN</Text>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity activeOpacity={0.7} onPress={onPress} style={[s.card, { borderWidth: 1.5, borderColor: glowColor + '80', paddingBottom: 16 }, webGlow]}>
      <View style={[s.radarCircle1, { borderColor: glowColor + '0A' }]} />
      <View style={[s.radarCircle2, { borderColor: glowColor + '06' }]} />
      <View style={[s.radarIconSm, { borderColor: glowColor + '80', backgroundColor: glowColor + '0F' }]}>
        <TrendingUp color={glowColor} size={20} />
      </View>
      <View style={s.textCol}>
        <Text style={[s.titleLg, { color: glowColor, textShadowColor: glowColor + '80' }]}>CHART SCANNER</Text>
        <Text style={[s.subtitle, { color: 'rgba(255,255,255,0.4)' }]}>Scanning markets with AI precision</Text>
      </View>
      {renderBars()}
      <View style={[s.meterTrackFull, { backgroundColor: glowColor + '0F' }]}>
        <Animated.View style={[s.meterFill, { backgroundColor: glowColor, width: powerWidth.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }) }]}>
          <Animated.View style={[s.meterDotSm, { backgroundColor: glowColor, opacity: glowAnim }]} />
        </Animated.View>
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  pill: { backgroundColor: '#080D1A', borderRadius: 28, borderWidth: 1, flexDirection: 'row', alignItems: 'center', height: 56, paddingHorizontal: 20, marginBottom: 12, gap: 14, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 10, elevation: 8 },
  pillIcon: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: '#040810', borderRadius: 18, borderWidth: 1, padding: 20, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 16, marginBottom: 12, position: 'relative', overflow: 'hidden', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 12, elevation: 8 },
  radarCircle1: { position: 'absolute', top: -30, left: 30, width: 200, height: 200, borderRadius: 100, borderWidth: 1 },
  radarCircle2: { position: 'absolute', top: -90, left: -10, width: 320, height: 320, borderRadius: 160, borderWidth: 1 },
  radarIcon: { width: 52, height: 52, borderRadius: 26, borderWidth: 2, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  radarIconSm: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  radarPing: { position: 'absolute', top: -2, right: -2, width: 10, height: 10, borderRadius: 5 },
  textCol: { flex: 1, gap: 3, minWidth: 0 },
  title: { fontSize: 15, fontWeight: '800', letterSpacing: 1.5, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 8 },
  titleLg: { fontSize: 16, fontWeight: '800', letterSpacing: 1.5, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 10 },
  subtitle: { fontSize: 11, fontWeight: '500' },
  barsCol: { alignItems: 'flex-end', gap: 4 },
  barsRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 26 },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  liveDot: { width: 5, height: 5, borderRadius: 2.5 },
  liveText: { fontSize: 8, fontWeight: '700', letterSpacing: 1 },
  meterRow: { flexDirection: 'row', alignItems: 'center', gap: 14, width: '100%', marginBottom: 14 },
  meterTrack: { height: 6, borderRadius: 3, overflow: 'hidden', width: '100%' },
  meterTrackFull: { height: 5, borderRadius: 3, overflow: 'hidden', width: '100%', marginTop: 14 },
  meterFill: { height: '100%', borderRadius: 3, position: 'relative' },
  meterDot: { position: 'absolute', right: -4, top: -3, width: 12, height: 12, borderRadius: 6 },
  meterDotSm: { position: 'absolute', right: -3, top: -2, width: 9, height: 9, borderRadius: 5 },
  meterLabels: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginTop: 8 },
  meterLabel: { fontSize: 9, fontWeight: '600', letterSpacing: 0.5 },
  termCard: { backgroundColor: '#030608', borderRadius: 14, borderWidth: 1, marginBottom: 12, overflow: 'hidden', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 12, elevation: 8 },
  termHeader: { paddingVertical: 6, paddingHorizontal: 14, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  termDot: { width: 6, height: 6, borderRadius: 3 },
  termFile: { fontSize: 9, fontWeight: '600', letterSpacing: 0.5, marginLeft: 8 },
  termVer: { fontSize: 8, fontWeight: '600', marginLeft: 'auto' },
  termBody: { paddingVertical: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10 },
});

export default ScannerCard;
