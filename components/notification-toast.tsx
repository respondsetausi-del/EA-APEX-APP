import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Platform } from 'react-native';
import { neonWebShadow } from '@/constants/colors';

interface NotificationToastProps {
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  visible: boolean;
  onDismiss: () => void;
  glowColor?: string;
  duration?: number;
}

const TYPE_COLORS = {
  info: null,
  success: '#00FF88',
  warning: '#FFD700',
  error: '#FF4444',
};

export function NotificationToast({
  message,
  type = 'info',
  visible,
  onDismiss,
  glowColor = '#00BFFF',
  duration = 3000,
}: NotificationToastProps) {
  const slideAnim = useRef(new Animated.Value(-80)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  const color = TYPE_COLORS[type] || glowColor;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();

      const timer = setTimeout(() => {
        Animated.parallel([
          Animated.timing(slideAnim, { toValue: -80, duration: 250, useNativeDriver: true }),
          Animated.timing(opacityAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
        ]).start(() => onDismiss());
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [visible, duration]);

  if (!visible) return null;

  return (
    <Animated.View style={[
      styles.toast,
      { borderColor: color + '45', transform: [{ translateY: slideAnim }], opacity: opacityAnim },
      Platform.OS === 'web' ? { borderWidth: 0, boxShadow: `${neonWebShadow(color, 'medium')}, 0 6px 18px rgba(0,0,0,0.55)` } as any : { shadowColor: color },
    ]}>
      <View style={[styles.indicator, { backgroundColor: color }]} />
      <Text style={[styles.toastText, { color: '#FFFFFF' }]} numberOfLines={2}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 54 : 16,
    left: 16,
    right: 16,
    backgroundColor: '#000000',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    zIndex: 100,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 12,
  },
  indicator: {
    width: 4,
    height: 24,
    borderRadius: 2,
    marginRight: 12,
  },
  toastText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
    lineHeight: 18,
  },
});

export default NotificationToast;
