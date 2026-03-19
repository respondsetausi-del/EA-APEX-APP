import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Animated } from 'react-native';
import { TrendingUp } from 'lucide-react-native';

interface ScannerCardProps {
  variant?: string;
  glowColor: string;
  onPress: () => void;
}

// Inject CSS keyframes once on web
let cssInjected = false;
function injectCSS() {
  if (cssInjected || Platform.OS !== 'web') return;
  cssInjected = true;
  const style = document.createElement('style');
  style.textContent = `
    @keyframes sc-radarSweep { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    @keyframes sc-ping { 0%,100% { opacity:0.2; transform:scale(0.8); } 50% { opacity:1; transform:scale(1.2); } }
    @keyframes sc-ring { 0% { transform:scale(0.3); opacity:0.6; } 100% { transform:scale(1.5); opacity:0; } }
    @keyframes sc-bar1 { 0%,100% { height:10px; } 50% { height:22px; } }
    @keyframes sc-bar2 { 0%,100% { height:16px; } 50% { height:8px; } }
    @keyframes sc-bar3 { 0%,100% { height:22px; } 50% { height:12px; } }
    @keyframes sc-bar4 { 0%,100% { height:14px; } 50% { height:24px; } }
    @keyframes sc-bar5 { 0%,100% { height:8px; } 50% { height:18px; } }
    @keyframes sc-cursor { 0%,100% { opacity:1; } 50% { opacity:0; } }
    @keyframes sc-typeText { 0% { width:0; } 100% { width:100%; } }
    @keyframes sc-scanLine { 0% { left:-100%; } 100% { left:100%; } }
    @keyframes sc-powerFill { 0% { width:0%; } 100% { width:62%; } }
    @keyframes sc-powerGlow { 0%,100% { opacity:0.3; } 50% { opacity:0.8; } }
    @keyframes sc-meterPulse { 0%,100% { box-shadow: 0 0 6px 1px rgba(0,191,255,0.4); } 50% { box-shadow: 0 0 14px 3px rgba(0,191,255,0.7), 0 0 24px 6px rgba(0,191,255,0.3); } }
    @keyframes sc-dotBlink { 0%,100% { opacity:1; } 50% { opacity:0.3; } }
  `;
  document.head.appendChild(style);
}

