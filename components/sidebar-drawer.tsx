import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Platform,
  TouchableWithoutFeedback,
} from 'react-native';
import { X, Home, TrendingUp, Settings, Info } from 'lucide-react-native';

const SCREEN_WIDTH = Dimensions.get('window').width;
const DRAWER_WIDTH = Math.min(SCREEN_WIDTH * 0.75, 280);

const GLOW_PRESETS = [
  '#00BFFF', // cyan (default)
  '#A855F7', // purple
  '#00FF88', // green
  '#FF3366', // pink
  '#FF6B00', // orange
  '#FFD700', // gold
  '#FF00FF', // magenta
];

interface SidebarDrawerProps {
  visible: boolean;
  onClose: () => void;
  glowColor: string;
  onColorChange: (color: string) => void;
  onNavigate: (route: string) => void;
  currentRoute?: string;
  showHeroAvatar?: boolean;
  onToggleHeroAvatar?: (show: boolean) => void;
}

export function SidebarDrawer({
  visible,
  onClose,
  glowColor,
  onColorChange,
  onNavigate,
  currentRoute = 'home',
  showHeroAvatar = true,
  onToggleHeroAvatar,
}: SidebarDrawerProps) {
  const slideAnim = useRef(new Animated.Value(DRAWER_WIDTH)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(overlayAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: DRAWER_WIDTH,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(overlayAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  if (!visible) return null;

  const navItems = [
    { key: 'home', label: 'Home', icon: Home, route: '/(tabs)' },
    { key: 'quotes', label: 'Quotes', icon: TrendingUp, route: '/(tabs)/quotes' },
    { key: 'metatrader', label: 'MetaTrader', icon: Settings, route: '/(tabs)/metatrader' },
  ];

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Overlay */}
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={[styles.overlay, { opacity: overlayAnim }]} />
      </TouchableWithoutFeedback>

      {/* Drawer */}
      <Animated.View
        style={[
          styles.drawer,
          {
            width: DRAWER_WIDTH,
            transform: [{ translateX: slideAnim }],
            borderLeftColor: glowColor + '50',
            ...Platform.select({
              web: {
                boxShadow: `-4px 0 20px 2px ${glowColor}33`,
              } as any,
            }),
          },
        ]}
      >
        {/* Close button */}
        <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
          <X color={glowColor} size={22} />
        </TouchableOpacity>

        {/* Nav links */}
        <View style={styles.navSection}>
          {navItems.map((item) => {
            const isActive = currentRoute === item.key;
            const Icon = item.icon;
            return (
              <TouchableOpacity
                key={item.key}
                style={[
                  styles.navItem,
                  isActive && { backgroundColor: glowColor + '15' },
                ]}
                activeOpacity={0.7}
                onPress={() => {
                  onNavigate(item.route);
                  onClose();
                }}
              >
                <Icon color={isActive ? glowColor : 'rgba(255,255,255,0.5)'} size={20} />
                <Text
                  style={[
                    styles.navLabel,
                    isActive && {
                      color: glowColor,
                      textShadowColor: glowColor + '80',
                      textShadowOffset: { width: 0, height: 0 },
                      textShadowRadius: 6,
                    },
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Info link */}
        <TouchableOpacity style={styles.navItem} activeOpacity={0.7} onPress={onClose}>
          <Info color="rgba(255,255,255,0.5)" size={20} />
          <Text style={styles.navLabel}>About</Text>
        </TouchableOpacity>

        {/* Divider */}
        <View style={[styles.divider, { backgroundColor: glowColor + '30' }]} />

        {/* Color Picker */}
        <Text style={styles.sectionLabel}>GLOW COLOR</Text>
        <View style={styles.colorRow}>
          {GLOW_PRESETS.map((color) => {
            const isSelected = glowColor === color;
            return (
              <TouchableOpacity
                key={color}
                activeOpacity={0.7}
                onPress={() => onColorChange(color)}
                style={[
                  styles.colorCircleOuter,
                  isSelected && {
                    borderColor: color,
                    ...Platform.select({
                      web: {
                        boxShadow: `0 0 8px 2px ${color}60`,
                      } as any,
                    }),
                  },
                ]}
              >
                <View style={[styles.colorCircle, { backgroundColor: color }]} />
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Divider */}
        <View style={[styles.divider, { backgroundColor: glowColor + '30' }]} />

        {/* Avatar Toggle */}
        <TouchableOpacity
          style={styles.toggleRow}
          activeOpacity={0.7}
          onPress={() => onToggleHeroAvatar?.(!showHeroAvatar)}
        >
          <Text style={styles.toggleLabel}>Avatar Circle</Text>
          <View style={[
            styles.toggleTrack,
            { backgroundColor: showHeroAvatar ? glowColor : 'rgba(255,255,255,0.15)' },
          ]}>
            <View style={[
              styles.toggleThumb,
              { transform: [{ translateX: showHeroAvatar ? 14 : 0 }] },
            ]} />
          </View>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  drawer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#080D1A',
    borderLeftWidth: 1,
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  navSection: {
    marginTop: 12,
    gap: 4,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  navLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.5,
    fontFamily: Platform.select({
      ios: 'System',
      android: 'Roboto',
      web: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    }),
  },
  divider: {
    height: 1,
    marginVertical: 20,
    marginHorizontal: 4,
  },
  sectionLabel: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.5,
    marginBottom: 14,
    marginLeft: 4,
  },
  colorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingHorizontal: 4,
  },
  colorCircleOuter: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  toggleLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.5,
    fontFamily: Platform.select({
      ios: 'System',
      android: 'Roboto',
      web: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    }),
  },
  toggleTrack: {
    width: 36,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleThumb: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FFFFFF',
  },
});

export default SidebarDrawer;
