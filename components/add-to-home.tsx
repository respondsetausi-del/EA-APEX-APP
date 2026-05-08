import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'pwa-add-to-home-dismissed';
const { width: SCREEN_W } = Dimensions.get('window');

function isIOSSafari(): boolean {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|OPiOS|EdgiOS|Chrome/.test(ua);
  return isIOS && isSafari;
}

function isStandalone(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  return (
    (window.navigator as any).standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches
  );
}

export function AddToHomePrompt() {
  const [visible, setVisible] = useState(false);
  const slideAnim = useRef(new Animated.Value(300)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (!isIOSSafari()) return;
    if (isStandalone()) return;

    AsyncStorage.getItem(STORAGE_KEY).then((val) => {
      if (val === 'true') return;
      setVisible(true);
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    });
  }, []);

  const dismiss = () => {
    AsyncStorage.setItem(STORAGE_KEY, 'true');
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 300,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => setVisible(false));
  };

  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Backdrop */}
      <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={dismiss} />
      </Animated.View>

      {/* Bottom sheet */}
      <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
        {/* Notch */}
        <View style={styles.notch} />

        <Text style={styles.title}>Install EA Converter</Text>
        <Text style={styles.subtitle}>
          Add this app to your home screen for the best experience — full screen, instant launch, no browser bar.
        </Text>

        {/* Steps */}
        <View style={styles.stepsContainer}>
          <View style={styles.step}>
            <View style={styles.stepBadge}>
              <Text style={styles.stepNumber}>1</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepText}>
                Tap the <Text style={styles.shareIcon}>⎙</Text> Share button at the bottom of Safari
              </Text>
            </View>
          </View>

          <View style={styles.stepDivider} />

          <View style={styles.step}>
            <View style={styles.stepBadge}>
              <Text style={styles.stepNumber}>2</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepText}>
                Scroll down and tap <Text style={styles.bold}>"Add to Home Screen"</Text>
              </Text>
            </View>
          </View>

          <View style={styles.stepDivider} />

          <View style={styles.step}>
            <View style={styles.stepBadge}>
              <Text style={styles.stepNumber}>3</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepText}>
                Tap <Text style={styles.bold}>"Add"</Text> in the top right corner
              </Text>
            </View>
          </View>
        </View>

        {/* Arrow pointing down to Safari share button */}
        <View style={styles.arrowContainer}>
          <Text style={styles.arrowDown}>↓</Text>
        </View>

        {/* Dismiss */}
        <TouchableOpacity style={styles.dismissBtn} onPress={dismiss} activeOpacity={0.7}>
          <Text style={styles.dismissText}>Maybe Later</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 40,
  },
  notch: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#444',
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  stepsContainer: {
    backgroundColor: '#111',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  stepBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#DC2626',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  stepNumber: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  stepContent: {
    flex: 1,
  },
  stepText: {
    color: '#DDD',
    fontSize: 15,
    lineHeight: 21,
  },
  shareIcon: {
    fontSize: 17,
    color: '#4A9EFF',
  },
  bold: {
    fontWeight: '700',
    color: '#FFF',
  },
  stepDivider: {
    height: 1,
    backgroundColor: '#222',
    marginLeft: 42,
    marginVertical: 4,
  },
  arrowContainer: {
    alignItems: 'center',
    marginBottom: 12,
  },
  arrowDown: {
    fontSize: 28,
    color: '#4A9EFF',
  },
  dismissBtn: {
    alignSelf: 'center',
    paddingVertical: 12,
    paddingHorizontal: 32,
  },
  dismissText: {
    color: '#666',
    fontSize: 15,
    fontWeight: '500',
  },
});
