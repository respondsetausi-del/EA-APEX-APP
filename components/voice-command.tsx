import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Animated } from 'react-native';
import { Mic, MicOff } from 'lucide-react-native';
import { router } from 'expo-router';

// ─── Types ────────────────────────────────────────────────────────────
interface VoiceCommandPillProps {
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

// ─── Color map for voice ──────────────────────────────────────────────
const COLOR_MAP: Record<string, string> = {
  cyan: '#00BFFF',
  blue: '#00BFFF',
  purple: '#A855F7',
  green: '#00FF88',
  pink: '#FF3366',
  orange: '#FF6B00',
  gold: '#FFD700',
  yellow: '#FFD700',
  magenta: '#FF00FF',
  red: '#FF3366',
};

// ─── Command definitions ──────────────────────────────────────────────
const COMMANDS: VoiceCommand[] = [
  // Navigation
  { patterns: [/open\s+quotes?/i, /show\s+quotes?/i, /go\s+(?:to\s+)?quotes?/i, /quotes?\s+screen/i], action: 'nav_quotes', label: 'Opening Quotes' },
  { patterns: [/open\s+(?:meta\s*trader|mt[45])/i, /show\s+(?:meta\s*trader|mt[45])/i, /go\s+(?:to\s+)?(?:meta\s*trader|mt[45])/i], action: 'nav_metatrader', label: 'Opening MetaTrader' },
  { patterns: [/go\s+(?:to\s+)?home/i, /home\s+screen/i, /go\s+back/i], action: 'nav_home', label: 'Going Home' },

  // Trading control
  { patterns: [/start\s+trad/i, /activate\s+(?:the\s+)?bot/i, /turn\s+on\s+(?:the\s+)?bot/i, /enable\s+trad/i, /bot\s+on/i], action: 'bot_start', label: 'Activating Bot' },
  { patterns: [/stop\s+trad/i, /deactivate\s+(?:the\s+)?bot/i, /turn\s+off\s+(?:the\s+)?bot/i, /disable\s+trad/i, /bot\s+off/i], action: 'bot_stop', label: 'Deactivating Bot' },
  { patterns: [/trade\s+(\w+)/i], action: 'trade_symbol', label: 'Opening Trade' },

  // EA management
  { patterns: [/add\s+(?:a\s+)?(?:new\s+)?ea/i, /new\s+ea/i, /add\s+(?:a\s+)?(?:new\s+)?bot/i], action: 'add_ea', label: 'Add New EA' },
  { patterns: [/remove\s+(?:the\s+)?(?:this\s+)?ea/i, /delete\s+(?:the\s+)?(?:this\s+)?ea/i, /remove\s+(?:the\s+)?(?:this\s+)?bot/i], action: 'remove_ea', label: 'Removing EA' },

  // Info queries
  { patterns: [/(?:what(?:'?s| is)?\s+(?:my\s+)?)?status/i, /how(?:'?s| is)?\s+(?:my\s+)?bot/i], action: 'query_status', label: 'Checking Status' },
  { patterns: [/how\s+many\s+ea/i, /how\s+many\s+bot/i, /ea\s+count/i], action: 'query_count', label: 'Counting EAs' },

  // Settings
  { patterns: [/(?:change|set|switch)\s+(?:the\s+)?colou?r\s+(?:to\s+)?(\w+)/i, /(\w+)\s+colou?r/i, /make\s+it\s+(\w+)/i], action: 'set_color', label: 'Changing Color' },
  { patterns: [/(?:turn|switch)\s+on\s+(?:the\s+)?avatar/i, /show\s+(?:the\s+)?avatar/i, /avatar\s+on/i], action: 'avatar_on', label: 'Avatar On' },
  { patterns: [/(?:turn|switch)\s+off\s+(?:the\s+)?avatar/i, /hide\s+(?:the\s+)?avatar/i, /avatar\s+off/i], action: 'avatar_off', label: 'Avatar Off' },
];

// ─── Component ────────────────────────────────────────────────────────
export function VoiceCommandPill({
  glowColor,
  isBotActive,
  onToggleBot,
  onRemoveEA,
  onAddEA,
  onSetGlowColor,
  onToggleAvatar,
  eaName = 'EA',
  eaCount = 0,
  activeSymbolCount = 0,
}: VoiceCommandPillProps) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [feedback, setFeedback] = useState('');
  const [supported, setSupported] = useState(true);
  const recognitionRef = useRef<any>(null);
  const feedbackTimer = useRef<NodeJS.Timeout | null>(null);

  // Animated bars
  const bar1 = useRef(new Animated.Value(8)).current;
  const bar2 = useRef(new Animated.Value(14)).current;
  const bar3 = useRef(new Animated.Value(20)).current;
  const bar4 = useRef(new Animated.Value(14)).current;
  const bar5 = useRef(new Animated.Value(8)).current;

  // Check support
  useEffect(() => {
    if (Platform.OS === 'web') {
      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SR) setSupported(false);
    } else {
      setSupported(false);
    }
  }, []);