export function ScannerCard({ variant = 'F', glowColor, onPress }: ScannerCardProps) {
  useEffect(() => { injectCSS(); }, []);

  // Native fallback animations
  const glowAnim = useRef(new Animated.Value(0.3)).current;
  const powerWidth = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (Platform.OS !== 'web') {
      Animated.timing(powerWidth, { toValue: 62, duration: 2500, useNativeDriver: false }).start();
      Animated.loop(Animated.sequence([
        Animated.timing(glowAnim, { toValue: 0.8, duration: 1500, useNativeDriver: false }),
        Animated.timing(glowAnim, { toValue: 0.3, duration: 1500, useNativeDriver: false }),
      ])).start();
    }
  }, []);

  const isWeb = Platform.OS === 'web';
  const webGlow = isWeb ? {
    boxShadow: `0 0 10px 2px ${glowColor}80, 0 0 24px 6px ${glowColor}33`,
  } as any : {};

  const webAnim = (name: string, duration: string, delay?: string, fill?: string, iter?: string) => isWeb ? {
    animationName: name,
    animationDuration: duration,
    animationTimingFunction: 'ease-in-out',
    animationIterationCount: iter || 'infinite',
    animationDelay: delay || '0s',
    animationFillMode: fill || 'none',
  } as any : {};

  const renderBarsWeb = () => (
    <View style={{ alignItems: 'flex-end', gap: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 26 }}>
        {['sc-bar1', 'sc-bar2', 'sc-bar3', 'sc-bar4', 'sc-bar5'].map((anim, i) => (
          <View key={i} style={[{ width: 3, borderRadius: 1.5, backgroundColor: glowColor, height: 12 }, webAnim(anim, '1.2s', `${i * 0.15}s`)]} />
        ))}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <View style={[{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#00FF88' }, webAnim('sc-dotBlink', '1s')]} />
        <Text style={{ color: glowColor + '80', fontSize: 8, fontWeight: '700', letterSpacing: 1 }}>LIVE</Text>
      </View>
    </View>
  );

  // ── A: Simple Pill ──
  if (variant === 'A') {
    return (
      <TouchableOpacity activeOpacity={0.7} onPress={onPress}
        style={[{ backgroundColor: '#080D1A', borderRadius: 28, borderWidth: 1, borderColor: glowColor + '80', flexDirection: 'row', alignItems: 'center', height: 56, paddingHorizontal: 20, marginBottom: 12, gap: 14 }, webGlow]}>
        <View style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: glowColor + '50', backgroundColor: glowColor + '12', alignItems: 'center', justifyContent: 'center' }}>
          <TrendingUp color={glowColor} size={20} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ color: glowColor, fontSize: 13, fontWeight: '700', letterSpacing: 1.2 }}>CHART SCANNER</Text>
          <Text style={{ color: glowColor + '8C', fontSize: 10, fontWeight: '500', letterSpacing: 0.8 }}>AI-POWERED CHART ANALYSIS</Text>
        </View>
      </TouchableOpacity>
    );
  }

  // ── F: Radar Scanner ──
  if (variant === 'F') {
    return (
      <TouchableOpacity activeOpacity={0.7} onPress={onPress}
        style={[{ backgroundColor: '#040810', borderRadius: 18, borderWidth: 1, borderColor: glowColor + '66', padding: 20, flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 12, position: 'relative', overflow: 'hidden' }, webGlow]}>
        <View style={{ position: 'absolute', top: '50%', left: 70, width: 200, height: 200, marginTop: -100, borderRadius: 100, borderWidth: 1, borderColor: glowColor + '0F' }} />
        <View style={{ position: 'absolute', top: '50%', left: 70, width: 320, height: 320, marginTop: -160, borderRadius: 160, borderWidth: 1, borderColor: glowColor + '0A' }} />
        {/* Ping rings */}
        <View style={[{ position: 'absolute', top: '50%', left: 96, width: 16, height: 16, marginTop: -8, borderRadius: 8, backgroundColor: glowColor + '4D', pointerEvents: 'none' }, webAnim('sc-ring', '2s', '0s')]} />
        <View style={[{ position: 'absolute', top: '50%', left: 96, width: 16, height: 16, marginTop: -8, borderRadius: 8, backgroundColor: glowColor + '4D', pointerEvents: 'none' }, webAnim('sc-ring', '2s', '0.6s')]} />
        {/* Radar icon */}
        <View style={{ width: 52, height: 52, borderRadius: 26, borderWidth: 2, borderColor: glowColor + '80', backgroundColor: glowColor + '0F', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
          <View style={{ position: 'absolute', width: 24, height: 24 }}>
            <TrendingUp color={glowColor} size={24} />
          </View>
          {/* Sweep arm */}
          <View style={[{ position: 'absolute', width: '100%', height: '100%' }, webAnim('sc-radarSweep', '3s', '0s', 'none', 'infinite'), { animationTimingFunction: 'linear' } as any]}>
            <View style={{ position: 'absolute', top: '50%', left: '50%', width: '50%', height: 2, transformOrigin: 'left center', backgroundColor: glowColor + 'CC', borderRadius: 1 } as any} />
          </View>
          {/* Ping dot */}
          <View style={[{ position: 'absolute', top: -2, right: -2, width: 10, height: 10, borderRadius: 5, backgroundColor: glowColor, borderWidth: 2, borderColor: '#040810' }, webAnim('sc-ping', '1.5s')]} />
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={{ color: glowColor, fontSize: 15, fontWeight: '800', letterSpacing: 1.5 }}>CHART SCANNER</Text>
          <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '500' }}>Scanning markets with AI precision</Text>
        </View>
        {renderBarsWeb()}
      </TouchableOpacity>
    );
  }

  // ── H: Terminal ──
  if (variant === 'H') {
    return (
      <TouchableOpacity activeOpacity={0.7} onPress={onPress}
        style={[{ backgroundColor: '#030608', borderRadius: 14, borderWidth: 1, borderColor: glowColor + '4D', marginBottom: 12, overflow: 'hidden', position: 'relative' }, webGlow]}>
        {/* Header */}
        <View style={{ backgroundColor: glowColor + '0F', paddingVertical: 6, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: glowColor + '25', flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#FF4444' }} />
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFD700' }} />
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#00FF88' }} />
          <Text style={{ color: glowColor + '66', fontSize: 9, fontWeight: '600', letterSpacing: 0.5, marginLeft: 8 }}>chart_scanner.ai</Text>
          <Text style={{ color: glowColor + '40', fontSize: 8, fontWeight: '600', marginLeft: 'auto' }}>v2.0</Text>
        </View>
        {/* Body */}
        <View style={{ paddingVertical: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Text style={{ color: '#00FF88', fontSize: 14, fontFamily: 'monospace' }}>$</Text>
          <View style={{ flex: 1, overflow: 'hidden' }}>
            <Text style={[{ color: glowColor, fontSize: 14, fontWeight: '600', fontFamily: 'monospace', whiteSpace: 'nowrap', display: 'inline-block', overflow: 'hidden' } as any, webAnim('sc-typeText', '2s', '0s', 'none', 'infinite'), { animationTimingFunction: 'steps(18)' } as any]}>scan --chart --ai</Text>
          </View>
          <View style={[{ width: 2, height: 18, borderRadius: 1, backgroundColor: glowColor }, webAnim('sc-cursor', '0.8s', '0s', 'none', 'infinite'), { animationTimingFunction: 'step-end' } as any]} />
        </View>
        {/* Scan line */}
        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 1, overflow: 'hidden' }}>
          <View style={[{ position: 'absolute', width: '60%', height: '100%', background: `linear-gradient(90deg, transparent, ${glowColor}99, transparent)` } as any, webAnim('sc-scanLine', '2.5s', '0s', 'none', 'infinite'), { animationTimingFunction: 'linear' } as any]} />
        </View>
      </TouchableOpacity>
    );
  }

  // ── I: Power Meter ──
  if (variant === 'I') {
    return (
      <TouchableOpacity activeOpacity={0.7} onPress={onPress}
        style={[{ backgroundColor: '#040810', borderRadius: 16, borderWidth: 1, borderColor: glowColor + '66', padding: 18, paddingHorizontal: 20, marginBottom: 12 }, webGlow, webAnim('sc-meterPulse', '3s')]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 14 }}>
          <TrendingUp color={glowColor} size={22} />
          <Text style={{ color: glowColor, fontSize: 14, fontWeight: '800', letterSpacing: 1.2, flex: 1 }}>CHART SCANNER</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={[{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#00FF88' }, webAnim('sc-dotBlink', '1.2s')]} />
            <Text style={{ color: '#00FF88', fontSize: 10, fontWeight: '700' }}>READY</Text>
          </View>
        </View>
        {/* Meter */}
        <View style={{ height: 6, backgroundColor: glowColor + '14', borderRadius: 3, overflow: 'hidden', position: 'relative' }}>
          <View style={[{ height: '100%', borderRadius: 3, position: 'relative', background: `linear-gradient(90deg, ${glowColor}, #00FFD5)` } as any, webAnim('sc-powerFill', '2.5s', '0s', 'forwards', '1'), { animationTimingFunction: 'ease-out' } as any]}>
            <View style={[{ position: 'absolute', right: 0, top: -2, width: 10, height: 10, borderRadius: 5, backgroundColor: glowColor }, webAnim('sc-powerGlow', '1s')]} />
          </View>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
          <Text style={{ color: glowColor + '59', fontSize: 9, fontWeight: '600', letterSpacing: 0.5 }}>AI POWERED</Text>
          <Text style={{ color: glowColor + '59', fontSize: 9, fontWeight: '600', letterSpacing: 0.5 }}>TAP TO SCAN</Text>
        </View>
      </TouchableOpacity>
    );
  }

  // ── K: Hybrid (Radar + Meter) — default ──
  return (
    <TouchableOpacity activeOpacity={0.7} onPress={onPress}
      style={[{ backgroundColor: '#040810', borderRadius: 18, borderWidth: 1.5, borderColor: glowColor + '80', padding: 20, paddingBottom: 16, marginBottom: 12, position: 'relative', overflow: 'hidden' }, webGlow]}>
      <View style={{ position: 'absolute', top: -30, left: 30, width: 200, height: 200, borderRadius: 100, borderWidth: 1, borderColor: glowColor + '0A' }} />
      <View style={{ position: 'absolute', top: -90, left: -10, width: 320, height: 320, borderRadius: 160, borderWidth: 1, borderColor: glowColor + '06' }} />
      {/* Top row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 14 }}>
        <View style={{ width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: glowColor + '80', backgroundColor: glowColor + '0F', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
          <TrendingUp color={glowColor} size={20} />
          {/* Sweep */}
          <View style={[{ position: 'absolute', width: '100%', height: '100%' }, webAnim('sc-radarSweep', '4s', '0s', 'none', 'infinite'), { animationTimingFunction: 'linear' } as any]}>
            <View style={{ position: 'absolute', top: '50%', left: '50%', width: '50%', height: 2, transformOrigin: 'left center', backgroundColor: glowColor + '99', borderRadius: 1 } as any} />
          </View>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ color: glowColor, fontSize: 16, fontWeight: '800', letterSpacing: 1.5 }}>CHART SCANNER</Text>
          <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '500' }}>Scanning markets with AI precision</Text>
        </View>
        {renderBarsWeb()}
      </View>
      {/* Power bar */}
      <View style={{ height: 5, backgroundColor: glowColor + '0F', borderRadius: 3, overflow: 'hidden' }}>
        <View style={[{ height: '100%', borderRadius: 3, position: 'relative', background: `linear-gradient(90deg, ${glowColor}, #00FFD5)` } as any, webAnim('sc-powerFill', '3s', '0s', 'forwards', '1'), { animationTimingFunction: 'ease-out' } as any]}>
          <View style={[{ position: 'absolute', right: 0, top: -2, width: 9, height: 9, borderRadius: 5, backgroundColor: glowColor }, webAnim('sc-powerGlow', '1.2s')]} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default ScannerCard;
