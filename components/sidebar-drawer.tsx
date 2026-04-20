import React, { useEffect, useRef, useState } from 'react';
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
import { X, Home, TrendingUp, Settings, Info, Film, Trash2, Mic, ChevronDown, ChevronUp, Palette, Sliders, Video as VideoIcon, Scan, Plus, EyeOff } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { VOICE_HELP } from './voice-command';
import { THEME_PRESETS } from '@/constants/themes';

const SCREEN_WIDTH = Dimensions.get('window').width;
const DRAWER_WIDTH = Math.min(SCREEN_WIDTH * 0.75, 280);

const GLOW_PRESETS = [
  // Core neon palette
  '#00BFFF', // cyan (default)
  '#A855F7', // purple
  '#00FF88', // green
  '#FF3366', // pink
  '#FF6B00', // orange
  '#FFD700', // gold
  '#FF00FF', // magenta
  // Restored + new entries — richer coverage for different themes
  '#EF4444', // red
  '#3B82F6', // electric blue
  '#14B8A6', // teal
  '#84CC16', // lime
  '#00FFCC', // aqua
  '#EC4899', // hot pink
  '#FFFFFF', // white
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
  panelStyle?: string;
  onPanelStyleChange?: (style: string) => void;
  voiceStyle?: string;
  onVoiceStyleChange?: (style: string) => void;
  layoutStyle?: string;
  onLayoutStyleChange?: (style: string) => void;
  scannerStyle?: string;
  onScannerStyleChange?: (style: string) => void;
  heroHidden?: boolean;
  onToggleHeroHidden?: (hidden: boolean) => void;
  onOpenScanner?: () => void;
  onAddNewEA?: () => void;
}

const STYLE_OPTIONS = [
  { key: 'A', label: 'Pill' },
  { key: 'B', label: 'Stack' },
  { key: 'C', label: 'Circle' },
  { key: 'D', label: 'Grid' },
  { key: 'E', label: 'Float' },
];

const LAYOUT_OPTIONS = [
  { key: '1', label: 'Hero' },
  { key: '2', label: 'Center' },
  { key: '3', label: 'Dash' },
  { key: '4', label: 'Cine' },
  { key: '5', label: 'Card' },
];

