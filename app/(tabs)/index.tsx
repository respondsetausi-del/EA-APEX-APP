import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, Platform, Dimensions, SafeAreaView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Plus, Info, Crown, Play, ArrowLeftRight, History, Check } from 'lucide-react-native';
import { router } from 'expo-router';
import { RobotLogo } from '@/components/robot-logo';
import { TradingPanel } from '@/components/trading-panel';
import { apexAdminUploadsBase } from '@/constants/apex-backend';
import { APEX_LOGO } from '@/constants/brand-assets';
import { neonWebShadow } from '@/constants/colors';

import { useApp } from '@/providers/app-provider';
import type { EA } from '@/providers/app-provider';

export default function HomeScreen() {
  const { user, eas, isFirstTime, setIsFirstTime, removeEA, isBotActive, setBotActive, setActiveEA, glowColor, heroHidden, setEmailAuthenticated } = useApp();

  const username = useMemo(() => {
    const raw = (user?.email || '').toString().trim();
    if (!raw) return 'trader';
    const handle = raw.includes('@') ? raw.split('@')[0] : raw;
    return handle.toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 24) || 'trader';
  }, [user?.email]);

  // Safely get the primary EA (first one in the list)
  const primaryEA = Array.isArray(eas) && eas.length > 0 ? eas[0] : null;
  const otherEAs = Array.isArray(eas) ? eas.slice(1) : [];

  console.log('HomeScreen render - EAs count:', eas?.length || 0, 'Primary EA:', primaryEA?.name || 'none');

  const [logoError, setLogoError] = useState<boolean>(false);

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
    return `${apexAdminUploadsBase}/${filename}`;
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
      // Use the provider setter so in-memory context and AsyncStorage
      // stay in lock-step. Raw AsyncStorage.removeItem left the context
      // flag stuck at true, producing a split-brain where storage said
      // "logged out" but AuthGate still saw "logged in" until the next
      // hydration — which on the NEXT cold start would then kick the
      // user to /login because storage wins at hydration time.
      await setEmailAuthenticated(false);
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
              borderColor: glowColor + '33',
              backgroundColor: glowColor + '14',
              ...Platform.OS === 'web' ? {
                borderWidth: 0,
                boxShadow: neonWebShadow(glowColor, 'medium'),
              } as any : { shadowColor: glowColor },
            }]}>
              <Image
                testID="splash-app-icon"
                source={APEX_LOGO}
                style={{ width: 100, height: 100, borderRadius: 20 }}
                resizeMode="contain"
              />
            </View>
            <Text style={[styles.splashTitle, { color: glowColor, textShadowColor: glowColor + '80' }]}>EA APEX</Text>
            <Text style={[styles.splashTagline, { color: glowColor + '66' }]}>AUTOMATED TRADING HOST</Text>
          </View>

          <Text style={styles.description}>
            A cutting-edge mobile hosting platform designed to empower traders with a secure, reliable, and user-friendly environment for running their automated trading systems.
          </Text>

          <TouchableOpacity
            style={[styles.splashStartButton, {
              borderColor: glowColor + '38',
              ...Platform.OS === 'web' ? {
                borderWidth: 0,
                boxShadow: neonWebShadow(glowColor, 'soft'),
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
    boxShadow: intense ? neonWebShadow(color, 'strong') : neonWebShadow(color, 'medium'),
  } as any : {};

  const webCard = Platform.OS === 'web' ? {
    background: 'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)',
    backgroundColor: '#000000',
    backdropFilter: 'blur(40px) saturate(1.4)',
    WebkitBackdropFilter: 'blur(40px) saturate(1.4)',
    borderTop: '1px solid rgba(255,255,255,0.08)',
    borderLeft: '1px solid rgba(255,255,255,0.04)',
    borderRight: '1px solid rgba(255,255,255,0.03)',
    borderBottom: '1px solid rgba(255,255,255,0.02)',
  } as any : {};


  const renderAvatar = (size: number = 200) => {
    const ringSize = size + 6;
    return (
      <View style={[styles.heroAvatarRing, {
        width: ringSize, height: ringSize, borderRadius: ringSize / 2,
        borderColor: glowColor + '30', shadowColor: glowColor, backgroundColor: glowColor + '22',
        ...Platform.OS === 'web' ? {
          borderWidth: 0,
          background: `linear-gradient(135deg, ${glowColor}99, ${glowColor}24, ${glowColor}99)`,
          boxShadow: neonWebShadow(glowColor, 'strong'),
        } as any : {},
      }]}>
        <View style={[styles.heroAvatarInner, { borderRadius: size / 2 }]}>
          {primaryEAImage && !logoError ? (
            <Image source={{ uri: primaryEAImage }} style={[styles.heroAvatarImage, { borderRadius: size / 2 }]} resizeMode="cover" onError={() => setLogoError(true)} />
          ) : (
            <Image source={APEX_LOGO} style={[styles.heroAvatarImage, { borderRadius: size / 2 }]} resizeMode="contain" />
          )}
        </View>
      </View>
    );
  };

  const renderTradingPanel = () => (
    <TradingPanel
      variant="A"
      glowColor={glowColor}
      isBotActive={isBotActive}
      onTrade={() => { try { setBotActive(!isBotActive); } catch (e) { console.error(e); } }}
      onQuotes={handleQuotes}
      onRemove={handleRemoveActiveBot}
    />
  );

  // ─── Card layout (matches mobile mockup: stacked hero card + actions + robots) ─────
  const eaDescription = primaryEA?.description
    || (primaryEA?.userData as any)?.ea_notification
    || 'Automated trading bot powered by EA APEX.';
  const nameParts = (primaryEA?.name || '').trim().split(/\s+/);
  const nameAccent = nameParts[0] || '';
  const nameRest = nameParts.slice(1).join(' ');

  const renderHeroCard = () => (
    <View
      style={[
        styles.heroCard,
        Platform.OS === 'web' && { borderWidth: 0 },
        { borderColor: glowColor + '40', shadowColor: glowColor },
        webGlow(glowColor),
        webCard,
      ]}
    >
      <View style={styles.heroCardHeader}>
        <Text style={styles.heroCardUsername} numberOfLines={1} ellipsizeMode="tail">{username}</Text>
        <View style={styles.proBadge}>
          <Crown size={11} color="#1a1300" fill="#1a1300" />
          <Text style={styles.proBadgeText}>Pro</Text>
        </View>
        <View style={styles.heroCardHeaderSpacer} />
        <TouchableOpacity
          style={styles.heroInfoBtn}
          activeOpacity={0.7}
          onPress={() => router.push('/license')}
        >
          <Info size={16} color="rgba(255,255,255,0.7)" />
        </TouchableOpacity>
      </View>

      {primaryEA ? (
        <>
          <View style={styles.heroCardAvatarWrap}>{renderAvatar(170)}</View>

          <Text testID="ea-title" style={styles.heroCardTitle} numberOfLines={2} ellipsizeMode="tail">
            <Text style={[styles.heroCardTitleAccent, { color: glowColor, textShadowColor: glowColor + 'AA' }]}>{nameAccent}</Text>
            {nameRest ? ` ${nameRest}` : ''}
          </Text>

          <Text style={styles.heroCardDescription} numberOfLines={3}>{eaDescription}</Text>

          <TouchableOpacity
            style={[
              styles.statusPill,
              { borderColor: 'rgba(255,255,255,0.18)' },
            ]}
            activeOpacity={0.85}
            onPress={() => { try { setBotActive(!isBotActive); } catch (e) { console.error(e); } }}
          >
            <Text style={styles.statusPillText}>{isBotActive ? 'ACTIVE' : 'STANDBY'}</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <View style={styles.heroCardAvatarWrap}>
            <View style={[styles.heroAvatarRing, {
              width: 176, height: 176, borderRadius: 88,
              borderColor: glowColor + '30', shadowColor: glowColor, backgroundColor: glowColor + '22',
              ...Platform.OS === 'web' ? {
                borderWidth: 0,
                background: `linear-gradient(135deg, ${glowColor}99, ${glowColor}24, ${glowColor}99)`,
                boxShadow: neonWebShadow(glowColor, 'strong'),
              } as any : {},
            }]}>
              <View style={[styles.heroAvatarInner, { borderRadius: 85 }]}>
                <Image source={APEX_LOGO} style={[styles.heroAvatarImage, { borderRadius: 85 }]} resizeMode="contain" />
              </View>
            </View>
          </View>
          <Text style={styles.heroCardTitle} numberOfLines={1}>
            <Text style={[styles.heroCardTitleAccent, { color: glowColor, textShadowColor: glowColor + 'AA' }]}>No</Text>
            {' EA Connected'}
          </Text>
          <Text style={styles.heroCardDescription} numberOfLines={2}>
            Add a license key to activate your first trading bot.
          </Text>
          <View style={[styles.statusPill, { borderColor: 'rgba(255,255,255,0.18)' }]}>
            <Text style={styles.statusPillText}>OFFLINE</Text>
          </View>
        </>
      )}
    </View>
  );

  const renderActionRow = () => (
    <View style={styles.actionRow}>
      <TouchableOpacity
        style={[
          styles.actionBtn,
          Platform.OS === 'web' && { borderWidth: 0 },
          { borderColor: glowColor + '33', shadowColor: glowColor },
          webGlow(glowColor),
          webCard,
        ]}
        activeOpacity={0.85}
        onPress={handleQuotes}
      >
        <ArrowLeftRight size={18} color="#FFFFFF" strokeWidth={2} />
        <Text style={styles.actionBtnText}>Pairs</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.actionBtnPrimary,
          Platform.OS === 'web' && { borderWidth: 0 },
          { borderColor: glowColor + '66', shadowColor: glowColor },
          webGlow(glowColor, true),
          webCard,
        ]}
        activeOpacity={0.85}
        onPress={() => { try { setBotActive(!isBotActive); } catch (e) { console.error(e); } }}
      >
        <Play size={18} color="#FFFFFF" fill="#FFFFFF" strokeWidth={2} />
        <Text style={styles.actionBtnText}>Run</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.actionBtn,
          Platform.OS === 'web' && { borderWidth: 0 },
          { borderColor: glowColor + '33', shadowColor: glowColor },
          webGlow(glowColor),
          webCard,
        ]}
        activeOpacity={0.85}
        onPress={handleQuotes}
      >
        <History size={18} color="#FFFFFF" strokeWidth={2} />
        <Text style={styles.actionBtnText}>Logs</Text>
      </TouchableOpacity>
    </View>
  );

  const renderPoweredByPill = () => (
    <View style={[
      styles.poweredByPill,
      { borderColor: 'rgba(255,255,255,0.08)' },
    ]}>
      <Text style={styles.poweredByText}>
        Powered by <Text style={[styles.poweredByBrand, { color: glowColor, textShadowColor: glowColor + '80' }]}>EA APEX</Text>
      </Text>
    </View>
  );

  const renderRobotRow = (ea: EA, idx: number, isActive: boolean) => {
    const img = getEAImageUrl(ea);
    return (
      <TouchableOpacity
        key={`${ea.id}-${idx}`}
        style={[
          styles.robotRow,
          Platform.OS === 'web' && { borderWidth: 0 },
          { borderColor: glowColor + (isActive ? '55' : '2E'), shadowColor: glowColor },
          webGlow(glowColor),
          webCard,
        ]}
        activeOpacity={0.85}
        onPress={async () => { try { await setActiveEA(ea.id); } catch (e) { console.error(e); } }}
      >
        <View style={[styles.robotRowIcon, { borderColor: glowColor + '40' }]}>
          {img ? (
            <Image testID={`robot-row-logo-${idx}`} source={{ uri: img }} style={styles.robotRowIconImg} resizeMode="cover" />
          ) : (
            <Image source={APEX_LOGO} style={styles.robotRowIconImg} resizeMode="contain" />
          )}
        </View>
        <View style={styles.robotRowTextBlock}>
          <Text style={styles.robotRowName} numberOfLines={1} ellipsizeMode="tail">{ea.name}</Text>
          <Text style={[styles.robotRowStatus, { color: glowColor + 'CC', textShadowColor: glowColor + '66' }]}>
            {isActive && isBotActive ? 'Active now' : isActive ? 'Standby' : 'Idle'}
          </Text>
        </View>
        <View style={[
          styles.robotRowCheck,
          { borderColor: glowColor + 'AA', shadowColor: glowColor },
          Platform.OS === 'web' ? { boxShadow: neonWebShadow(glowColor, 'soft') } as any : {},
        ]}>
          <Check size={14} color={glowColor} strokeWidth={3} />
        </View>
      </TouchableOpacity>
    );
  };

  const renderRobotsSection = () => (
    <View style={styles.robotsSection}>
      <Text style={styles.robotsLabel}>ROBOTS</Text>
      {primaryEA && renderRobotRow(primaryEA, 0, true)}
      {otherEAs.map((ea, i) => renderRobotRow(ea, i + 1, false))}

      <TouchableOpacity
        style={[
          styles.addBotBtn,
          { borderColor: glowColor + '66', shadowColor: glowColor },
          Platform.OS === 'web' ? { boxShadow: neonWebShadow(glowColor, 'soft') } as any : {},
        ]}
        activeOpacity={0.85}
        onPress={handleAddNewEA}
      >
        <View style={[
          styles.addBotIconBox,
          { borderColor: glowColor + '88' },
          Platform.OS === 'web' ? { boxShadow: neonWebShadow(glowColor, 'soft') } as any : {},
        ]}>
          <Plus size={22} color={glowColor} strokeWidth={2.5} />
        </View>
        <Text style={[styles.addBotText, { color: glowColor, textShadowColor: glowColor + '80' }]}>Add Trading Bot</Text>
      </TouchableOpacity>
    </View>
  );

  const renderCardLayout = () => (
    <>
      {renderHeroCard()}
      {renderActionRow()}
      {renderPoweredByPill()}
      {renderRobotsSection()}
    </>
  );

  // ─── Minimal home (hero hidden) ────────────────────────────────────
  // Triggered from the sidebar's "Hide Hero Image" toggle. The tall 9:16
  // hero disappears so the robot backdrop stands out; the trading panel
  // stays pinned at the bottom with the "Powered by EA Mobile Connect"
  // strip above it, dissolving upward into the robot and downward into
  // the panel.
  const renderMinimalHome = () => (
    <View style={styles.minimalRoot}>
      {/* Robot backdrop — fills the whole screen behind everything. */}
      <View style={styles.minimalBackdrop}>
        <RobotLogo size={Math.min(width * 0.9, 440)} />
      </View>

      {/* Fade from the robot down into the brand strip. */}
      <LinearGradient
        colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.95)']}
        style={styles.minimalFadeTop}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        pointerEvents="none"
      />

      {/* Bottom stack: brand line → trading panel. */}
      <View style={styles.minimalBottom} pointerEvents="box-none">
        <View
          style={[
            styles.minimalBrand,
            Platform.OS === 'web' && { borderWidth: 0 },
            { borderColor: glowColor + '2E', shadowColor: glowColor },
            webGlow(glowColor),
            webCard,
          ]}
        >
          <Text style={[styles.minimalBrandText, { color: glowColor, textShadowColor: glowColor + '80' }]}>
            POWERED BY EA APEX
          </Text>
          <View style={[styles.minimalBrandLine, { backgroundColor: glowColor + '55' }]} />
        </View>

        {/* Fade from the brand line down into the trading panel. */}
        <LinearGradient
          colors={['rgba(10,10,12,0)', 'rgba(10,10,12,0.75)', '#0a0a0c']}
          style={styles.minimalFadeBottom}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          pointerEvents="none"
        />

        <View style={styles.minimalPanelWrap}>
          {primaryEA ? renderTradingPanel() : (
            <TouchableOpacity
              style={[
                styles.addEAButton,
                Platform.OS === 'web' && { borderWidth: 0 },
                { borderColor: glowColor + '3D', shadowColor: glowColor },
                webGlow(glowColor, true),
                webCard,
              ]}
              onPress={handleAddNewEA}
              activeOpacity={0.85}
            >
              <Plus color={glowColor} size={20} />
              <View style={styles.addEATextContainer}>
                <Text style={[styles.addEATitle, { color: glowColor, textShadowColor: glowColor + '80' }]}>ADD A NEW EA</Text>
                <Text style={[styles.addEASubtitle, { color: glowColor + '8C' }]}>HAVE A VALID LICENSE KEY</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );

  // ─── Main return ───────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      {heroHidden ? renderMinimalHome() : (
        <ScrollView style={styles.content} contentContainerStyle={styles.cardScroll} showsVerticalScrollIndicator={false}>
          {renderCardLayout()}
        </ScrollView>
      )}

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
    borderWidth: 1,
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
    backgroundColor: '#000000',
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
  cardScroll: {
    paddingTop: Platform.OS === 'ios' ? 56 : 24,
    paddingHorizontal: 16,
    paddingBottom: 40,
  },

  // ── Hero card (mockup match) ──────────────────────────────────────
  heroCard: {
    borderRadius: 24,
    backgroundColor: '#0a0a0c',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 22,
    alignItems: 'center',
    borderWidth: 1,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 18,
    elevation: 12,
    overflow: 'hidden',
  },
  heroCardHeader: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  heroCardUsername: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.2,
    maxWidth: '55%',
  },
  proBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: '#F5A623',
  },
  proBadgeText: {
    color: '#1a1300',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  heroCardHeaderSpacer: {
    flex: 1,
  },
  heroInfoBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  heroCardAvatarWrap: {
    marginTop: 4,
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCardTitle: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 0.5,
    textAlign: 'center',
    marginBottom: 10,
    paddingHorizontal: 8,
  },
  heroCardTitleAccent: {
    fontWeight: '800',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  heroCardDescription: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 19,
    textAlign: 'center',
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  statusPill: {
    paddingHorizontal: 26,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  statusPillText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
  },

  // ── Action row (Pairs / Run / Logs) ───────────────────────────────
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 54,
    borderRadius: 18,
    borderWidth: 1,
    backgroundColor: '#0a0a0c',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  actionBtnPrimary: {
    flex: 1.05,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 54,
    borderRadius: 18,
    borderWidth: 1.5,
    backgroundColor: '#0a0a0c',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 14,
    elevation: 10,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.4,
  },

  // ── Powered by pill ───────────────────────────────────────────────
  poweredByPill: {
    alignSelf: 'center',
    paddingHorizontal: 18,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.03)',
    marginTop: 20,
    marginBottom: 8,
  },
  poweredByText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  poweredByBrand: {
    fontWeight: '800',
    letterSpacing: 0.5,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },

  // ── Robots section ────────────────────────────────────────────────
  robotsSection: {
    marginTop: 18,
    gap: 10,
  },
  robotsLabel: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2.5,
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  robotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 18,
    borderWidth: 1,
    backgroundColor: '#0a0a0c',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 8,
  },
  robotRowIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#050505',
  },
  robotRowIconImg: {
    width: '100%',
    height: '100%',
  },
  robotRowTextBlock: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  robotRowName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  robotRowStatus: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
  robotRowCheck: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 4,
  },
  addBotBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 18,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    backgroundColor: 'rgba(255,255,255,0.015)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 6,
  },
  addBotIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.02)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 4,
  },
  addBotText: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.4,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
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
    borderRadius: 18,
    marginBottom: 10,
    overflow: 'hidden',
    borderWidth: 0,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
    backgroundColor: '#000000',
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
    backgroundColor: '#050505',
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
    backgroundColor: '#000000',
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
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    height: 68,
    paddingHorizontal: 18,
    marginBottom: 10,
    borderWidth: 0,
    gap: 14,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
    backgroundColor: '#000000',
  },
  eaAvatarBox: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eaAvatarImage: {
    width: 42,
    height: 42,
    borderRadius: 13,
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
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    height: 68,
    paddingHorizontal: 18,
    marginBottom: 20,
    borderWidth: 0,
    gap: 14,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
    backgroundColor: '#000000',
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
  scannerSymbolPicker: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 8,
    backgroundColor: 'rgba(8, 13, 26, 0.6)',
  },
  scannerSymbolLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.6,
  },
  scannerSymbolInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    backgroundColor: '#05090F',
  },
  scannerSymbolChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  scannerSymbolChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderRadius: 14,
  },
  scannerSymbolChipText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  scannerDropzone: {
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    backgroundColor: '#000000',
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
  scannerPlaceholderLogo: {
    width: 96,
    height: 96,
    marginBottom: 4,
    opacity: 0.95,
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
    backgroundColor: '#000000',
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
    borderWidth: 1.5,
    backgroundColor: '#000000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.65,
    shadowRadius: 14,
    elevation: 10,
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
    borderWidth: 1.5,
    backgroundColor: '#000000',
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
    backgroundColor: '#000000',
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
    backgroundColor: '#000000',
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
  minimalRoot: {
    flex: 1,
    backgroundColor: '#000000',
  },
  minimalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 200,
  },
  minimalFadeTop: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 220,
    height: 120,
  },
  minimalBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingBottom: Platform.OS === 'ios' ? 28 : 18,
  },
  minimalBrand: {
    alignSelf: 'center',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 18,
    borderWidth: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
    marginBottom: 6,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 6,
  },
  minimalBrandText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2.2,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  minimalBrandLine: {
    marginTop: 6,
    width: 60,
    height: 2,
    borderRadius: 2,
  },
  minimalFadeBottom: {
    height: 24,
    marginHorizontal: 20,
    marginBottom: -4,
  },
  minimalPanelWrap: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  scannerTradeCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 14,
    borderWidth: 1.5,
    marginTop: 4,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 6,
  },
  scannerTradeCtaText: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.6,
  },
  scannerAutoPlan: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 8,
    marginBottom: 4,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  scannerAutoPlanTitle: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.4,
    marginBottom: 6,
  },
  scannerAutoPlanRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
  },
  scannerAutoPlanKey: {
    fontSize: 12,
    color: '#AAAAAA',
    letterSpacing: 0.5,
  },
  scannerAutoPlanVal: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  tradePromptBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  tradePromptCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#000000',
    borderWidth: 1,
    borderRadius: 18,
    padding: 18,
    gap: 10,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 12,
  },
  tradePromptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tradePromptTitle: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 2,
  },
  tradePromptCloseBtn: {
    padding: 4,
  },
  tradePromptDirection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  tradePromptDirectionText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  tradePromptLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.4,
    marginTop: 4,
  },
  tradePromptInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    fontSize: 14,
    fontWeight: '600',
    backgroundColor: '#05090F',
  },
  tradePromptChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tradePromptChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderRadius: 14,
  },
  tradePromptChipText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  tradePromptRow: {
    flexDirection: 'row',
    gap: 10,
  },
  tradePromptPlatformRow: {
    flexDirection: 'row',
    gap: 10,
  },
  tradePromptPlatformBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tradePromptPlatformText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  tradePromptError: {
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    backgroundColor: 'rgba(255, 77, 77, 0.08)',
  },
  tradePromptErrorText: {
    color: '#FF6B6B',
    fontSize: 12,
    fontWeight: '600',
  },
  tradePromptActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  tradePromptSecondaryBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
  },
  tradePromptSecondaryText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  tradePromptPrimaryBtn: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 1.5,
    backgroundColor: '#000000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  tradePromptPrimaryText: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.4,
  },

});