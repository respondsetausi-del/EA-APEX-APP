import { Tabs, usePathname } from "expo-router";
import { Menu } from "lucide-react-native";
import React, { useState } from "react";
import { View, TouchableOpacity, StyleSheet, Platform } from "react-native";
import { router } from "expo-router";
import { useApp } from "@/providers/app-provider";
import { SidebarDrawer } from "@/components/sidebar-drawer";

export default function TabLayout() {
  const { glowColor, setGlowColor } = useApp();
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const pathname = usePathname();

  // Map pathname to route key for sidebar active state
  const currentRoute = pathname.includes('metatrader') ? 'metatrader'
    : pathname.includes('quotes') ? 'quotes'
    : 'home';

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
});