const SCANNER_OPTIONS = [
  { key: 'A', label: 'Pill' },
  { key: 'F', label: 'Radar' },
  { key: 'H', label: 'Terminal' },
  { key: 'I', label: 'Power' },
  { key: 'K', label: 'Hybrid' },
];

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
  panelStyle = 'A',
  onPanelStyleChange,
  voiceStyle = 'A',
  onVoiceStyleChange,
  layoutStyle = '1',
  onLayoutStyleChange,
  scannerStyle = 'K',
  onScannerStyleChange,
  heroHidden = false,
  onToggleHeroHidden,
  onOpenScanner,
  onAddNewEA,
}: SidebarDrawerProps) {
  const slideAnim = useRef(new Animated.Value(DRAWER_WIDTH)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;
  const [voiceHelpOpen, setVoiceHelpOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [appearanceOpen, setAppearanceOpen] = useState(true);
  const [mediaOpen, setMediaOpen] = useState(false);

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

  const handleApplyTheme = (themeId: string) => {
    const theme = THEME_PRESETS.find(t => t.id === themeId);
    if (!theme) return;
    onColorChange(theme.glowColor);
    onSetBackgroundVideo?.(theme.videoFile);
  };

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

        {/* Quick actions — lets the user reach these without cluttering
            the home screen, especially when the hero is hidden. */}
        {onOpenScanner && (
          <TouchableOpacity
            style={styles.navItem}
            activeOpacity={0.7}
            onPress={() => { onOpenScanner(); onClose(); }}
          >
            <Scan color={glowColor} size={20} />
            <Text style={[styles.navLabel, { color: glowColor, textShadowColor: glowColor + '80', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 6 }]}>Chart Scanner</Text>
          </TouchableOpacity>
        )}
        {onAddNewEA && (
          <TouchableOpacity
            style={styles.navItem}
            activeOpacity={0.7}
            onPress={() => { onAddNewEA(); onClose(); }}
          >
            <Plus color={glowColor} size={20} />
            <Text style={[styles.navLabel, { color: glowColor, textShadowColor: glowColor + '80', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 6 }]}>Add New EA</Text>
          </TouchableOpacity>
        )}

        {/* Info link */}
        <TouchableOpacity style={styles.navItem} activeOpacity={0.7} onPress={onClose}>
          <Info color="rgba(255,255,255,0.5)" size={20} />
          <Text style={styles.navLabel}>About</Text>
        </TouchableOpacity>

        {/* ═══ THEMES SECTION ═══ */}
        <TouchableOpacity style={[styles.sectionHeader2, { borderTopColor: glowColor + '30' }]} activeOpacity={0.7} onPress={() => setThemeOpen(!themeOpen)}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Palette color={glowColor} size={16} />
            <Text style={[styles.sectionHeaderText, { color: glowColor }]}>THEMES</Text>
          </View>
          {themeOpen ? <ChevronUp color={glowColor + '60'} size={16} /> : <ChevronDown color={glowColor + '60'} size={16} />}
        </TouchableOpacity>
        {themeOpen && (
          <View style={styles.sectionBody}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.presetVideoRow}>
              {THEME_PRESETS.map((theme) => {
                const isActive = glowColor === theme.glowColor && backgroundVideo === theme.videoFile;
                return (
                  <TouchableOpacity
                    key={theme.id}
                    activeOpacity={0.7}
                    onPress={() => handleApplyTheme(theme.id)}
                    style={[styles.themeTile, { borderColor: isActive ? theme.glowColor : 'rgba(255,255,255,0.15)' }, isActive && Platform.OS === 'web' ? { boxShadow: `0 0 6px 1px ${theme.glowColor}60` } as any : {}]}
                  >
                    <View style={[styles.themeDot, { backgroundColor: theme.glowColor }]} />
                    <Text style={[styles.themeTileLabel, isActive && { color: theme.glowColor }]}>{theme.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* ═══ APPEARANCE SECTION ═══ */}
        <TouchableOpacity style={[styles.sectionHeader2, { borderTopColor: glowColor + '30' }]} activeOpacity={0.7} onPress={() => setAppearanceOpen(!appearanceOpen)}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Sliders color={glowColor} size={16} />
            <Text style={[styles.sectionHeaderText, { color: glowColor }]}>APPEARANCE</Text>
          </View>
          {appearanceOpen ? <ChevronUp color={glowColor + '60'} size={16} /> : <ChevronDown color={glowColor + '60'} size={16} />}
        </TouchableOpacity>
        {appearanceOpen && (
          <View style={styles.sectionBody}>
            <Text style={styles.sectionLabel}>GLOW COLOR</Text>
            <View style={styles.colorRow}>
              {GLOW_PRESETS.map((color) => {
                const isSelected = glowColor === color;
                return (
                  <TouchableOpacity
                    key={color}
                    activeOpacity={0.7}
                    onPress={() => onColorChange(color)}
                    style={[styles.colorCircleOuter, isSelected && { borderColor: color, ...Platform.select({ web: { boxShadow: `0 0 8px 2px ${color}60` } as any }) }]}
                  >
                    <View style={[styles.colorCircle, { backgroundColor: color }]} />
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Avatar Toggle */}
            <TouchableOpacity
              style={[styles.toggleRow, hasVideo && styles.toggleRowDisabled]}
              activeOpacity={hasVideo ? 1 : 0.7}
              onPress={() => { if (!hasVideo) onToggleHeroAvatar?.(!showHeroAvatar); }}
            >
              <View style={{ flexDirection: 'column' }}>
                <Text style={[styles.toggleLabel, hasVideo && { color: 'rgba(255,255,255,0.25)' }]}>Avatar Circle</Text>
                {hasVideo && <Text style={{ color: 'rgba(255,255,255,0.2)', fontSize: 10, marginTop: 2 }}>Required with video</Text>}
              </View>
              <View style={[styles.toggleTrack, { backgroundColor: showHeroAvatar ? (hasVideo ? glowColor + '60' : glowColor) : 'rgba(255,255,255,0.15)' }]}>
                <View style={[styles.toggleThumb, { transform: [{ translateX: showHeroAvatar ? 14 : 0 }] }]} />
              </View>
            </TouchableOpacity>

            {/* Hero Image Toggle — hides the tall 9:16 hero + moves the
                EA card, scanner, and Add EA action into this sidebar so
                the robot background becomes the standout visual. */}
            <TouchableOpacity
              style={styles.toggleRow}
              activeOpacity={0.7}
              onPress={() => onToggleHeroHidden?.(!heroHidden)}
            >
              <View style={{ flexDirection: 'column', flex: 1, paddingRight: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <EyeOff color={heroHidden ? glowColor : 'rgba(255,255,255,0.5)'} size={14} />
                  <Text style={styles.toggleLabel}>Hide Hero Image</Text>
                </View>
                <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, marginTop: 2 }}>
                  Shows robot backdrop only
                </Text>
              </View>
              <View style={[styles.toggleTrack, { backgroundColor: heroHidden ? glowColor : 'rgba(255,255,255,0.15)' }]}>
                <View style={[styles.toggleThumb, { transform: [{ translateX: heroHidden ? 14 : 0 }] }]} />
              </View>
            </TouchableOpacity>

            {/* Panel Style */}
            <Text style={[styles.sectionLabel, { marginTop: 10 }]}>PANEL STYLE</Text>
            <View style={styles.styleTileRow}>
              {STYLE_OPTIONS.map((opt) => {
                const active = panelStyle === opt.key;
                return (
                  <TouchableOpacity key={opt.key} activeOpacity={0.7} onPress={() => onPanelStyleChange?.(opt.key)}
                    style={[styles.styleTile, { borderColor: active ? glowColor : 'rgba(255,255,255,0.15)' }, active && Platform.OS === 'web' ? { boxShadow: `0 0 6px 1px ${glowColor}60` } as any : {}]}>
                    <Text style={[styles.styleTileLabel, active && { color: glowColor }]}>{opt.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Voice Style */}
            <Text style={[styles.sectionLabel, { marginTop: 10 }]}>VOICE STYLE</Text>
            <View style={styles.styleTileRow}>
              {STYLE_OPTIONS.map((opt) => {
                const active = voiceStyle === opt.key;
                return (
                  <TouchableOpacity key={opt.key} activeOpacity={0.7} onPress={() => onVoiceStyleChange?.(opt.key)}
                    style={[styles.styleTile, { borderColor: active ? glowColor : 'rgba(255,255,255,0.15)' }, active && Platform.OS === 'web' ? { boxShadow: `0 0 6px 1px ${glowColor}60` } as any : {}]}>
                    <Text style={[styles.styleTileLabel, active && { color: glowColor }]}>{opt.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Layout Style */}
            <Text style={[styles.sectionLabel, { marginTop: 10 }]}>LAYOUT STYLE</Text>
            <View style={styles.styleTileRow}>
              {LAYOUT_OPTIONS.map((opt) => {
                const active = layoutStyle === opt.key;
                return (
                  <TouchableOpacity key={opt.key} activeOpacity={0.7} onPress={() => onLayoutStyleChange?.(opt.key)}
                    style={[styles.styleTile, { borderColor: active ? glowColor : 'rgba(255,255,255,0.15)' }, active && Platform.OS === 'web' ? { boxShadow: `0 0 6px 1px ${glowColor}60` } as any : {}]}>
                    <Text style={[styles.styleTileLabel, active && { color: glowColor }]}>{opt.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Scanner Style */}
            <Text style={[styles.sectionLabel, { marginTop: 10 }]}>SCANNER STYLE</Text>
            <View style={styles.styleTileRow}>
              {SCANNER_OPTIONS.map((opt) => {
                const active = scannerStyle === opt.key;
                return (
                  <TouchableOpacity key={opt.key} activeOpacity={0.7} onPress={() => onScannerStyleChange?.(opt.key)}
                    style={[styles.styleTile, { borderColor: active ? glowColor : 'rgba(255,255,255,0.15)' }, active && Platform.OS === 'web' ? { boxShadow: `0 0 6px 1px ${glowColor}60` } as any : {}]}>
                    <Text style={[styles.styleTileLabel, active && { color: glowColor }]}>{opt.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* ═══ MEDIA SECTION ═══ */}
        <TouchableOpacity style={[styles.sectionHeader2, { borderTopColor: glowColor + '30' }]} activeOpacity={0.7} onPress={() => setMediaOpen(!mediaOpen)}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <VideoIcon color={glowColor} size={16} />
            <Text style={[styles.sectionHeaderText, { color: glowColor }]}>BACKGROUND VIDEO</Text>
          </View>
          {mediaOpen ? <ChevronUp color={glowColor + '60'} size={16} /> : <ChevronDown color={glowColor + '60'} size={16} />}
        </TouchableOpacity>
        {mediaOpen && (
          <View style={styles.sectionBody}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.presetVideoRow}>
              {VIDEO_PRESETS.map((preset) => {
                const isActive = backgroundVideo === preset.file;
                return (
                  <TouchableOpacity key={preset.id} activeOpacity={0.7} onPress={() => onSetBackgroundVideo?.(isActive ? null : preset.file)}
                    style={[styles.presetVideoTile, { borderColor: isActive ? glowColor : 'rgba(255,255,255,0.15)' }, isActive && Platform.OS === 'web' ? { boxShadow: `0 0 6px 1px ${glowColor}60` } as any : {}]}>
                    <Film color={isActive ? glowColor : 'rgba(255,255,255,0.4)'} size={16} />
                    <Text style={[styles.presetVideoLabel, isActive && { color: glowColor }]}>{preset.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity style={[styles.videoButton, { borderColor: glowColor + '50', marginTop: 10 }]} activeOpacity={0.7} onPress={handlePickVideo}>
              <Film color={glowColor} size={18} />
              <Text style={[styles.videoButtonText, { color: glowColor }]}>
                {hasVideo && !VIDEO_PRESETS.some(p => p.file === backgroundVideo) ? 'Change Custom' : 'Upload Custom'}
              </Text>
            </TouchableOpacity>

            {hasVideo && (
              <TouchableOpacity style={[styles.videoButton, { borderColor: '#FF444450', marginTop: 8 }]} activeOpacity={0.7} onPress={() => onSetBackgroundVideo?.(null)}>
                <Trash2 color="#FF4444" size={18} />
                <Text style={[styles.videoButtonText, { color: '#FF4444' }]}>Remove Video</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ═══ VOICE SECTION ═══ */}
        <TouchableOpacity
          style={[styles.sectionHeader2, { borderTopColor: glowColor + '30' }]}
          activeOpacity={0.7}
          onPress={() => setVoiceHelpOpen(!voiceHelpOpen)}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Mic color={glowColor} size={16} />
            <Text style={[styles.sectionHeaderText, { color: glowColor }]}>VOICE COMMANDS</Text>
          </View>
          {voiceHelpOpen ? <ChevronUp color={glowColor + '60'} size={16} /> : <ChevronDown color={glowColor + '60'} size={16} />}
        </TouchableOpacity>

        {voiceHelpOpen && (
          <View style={styles.voiceHelpList}>
            {VOICE_HELP.map((group) => (
              <View key={group.category} style={styles.voiceHelpGroup}>
                <Text style={[styles.voiceHelpCategory, { color: glowColor + '80' }]}>{group.category}</Text>
                {group.commands.map((cmd, i) => (
                  <Text key={i} style={styles.voiceHelpCmd}>{cmd}</Text>
                ))}
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 30 }} />
        </ScrollView>
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
  styleTileRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 4,
  },
  styleTile: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  styleTileLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  sectionHeader2: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderTopWidth: 1,
    marginTop: 4,
  },
  sectionHeaderText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  sectionBody: {
    paddingBottom: 8,
  },
  themeTile: {
    width: 70,
    height: 50,
    borderRadius: 10,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    gap: 4,
  },
  themeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  themeTileLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 8,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  voiceHelpHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  voiceHelpList: {
    paddingHorizontal: 4,
    paddingTop: 8,
    gap: 12,
  },
  voiceHelpGroup: {
    gap: 4,
  },
  voiceHelpCategory: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  voiceHelpCmd: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    fontWeight: '500',
    paddingLeft: 8,
    lineHeight: 18,
  },
});

export default SidebarDrawer;
