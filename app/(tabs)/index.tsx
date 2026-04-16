import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, ImageBackground, Platform, Dimensions, SafeAreaView, Modal, ActivityIndicator, Alert, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Video, ResizeMode } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { Plus, TrendingUp, TrendingDown, Minus, X, Upload, Scan, RefreshCw, Clock, History, Trash2 } from 'lucide-react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { WebView } from 'react-native-webview';
import { analyzeOnWeb, buildInsights, buildAnalyzerHtml, type ChartInsights } from '@/utils/chart-heuristics';
import { ConfidenceGauge } from '@/components/confidence-gauge';
import { Typewriter } from '@/components/typewriter';
import { ParticleBurst } from '@/components/particle-burst';
import { ScanPhases } from '@/components/scan-phases';
import { RobotLogo } from '@/components/robot-logo';
import { TradingPanel } from '@/components/trading-panel';
import { VoiceCommandPill } from '@/components/voice-command';
import { ScannerCard } from '@/components/scanner-card';
import TradeChatWidget from '@/components/trade-chat-widget';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useApp } from '@/providers/app-provider';
import type { EA } from '@/providers/app-provider';

export default function HomeScreen() {
  const { eas, isFirstTime, setIsFirstTime, removeEA, isBotActive, setBotActive, setActiveEA, glowColor, setGlowColor, showHeroAvatar, setShowHeroAvatar, backgroundVideo, activeSymbols, mt4Symbols, mt5Symbols, panelStyle, voiceStyle, layoutStyle, scannerStyle } = useApp();

  // Safely get the primary EA (first one in the list)
  const primaryEA = Array.isArray(eas) && eas.length > 0 ? eas[0] : null;
  const otherEAs = Array.isArray(eas) ? eas.slice(1) : [];
  const totalSymbols = (activeSymbols?.length || 0) + (mt4Symbols?.length || 0) + (mt5Symbols?.length || 0);

  console.log('HomeScreen render - EAs count:', eas?.length || 0, 'Primary EA:', primaryEA?.name || 'none');

  const [logoError, setLogoError] = useState<boolean>(false);
  const [avatarError, setAvatarError] = useState<boolean>(false);
  const [synapseOpen, setSynapseOpen] = useState<boolean>(false);

  // Chart Scanner state
  const [pickedImage, setPickedImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [scanLoading, setScanLoading] = useState<boolean>(false);
  const [insights, setInsights] = useState<ChartInsights | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  // When set on native, a hidden WebView mounts and runs the analyzer on the data URI
  const [analyzerDataUri, setAnalyzerDataUri] = useState<string | null>(null);
  // Tier 2 — multi-phase scan state (-1 = idle, 0..3 active phase, 4 = done)
  const [scanPhase, setScanPhase] = useState<number>(-1);
  // Increments each time a signal reveals — drives the particle burst.
  const [revealCount, setRevealCount] = useState<number>(0);
  // When the currently displayed signal was produced (for the 15-min countdown).
  const [signalAt, setSignalAt] = useState<number | null>(null);
  const [nowTick, setNowTick] = useState<number>(() => Date.now());
  // Scan history (last 10 signals, persisted in AsyncStorage).
  type ScanHistoryEntry = {
    id: string;
    at: number;
    action: ChartInsights['signal']['action'];
    strength: ChartInsights['signal']['strength'];
    headline: string;
    confidence: number;
    bullishPercent: number;
    bearishPercent: number;
    trend: ChartInsights['trend'];
  };
  const [scanHistory, setScanHistory] = useState<ScanHistoryEntry[]>([]);
  const [historyOpen, setHistoryOpen] = useState<boolean>(false);

  const SCAN_HISTORY_KEY = 'scanHistory.v1';
  const SIGNAL_TTL_MS = 15 * 60 * 1000;

  // Each scan holds the revealed result for a random 10–20s so the phase
  // progression has room to play out and the experience feels like genuine
  // analysis. These refs track the target + elapsed so we can cancel cleanly.
  const scanTargetMsRef = useRef<number>(0);
  const scanStartedAtRef = useRef<number>(0);
  const scanRevealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hydrate history once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(SCAN_HISTORY_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (!cancelled && Array.isArray(parsed)) {
          setScanHistory(parsed.slice(0, 10));
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);

  const resetScanner = useCallback(() => {
    // Cancel any in-flight reveal so closing the modal mid-scan doesn't
    // pop the result in later.
    if (scanRevealTimerRef.current) {
      clearTimeout(scanRevealTimerRef.current);
      scanRevealTimerRef.current = null;
    }
    setPickedImage(null);
    setInsights(null);
    setScanError(null);
    setScanLoading(false);
    setAnalyzerDataUri(null);
    setScanPhase(-1);
    setSignalAt(null);
  }, []);

  const handlePickChartImage = useCallback(async () => {
    try {
      setScanError(null);
      setInsights(null);
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission needed', 'Please allow access to your media library to upload a chart.');
          return;
        }
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.9,
        // Native analyzer needs raw bytes to build a data URI for the hidden WebView
        base64: Platform.OS !== 'web',
      });
      if (!result.canceled && result.assets && result.assets[0]) {
        setPickedImage(result.assets[0]);
      }
    } catch (e) {
      console.error('Pick chart image error:', e);
      setScanError('Could not pick image. Please try again.');
    }
  }, []);

  // Pushes a freshly computed insight into state + history, fires reveal effects.
  const commitInsights = useCallback(async (result: ChartInsights) => {
    setInsights(result);
    setScanError(null);
    setSignalAt(Date.now());
    setRevealCount(c => c + 1);
    const entry: ScanHistoryEntry = {
      id: `${Date.now()}`,
      at: Date.now(),
      action: result.signal.action,
      strength: result.signal.strength,
      headline: result.signal.headline,
      confidence: result.confidence,
      bullishPercent: result.bullishPercent,
      bearishPercent: result.bearishPercent,
      trend: result.trend,
    };
    setScanHistory(prev => {
      const next = [entry, ...prev].slice(0, 10);
      AsyncStorage.setItem(SCAN_HISTORY_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  // Holds the real analysis result until at least `scanTargetMsRef.current`
  // has elapsed since the scan started. This is what makes each scan feel
  // like 10–20s of work even though the pixel read is effectively instant.
  // Errors bypass the delay and surface immediately.
  const revealWhenReady = useCallback((result: ChartInsights) => {
    const elapsed = Date.now() - scanStartedAtRef.current;
    const remaining = Math.max(0, scanTargetMsRef.current - elapsed);
    if (scanRevealTimerRef.current) {
      clearTimeout(scanRevealTimerRef.current);
    }
    scanRevealTimerRef.current = setTimeout(() => {
      scanRevealTimerRef.current = null;
      commitInsights(result);
      setScanLoading(false);
    }, remaining);
  }, [commitInsights]);

  const handleScanChart = useCallback(async () => {
    if (!pickedImage) return;
    // Pick a random hold time in [10_000, 20_000] ms. Analysis kicks off
    // immediately but the reveal is gated on this window.
    const targetMs = 10000 + Math.floor(Math.random() * 10001);
    scanTargetMsRef.current = targetMs;
    scanStartedAtRef.current = Date.now();
    // Cancel any lingering reveal from a previous scan.
    if (scanRevealTimerRef.current) {
      clearTimeout(scanRevealTimerRef.current);
      scanRevealTimerRef.current = null;
    }
    setScanLoading(true);
    setScanError(null);
    setInsights(null);
    setScanPhase(0);
    try {
      if (Platform.OS === 'web') {
        // Direct canvas analysis — no network call, no AI.
        const result = await analyzeOnWeb(pickedImage.uri);
        revealWhenReady(result);
      } else {
        // Native: feed the image into a hidden WebView analyzer.
        const base64 = pickedImage.base64;
        if (!base64) {
          throw new Error('Could not read image data. Please pick the image again.');
        }
        const mime = pickedImage.mimeType || 'image/jpeg';
        const dataUri = `data:${mime};base64,${base64}`;
        setAnalyzerDataUri(dataUri);
        // scanLoading stays true until onAnalyzerMessage fires → revealWhenReady.
      }
    } catch (e: any) {
      console.error('Scan chart error:', e);
      setScanError(e?.message || 'Failed to analyze chart. Please try again.');
      setScanLoading(false);
      setScanPhase(-1);
    }
  }, [pickedImage, revealWhenReady]);

  const onAnalyzerMessage = useCallback((event: any) => {
    try {
      const payload = JSON.parse(event?.nativeEvent?.data || '{}');
      if (payload && payload.__error) {
        throw new Error(
          payload.__error === 'image_load_failed'
            ? 'Could not decode the image. Try a PNG/JPG screenshot.'
            : `Analyzer failed (${payload.__error})`
        );
      }
      const result = buildInsights(payload);
      revealWhenReady(result);
    } catch (e: any) {
      console.error('Analyzer message error:', e);
      setScanError(e?.message || 'Analyzer failed. Please try again.');
      setScanLoading(false);
      setScanPhase(-1);
    } finally {
      setAnalyzerDataUri(null);
    }
  }, [revealWhenReady]);

  // Advance scan phases while loading — purely visual, caps at 3 so the last
  // phase stays highlighted until the real result arrives. The per-phase
  // interval is derived from the target hold window so all four phases
  // progress across the full 10–20s delay (roughly one phase per third of
  // the window, with a small buffer so "BUILDING SIGNAL" sits briefly before
  // the reveal rather than racing past it).
  useEffect(() => {
    if (!scanLoading) return;
    const target = scanTargetMsRef.current || 2000;
    const interval = Math.max(700, Math.floor((target - 800) / 3));
    const id = setInterval(() => {
      setScanPhase(p => (p < 3 ? p + 1 : p));
    }, interval);
    return () => clearInterval(id);
  }, [scanLoading]);

  // When a result lands, mark all phases as complete briefly, then idle.
  useEffect(() => {
    if (!insights) return;
    setScanPhase(4);
    const id = setTimeout(() => setScanPhase(-1), 700);
    return () => clearTimeout(id);
  }, [insights]);

  // 15-minute countdown ticker. Only runs while we have a live signal.
  useEffect(() => {
    if (!signalAt) return;
    setNowTick(Date.now());
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [signalAt]);

  // ── Tier 1 animations ────────────────────────────────────────────────
  // Pulsing glow on the signal card while a result is visible.
  const signalPulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!insights) {
      signalPulse.stopAnimation();
      signalPulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(signalPulse, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        }),
        Animated.timing(signalPulse, {
          toValue: 0,
          duration: 1400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        }),
      ])
    );
    loop.start();
    return () => {
      loop.stop();
    };
  }, [insights, signalPulse]);

  // Scan-line sweep across the preview while scanning.
  const scanLine = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!scanLoading) {
      scanLine.stopAnimation();
      scanLine.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(scanLine, {
        toValue: 1,
        duration: 1600,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => {
      loop.stop();
    };
  }, [scanLoading, scanLine]);

  // Haptic + soft beep the moment a result reveals.
  useEffect(() => {
    if (!insights) return;
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      return;
    }
    try {
      const w = window as any;
      const Ctor = w.AudioContext || w.webkitAudioContext;
      if (!Ctor) return;
      const ctx = new Ctor();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(1320, now + 0.12);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.18, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.34);
      osc.onended = () => {
        try { ctx.close(); } catch {}
      };
    } catch {}
  }, [insights]);

  // Auth routing is owned by <AuthGate> in app/_layout.tsx. No duplicate
  // check here — that effect had a 300ms race window and a LOGIN_DISABLED
  // bypass that together allowed unauthenticated users onto /license.

  const getEAImageUrl = useCallback((ea: EA | null): string | null => {
    if (!ea || !ea.userData || !ea.userData.owner) return null;
    const raw = (ea.userData.owner.logo || '').toString().trim();
    if (!raw) return null;
    // If already an absolute URL, return as-is
    if (/^https?:\/\//i.test(raw)) return raw;
    // Otherwise, treat as filename and prefix uploads base URL
    const filename = raw.replace(/^\/+/, '');
    const base = 'https://ea-converter.com/admin/uploads';
    return `${base}/${filename}`;
  }, []);

  const primaryEAImage = useMemo(() => getEAImageUrl(primaryEA), [getEAImageUrl, primaryEA]);

  const handleStartNow = async () => {
    try {
      await setIsFirstTime(false);
      // Always route fresh users to /login. The old LOGIN_DISABLED shortcut
      // would silently mark the device as authenticated and skip straight to
      // /license — which is exactly the hole that was letting non-paying
      // users land on the activation form.
      console.log('Start Now pressed, navigating to login...');
      await AsyncStorage.removeItem('emailAuthenticated');
      router.push('/login');
    } catch (error) {
      console.error('Error navigating:', error);
    }
  };

  const handleAddNewEA = () => {
    router.push('/license');
  };

  const handleRemoveActiveBot = async () => {
    if (primaryEA && primaryEA.id) {
      try {
        console.log('Removing EA:', primaryEA.name, primaryEA.id);
        const success = await removeEA(primaryEA.id);
        if (success) {
          console.log('EA removed successfully, navigating to license screen');
          router.push('/license');
        } else {
          console.error('Failed to remove EA');
        }
      } catch (error) {
        console.error('Error removing EA:', error);
      }
    }
  };

  const handleQuotes = () => {
    router.push('/(tabs)/quotes');
  };


  // Show splash screen for first-time users
  if (isFirstTime) {
    return (
      <View style={styles.splashContainer}>
        <View style={styles.splashContent}>
          <View style={styles.logoContainer}>
            <View style={[styles.splashIconRing, {
              borderColor: glowColor + '50',
              backgroundColor: glowColor + '20',
              ...Platform.OS === 'web' ? {
                boxShadow: `0 0 12px 3px ${glowColor}60, 0 0 30px 8px ${glowColor}25`,
              } as any : { shadowColor: glowColor },
            }]}>
              <Image
                testID="splash-app-icon"
                source={require('../../assets/images/icon.png')}
                style={{ width: 100, height: 100, borderRadius: 20 }}
                resizeMode="contain"
              />
            </View>
            <Text style={[styles.splashTitle, { color: glowColor, textShadowColor: glowColor + '80' }]}>EA CONVERTER</Text>
            <Text style={[styles.splashTagline, { color: glowColor + '66' }]}>AUTOMATED TRADING HOST</Text>
          </View>

          <Text style={styles.description}>
            A cutting-edge mobile hosting platform designed to empower traders with a secure, reliable, and user-friendly environment for running their automated trading systems.
          </Text>

          <TouchableOpacity
            style={[styles.splashStartButton, {
              borderColor: glowColor + '80',
              ...Platform.OS === 'web' ? {
                boxShadow: `0 0 6px 1px ${glowColor}80, 0 0 18px 4px ${glowColor}33`,
              } as any : { shadowColor: glowColor },
            }]}
            onPress={handleStartNow}
          >
            <Text style={[styles.startButtonText, { color: glowColor }]}>START NOW</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ─── Shared render helpers ──────────────────────────────────────────
  const webGlow = (color: string, intense?: boolean) => Platform.OS === 'web' ? {
    boxShadow: intense
      ? `0 0 8px 2px ${color}80, 0 0 24px 6px ${color}33`
      : `0 0 6px 1px ${color}80, 0 0 18px 4px ${color}33`,
  } as any : {};

  // mm:ss formatter for the signal countdown.
  const formatCountdown = (ms: number): string => {
    const total = Math.max(0, Math.round(ms / 1000));
    const mm = Math.floor(total / 60);
    const ss = total % 60;
    return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  };

  const formatHistoryTime = (at: number): string => {
    const diff = Date.now() - at;
    if (diff < 60_000) return 'just now';
    if (diff < 60 * 60_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 24 * 60 * 60_000) return `${Math.floor(diff / (60 * 60_000))}h ago`;
    return `${Math.floor(diff / (24 * 60 * 60_000))}d ago`;
  };

  const renderInsights = (data: ChartInsights) => {
    const statRows: Array<{ label: string; value: string }> = [
      { label: 'BIAS', value: data.bias === 'bullish' ? 'Bullish' : data.bias === 'bearish' ? 'Bearish' : 'Balanced' },
      { label: 'STRUCTURE', value: data.trend === 'up' ? 'Uptrend' : data.trend === 'down' ? 'Downtrend' : 'Sideways range' },
      { label: 'VOLATILITY', value: data.volatility.charAt(0).toUpperCase() + data.volatility.slice(1) },
      { label: 'MOMENTUM', value: data.momentum.charAt(0).toUpperCase() + data.momentum.slice(1) },
    ];

    const signalColor =
      data.signal.action === 'BUY' ? '#22C55E'
      : data.signal.action === 'SELL' ? '#EF4444'
      : '#9CA3AF';
    const signalBg =
      data.signal.action === 'BUY' ? 'rgba(34, 197, 94, 0.12)'
      : data.signal.action === 'SELL' ? 'rgba(239, 68, 68, 0.12)'
      : 'rgba(156, 163, 175, 0.10)';
    const SignalIcon =
      data.signal.action === 'BUY' ? TrendingUp
      : data.signal.action === 'SELL' ? TrendingDown
      : Minus;
    const structureLabel =
      data.trend === 'up' ? 'UPTREND'
      : data.trend === 'down' ? 'DOWNTREND'
      : 'SIDEWAYS';

    const strengthBars = data.signal.action === 'WAIT'
      ? 0
      : data.signal.strength === 'strong' ? 3
      : data.signal.strength === 'moderate' ? 2
      : 1;

    // Pulsing glow overlay — animated opacity + slight scale for a breathing feel.
    const pulseOpacity = signalPulse.interpolate({
      inputRange: [0, 1],
      outputRange: [0.35, 0.95],
    });
    const pulseScale = signalPulse.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 1.015],
    });

    return (
      <View style={{ gap: 14 }}>
        {/* ── Large signal hero with pulsing glow ─────────────────── */}
        <Animated.View
          style={[
            styles.scannerSignalBox,
            {
              backgroundColor: signalBg,
              borderColor: signalColor,
              shadowColor: signalColor,
              transform: [{ scale: pulseScale }],
            },
            webGlow(signalColor, true),
          ]}
        >
          {/* Animated glow ring sitting just inside the border */}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.scannerSignalPulse,
              { borderColor: signalColor, opacity: pulseOpacity },
            ]}
          />
          <View style={styles.scannerSignalRow}>
            <SignalIcon color={signalColor} size={44} strokeWidth={2.5} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.scannerSignalHeadline, { color: signalColor, textShadowColor: signalColor + 'B3' }]}>
                {data.signal.headline}
              </Text>
              <Text style={[styles.scannerSignalMeta, { color: signalColor + 'CC' }]}>
                {data.signal.action === 'WAIT'
                  ? `${structureLabel} \u2022 ${data.volatility.toUpperCase()} VOL`
                  : `${data.signal.strength.toUpperCase()} \u2022 ${structureLabel} \u2022 ${data.volatility.toUpperCase()} VOL`}
              </Text>
              {data.signal.action !== 'WAIT' && (
                <View style={styles.scannerStrengthRow}>
                  {[0, 1, 2].map(i => (
                    <View
                      key={i}
                      style={[
                        styles.scannerStrengthBar,
                        {
                          backgroundColor: i < strengthBars ? signalColor : signalColor + '26',
                          shadowColor: signalColor,
                        },
                        i < strengthBars && webGlow(signalColor, true),
                      ]}
                    />
                  ))}
                </View>
              )}
            </View>
            <ConfidenceGauge value={data.confidence} color={signalColor} label="CONF" />
          </View>
          <Typewriter
            text={data.signal.rationale}
            speed={14}
            startDelay={120}
            style={styles.scannerSignalRationale}
          />
          {/* Particle burst bursts each time a new signal lands */}
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <ParticleBurst trigger={revealCount} color={signalColor} count={16} radius={150} />
          </View>
          {/* 15-minute freshness countdown */}
          {signalAt && (
            <View style={styles.scannerCountdownWrap}>
              <View style={styles.scannerCountdownLabelRow}>
                <Clock color={signalColor + 'CC'} size={12} strokeWidth={2.5} />
                <Text style={[styles.scannerCountdownLabel, { color: signalColor + 'CC' }]}>
                  SIGNAL FRESH FOR {formatCountdown(Math.max(0, SIGNAL_TTL_MS - (nowTick - signalAt)))}
                </Text>
              </View>
              <View style={styles.scannerCountdownTrack}>
                <View
                  style={[
                    styles.scannerCountdownFill,
                    {
                      backgroundColor: signalColor,
                      width: `${Math.max(0, Math.min(100, 100 - ((nowTick - signalAt) / SIGNAL_TTL_MS) * 100))}%`,
                    },
                  ]}
                />
              </View>
            </View>
          )}
        </Animated.View>

        {/* ── Supporting diagnostics ───────────────────────────────── */}
        <Text style={styles.scannerResultText}>{data.summary}</Text>

        <View style={styles.scannerMixRow}>
          <View style={[styles.scannerMixBar, { flex: Math.max(1, data.bullishPercent), backgroundColor: '#22C55E' }]} />
          <View style={[styles.scannerMixBar, { flex: Math.max(1, data.bearishPercent), backgroundColor: '#EF4444' }]} />
        </View>
        <View style={styles.scannerMixLabels}>
          <Text style={styles.scannerMixLabel}>{data.bullishPercent}% bullish</Text>
          <Text style={styles.scannerMixLabel}>{data.bearishPercent}% bearish</Text>
        </View>

        <View style={{ gap: 8, marginTop: 4 }}>
          {statRows.map(row => (
            <View key={row.label} style={styles.scannerResultRow}>
              <Text style={[styles.scannerResultLabel, { color: glowColor }]}>{row.label}</Text>
              <Text style={styles.scannerResultText}>{row.value}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.scannerDisclaimer}>
          Descriptive chart diagnostics only — not financial advice or a trade recommendation.
        </Text>
      </View>
    );
  };

  const renderHeroBg = () => (
    backgroundVideo ? (
      <View style={styles.hero}>
        <Video source={{ uri: backgroundVideo }} style={StyleSheet.absoluteFill} resizeMode={ResizeMode.COVER} shouldPlay isLooping isMuted />
        <View style={styles.heroOverlay}><View style={styles.gradientOverlay} /></View>
      </View>
    ) : primaryEAImage && !logoError ? (
      <ImageBackground testID="ea-hero-bg" source={{ uri: primaryEAImage }} style={styles.hero} onError={() => setLogoError(true)} resizeMode="cover">
        <View style={styles.heroOverlay}><View style={styles.gradientOverlay} /></View>
      </ImageBackground>
    ) : (
      <View style={styles.heroFallback}>
        <Image testID="fallback-app-icon" source={require('../../assets/images/icon.png')} style={styles.fallbackIcon} resizeMode="contain" />
        <View style={styles.gradientOverlay} />
      </View>
    )
  );

  const renderAvatar = (size: number = 200) => {
    const ringSize = size + 6;
    return (
      <View style={[styles.heroAvatarRing, {
        width: ringSize, height: ringSize, borderRadius: ringSize / 2,
        borderColor: glowColor + '50', shadowColor: glowColor, backgroundColor: glowColor + '40',
        ...Platform.OS === 'web' ? {
          background: `linear-gradient(135deg, ${glowColor}B3, ${glowColor}33, ${glowColor}B3)`,
          boxShadow: `0 0 8px 2px ${glowColor}80, 0 0 24px 6px ${glowColor}33`,
        } as any : {},
      }]}>
        <View style={[styles.heroAvatarInner, { borderRadius: size / 2 }]}>
          {primaryEAImage && !logoError ? (
            <Image source={{ uri: primaryEAImage }} style={[styles.heroAvatarImage, { borderRadius: size / 2 }]} resizeMode="cover" />
          ) : (
            <View style={styles.heroAvatarFallback}>
              <View style={[styles.heroAvatarEye, { backgroundColor: glowColor }]} />
              <View style={[styles.heroAvatarEye, { backgroundColor: glowColor }]} />
            </View>
          )}
        </View>
      </View>
    );
  };

  const renderTradingPanel = () => (
    <TradingPanel
      variant={panelStyle}
      glowColor={glowColor}
      isBotActive={isBotActive}
      onTrade={() => { try { setBotActive(!isBotActive); } catch (e) { console.error(e); } }}
      onQuotes={handleQuotes}
      onRemove={handleRemoveActiveBot}
    />
  );

  const renderBottomSection = () => (
    <View style={styles.connectedBotsSection}>
      {/* Stats Card */}
      {primaryEA && (
        <View style={[styles.statsCard, { borderColor: glowColor + '30' }, webGlow(glowColor)]}>
          <View style={styles.statItem}>
            <Text style={[styles.statLabel, { color: glowColor + '80' }]}>SYMBOLS</Text>
            <Text style={styles.statValue}>{totalSymbols}</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: glowColor + '30' }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statLabel, { color: glowColor + '80' }]}>STATUS</Text>
            <Text style={[styles.statValueHighlight, { color: isBotActive ? glowColor : glowColor + 'B3' }]}>{isBotActive ? 'ACTIVE' : 'IDLE'}</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: glowColor + '30' }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statLabel, { color: glowColor + '80' }]}>EAs</Text>
            <Text style={styles.statValue}>{eas.length}</Text>
          </View>
        </View>
      )}

      {otherEAs.length > 0 && (
        <>
          <View testID="connected-bots-header" style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>CONNECTED BOTS</Text>
            <View testID="connected-bots-count" style={styles.sectionBadge}>
              <Text style={styles.sectionBadgeText}>{eas.length}</Text>
            </View>
          </View>
          {otherEAs.map((ea, index) => (
            <TouchableOpacity key={`${ea.id}-${index}`} style={styles.botCard}
              onPress={async () => { try { await setActiveEA(ea.id); } catch (e) { console.error(e); } }}>
              <View style={styles.botCardContent}>
                <View style={styles.botIcon}>
                  {getEAImageUrl(ea as unknown as EA) ? (
                    <Image testID={`ea-logo-small-${index}`} source={{ uri: getEAImageUrl(ea as unknown as EA) as string }} style={styles.smallLogo} />
                  ) : (
                    <View style={styles.robotFace}><View style={styles.robotEye} /><View style={styles.robotEye} /></View>
                  )}
                </View>
                <Text style={styles.botName} numberOfLines={2} ellipsizeMode="tail">{ea.name}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </>
      )}

      {primaryEA && (
        <View style={[styles.eaStatusPill, { borderColor: glowColor + '80', shadowColor: glowColor }, webGlow(glowColor)]}>
          <View style={[styles.eaAvatarBox, { borderColor: glowColor + '66' }]}>
            {primaryEAImage && !avatarError ? (
              <Image source={{ uri: primaryEAImage }} style={styles.eaAvatarImage} onError={() => setAvatarError(true)} resizeMode="cover" />
            ) : (
              <View style={styles.eaAvatarFallback}><View style={[styles.eaAvatarEye, { backgroundColor: glowColor }]} /><View style={[styles.eaAvatarEye, { backgroundColor: glowColor }]} /></View>
            )}
          </View>
          <View style={styles.eaStatusTextBlock}>
            <Text style={styles.eaStatusName} numberOfLines={1} ellipsizeMode="tail">{primaryEA.name}</Text>
            <Text style={[styles.eaStatusLabel, { color: glowColor + '8C' }]}>{isBotActive ? 'ACTIVE' : 'IDLE'}</Text>
          </View>
          <View style={[styles.eaStatusDot, { backgroundColor: isBotActive ? glowColor : glowColor + '80' }]} />
        </View>
      )}

      <TouchableOpacity style={[styles.addEAButton, { borderColor: glowColor + '80', shadowColor: glowColor }, webGlow(glowColor)]} onPress={handleAddNewEA}>
        <Plus color={glowColor} size={20} />
        <View style={styles.addEATextContainer}>
          <Text style={[styles.addEATitle, { color: glowColor, textShadowColor: glowColor + '80' }]}>ADD A NEW EA</Text>
          <Text style={[styles.addEASubtitle, { color: glowColor + '8C' }]}>HAVE A VALID LICENSE KEY</Text>
        </View>
      </TouchableOpacity>

      {/* Chart Scanner Card */}
      <ScannerCard
        variant={scannerStyle}
        glowColor={glowColor}
        onPress={() => setSynapseOpen(true)}
      />

      <VoiceCommandPill
        variant={voiceStyle} glowColor={glowColor} isBotActive={isBotActive}
        onToggleBot={() => setBotActive(!isBotActive)} onRemoveEA={handleRemoveActiveBot} onAddEA={handleAddNewEA}
        onSetGlowColor={setGlowColor} onToggleAvatar={setShowHeroAvatar}
        eaName={primaryEA?.name || 'EA'} eaCount={eas.length} activeSymbolCount={totalSymbols}
      />
    </View>
  );

  const renderNoEA = () => (
    <View style={styles.mainEAContainer}>
      <RobotLogo size={200} />
      <View style={styles.botInfoContainer}>
        <Text style={styles.botMainName}>NO EA CONNECTED</Text>
        <Text style={styles.botDescription}>ADD A LICENSE KEY TO GET STARTED</Text>
      </View>
    </View>
  );

  // ─── Layout 1: Current (Hero + Circle + Pill Bar) ─────────────────
  const renderLayout1 = () => (
    <>
      {primaryEA ? (
        <View style={styles.mainEAContainer}>
          {renderHeroBg()}
          <View style={styles.heroContent}>
            <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.8)', '#000000']} style={styles.fadeGradient} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} />
            <View style={styles.topSection}>
              {showHeroAvatar && renderAvatar(200)}
              <View style={styles.titleBlock}>
                <Text testID="ea-title" style={styles.botMainName} numberOfLines={3} ellipsizeMode="tail">{primaryEA.name}</Text>
              </View>
            </View>
            {renderTradingPanel()}
          </View>
        </View>
      ) : renderNoEA()}
      {renderBottomSection()}
    </>
  );

  // ─── Layout 2: Centered Hero + Grid ────────────────────────────────
  const renderLayout2 = () => (
    <>
      {primaryEA ? (
        <View style={styles.mainEAContainer}>
          {renderHeroBg()}
          <View style={[styles.heroContent, { justifyContent: 'center', alignItems: 'center', paddingTop: 0 }]}>
            <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.8)', '#000000']} style={styles.fadeGradient} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} />
            <View style={{ alignItems: 'center', gap: 12, zIndex: 2 }}>
              {renderAvatar(120)}
              <Text testID="ea-title" style={styles.botMainName} numberOfLines={3} ellipsizeMode="tail">{primaryEA.name}</Text>
              <Text style={{ color: glowColor + '80', fontSize: 9, fontWeight: '600', letterSpacing: 2 }}>
                {isBotActive ? 'ACTIVE' : 'IDLE'} {'\u2022'} {totalSymbols} SYMBOLS
              </Text>
            </View>
          </View>
        </View>
      ) : renderNoEA()}
      <View style={{ paddingHorizontal: 20, gap: 8, marginTop: 12 }}>
        {renderTradingPanel()}
      </View>
      {renderBottomSection()}
    </>
  );

  // ─── Layout 3: Dashboard ───────────────────────────────────────────
  const renderLayout3 = () => (
    <>
      {primaryEA ? (
        <>
          {/* Top bar */}
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 }}>
            <View style={[{ width: 44, height: 44, borderRadius: 22, overflow: 'hidden', borderWidth: 2, borderColor: glowColor + '66' }, webGlow(glowColor)]}>
              {primaryEAImage && !logoError ? (
                <Image source={{ uri: primaryEAImage }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
              ) : (
                <View style={{ flex: 1, backgroundColor: '#0a0f1a', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}>
                  <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: glowColor }} />
                  <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: glowColor }} />
                </View>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '800' }}>{primaryEA.name}</Text>
              <Text style={{ color: glowColor + '80', fontSize: 9, fontWeight: '600', letterSpacing: 1 }}>{isBotActive ? 'ACTIVE' : 'IDLE'}</Text>
            </View>
          </View>
          {/* Stats card */}
          <View style={[{ marginHorizontal: 16, borderRadius: 16, borderWidth: 1, borderColor: glowColor + '33', padding: 20, alignItems: 'center', gap: 14, backgroundColor: '#080D1A' }, webGlow(glowColor)]}>
            {renderAvatar(72)}
            <View style={{ flexDirection: 'row', gap: 24 }}>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ color: glowColor + '80', fontSize: 8, fontWeight: '600', letterSpacing: 1 }}>SYMBOLS</Text>
                <Text style={{ color: '#FFF', fontSize: 18, fontWeight: '800' }}>{totalSymbols}</Text>
              </View>
              <View style={{ width: 1, height: 28, backgroundColor: glowColor + '33' }} />
              <View style={{ alignItems: 'center' }}>
                <Text style={{ color: glowColor + '80', fontSize: 8, fontWeight: '600', letterSpacing: 1 }}>STATUS</Text>
                <Text style={{ color: glowColor + 'B3', fontSize: 14, fontWeight: '800' }}>{isBotActive ? 'ACTIVE' : 'IDLE'}</Text>
              </View>
              <View style={{ width: 1, height: 28, backgroundColor: glowColor + '33' }} />
              <View style={{ alignItems: 'center' }}>
                <Text style={{ color: glowColor + '80', fontSize: 8, fontWeight: '600', letterSpacing: 1 }}>EAs</Text>
                <Text style={{ color: '#FFF', fontSize: 18, fontWeight: '800' }}>{eas.length}</Text>
              </View>
            </View>
          </View>
          <View style={{ padding: 16, gap: 8 }}>
            {renderTradingPanel()}
          </View>
        </>
      ) : renderNoEA()}
      {renderBottomSection()}
    </>
  );

  // ─── Layout 4: Cinematic (full bleed + circle buttons) ─────────────
  const renderLayout4 = () => (
    <>
      {primaryEA ? (
        <View style={styles.mainEAContainer}>
          {renderHeroBg()}
          <View style={[styles.heroContent, { height: 500, justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 20 }]}>
            <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.7)', '#000000']} style={[styles.fadeGradient, { height: 250 }]} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} />
            <View style={{ alignItems: 'center', gap: 14, zIndex: 2 }}>
              {renderAvatar(140)}
              <Text testID="ea-title" style={styles.botMainName} numberOfLines={3} ellipsizeMode="tail">{primaryEA.name}</Text>
              {renderTradingPanel()}
            </View>
          </View>
        </View>
      ) : renderNoEA()}
      {renderBottomSection()}
    </>
  );

  // ─── Layout 5: Minimal Card Stack ──────────────────────────────────
  const renderLayout5 = () => (
    <>
      {primaryEA ? (
        <View style={{ padding: 16, gap: 10 }}>
          {/* EA Card */}
          <View style={[{ borderRadius: 16, borderWidth: 1, borderColor: glowColor + '4D', backgroundColor: '#080D1A', padding: 20, gap: 14 }, webGlow(glowColor)]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <View style={[{ width: 50, height: 50, borderRadius: 25, overflow: 'hidden', borderWidth: 2, borderColor: glowColor + '66' }, webGlow(glowColor)]}>
                {primaryEAImage && !logoError ? (
                  <Image source={{ uri: primaryEAImage }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                ) : (
                  <View style={{ flex: 1, backgroundColor: '#0a0f1a', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}>
                    <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: glowColor }} />
                    <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: glowColor }} />
                  </View>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '800' }}>{primaryEA.name}</Text>
                <Text style={{ color: glowColor + '80', fontSize: 9, fontWeight: '600', letterSpacing: 1.5 }}>{isBotActive ? 'ACTIVE' : 'IDLE'} {'\u2022'} EA CONVERTER</Text>
              </View>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: isBotActive ? glowColor : glowColor + '66' }} />
            </View>
            {renderTradingPanel()}
          </View>
        </View>
      ) : renderNoEA()}
      {renderBottomSection()}
    </>
  );

  // ─── Main return ───────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {layoutStyle === '2' ? renderLayout2()
         : layoutStyle === '3' ? renderLayout3()
         : layoutStyle === '4' ? renderLayout4()
         : layoutStyle === '5' ? renderLayout5()
         : renderLayout1()}
      </ScrollView>

      {/* Chart Scanner Upload Modal */}
      <Modal
        visible={synapseOpen}
        animationType="slide"
        onRequestClose={() => { setSynapseOpen(false); resetScanner(); }}
      >
        <SafeAreaView style={styles.synapseModal}>
          <View style={styles.synapseModalHeader}>
            <Text style={[styles.synapseModalTitle, { color: glowColor }]}>CHART SCANNER</Text>
            <View style={styles.synapseHeaderActions}>
              <TouchableOpacity
                onPress={() => setHistoryOpen(v => !v)}
                activeOpacity={0.7}
                style={[styles.synapseHeaderBtn, { borderColor: glowColor + '66' }, webGlow(glowColor)]}
              >
                <History color={glowColor} size={16} />
                {scanHistory.length > 0 && (
                  <View style={[styles.synapseHeaderBadge, { backgroundColor: glowColor }]}>
                    <Text style={styles.synapseHeaderBadgeText}>{scanHistory.length}</Text>
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { setSynapseOpen(false); resetScanner(); }}
                activeOpacity={0.7}
                style={styles.synapseCloseBtn}
              >
                <X color={glowColor} size={22} />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scannerBody}>
            <Text style={styles.scannerIntro}>
              Drop a chart screenshot. We read the candles on-device and call a BUY, SELL or WAIT with a live confidence score — no servers, no AI.
            </Text>

            {/* ── Scan history drawer ───────────────────────────────── */}
            {historyOpen && (
              <View style={[styles.scannerHistoryBox, { borderColor: glowColor + '66' }, webGlow(glowColor)]}>
                <View style={styles.scannerHistoryHeader}>
                  <Text style={[styles.scannerHistoryTitle, { color: glowColor }]}>RECENT SCANS</Text>
                  {scanHistory.length > 0 && (
                    <TouchableOpacity
                      onPress={() => {
                        setScanHistory([]);
                        AsyncStorage.removeItem(SCAN_HISTORY_KEY).catch(() => {});
                      }}
                      activeOpacity={0.7}
                      style={styles.scannerHistoryClearBtn}
                    >
                      <Trash2 color={glowColor + 'CC'} size={14} />
                      <Text style={[styles.scannerHistoryClearText, { color: glowColor + 'CC' }]}>CLEAR</Text>
                    </TouchableOpacity>
                  )}
                </View>
                {scanHistory.length === 0 ? (
                  <Text style={styles.scannerHistoryEmpty}>No scans yet — upload a chart to get started.</Text>
                ) : (
                  <View style={{ gap: 8 }}>
                    {scanHistory.map(h => {
                      const c =
                        h.action === 'BUY' ? '#22C55E'
                        : h.action === 'SELL' ? '#EF4444'
                        : '#9CA3AF';
                      return (
                        <View
                          key={h.id}
                          style={[
                            styles.scannerHistoryRow,
                            { borderColor: c + '66', backgroundColor: c + '14' },
                          ]}
                        >
                          <View style={[styles.scannerHistoryBadge, { backgroundColor: c + '26', borderColor: c }]}>
                            <Text style={[styles.scannerHistoryBadgeText, { color: c }]}>{h.action}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.scannerHistoryHeadline}>
                              {h.strength.toUpperCase()} {'\u2022'} {h.trend === 'up' ? 'UPTREND' : h.trend === 'down' ? 'DOWNTREND' : 'SIDEWAYS'}
                            </Text>
                            <Text style={styles.scannerHistoryMeta}>
                              {h.confidence}% conf {'\u2022'} {h.bullishPercent}/{h.bearishPercent} {'\u2022'} {formatHistoryTime(h.at)}
                            </Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            )}

            {/* Upload / Preview area */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handlePickChartImage}
              style={[styles.scannerDropzone, { borderColor: glowColor + '66' }, webGlow(glowColor)]}
            >
              {pickedImage ? (
                <Image source={{ uri: pickedImage.uri }} style={styles.scannerPreview} resizeMode="contain" />
              ) : (
                <View style={styles.scannerDropzoneInner}>
                  <Upload color={glowColor} size={36} />
                  <Text style={[styles.scannerDropzoneTitle, { color: glowColor }]}>TAP TO UPLOAD CHART</Text>
                  <Text style={styles.scannerDropzoneSub}>PNG or JPG screenshot of your chart</Text>
                </View>
              )}

              {/* Detected horizontal levels — absolute-positioned dashed lines over the preview */}
              {pickedImage && insights && insights.levels && insights.levels.length > 0 && (
                <View pointerEvents="none" style={StyleSheet.absoluteFill}>
                  {insights.levels.map((ly, li) => {
                    const signalColor =
                      insights.signal.action === 'BUY' ? '#22C55E'
                      : insights.signal.action === 'SELL' ? '#EF4444'
                      : '#9CA3AF';
                    return (
                      <View
                        key={`lvl-${li}`}
                        style={[
                          styles.scannerLevelLine,
                          {
                            top: `${Math.max(2, Math.min(98, ly * 100))}%`,
                            borderColor: signalColor,
                            shadowColor: signalColor,
                          },
                          webGlow(signalColor, true),
                        ]}
                      >
                        <View style={[styles.scannerLevelTag, { backgroundColor: signalColor + 'E6' }]}>
                          <Text style={styles.scannerLevelTagText}>L{li + 1}</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}

              {/* Scan-line sweep during analysis */}
              {scanLoading && pickedImage && (
                <>
                  <View pointerEvents="none" style={styles.scannerScanVeil} />
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      styles.scannerScanLine,
                      {
                        backgroundColor: glowColor,
                        shadowColor: glowColor,
                        transform: [
                          {
                            translateY: scanLine.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0, 260],
                            }),
                          },
                        ],
                      },
                      webGlow(glowColor, true),
                    ]}
                  />
                </>
              )}
            </TouchableOpacity>

            {pickedImage && !scanLoading && (
              <View style={styles.scannerActionsRow}>
                <TouchableOpacity
                  onPress={handlePickChartImage}
                  activeOpacity={0.8}
                  style={[styles.scannerSecondaryBtn, { borderColor: glowColor + '66' }]}
                >
                  <RefreshCw color={glowColor} size={16} />
                  <Text style={[styles.scannerSecondaryText, { color: glowColor }]}>CHANGE IMAGE</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleScanChart}
                  activeOpacity={0.8}
                  style={[styles.scannerPrimaryBtn, { borderColor: glowColor, shadowColor: glowColor }, webGlow(glowColor)]}
                >
                  <Scan color={glowColor} size={18} />
                  <Text style={[styles.scannerPrimaryText, { color: glowColor }]}>SCAN CHART</Text>
                </TouchableOpacity>
              </View>
            )}

            {pickedImage && scanLoading && (
              <View style={[styles.scannerPhasesBox, { borderColor: glowColor + '66' }, webGlow(glowColor)]}>
                <View style={styles.scannerPhasesHeader}>
                  <ActivityIndicator color={glowColor} size="small" />
                  <Text style={[styles.scannerPhasesTitle, { color: glowColor }]}>ANALYZING CHART</Text>
                </View>
                <ScanPhases phase={scanPhase} color={glowColor} />
              </View>
            )}

            {scanError && (
              <View style={[styles.scannerErrorBox, { borderColor: '#FF4D4D' }]}>
                <Text style={styles.scannerErrorText}>{scanError}</Text>
              </View>
            )}

            {insights && (
              <View style={[styles.scannerResultBox, { borderColor: glowColor + '66' }, webGlow(glowColor)]}>
                <Text style={[styles.scannerResultTitle, { color: glowColor }]}>CHART DIAGNOSTICS</Text>
                {renderInsights(insights)}
              </View>
            )}
          </ScrollView>

          {/* Hidden native-only analyzer: renders the image on a canvas and posts back pixel stats. */}
          {Platform.OS !== 'web' && analyzerDataUri && (
            <WebView
              source={{ html: buildAnalyzerHtml(analyzerDataUri) }}
              onMessage={onAnalyzerMessage}
              javaScriptEnabled
              domStorageEnabled
              originWhitelist={['*']}
              style={styles.scannerHiddenWebView}
              pointerEvents="none"
            />
          )}
        </SafeAreaView>
      </Modal>
      <TradeChatWidget glowColor={glowColor} />
    </SafeAreaView>
  );
}

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  splashContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  splashIconRing: {
    width: 120,
    height: 120,
    borderRadius: 30,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 10,
  },
  splashTitle: {
    fontSize: 26,
    fontWeight: '800',
    marginTop: 20,
    letterSpacing: 3,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  splashTagline: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 2,
    marginTop: 6,
  },
  description: {
    fontSize: 14,
    color: '#CCCCCC',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 60,
    paddingHorizontal: 20,
  },
  splashStartButton: {
    backgroundColor: '#080D1A',
    paddingHorizontal: 60,
    paddingVertical: 16,
    borderRadius: 28,
    minWidth: 200,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  startButtonText: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 1.5,
  },
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  content: {
    flex: 1,
  },
  mainEAContainer: {
    alignItems: 'center',
    paddingTop: 0,
    paddingBottom: 20,
    position: 'relative',
    overflow: 'hidden',
  },
  hero: {
    width: '100%',
    height: 500,
    overflow: 'hidden',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  gradientOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    ...(Platform.OS === 'web' && {
      backgroundImage: 'linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.7) 100%)',
    }),
  },
  fadeGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 200,
    width: width,
    zIndex: -1,
  },
  heroFallback: {
    width: '100%',
    height: 500,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  fallbackIcon: {
    width: 160,
    height: 160,
    borderRadius: 32,
  },
  botInfoContainer: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 40,
  },
  heroContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 450,
    justifyContent: 'space-between',
    paddingTop: 20,
    paddingBottom: 30,
    zIndex: 10,
  },
  topSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },

  titleBlock: {
    alignItems: 'center',
    marginTop: 14,
  },
  botMainName: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 4,
    fontFamily: Platform.select({
      ios: 'System',
      android: 'Roboto',
      web: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }),
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
    textAlign: 'center',
    flexWrap: 'wrap',
  },
  botDescription: {
    color: '#CCCCCC',
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 0.5,
  },

  connectedCountBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    marginBottom: 12,
  },
  connectedCountText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  // bottomActions styles removed — replaced by ActionPillBar component
  connectedBotsSection: {
    paddingHorizontal: 20,
    paddingTop: 24,
    position: 'relative',
    marginTop: 0,
    backgroundColor: '#000000',
    overflow: 'hidden',
    zIndex: 10,
  },
  statsCard: {
    backgroundColor: '#080D1A',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 16,
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
    gap: 4,
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 1.2,
  },
  statValue: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
  },
  statValueHighlight: {
    fontSize: 15,
    fontWeight: '800',
  },
  statDivider: {
    width: 1,
    height: 30,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.5,
  },
  sectionBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    minWidth: 28,
    alignItems: 'center',
  },
  sectionBadgeText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  botCard: {
    backgroundColor: '#080D1A',
    borderRadius: 16,
    marginBottom: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  botCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  botIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#0C1425',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  smallLogo: {
    width: 36,
    height: 36,
    borderRadius: 10,
  },
  robotFace: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  robotEye: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#00BFFF',
    marginHorizontal: 2,
  },
  botName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    flexWrap: 'wrap',
    numberOfLines: 2,
    textAlign: 'center',
  },
  heroAvatarRing: {
    width: 206,
    height: 206,
    borderRadius: 103,
    padding: 3,
    borderWidth: 0,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 10,
    backgroundColor: 'transparent',
  },
  heroAvatarInner: {
    width: '100%',
    height: '100%',
    borderRadius: 100,
    overflow: 'hidden',
    backgroundColor: '#080D1A',
  },
  heroAvatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 100,
  },
  heroAvatarFallback: {
    width: '100%',
    height: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  heroAvatarEye: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  eaStatusPill: {
    backgroundColor: '#080D1A',
    borderRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    paddingHorizontal: 20,
    marginBottom: 12,
    borderWidth: 1,
    gap: 12,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  eaAvatarBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#0C1425',
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eaAvatarImage: {
    width: 36,
    height: 36,
    borderRadius: 10,
  },
  eaAvatarFallback: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  eaAvatarEye: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  eaStatusTextBlock: {
    flex: 1,
    flexDirection: 'column',
    gap: 2,
    minWidth: 0,
  },
  eaStatusName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  eaStatusLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.5,
  },
  eaStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  addEAButton: {
    backgroundColor: '#080D1A',
    borderRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    paddingHorizontal: 24,
    marginBottom: 20,
    borderWidth: 1,
    gap: 14,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  addEATextContainer: {
    flexDirection: 'column' as const,
    gap: 2,
  },
  addEATitle: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.2,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
  addEASubtitle: {
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 0.8,
  },

  // Chart Scanner modal
  synapseModal: {
    flex: 1,
    backgroundColor: '#000000',
  },
  synapseModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  synapseModalTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  synapseCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  synapseHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  synapseHeaderBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  synapseHeaderBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  synapseHeaderBadgeText: {
    color: '#000',
    fontSize: 9,
    fontWeight: '900',
  },

  // Chart Scanner Upload
  scannerBody: {
    padding: 20,
    gap: 16,
    paddingBottom: 40,
  },
  scannerIntro: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  scannerDropzone: {
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    backgroundColor: '#080D1A',
    minHeight: 260,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  scannerDropzoneInner: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 24,
  },
  scannerDropzoneTitle: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1.4,
  },
  scannerDropzoneSub: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  scannerPreview: {
    width: '100%',
    height: 260,
    backgroundColor: '#000',
  },
  scannerActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  scannerSecondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 28,
    borderWidth: 1,
    backgroundColor: '#080D1A',
  },
  scannerSecondaryText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  scannerPrimaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 28,
    borderWidth: 1,
    backgroundColor: '#080D1A',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  scannerPrimaryText: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  scannerErrorBox: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: 'rgba(255, 77, 77, 0.08)',
  },
  scannerErrorText: {
    color: '#FF6B6B',
    fontSize: 13,
    fontWeight: '500',
  },
  scannerResultBox: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: '#080D1A',
    gap: 12,
  },
  scannerResultTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.6,
  },
  scannerResultRow: {
    gap: 2,
  },
  scannerResultLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  scannerResultText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  scannerSignalBox: {
    position: 'relative',
    borderRadius: 20,
    borderWidth: 2,
    paddingVertical: 20,
    paddingHorizontal: 20,
    gap: 14,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 12,
  },
  scannerSignalPulse: {
    position: 'absolute',
    top: 4,
    left: 4,
    right: 4,
    bottom: 4,
    borderRadius: 16,
    borderWidth: 1,
  },
  scannerSignalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  scannerSignalHeadline: {
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 2,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  scannerSignalMeta: {
    marginTop: 3,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
  },
  scannerStrengthRow: {
    flexDirection: 'row',
    gap: 5,
    marginTop: 10,
  },
  scannerStrengthBar: {
    width: 22,
    height: 6,
    borderRadius: 3,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 4,
  },
  scannerSignalRationale: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 19,
  },
  scannerScanVeil: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  scannerScanLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 2,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 8,
  },
  scannerMixRow: {
    flexDirection: 'row',
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  scannerMixBar: {
    height: '100%',
  },
  scannerMixLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  scannerMixLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  scannerDisclaimer: {
    marginTop: 6,
    color: 'rgba(255,255,255,0.45)',
    fontSize: 10,
    fontWeight: '500',
    fontStyle: 'italic',
    lineHeight: 14,
  },
  scannerLevelLine: {
    position: 'absolute',
    left: 10,
    right: 10,
    height: 0,
    borderTopWidth: 1,
    borderStyle: 'dashed',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 8,
  },
  scannerLevelTag: {
    position: 'absolute',
    left: 0,
    top: -8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  scannerLevelTagText: {
    color: '#000',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  scannerPhasesBox: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    backgroundColor: '#080D1A',
    gap: 6,
  },
  scannerPhasesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 2,
  },
  scannerPhasesTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.6,
  },
  scannerCountdownWrap: {
    marginTop: 6,
    gap: 6,
  },
  scannerCountdownLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  scannerCountdownLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  scannerCountdownTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  scannerCountdownFill: {
    height: '100%',
    borderRadius: 2,
  },
  scannerHistoryBox: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    backgroundColor: '#080D1A',
    gap: 12,
  },
  scannerHistoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  scannerHistoryTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.6,
  },
  scannerHistoryClearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  scannerHistoryClearText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  scannerHistoryEmpty: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 8,
  },
  scannerHistoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  scannerHistoryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  scannerHistoryBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  scannerHistoryHeadline: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  scannerHistoryMeta: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  scannerHiddenWebView: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
    left: -9999,
    top: -9999,
    backgroundColor: 'transparent',
  },

});