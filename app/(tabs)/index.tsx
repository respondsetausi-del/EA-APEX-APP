import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, ImageBackground, Platform, Dimensions, SafeAreaView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Video, ResizeMode } from 'expo-av';
import { Plus } from 'lucide-react-native';
import { router } from 'expo-router';
import { RobotLogo } from '@/components/robot-logo';
import { TradingPanel } from '@/components/trading-panel';
import { apexAdminUploadsBase } from '@/constants/apex-backend';
import { APEX_LOGO } from '@/constants/brand-assets';
import { neonWebShadow } from '@/constants/colors';

import { useApp } from '@/providers/app-provider';
import type { EA } from '@/providers/app-provider';

export default function HomeScreen() {
  const { eas, isFirstTime, setIsFirstTime, removeEA, isBotActive, setBotActive, setActiveEA, glowColor, setGlowColor, showHeroAvatar, setShowHeroAvatar, backgroundVideo, heroHidden, setEmailAuthenticated } = useApp();

  // Safely get the primary EA (first one in the list)
  const primaryEA = Array.isArray(eas) && eas.length > 0 ? eas[0] : null;
  const otherEAs = Array.isArray(eas) ? eas.slice(1) : [];

  console.log('HomeScreen render - EAs count:', eas?.length || 0, 'Primary EA:', primaryEA?.name || 'none');

  const [logoError, setLogoError] = useState<boolean>(false);
  const [avatarError, setAvatarError] = useState<boolean>(false);

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
        <Image testID="fallback-app-icon" source={APEX_LOGO} style={styles.fallbackIcon} resizeMode="contain" />
        <View style={styles.gradientOverlay} />
      </View>
    )
  );

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
            <Image source={{ uri: primaryEAImage }} style={[styles.heroAvatarImage, { borderRadius: size / 2 }]} resizeMode="cover" />
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

  const renderBottomSection = () => (
    <View style={styles.connectedBotsSection}>
      {otherEAs.length > 0 && (
        <>
          <View testID="connected-bots-header" style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>CONNECTED BOTS</Text>
            <View testID="connected-bots-count" style={styles.sectionBadge}>
              <Text style={styles.sectionBadgeText}>{eas.length}</Text>
            </View>
          </View>
          {otherEAs.map((ea, index) => (
            <TouchableOpacity
              key={`${ea.id}-${index}`}
              style={[
                styles.botCard,
                Platform.OS === 'web' && { borderWidth: 0 },
                { borderColor: glowColor + '2E', shadowColor: glowColor },
                webGlow(glowColor),
                webCard,
              ]}
              onPress={async () => { try { await setActiveEA(ea.id); } catch (e) { console.error(e); } }}>
              <View style={styles.botCardContent}>
                <View style={styles.botIcon}>
                  {getEAImageUrl(ea as unknown as EA) ? (
                    <Image testID={`ea-logo-small-${index}`} source={{ uri: getEAImageUrl(ea as unknown as EA) as string }} style={styles.smallLogo} />
                  ) : (
                    <Image testID={`ea-logo-placeholder-${index}`} source={APEX_LOGO} style={styles.smallLogo} resizeMode="contain" />
                  )}
                </View>
                <Text style={styles.botName} numberOfLines={2} ellipsizeMode="tail">{ea.name}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </>
      )}

      {primaryEA && (
        <View style={[
          styles.eaStatusPill,
          Platform.OS === 'web' && { borderWidth: 0 },
          { borderColor: glowColor + '33', shadowColor: glowColor },
          webGlow(glowColor),
          webCard,
        ]}>
          <View style={[styles.eaAvatarBox, { borderColor: glowColor + '3D' }]}>
            {primaryEAImage && !avatarError ? (
              <Image source={{ uri: primaryEAImage }} style={styles.eaAvatarImage} onError={() => setAvatarError(true)} resizeMode="cover" />
            ) : (
              <Image source={APEX_LOGO} style={styles.eaAvatarImage} resizeMode="contain" />
            )}
          </View>
          <View style={styles.eaStatusTextBlock}>
            <Text style={styles.eaStatusName} numberOfLines={1} ellipsizeMode="tail">{primaryEA.name}</Text>
            {isBotActive && <Text style={[styles.eaStatusLabel, { color: glowColor + '8C' }]}>ACTIVE</Text>}
          </View>
          <View style={[styles.eaStatusDot, { backgroundColor: isBotActive ? glowColor : glowColor + '80' }]} />
        </View>
      )}

      <TouchableOpacity
        style={[
          styles.addEAButton,
          Platform.OS === 'web' && { borderWidth: 0 },
          { borderColor: glowColor + '33', shadowColor: glowColor },
          webGlow(glowColor),
          webCard,
        ]}
        onPress={handleAddNewEA}
      >
        <Plus color={glowColor} size={20} />
        <View style={styles.addEATextContainer}>
          <Text style={[styles.addEATitle, { color: glowColor, textShadowColor: glowColor + '80' }]}>ADD A NEW EA</Text>
          <Text style={[styles.addEASubtitle, { color: glowColor + '8C' }]}>HAVE A VALID LICENSE KEY</Text>
        </View>
      </TouchableOpacity>
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
            <LinearGradient colors={['rgba(10,10,12,0)', 'rgba(10,10,12,0.85)', '#0a0a0c']} style={styles.fadeGradient} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} />
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
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {renderLayout1()}
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