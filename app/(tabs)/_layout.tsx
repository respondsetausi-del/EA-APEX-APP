import { Tabs, usePathname } from "expo-router";
import { Menu } from "lucide-react-native";
import React, { useState, useCallback } from "react";
import { View, TouchableOpacity, StyleSheet, Platform } from "react-native";
import { router } from "expo-router";
import { useApp } from "@/providers/app-provider";
import { SidebarDrawer } from "@/components/sidebar-drawer";
import { VoiceCommandPill } from "@/components/voice-command";

export default function TabLayout() {
  const {
    glowColor, setGlowColor, showHeroAvatar, setShowHeroAvatar,
    backgroundVideo, setBackgroundVideo,
    eas, isBotActive, setBotActive, removeEA, activeSymbols,
  } = useApp();
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const pathname = usePathname();

  const primaryEA = Array.isArray(eas) && eas.length > 0 ? eas[0] : null;

  const currentRoute = pathname.includes('metatrader') ? 'metatrader'
    : pathname.includes('quotes') ? 'quotes'
    : 'home';

  const handleVoiceAddEA = useCallback(() => {
    router.push('/license');
  }, []);

  const handleVoiceRemoveEA = useCallback(async () => {
    if (primaryEA) {
      await removeEA(primaryEA.id);
    }
  }, [primaryEA, removeEA]);

  return (
    <View style={styles.root}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: { display: 'none' },
        }}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="quotes" />
        <Tabs.Screen name="metatrader" />
      </Tabs>

      {/* Voice Command — floats at bottom, works on all pages */}
      <View style={styles.voiceContainer}>
        <VoiceCommandPill
          glowColor={glowColor}
          isBotActive={isBotActive}
          onToggleBot={() => setBotActive(!isBotActive)}
          onRemoveEA={handleVoiceRemoveEA}
          onAddEA={handleVoiceAddEA}
          onSetGlowColor={setGlowColor}
          onToggleAvatar={setShowHeroAvatar}
          eaName={primaryEA?.name || 'EA'}
          eaCount={eas.length}
          activeSymbolCount={activeSymbols?.length || 0}
        />
      </View>

      {/* Hamburger — floats over every screen */}
      <TouchableOpacity
        style={[styles.hamburger, { borderColor: glowColor + '40' }]}
        onPress={() => setSidebarVisible(true)}
        activeOpacity={0.7}
      >
        <Menu color={glowColor} size={18} />
      </TouchableOpacity>

      {/* Sidebar — overlays every screen */}
      <SidebarDrawer
        visible={sidebarVisible}
        onClose={() => setSidebarVisible(false)}
        glowColor={glowColor}
        onColorChange={setGlowColor}
        onNavigate={(route) => {
          router.push(route as any);
          setSidebarVisible(false);
        }}
        currentRoute={currentRoute}
        showHeroAvatar={showHeroAvatar}
        onToggleHeroAvatar={setShowHeroAvatar}
        backgroundVideo={backgroundVideo}
        onSetBackgroundVideo={setBackgroundVideo}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },
  hamburger: {
    position: 'absolute',
    right: 16,
    top: Platform.OS === 'ios' ? 54 : 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    zIndex: 50,
  },
  voiceContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 30 : 16,
    zIndex: 40,
  },
});