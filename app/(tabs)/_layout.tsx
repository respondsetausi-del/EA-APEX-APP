import { Tabs, usePathname } from "expo-router";
import { Menu } from "lucide-react-native";
import React, { useState, useEffect } from "react";
import { View, TouchableOpacity, StyleSheet, Platform } from "react-native";
import { router } from "expo-router";
import { useApp } from "@/providers/app-provider";
import { neonWebShadow } from "@/constants/colors";
import { SidebarDrawer } from "@/components/sidebar-drawer";
import { NotificationToast } from "@/components/notification-toast";

export default function TabLayout() {
  const { glowColor, setGlowColor, showHeroAvatar, setShowHeroAvatar, backgroundVideo, setBackgroundVideo, heroHidden, setHeroHidden, autoTradeEnabled, setAutoTradeEnabled, warmTerminalSession, mt4Account, mt5Account, mt4Symbols, mt5Symbols, isHydrated, newSignal, dismissNewSignal } = useApp();

  // Pre-warm the broker terminal on app open. Now gated on BOTH having
  // credentials AND the user having opted into auto-trading AND at least
  // one configured symbol — without those, warming is pointless (the
  // terminal would log in, idle, and eventually time out). Previously
  // this ran unconditionally on every app open and — together with the
  // fake ManualTradeRequest the old warmTerminalSession built — caused
  // a rogue EURUSD BUY on the broker account.
  useEffect(() => {
    if (!isHydrated) return;
    if (!autoTradeEnabled) return;
    const hasMt4 = !!(mt4Account?.login && mt4Account?.password && mt4Account?.server);
    const hasMt5 = !!(mt5Account?.login && mt5Account?.password && mt5Account?.server);
    if (!hasMt4 && !hasMt5) return;
    const hasSymbols = (mt4Symbols?.length ?? 0) + (mt5Symbols?.length ?? 0) > 0;
    if (!hasSymbols) return;
    const t = setTimeout(() => { warmTerminalSession(); }, 1200);
    return () => clearTimeout(t);
  }, [isHydrated, autoTradeEnabled, mt4Account, mt5Account, mt4Symbols, mt5Symbols, warmTerminalSession]);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [toastType, setToastType] = useState<'info' | 'success' | 'warning' | 'error'>('info');
  const pathname = usePathname();

  // Show toast when new signal arrives
  useEffect(() => {
    if (newSignal) {
      const dir = newSignal.direction || newSignal.type || '';
      setToastMessage(`${newSignal.asset} ${dir.toUpperCase()} signal received`);
      setToastType(dir.toLowerCase().includes('buy') ? 'success' : dir.toLowerCase().includes('sell') ? 'error' : 'info');
      setToastVisible(true);
      dismissNewSignal();
    }
  }, [newSignal]);

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

      {/* Notification Toast */}
      <NotificationToast
        message={toastMessage}
        type={toastType}
        visible={toastVisible}
        onDismiss={() => setToastVisible(false)}
        glowColor={glowColor}
      />

      {/* Hamburger — floats over every screen */}
      <TouchableOpacity
        style={[
          styles.hamburger,
          Platform.OS === "web" && { borderWidth: 0, boxShadow: `${neonWebShadow(glowColor, "soft")}, 0 4px 14px rgba(0,0,0,0.65)` } as any,
          { borderColor: glowColor + '2E' },
        ]}
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
        heroHidden={heroHidden}
        onToggleHeroHidden={setHeroHidden}
        onAddNewEA={() => router.push('/license')}
        autoTradeEnabled={autoTradeEnabled}
        onToggleAutoTrade={setAutoTradeEnabled}
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
    backgroundColor: 'rgba(0, 0, 0, 0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    zIndex: 50,
  },
});