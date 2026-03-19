import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, ImageBackground, Platform, Dimensions, SafeAreaView, Modal } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Video, ResizeMode } from 'expo-av';
import { Plus, TrendingUp, X } from 'lucide-react-native';
import { router } from 'expo-router';
import { WebView } from 'react-native-webview';
import { RobotLogo } from '@/components/robot-logo';
import { TradingPanel } from '@/components/trading-panel';
import { VoiceCommandPill } from '@/components/voice-command';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useApp } from '@/providers/app-provider';
import { LOGIN_DISABLED } from '@/constants/features';
import type { EA } from '@/providers/app-provider';

export default function HomeScreen() {
  const { eas, isFirstTime, setIsFirstTime, removeEA, isBotActive, setBotActive, setActiveEA, glowColor, setGlowColor, showHeroAvatar, setShowHeroAvatar, backgroundVideo, activeSymbols, panelStyle, voiceStyle, layoutStyle } = useApp();

  // Safely get the primary EA (first one in the list)
  const primaryEA = Array.isArray(eas) && eas.length > 0 ? eas[0] : null;
  const otherEAs = Array.isArray(eas) ? eas.slice(1) : []; // All EAs except the first one

  console.log('HomeScreen render - EAs count:', eas?.length || 0, 'Primary EA:', primaryEA?.name || 'none');

  const [logoError, setLogoError] = useState<boolean>(false);
  const [avatarError, setAvatarError] = useState<boolean>(false);
  const [synapseOpen, setSynapseOpen] = useState<boolean>(false);
  const [hasCheckedAuth, setHasCheckedAuth] = useState<boolean>(false);

  // Check if user has completed email authentication
  useEffect(() => {
    // Only run the check once on mount, not on every EA length change
    if (hasCheckedAuth) return;

    const checkAuthenticationStatus = async () => {
      try {
        // Wait for initial state to load
        await new Promise(resolve => setTimeout(resolve, 300));

        // If not first time but no EAs, check if email auth was completed
        if (!isFirstTime && eas.length === 0) {
          const emailAuthenticated = await AsyncStorage.getItem('emailAuthenticated');

          // If email authentication was never completed
          if (!emailAuthenticated || emailAuthenticated !== 'true') {
            if (LOGIN_DISABLED) {
              // Bypass: skip login, go straight to license (DB/auth saved for later)
              console.log('Login disabled - bypassing to license...');
              await AsyncStorage.setItem('emailAuthenticated', 'true');
              router.replace('/license');
            } else {
              console.log('Email authentication not completed, redirecting to login...');
              await setIsFirstTime(true);
              router.replace('/login');
            }
          } else {
            // Email authentication was completed, but no license added yet - go to license page
            console.log('Email authenticated but no EA added, redirecting to license...');
            router.replace('/license');
          }
        }

        setHasCheckedAuth(true);
      } catch (error) {
        console.error('Error checking authentication status:', error);
        setHasCheckedAuth(true);
      }
    };

    checkAuthenticationStatus();
  }, [isFirstTime, eas.length, hasCheckedAuth]);

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
      if (LOGIN_DISABLED) {
        console.log('Start Now pressed - login disabled, navigating to license...');
        await AsyncStorage.setItem('emailAuthenticated', 'true');
        router.push('/license');
      } else {
        console.log('Start Now pressed, navigating to login...');
        await AsyncStorage.removeItem('emailAuthenticated');
        router.push('/login');
      }
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
            <Text style={styles.statValue}>{activeSymbols?.length || 0}</Text>
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

      {/* FXSynapse AI Card */}
      <TouchableOpacity
        style={[styles.synapseCard, { borderColor: glowColor + '50' }, webGlow(glowColor)]}
        activeOpacity={0.7}
        onPress={() => setSynapseOpen(true)}
      >
        <View style={[styles.synapseIconBox, { backgroundColor: glowColor + '15', borderColor: glowColor + '40' }]}>
          <TrendingUp color={glowColor} size={20} />
        </View>
        <View style={styles.synapseTextBlock}>
          <Text style={[styles.synapseTitle, { color: glowColor, textShadowColor: glowColor + '80' }]}>FXSYNAPSE AI</Text>
          <Text style={[styles.synapseSubtitle, { color: glowColor + '8C' }]}>AI-POWERED CHART ANALYSIS</Text>
        </View>
      </TouchableOpacity>

      <VoiceCommandPill
        variant={voiceStyle} glowColor={glowColor} isBotActive={isBotActive}
        onToggleBot={() => setBotActive(!isBotActive)} onRemoveEA={handleRemoveActiveBot} onAddEA={handleAddNewEA}
        onSetGlowColor={setGlowColor} onToggleAvatar={setShowHeroAvatar}
        eaName={primaryEA?.name || 'EA'} eaCount={eas.length} activeSymbolCount={activeSymbols?.length || 0}
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
                {isBotActive ? 'ACTIVE' : 'IDLE'} {'\u2022'} {activeSymbols?.length || 0} SYMBOLS
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
                <Text style={{ color: '#FFF', fontSize: 18, fontWeight: '800' }}>{activeSymbols?.length || 0}</Text>
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

      {/* FXSynapse AI WebView Modal */}
      <Modal visible={synapseOpen} animationType="slide" onRequestClose={() => setSynapseOpen(false)}>
        <SafeAreaView style={styles.synapseModal}>
          <View style={styles.synapseModalHeader}>
            <Text style={[styles.synapseModalTitle, { color: glowColor }]}>FXSYNAPSE AI</Text>
            <TouchableOpacity onPress={() => setSynapseOpen(false)} activeOpacity={0.7} style={styles.synapseCloseBtn}>
              <X color={glowColor} size={22} />
            </TouchableOpacity>
          </View>
          {Platform.OS === 'web' ? (
            <View style={{ flex: 1 }}>
              {React.createElement('iframe', {
                src: 'https://fxsynapse-ai.vercel.app/partner/converter',
                style: { width: '100%', height: '100%', border: 'none', backgroundColor: '#000' },
              })}
            </View>
          ) : (
            <WebView
              source={{ uri: 'https://fxsynapse-ai.vercel.app/partner/converter' }}
              style={{ flex: 1, backgroundColor: '#000' }}
              startInLoadingState={true}
            />
          )}
        </SafeAreaView>
      </Modal>
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

  // FXSynapse card
  synapseCard: {
    backgroundColor: '#080D1A',
    borderRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    paddingHorizontal: 20,
    marginBottom: 12,
    borderWidth: 1,
    gap: 14,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  synapseIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  synapseTextBlock: {
    flex: 1,
    flexDirection: 'column',
    gap: 2,
  },
  synapseTitle: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.2,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
  synapseSubtitle: {
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 0.8,
  },

  // FXSynapse modal
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

});