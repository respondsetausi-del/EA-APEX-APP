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
  Alert,
  ScrollView,
} from 'react-native';
import { X, Home, TrendingUp, Settings, Info, Film, Trash2 } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';

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

const VIDEO_PRESETS = [
  { id: 'v0', label: 'Cyber', file: '/videos/video.mp4' },
  { id: 'v1', label: 'Neon', file: '/videos/video1.mp4' },
  { id: 'v2', label: 'Matrix', file: '/videos/video2.mp4' },
  { id: 'v3', label: 'Pulse', file: '/videos/video3.mp4' },
  { id: 'v4', label: 'Storm', file: '/videos/video4.mp4' },
  { id: 'v5', label: 'Drift', file: '/videos/video5.mp4' },
  { id: 'v6', label: 'Grid', file: '/videos/video6.mp4' },
  { id: 'v7', label: 'Wave', file: '/videos/video7.mp4' },
  { id: 'v8', label: 'Flux', file: '/videos/video8.mp4' },
  { id: 'v9', label: 'Void', file: '/videos/video9.mp4' },
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
  backgroundVideo?: string | null;
  onSetBackgroundVideo?: (uri: string | null) => void;
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
  backgroundVideo = null,
  onSetBackgroundVideo,
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

  const hasVideo = !!backgroundVideo;

  const handlePickVideo = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please allow access to your media library to upload a video.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['videos'],
        allowsEditing: false,
        quality: 0.8,
      });
      if (!result.canceled && result.assets && result.assets[0]) {
        onSetBackgroundVideo?.(result.assets[0].uri);
      }
    } catch (e) {
      console.error('Video pick error:', e);
      Alert.alert('Error', 'Failed to pick video.');
    }
  };

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

        <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>

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
          style={[styles.toggleRow, hasVideo && styles.toggleRowDisabled]}
          activeOpacity={hasVideo ? 1 : 0.7}
          onPress={() => {
            if (!hasVideo) onToggleHeroAvatar?.(!showHeroAvatar);
          }}
        >
          <View style={{ flexDirection: 'column' }}>
            <Text style={[styles.toggleLabel, hasVideo && { color: 'rgba(255,255,255,0.25)' }]}>Avatar Circle</Text>
            {hasVideo && <Text style={{ color: 'rgba(255,255,255,0.2)', fontSize: 10, marginTop: 2 }}>Required with video</Text>}
          </View>
          <View style={[
            styles.toggleTrack,
            { backgroundColor: showHeroAvatar ? (hasVideo ? glowColor + '60' : glowColor) : 'rgba(255,255,255,0.15)' },
          ]}>
            <View style={[
              styles.toggleThumb,
              { transform: [{ translateX: showHeroAvatar ? 14 : 0 }] },
            ]} />
          </View>
        </TouchableOpacity>

        {/* Divider */}
        <View style={[styles.divider, { backgroundColor: glowColor + '30' }]} />

        {/* Background Video */}
        <Text style={styles.sectionLabel}>BACKGROUND VIDEO</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.presetVideoRow}>
          {VIDEO_PRESETS.map((preset) => {
            const isActive = backgroundVideo === preset.file;
            return (
              <TouchableOpacity
                key={preset.id}
                activeOpacity={0.7}
                onPress={() => onSetBackgroundVideo?.(isActive ? null : preset.file)}
                style={[
                  styles.presetVideoTile,
                  { borderColor: isActive ? glowColor : 'rgba(255,255,255,0.15)' },
                  isActive && Platform.OS === 'web' ? {
                    boxShadow: `0 0 6px 1px ${glowColor}60`,
                  } as any : {},
                ]}
              >
                <Film color={isActive ? glowColor : 'rgba(255,255,255,0.4)'} size={16} />
                <Text style={[styles.presetVideoLabel, isActive && { color: glowColor }]}>{preset.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <TouchableOpacity
          style={[styles.videoButton, { borderColor: glowColor + '50', marginTop: 10 }]}
          activeOpacity={0.7}
          onPress={handlePickVideo}
        >
          <Film color={glowColor} size={18} />
          <Text style={[styles.videoButtonText, { color: glowColor }]}>
            {hasVideo && !VIDEO_PRESETS.some(p => p.file === backgroundVideo) ? 'Change Custom' : 'Upload Custom'}
          </Text>
        </TouchableOpacity>

        {hasVideo && (
          <TouchableOpacity
            style={[styles.videoButton, { borderColor: '#FF4444' + '50', marginTop: 8 }]}
            activeOpacity={0.7}
            onPress={() => onSetBackgroundVideo?.(null)}
          >
            <Trash2 color="#FF4444" size={18} />
            <Text style={[styles.videoButtonText, { color: '#FF4444' }]}>Remove Video</Text>
          </TouchableOpacity>
        )}
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
  toggleRowDisabled: {
    opacity: 0.5,
  },
  videoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  videoButtonText: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  presetVideoRow: {
    flexDirection: 'row',
    maxHeight: 58,
    marginBottom: 4,
  },
  presetVideoTile: {
    width: 56,
    height: 50,
    borderRadius: 10,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    gap: 4,
  },
  presetVideoLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});

export default SidebarDrawer;
