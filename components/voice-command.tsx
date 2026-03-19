import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Animated } from 'react-native';
import { Mic, MicOff, X } from 'lucide-react-native';
import { router } from 'expo-router';

interface VoiceCommandPillProps {
  variant?: string;
  glowColor: string;
  isBotActive: boolean;
  onToggleBot: () => void;
  onRemoveEA: () => void;
  onAddEA: () => void;
  onSetGlowColor?: (color: string) => void;
  onToggleAvatar?: (show: boolean) => void;
  eaName?: string;
  eaCount?: number;
  activeSymbolCount?: number;
}

interface VoiceCommand {
  patterns: RegExp[];
  action: string;
  label: string;
}

const COLOR_MAP: Record<string, string> = {
  cyan: '#00BFFF', blue: '#00BFFF', purple: '#A855F7', green: '#00FF88',
  pink: '#FF3366', orange: '#FF6B00', gold: '#FFD700', yellow: '#FFD700',
  magenta: '#FF00FF', red: '#FF3366',
};

export const VOICE_COMMANDS: VoiceCommand[] = [
  { patterns: [/open\s+quotes?/i, /show\s+quotes?/i, /go\s+(?:to\s+)?quotes?/i, /quotes?\s+screen/i], action: 'nav_quotes', label: 'Opening Quotes' },
  { patterns: [/open\s+(?:meta\s*trader|mt[45])/i, /show\s+(?:meta\s*trader|mt[45])/i, /go\s+(?:to\s+)?(?:meta\s*trader|mt[45])/i], action: 'nav_metatrader', label: 'Opening MetaTrader' },
  { patterns: [/go\s+(?:to\s+)?home/i, /home\s+screen/i, /go\s+back/i], action: 'nav_home', label: 'Going Home' },
  { patterns: [/start\s+trad/i, /activate\s+(?:the\s+)?bot/i, /turn\s+on\s+(?:the\s+)?bot/i, /enable\s+trad/i, /bot\s+on/i], action: 'bot_start', label: 'Activating Bot' },
  { patterns: [/stop\s+trad/i, /deactivate\s+(?:the\s+)?bot/i, /turn\s+off\s+(?:the\s+)?bot/i, /disable\s+trad/i, /bot\s+off/i], action: 'bot_stop', label: 'Deactivating Bot' },
  { patterns: [/trade\s+(\w+)/i], action: 'trade_symbol', label: 'Opening Trade' },
  { patterns: [/add\s+(?:a\s+)?(?:new\s+)?ea/i, /new\s+ea/i, /add\s+(?:a\s+)?(?:new\s+)?bot/i], action: 'add_ea', label: 'Adding New EA' },
  { patterns: [/remove\s+(?:the\s+)?(?:this\s+)?ea/i, /delete\s+(?:the\s+)?(?:this\s+)?ea/i, /remove\s+(?:the\s+)?(?:this\s+)?bot/i], action: 'remove_ea', label: 'Removing EA' },
  { patterns: [/(?:what(?:'?s| is)?\s+(?:my\s+)?)?status/i, /how(?:'?s| is)?\s+(?:my\s+)?bot/i], action: 'query_status', label: 'Checking Status' },
  { patterns: [/how\s+many\s+ea/i, /how\s+many\s+bot/i, /ea\s+count/i], action: 'query_count', label: 'Counting EAs' },
  { patterns: [/(?:change|set|switch)\s+(?:the\s+)?colou?r\s+(?:to\s+)?(\w+)/i, /(\w+)\s+colou?r/i, /make\s+it\s+(\w+)/i], action: 'set_color', label: 'Changing Color' },
  { patterns: [/(?:turn|switch)\s+on\s+(?:the\s+)?avatar/i, /show\s+(?:the\s+)?avatar/i, /avatar\s+on/i], action: 'avatar_on', label: 'Avatar On' },
  { patterns: [/(?:turn|switch)\s+off\s+(?:the\s+)?avatar/i, /hide\s+(?:the\s+)?avatar/i, /avatar\s+off/i], action: 'avatar_off', label: 'Avatar Off' },
];

export const VOICE_HELP = [
  { category: 'NAVIGATION', commands: ['"Open quotes"', '"Go to MetaTrader"', '"Go home"'] },
  { category: 'TRADING', commands: ['"Start trading"', '"Stop trading"', '"Trade EURUSD"'] },
  { category: 'EA', commands: ['"Add new EA"', '"Remove EA"'] },
  { category: 'INFO', commands: ['"What\'s my status?"', '"How many EAs?"'] },
  { category: 'SETTINGS', commands: ['"Change color to purple"', '"Avatar on"', '"Avatar off"'] },
];

function speak(text: string): Promise<void> {
  return new Promise((resolve) => {
    if (Platform.OS !== 'web' || !window.speechSynthesis) { resolve(); return; }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.1;
    u.pitch = 0.9;
    u.volume = 0.8;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    window.speechSynthesis.speak(u);
  });
}

export function VoiceCommandPill({
  variant = 'A', glowColor, isBotActive, onToggleBot, onRemoveEA, onAddEA,
  onSetGlowColor, onToggleAvatar,
  eaName = 'EA', eaCount = 0, activeSymbolCount = 0,
}: VoiceCommandPillProps) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [feedback, setFeedback] = useState('');
  const [supported, setSupported] = useState(true);
  const recognitionRef = useRef<any>(null);
  const feedbackTimer = useRef<NodeJS.Timeout | null>(null);
  const wantActiveRef = useRef(false);
  const restartTimer = useRef<NodeJS.Timeout | null>(null);

  const bar1 = useRef(new Animated.Value(8)).current;
  const bar2 = useRef(new Animated.Value(14)).current;
  const bar3 = useRef(new Animated.Value(20)).current;
  const bar4 = useRef(new Animated.Value(14)).current;
  const bar5 = useRef(new Animated.Value(8)).current;

  useEffect(() => {
    if (Platform.OS === 'web') {
      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SR) setSupported(false);
    } else {
      setSupported(false);
    }
  }, []);

  useEffect(() => {
    if (!isListening) return;
    const bars = [bar1, bar2, bar3, bar4, bar5];
    const anims = bars.map((bar, i) =>
      Animated.loop(Animated.sequence([
        Animated.timing(bar, { toValue: 6 + Math.random() * 18, duration: 200 + i * 50, useNativeDriver: false }),
        Animated.timing(bar, { toValue: 4 + Math.random() * 8, duration: 200 + i * 50, useNativeDriver: false }),
      ]))
    );
    anims.forEach(a => a.start());
    return () => anims.forEach(a => a.stop());
  }, [isListening]);

  const showFeedback = useCallback((msg: string) => {
    setFeedback(msg);
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    feedbackTimer.current = setTimeout(() => setFeedback(''), 4000);
  }, []);

  const startRecognition = useCallback(() => {
    if (!supported || Platform.OS !== 'web') return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    try { recognitionRef.current?.stop(); } catch (e) {}

    const r = new SR();
    r.lang = 'en-US';
    r.interimResults = true;
    r.maxAlternatives = 1;
    r.continuous = false;

    r.onstart = () => { setIsListening(true); setTranscript(''); };

    r.onresult = (event: any) => {
      const res = event.results[event.results.length - 1];
      setTranscript(res[0].transcript);
      if (res.isFinal) {
        setIsListening(false);
        executeCommand(res[0].transcript);
      }
    };

    r.onerror = (event: any) => {
      console.error('Speech error:', event.error);
      if (event.error === 'not-allowed') {
        showFeedback('Microphone access denied');
        speak('Microphone access denied');
        wantActiveRef.current = false;
      }
      setIsListening(false);
    };

    r.onend = () => {
      setIsListening(false);
      if (wantActiveRef.current) {
        restartTimer.current = setTimeout(() => {
          if (wantActiveRef.current) startRecognition();
        }, 600);
      }
    };

    recognitionRef.current = r;
    r.start();
  }, [supported, showFeedback]);

  const executeCommand = useCallback(async (text: string) => {
    const lower = text.toLowerCase().trim();
    if (!lower) return;

    let spoken = '';
    for (const cmd of VOICE_COMMANDS) {
      for (const pattern of cmd.patterns) {
        const match = lower.match(pattern);
        if (!match) continue;

        switch (cmd.action) {
          case 'nav_quotes':
            spoken = 'Opening Quotes';
            showFeedback(spoken); await speak(spoken);
            router.push('/(tabs)/quotes'); return;
          case 'nav_metatrader':
            spoken = 'Opening MetaTrader';
            showFeedback(spoken); await speak(spoken);
            router.push('/(tabs)/metatrader'); return;
          case 'nav_home':
            spoken = 'Going Home';
            showFeedback(spoken); await speak(spoken);
            router.push('/(tabs)/'); return;
          case 'bot_start':
            spoken = isBotActive ? 'Bot is already active' : 'Bot activated';
            if (!isBotActive) onToggleBot();
            showFeedback(spoken); await speak(spoken); return;
          case 'bot_stop':
            spoken = isBotActive ? 'Bot deactivated' : 'Bot is already stopped';
            if (isBotActive) onToggleBot();
            showFeedback(spoken); await speak(spoken); return;
          case 'trade_symbol': {
            const sym = (match[1] || '').toUpperCase();
            if (sym) { spoken = `Opening trade for ${sym}`; showFeedback(spoken); await speak(spoken); router.push(`/trade-config?symbol=${sym}`); }
            return;
          }
          case 'add_ea':
            spoken = 'Adding new EA'; showFeedback(spoken); await speak(spoken); onAddEA(); return;
          case 'remove_ea':
            spoken = 'Removing EA'; showFeedback(spoken); await speak(spoken); onRemoveEA(); return;
          case 'query_status':
            spoken = `${eaName} is ${isBotActive ? 'active' : 'idle'} with ${activeSymbolCount} symbols`;
            showFeedback(spoken); await speak(spoken); return;
          case 'query_count':
            spoken = `${eaCount} EA${eaCount !== 1 ? 's' : ''} connected`;
            showFeedback(spoken); await speak(spoken); return;
          case 'set_color': {
            const cw = (match[1] || match[2] || match[3] || '').toLowerCase();
            const hex = COLOR_MAP[cw];
            spoken = hex ? `Color changed to ${cw}` : `Unknown color ${cw}`;
            if (hex && onSetGlowColor) onSetGlowColor(hex);
            showFeedback(spoken); await speak(spoken); return;
          }
          case 'avatar_on':
            onToggleAvatar?.(true); spoken = 'Avatar circle on';
            showFeedback(spoken); await speak(spoken); return;
          case 'avatar_off':
            onToggleAvatar?.(false); spoken = 'Avatar circle off';
            showFeedback(spoken); await speak(spoken); return;
        }
      }
    }
    spoken = `${text}. Command not recognized`;
    showFeedback(`"${text}" — not recognized`);
    await speak(spoken);
  }, [isBotActive, onToggleBot, onRemoveEA, onAddEA, onSetGlowColor, onToggleAvatar, eaName, eaCount, activeSymbolCount, showFeedback]);

  const toggleListening = useCallback(() => {
    if (!supported) {
      showFeedback('Voice not supported');
      speak('Voice is not supported in this browser');
      return;
    }
    if (wantActiveRef.current) {
      wantActiveRef.current = false;
      if (restartTimer.current) clearTimeout(restartTimer.current);
      try { recognitionRef.current?.stop(); } catch (e) {}
      setIsListening(false); setTranscript(''); setFeedback('');
      if (Platform.OS === 'web' && window.speechSynthesis) window.speechSynthesis.cancel();
    } else {
      wantActiveRef.current = true;
      startRecognition();
    }
  }, [supported, startRecognition, showFeedback]);

  useEffect(() => {
    return () => {
      wantActiveRef.current = false;
      if (restartTimer.current) clearTimeout(restartTimer.current);
      try { recognitionRef.current?.stop(); } catch (e) {}
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
      if (Platform.OS === 'web' && window.speechSynthesis) window.speechSynthesis.cancel();
    };
  }, []);

  const bars = [bar1, bar2, bar3, bar4, bar5];
  const glow = (active: boolean) => Platform.OS === 'web' ? {
    boxShadow: active
      ? `0 0 10px 2px ${glowColor}A0, 0 0 24px 6px ${glowColor}40`
      : `0 0 6px 1px ${glowColor}80, 0 0 18px 4px ${glowColor}33`,
  } as any : {};

  const renderBars = (compact?: boolean) => (
    <View style={s.barsRow}>
      {bars.map((bar, i) => (
        <Animated.View key={i} style={[s.bar, compact && { width: 1.5 }, { height: isListening ? bar : [8, 14, 20, 14, 8][i], backgroundColor: isListening ? glowColor : glowColor + '66' }]} />
      ))}
    </View>
  );

  const renderText = () => (
    <View style={s.textBlock}>
      {feedback ? (
        <Text style={[s.feedbackText, { color: glowColor }]} numberOfLines={1} ellipsizeMode="tail">{feedback}</Text>
      ) : isListening && transcript ? (
        <Text style={[s.transcriptText, { color: glowColor }]} numberOfLines={1} ellipsizeMode="tail">{transcript}</Text>
      ) : (
        <>
          <Text style={[s.title, { color: glowColor, textShadowColor: glowColor + '80' }]}>{isListening ? 'LISTENING...' : 'VOICE COMMAND'}</Text>
          <Text style={[s.subtitle, { color: glowColor + '8C' }]}>{isListening ? 'SPEAK NOW' : 'TAP TO SPEAK'}</Text>
        </>
      )}
    </View>
  );

  // ── Variant A: Pill (current) ──
  if (variant === 'A') {
    return (
      <TouchableOpacity activeOpacity={0.7} onPress={toggleListening}
        style={[s.pill, { borderColor: isListening ? glowColor : glowColor + '80', shadowColor: glowColor }, glow(isListening)]}>
        <View style={[s.micCircle, { borderColor: glowColor + '50', backgroundColor: isListening ? glowColor + '25' : glowColor + '12' }]}>
          {isListening ? <MicOff color={glowColor} size={18} /> : <Mic color={glowColor} size={18} />}
        </View>
        {renderText()}
        {renderBars()}
      </TouchableOpacity>
    );
  }

  // ── Variant B: Compact circle → expands ──
  if (variant === 'B') {
    if (!isListening && !feedback) {
      return (
        <View style={s.compactRow}>
          <TouchableOpacity activeOpacity={0.7} onPress={toggleListening}
            style={[s.compactCircle, { borderColor: glowColor + '80', shadowColor: glowColor }, glow(false)]}>
            <Mic color={glowColor} size={22} />
          </TouchableOpacity>
          <Text style={[s.compactLabel, { color: glowColor + '80' }]}>VOICE</Text>
        </View>
      );
    }
    return (
      <TouchableOpacity activeOpacity={0.7} onPress={toggleListening}
        style={[s.pill, { borderColor: glowColor, shadowColor: glowColor }, glow(true)]}>
        <View style={[s.micCircleSmall, { backgroundColor: glowColor + '33' }]}>
          <X color={glowColor} size={16} />
        </View>
        {renderText()}
        {renderBars()}
      </TouchableOpacity>
    );
  }

  // ── Variant C: Thin bar ──
  if (variant === 'C') {
    return (
      <TouchableOpacity activeOpacity={0.7} onPress={toggleListening}
        style={[s.thinBar, { borderColor: isListening ? glowColor : glowColor + '4D', shadowColor: glowColor }, isListening ? glow(true) : {}]}>
        {isListening ? (
          <X color={glowColor} size={16} />
        ) : (
          <Mic color={glowColor + '80'} size={16} />
        )}
        {feedback ? (
          <Text style={[s.thinText, { color: glowColor }]} numberOfLines={1}>{feedback}</Text>
        ) : isListening && transcript ? (
          <Text style={[s.thinText, { color: glowColor, fontStyle: 'italic' }]} numberOfLines={1}>{transcript}</Text>
        ) : (
          <Text style={[s.thinText, { color: isListening ? glowColor : glowColor + '80' }]}>{isListening ? 'SPEAK NOW...' : 'TAP FOR VOICE COMMANDS'}</Text>
        )}
        {isListening && renderBars(true)}
      </TouchableOpacity>
    );
  }

  // ── Variant D: Minimal mic icon (integrates near action bar) ──
  if (variant === 'D') {
    return (
      <TouchableOpacity activeOpacity={0.7} onPress={toggleListening}
        style={[s.minimalPill, { borderColor: isListening ? glowColor : glowColor + '4D' }, isListening ? glow(true) : {}]}>
        {isListening ? <MicOff color={glowColor} size={16} /> : <Mic color={glowColor + '80'} size={16} />}
        {feedback ? (
          <Text style={[s.thinText, { color: glowColor, flex: 1 }]} numberOfLines={1}>{feedback}</Text>
        ) : isListening ? (
          <Text style={[s.thinText, { color: glowColor, fontStyle: 'italic', flex: 1 }]} numberOfLines={1}>{transcript || 'Listening...'}</Text>
        ) : (
          <Text style={[s.thinText, { color: glowColor + '80', flex: 1 }]}>VOICE</Text>
        )}
        {isListening && renderBars(true)}
      </TouchableOpacity>
    );
  }

  // ── Variant E: Waveform strip ──
  return (
    <TouchableOpacity activeOpacity={0.7} onPress={toggleListening}
      style={[s.waveStrip, { borderColor: isListening ? glowColor : glowColor + '4D', shadowColor: glowColor }, isListening ? glow(true) : {}]}>
      {feedback ? (
        <Text style={[s.waveText, { color: glowColor }]} numberOfLines={1}>{feedback}</Text>
      ) : isListening && transcript ? (
        <Text style={[s.waveText, { color: glowColor, fontStyle: 'italic' }]} numberOfLines={1}>{transcript}</Text>
      ) : (
        <Text style={[s.waveText, { color: isListening ? glowColor : glowColor + '8C' }]}>{isListening ? 'SPEAK NOW...' : 'VOICE COMMAND'}</Text>
      )}
      {isListening && (
        <View style={s.waveBars}>
          {[4, 10, 18, 24, 16, 22, 12, 20, 8, 14].map((h, i) => (
            <Animated.View key={i} style={{ width: 2, height: isListening ? bars[i % 5] : h, borderRadius: 1, backgroundColor: glowColor, opacity: 0.5 + (i % 3) * 0.2 }} />
          ))}
        </View>
      )}
      <View style={[s.waveMicBtn, { borderColor: isListening ? glowColor + '80' : glowColor + '4D', backgroundColor: isListening ? glowColor + '33' : glowColor + '15' }]}>
        {isListening ? <X color={glowColor} size={16} /> : <Mic color={glowColor} size={18} />}
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  // Shared
  textBlock: { flex: 1, flexDirection: 'column', gap: 2, minWidth: 0 },
  title: { fontSize: 13, fontWeight: '700', letterSpacing: 1.2, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 6 },
  subtitle: { fontSize: 10, fontWeight: '500', letterSpacing: 0.8 },
  transcriptText: { fontSize: 13, fontWeight: '600', fontStyle: 'italic' },
  feedbackText: { fontSize: 13, fontWeight: '700', letterSpacing: 0.5 },
  barsRow: { flexDirection: 'row', alignItems: 'center', gap: 2, height: 24 },
  bar: { width: 2, borderRadius: 1 },

  // A: Pill
  pill: { backgroundColor: '#080D1A', borderRadius: 28, flexDirection: 'row', alignItems: 'center', height: 56, paddingHorizontal: 20, marginBottom: 20, borderWidth: 1, gap: 14, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 10, elevation: 8 },
  micCircle: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },

  // B: Compact
  compactRow: { alignItems: 'center', gap: 6, marginBottom: 20 },
  compactCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#080D1A', borderWidth: 1, alignItems: 'center', justifyContent: 'center', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 6 },
  compactLabel: { fontSize: 9, fontWeight: '600', letterSpacing: 1 },
  micCircleSmall: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },

  // C: Thin bar
  thinBar: { backgroundColor: '#080D1A', borderRadius: 20, flexDirection: 'row', alignItems: 'center', height: 40, paddingHorizontal: 16, marginBottom: 20, borderWidth: 1, gap: 10 },
  thinText: { fontSize: 11, fontWeight: '600', letterSpacing: 1, flex: 1 },

  // D: Minimal
  minimalPill: { backgroundColor: '#080D1A', borderRadius: 20, flexDirection: 'row', alignItems: 'center', height: 36, paddingHorizontal: 14, marginBottom: 20, borderWidth: 1, gap: 8 },

  // E: Waveform
  waveStrip: { backgroundColor: '#080D1A', borderRadius: 24, flexDirection: 'row', alignItems: 'center', height: 48, paddingLeft: 18, paddingRight: 6, marginBottom: 20, borderWidth: 1, gap: 10 },
  waveText: { fontSize: 11, fontWeight: '600', letterSpacing: 1, flex: 1 },
  waveBars: { flexDirection: 'row', alignItems: 'center', gap: 1.5, height: 28, paddingRight: 4 },
  waveMicBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
});

export default VoiceCommandPill;