  // Animate bars when listening
  useEffect(() => {
    if (!isListening) return;
    const bars = [bar1, bar2, bar3, bar4, bar5];
    const anims = bars.map((bar, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(bar, { toValue: 6 + Math.random() * 18, duration: 200 + i * 50, useNativeDriver: false }),
          Animated.timing(bar, { toValue: 4 + Math.random() * 8, duration: 200 + i * 50, useNativeDriver: false }),
        ])
      )
    );
    anims.forEach(a => a.start());
    return () => anims.forEach(a => a.stop());
  }, [isListening]);

  // Show feedback briefly
  const showFeedback = useCallback((msg: string) => {
    setFeedback(msg);
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    feedbackTimer.current = setTimeout(() => setFeedback(''), 3000);
  }, []);

  // Parse and execute command
  const executeCommand = useCallback((text: string) => {
    const lower = text.toLowerCase().trim();
    if (!lower) return;

    for (const cmd of COMMANDS) {
      for (const pattern of cmd.patterns) {
        const match = lower.match(pattern);
        if (!match) continue;

        showFeedback(cmd.label);

        switch (cmd.action) {
          case 'nav_quotes':
            router.push('/(tabs)/quotes');
            return;
          case 'nav_metatrader':
            router.push('/(tabs)/metatrader');
            return;
          case 'nav_home':
            router.push('/(tabs)/');
            return;
          case 'bot_start':
            if (!isBotActive) onToggleBot();
            else showFeedback('Bot already active');
            return;
          case 'bot_stop':
            if (isBotActive) onToggleBot();
            else showFeedback('Bot already stopped');
            return;
          case 'trade_symbol': {
            const symbol = (match[1] || '').toUpperCase();
            if (symbol) {
              router.push(`/trade-config?symbol=${symbol}`);
              showFeedback(`Trading ${symbol}`);
            }
            return;
          }
          case 'add_ea':
            onAddEA();
            return;
          case 'remove_ea':
            onRemoveEA();
            return;
          case 'query_status':
            showFeedback(`${eaName} is ${isBotActive ? 'ACTIVE' : 'IDLE'} • ${activeSymbolCount} symbols`);
            return;
          case 'query_count':
            showFeedback(`${eaCount} EA${eaCount !== 1 ? 's' : ''} connected`);
            return;
          case 'set_color': {
            const colorWord = (match[1] || match[2] || match[3] || '').toLowerCase();
            const hex = COLOR_MAP[colorWord];
            if (hex && onSetGlowColor) {
              onSetGlowColor(hex);
              showFeedback(`Color → ${colorWord}`);
            } else {
              showFeedback(`Unknown color: ${colorWord}`);
            }
            return;
          }
          case 'avatar_on':
            onToggleAvatar?.(true);
            showFeedback('Avatar circle on');
            return;
          case 'avatar_off':
            onToggleAvatar?.(false);
            showFeedback('Avatar circle off');
            return;
        }
      }
    }
    showFeedback(`"${text}" — command not recognized`);
  }, [isBotActive, onToggleBot, onRemoveEA, onAddEA, onSetGlowColor, onToggleAvatar, eaName, eaCount, activeSymbolCount, showFeedback]);

  // Start/stop listening
  const toggleListening = useCallback(() => {
    if (!supported) {
      showFeedback('Voice not supported in this browser');
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      showFeedback('Voice not supported');
      return;
    }

    const recognition = new SR();
    recognition.lang = 'en-US';
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    recognition.onstart = () => {
      setIsListening(true);
      setTranscript('');
      setFeedback('');
    };

    recognition.onresult = (event: any) => {
      const result = event.results[event.results.length - 1];
      const text = result[0].transcript;
      setTranscript(text);
      if (result.isFinal) {
        executeCommand(text);
        setIsListening(false);
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech error:', event.error);
      if (event.error === 'not-allowed') {
        showFeedback('Microphone access denied');
      } else {
        showFeedback('Voice error — try again');
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [isListening, supported, executeCommand, showFeedback]);

  // Cleanup
  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    };
  }, []);

  const bars = [bar1, bar2, bar3, bar4, bar5];

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={toggleListening}
      style={[
        styles.pill,
        {
          borderColor: isListening ? glowColor : glowColor + '80',
          shadowColor: glowColor,
        },
        Platform.OS === 'web' ? {
          boxShadow: isListening
            ? `0 0 10px 2px ${glowColor}A0, 0 0 24px 6px ${glowColor}40`
            : `0 0 6px 1px ${glowColor}80, 0 0 18px 4px ${glowColor}33`,
        } as any : {},
      ]}
    >
      {/* Mic icon */}
      <View style={[
        styles.micCircle,
        { borderColor: glowColor + '50', backgroundColor: isListening ? glowColor + '25' : glowColor + '12' },
      ]}>
        {isListening ? (
          <MicOff color={glowColor} size={18} />
        ) : (
          <Mic color={glowColor} size={18} />
        )}
      </View>

      {/* Text area */}
      <View style={styles.textBlock}>
        {feedback ? (
          <Text style={[styles.feedbackText, { color: glowColor }]} numberOfLines={1} ellipsizeMode="tail">
            {feedback}
          </Text>
        ) : isListening && transcript ? (
          <Text style={[styles.transcriptText, { color: glowColor }]} numberOfLines={1} ellipsizeMode="tail">
            {transcript}
          </Text>
        ) : (
          <>
            <Text style={[styles.title, { color: glowColor, textShadowColor: glowColor + '80' }]}>
              {isListening ? 'LISTENING...' : 'VOICE COMMAND'}
            </Text>
            <Text style={[styles.subtitle, { color: glowColor + '8C' }]}>
              {isListening ? 'SPEAK NOW' : 'TAP TO SPEAK'}
            </Text>
          </>
        )}
      </View>

      {/* Sound bars */}
      <View style={styles.barsContainer}>
        {bars.map((bar, i) => (
          <Animated.View
            key={i}
            style={[
              styles.bar,
              {
                height: isListening ? bar : [8, 14, 20, 14, 8][i],
                backgroundColor: isListening ? glowColor : glowColor + '66',
              },
            ]}
          />
        ))}
      </View>
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  pill: {
    backgroundColor: '#080D1A',
    borderRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    paddingHorizontal: 20,
    marginBottom: 20,
    borderWidth: 1,
    gap: 14,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
    overflow: 'hidden',
  },
  micCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBlock: {
    flex: 1,
    flexDirection: 'column',
    gap: 2,
    minWidth: 0,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.2,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
  subtitle: {
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 0.8,
  },
  transcriptText: {
    fontSize: 13,
    fontWeight: '600',
    fontStyle: 'italic',
  },
  feedbackText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  barsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    height: 24,
  },
  bar: {
    width: 2,
    borderRadius: 1,
  },
});

export default VoiceCommandPill;
