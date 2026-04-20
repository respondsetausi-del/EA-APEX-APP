import createContextHook from '@nkzw/create-context-hook';
import { useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, Alert } from 'react-native';
import { LicenseData, apiService } from '@/services/api';
import signalsMonitor, { SignalLog } from '@/services/signals-monitor';
import databaseSignalsPollingService, { DatabaseSignal } from '@/services/database-signals-polling';
import { proxyAuthLicense } from '@/services/ea-converter-proxy';

export interface User {
  mentorId: string;
  email: string;
}

export interface EA {
  id: string;
  name: string;
  licenseKey: string;
  status: 'connected' | 'disconnected';
  description?: string;
  phoneSecretKey?: string;
  userData?: LicenseData;
}

export interface MTAccount {
  type: 'MT4' | 'MT5';
  login: string;
  server: string;
  connected: boolean;
}

export interface MT4Account {
  login: string;
  password: string;
  server: string;
  connected: boolean;
}

export interface MT5Account {
  login: string;
  password: string;
  server: string;
  connected: boolean;
}

export interface ActiveSymbol {
  symbol: string;
  lotSize: string;
  direction: 'BUY' | 'SELL' | 'BOTH';
  platform: 'MT4' | 'MT5';
  numberOfTrades: string;
  activatedAt: Date;
}

export interface MT4Symbol {
  symbol: string;
  lotSize: string;
  direction: 'BUY' | 'SELL' | 'BOTH';
  numberOfTrades: string;
  activatedAt: Date;
}

export interface MT5Symbol {
  symbol: string;
  lotSize: string;
  direction: 'BUY' | 'SELL' | 'BOTH';
  numberOfTrades: string;
  activatedAt: Date;
}

export interface ManualTradeRequest {
  symbol: string;
  action: 'BUY' | 'SELL';
  lot: number;
  count: number;
  platform: 'MT4' | 'MT5';
  slPrice?: number;
  tpPrice?: number;
}

export interface PlaceManualTradeResult {
  ok: boolean;
  error?: string;
  platform?: 'MT4' | 'MT5';
}

interface AppState {
  user: User | null;
  eas: EA[];
  mtAccount: MTAccount | null;
  mt4Account: MT4Account | null;
  mt5Account: MT5Account | null;
  isFirstTime: boolean;
  /** True once loadPersistedData has finished. Auth gates MUST wait on this
   *  before making redirect decisions, otherwise they evaluate stale defaults
   *  and send fresh devices to the wrong place. */
  isHydrated: boolean;
  activeSymbols: ActiveSymbol[];
  mt4Symbols: MT4Symbol[];
  mt5Symbols: MT5Symbol[];
  isBotActive: boolean;
  signalLogs: SignalLog[];
  isSignalsMonitoring: boolean;
  newSignal: SignalLog | null;
  tradingSignal: SignalLog | null;
  showTradingWebView: boolean;
  manualTradeRequest: ManualTradeRequest | null;
  databaseSignal: DatabaseSignal | null;
  isDatabaseSignalsPolling: boolean;
  glowColor: string;
  setGlowColor: (color: string) => void;
  showHeroAvatar: boolean;
  setShowHeroAvatar: (show: boolean) => void;
  backgroundVideo: string | null;
  setBackgroundVideo: (uri: string | null) => void;
  panelStyle: string;
  setPanelStyle: (style: string) => void;
  voiceStyle: string;
  setVoiceStyle: (style: string) => void;
  layoutStyle: string;
  setLayoutStyle: (style: string) => void;
  scannerStyle: string;
  setScannerStyle: (style: string) => void;
  heroHidden: boolean;
  setHeroHidden: (hidden: boolean) => void;
  scannerOpenRequest: number;
  requestOpenScanner: () => void;
  chatVisible: boolean;
  setChatVisible: (visible: boolean) => void;
  setUser: (user: User) => void;
  addEA: (ea: EA) => Promise<boolean>;
  removeEA: (id: string) => Promise<boolean>;
  setActiveEA: (id: string) => Promise<void>;
  setMTAccount: (account: MTAccount) => void;
  setMT4Account: (account: MT4Account) => void;
  setMT5Account: (account: MT5Account) => void;
  setIsFirstTime: (isFirstTime: boolean) => void;
  activateSymbol: (symbolConfig: Omit<ActiveSymbol, 'activatedAt'>) => void;
  activateMT4Symbol: (symbolConfig: Omit<MT4Symbol, 'activatedAt'>) => void;
  activateMT5Symbol: (symbolConfig: Omit<MT5Symbol, 'activatedAt'>) => void;
  deactivateSymbol: (symbol: string) => void;
  deactivateMT4Symbol: (symbol: string) => void;
  deactivateMT5Symbol: (symbol: string) => void;
  setBotActive: (active: boolean) => void;
  requestOverlayPermission: () => Promise<boolean>;
  startSignalsMonitoring: (phoneSecret: string) => void;
  stopSignalsMonitoring: () => void;
  clearSignalLogs: () => void;
  dismissNewSignal: () => void;
  setTradingSignal: (signal: SignalLog | null) => void;
  setShowTradingWebView: (show: boolean) => void;
  placeManualTrade: (req: Omit<ManualTradeRequest, 'platform'> & { platform?: 'MT4' | 'MT5' }) => PlaceManualTradeResult;
}

export const [AppProvider, useApp] = createContextHook<AppState>(() => {
  const [user, setUserState] = useState<User | null>(null);
  const [eas, setEAs] = useState<EA[]>([]);
  const [mtAccount, setMTAccountState] = useState<MTAccount | null>(null);
  const [mt4Account, setMT4AccountState] = useState<MT4Account | null>(null);
  const [mt5Account, setMT5AccountState] = useState<MT5Account | null>(null);
  const [isFirstTime, setIsFirstTimeState] = useState<boolean>(true);
  const [isHydrated, setIsHydrated] = useState<boolean>(false);
  const [activeSymbols, setActiveSymbols] = useState<ActiveSymbol[]>([]);
  const [mt4Symbols, setMT4Symbols] = useState<MT4Symbol[]>([]);
  const [mt5Symbols, setMT5Symbols] = useState<MT5Symbol[]>([]);
  const [isBotActive, setIsBotActive] = useState<boolean>(false);
  const [signalLogs, setSignalLogs] = useState<SignalLog[]>([]);
  const [isSignalsMonitoring, setIsSignalsMonitoring] = useState<boolean>(false);
  const [newSignal, setNewSignal] = useState<SignalLog | null>(null);
  const [tradingSignal, setTradingSignal] = useState<SignalLog | null>(null);
  const [showTradingWebView, setShowTradingWebView] = useState<boolean>(false);
  const [manualTradeRequest, setManualTradeRequest] = useState<ManualTradeRequest | null>(null);
  const [databaseSignal, setDatabaseSignal] = useState<DatabaseSignal | null>(null);
  const [isDatabaseSignalsPolling, setIsDatabaseSignalsPolling] = useState<boolean>(false);
  const [glowColor, setGlowColorState] = useState<string>('#00BFFF');
  const [showHeroAvatar, setShowHeroAvatarState] = useState<boolean>(true);
  const [backgroundVideo, setBackgroundVideoState] = useState<string | null>(null);
  const [panelStyle, setPanelStyleState] = useState<string>('A');
  const [voiceStyle, setVoiceStyleState] = useState<string>('A');
  const [layoutStyle, setLayoutStyleState] = useState<string>('1');
  const [scannerStyle, setScannerStyleState] = useState<string>('F');
  // Hides the tall 9:16 hero on the home screen; cards move to the sidebar
  // and the robot backdrop becomes the standout visual.
  const [heroHidden, setHeroHiddenState] = useState<boolean>(false);
  // Bumps whenever the sidebar asks the home screen to open the scanner
  // modal — keeps the scanner triggerable from anywhere without navigation
  // params.
  const [scannerOpenRequest, setScannerOpenRequest] = useState<number>(0);
  const [chatVisible, setChatVisibleState] = useState<boolean>(true);

  // Load persisted data on mount
  useEffect(() => {
    loadPersistedData();
  }, []);

  const loadPersistedData = async () => {
    try {
      console.log('Loading persisted data...');

      // Load all data in parallel but handle each independently
      const [userData, easData, mtData, mt4Data, mt5Data, firstTimeData, activeSymbolsData, mt4SymbolsData, mt5SymbolsData, botActiveData, glowColorData, heroAvatarData, bgVideoData, panelData, voiceData, layoutData, scannerData, heroHiddenData, chatVisibleData] = await Promise.allSettled([
        AsyncStorage.getItem('user'),
        AsyncStorage.getItem('eas'),
        AsyncStorage.getItem('mtAccount'),
        AsyncStorage.getItem('mt4Account'),
        AsyncStorage.getItem('mt5Account'),
        AsyncStorage.getItem('isFirstTime'),
        AsyncStorage.getItem('activeSymbols'),
        AsyncStorage.getItem('mt4Symbols'),
        AsyncStorage.getItem('mt5Symbols'),
        AsyncStorage.getItem('isBotActive'),
        AsyncStorage.getItem('glowColor'),
        AsyncStorage.getItem('showHeroAvatar'),
        AsyncStorage.getItem('backgroundVideo'),
        AsyncStorage.getItem('panelStyle'),
        AsyncStorage.getItem('voiceStyle'),
        AsyncStorage.getItem('layoutStyle'),
        AsyncStorage.getItem('scannerStyle'),
        AsyncStorage.getItem('heroHidden'),
        AsyncStorage.getItem('chatVisible')
      ]);

      // Handle user data
      if (userData.status === 'fulfilled' && userData.value) {
        try {
          const parsed = JSON.parse(userData.value);
          if (parsed && typeof parsed === 'object') {
            setUserState(parsed);
            console.log('User data loaded successfully');
          }
        } catch (parseError) {
          console.error('Error parsing user data:', parseError);
          AsyncStorage.removeItem('user').catch(console.error);
        }
      }

      // Handle EAs data
      if (easData.status === 'fulfilled' && easData.value) {
        try {
          const parsed = JSON.parse(easData.value);
          if (Array.isArray(parsed)) {
            setEAs(parsed);
            console.log('EAs data loaded successfully:', parsed.length);
          } else {
            setEAs([]);
          }
        } catch (parseError) {
          console.error('Error parsing EAs data:', parseError);
          AsyncStorage.removeItem('eas').catch(console.error);
          setEAs([]);
        }
      }

      // Handle MT account data
      if (mtData.status === 'fulfilled' && mtData.value) {
        try {
          const parsed = JSON.parse(mtData.value);
          if (parsed && typeof parsed === 'object') {
            setMTAccountState(parsed);
            console.log('MT account data loaded successfully');
          }
        } catch (parseError) {
          console.error('Error parsing MT account data:', parseError);
          AsyncStorage.removeItem('mtAccount').catch(console.error);
        }
      }

      // Handle MT4 account data
      if (mt4Data.status === 'fulfilled' && mt4Data.value) {
        try {
          const parsed = JSON.parse(mt4Data.value);
          if (parsed && typeof parsed === 'object') {
            setMT4AccountState(parsed);
            console.log('MT4 account data loaded successfully');
          }
        } catch (parseError) {
          console.error('Error parsing MT4 account data:', parseError);
          AsyncStorage.removeItem('mt4Account').catch(console.error);
        }
      }

      // Handle MT5 account data
      if (mt5Data.status === 'fulfilled' && mt5Data.value) {
        try {
          const parsed = JSON.parse(mt5Data.value);
          if (parsed && typeof parsed === 'object') {
            setMT5AccountState(parsed);
            console.log('MT5 account data loaded successfully');
          }
        } catch (parseError) {
          console.error('Error parsing MT5 account data:', parseError);
          AsyncStorage.removeItem('mt5Account').catch(console.error);
        }
      }

      // Handle first time flag
      if (firstTimeData.status === 'fulfilled' && firstTimeData.value !== null) {
        try {
          const parsed = JSON.parse(firstTimeData.value);
          if (typeof parsed === 'boolean') {
            setIsFirstTimeState(parsed);
            console.log('First time flag loaded successfully:', parsed);
          }
        } catch (parseError) {
          console.error('Error parsing first time data:', parseError);
          AsyncStorage.removeItem('isFirstTime').catch(console.error);
        }
      }

      // Handle active symbols
      if (activeSymbolsData.status === 'fulfilled' && activeSymbolsData.value) {
        try {
          const parsed = JSON.parse(activeSymbolsData.value);
          if (Array.isArray(parsed)) {
            const symbolsWithDates = parsed.map((symbol: any) => {
              try {
                return {
                  ...symbol,
                  activatedAt: new Date(symbol.activatedAt)
                };
              } catch {
                return {
                  ...symbol,
                  activatedAt: new Date()
                };
              }
            });
            setActiveSymbols(symbolsWithDates);
            console.log('Active symbols loaded successfully:', symbolsWithDates.length);
          } else {
            setActiveSymbols([]);
          }
        } catch (parseError) {
          console.error('Error parsing active symbols data:', parseError);
          AsyncStorage.removeItem('activeSymbols').catch(console.error);
          setActiveSymbols([]);
        }
      }

      // Handle MT4 symbols
      if (mt4SymbolsData.status === 'fulfilled' && mt4SymbolsData.value) {
        try {
          const parsed = JSON.parse(mt4SymbolsData.value);
          if (Array.isArray(parsed)) {
            const symbolsWithDates = parsed.map((symbol: any) => {
              try {
                return {
                  ...symbol,
                  activatedAt: new Date(symbol.activatedAt)
                };
              } catch {
                return {
                  ...symbol,
                  activatedAt: new Date()
                };
              }
            });
            setMT4Symbols(symbolsWithDates);
            console.log('MT4 symbols loaded successfully:', symbolsWithDates.length);
          } else {
            setMT4Symbols([]);
          }
        } catch (parseError) {
          console.error('Error parsing MT4 symbols data:', parseError);
          AsyncStorage.removeItem('mt4Symbols').catch(console.error);
          setMT4Symbols([]);
        }
      }

      // Handle MT5 symbols
      if (mt5SymbolsData.status === 'fulfilled' && mt5SymbolsData.value) {
        try {
          const parsed = JSON.parse(mt5SymbolsData.value);
          if (Array.isArray(parsed)) {
            const symbolsWithDates = parsed.map((symbol: any) => {
              try {
                return {
                  ...symbol,
                  activatedAt: new Date(symbol.activatedAt)
                };
              } catch {
                return {
                  ...symbol,
                  activatedAt: new Date()
                };
              }
            });
            setMT5Symbols(symbolsWithDates);
            console.log('MT5 symbols loaded successfully:', symbolsWithDates.length);
          } else {
            setMT5Symbols([]);
          }
        } catch (parseError) {
          console.error('Error parsing MT5 symbols data:', parseError);
          AsyncStorage.removeItem('mt5Symbols').catch(console.error);
          setMT5Symbols([]);
        }
      }

      // Handle bot active state
      if (botActiveData.status === 'fulfilled' && botActiveData.value !== null) {
        try {
          const parsed = JSON.parse(botActiveData.value);
          if (typeof parsed === 'boolean') {
            setIsBotActive(parsed);
            console.log('Bot active state loaded successfully:', parsed);
          }
        } catch (parseError) {
          console.error('Error parsing bot active data:', parseError);
          AsyncStorage.removeItem('isBotActive').catch(console.error);
        }
      }

      // Handle glow color
      if (glowColorData.status === 'fulfilled' && glowColorData.value) {
        setGlowColorState(glowColorData.value);
        console.log('Glow color loaded:', glowColorData.value);
      }

      // Handle hero avatar toggle
      if (heroAvatarData.status === 'fulfilled' && heroAvatarData.value !== null) {
        try {
          const parsed = JSON.parse(heroAvatarData.value);
          if (typeof parsed === 'boolean') {
            setShowHeroAvatarState(parsed);
            console.log('Hero avatar setting loaded:', parsed);
          }
        } catch (e) {
          console.error('Error parsing hero avatar setting:', e);
        }
      }

      // Handle background video
      if (bgVideoData.status === 'fulfilled' && bgVideoData.value) {
        setBackgroundVideoState(bgVideoData.value);
        console.log('Background video loaded:', bgVideoData.value);
      }

      // Handle style selectors
      if (panelData.status === 'fulfilled' && panelData.value) {
        setPanelStyleState(panelData.value);
      }
      if (voiceData.status === 'fulfilled' && voiceData.value) {
        setVoiceStyleState(voiceData.value);
      }
      if (layoutData.status === 'fulfilled' && layoutData.value) {
        setLayoutStyleState(layoutData.value);
      }
      if (scannerData.status === 'fulfilled' && scannerData.value) {
        setScannerStyleState(scannerData.value);
      }
      if (heroHiddenData.status === 'fulfilled' && heroHiddenData.value !== null) {
        try {
          const parsed = JSON.parse(heroHiddenData.value);
          if (typeof parsed === 'boolean') setHeroHiddenState(parsed);
        } catch (e) {
          console.error('Error parsing heroHidden setting:', e);
        }
      }
      if (chatVisibleData.status === 'fulfilled' && chatVisibleData.value !== null) {
        try {
          const parsed = JSON.parse(chatVisibleData.value);
          if (typeof parsed === 'boolean') setChatVisibleState(parsed);
        } catch (e) {
          console.error('Error parsing chatVisible setting:', e);
        }
      }

      console.log('Persisted data loading completed');
    } catch (error) {
      console.error('Critical error loading persisted data:', error);
      // Reset to safe default state
      setUserState(null);
      setEAs([]);
      setMTAccountState(null);
      setMT4AccountState(null);
      setMT5AccountState(null);
      setIsFirstTimeState(true);
      setActiveSymbols([]);
      setMT4Symbols([]);
      setMT5Symbols([]);
      setIsBotActive(false);
    } finally {
      // Signal hydration regardless of success/failure so the auth gate
      // can start evaluating. On error we've reset to safe defaults above.
      setIsHydrated(true);
    }
  };

  // ── SUBSCRIPTION VERIFICATION ON EVERY APP OPEN ──
  // Checks server on launch. If revoked, expired, or device mismatch → instant kick.
  const verifySubscription = useCallback(async () => {
    if (!user?.email) return;
    try {
      console.log('Verifying subscription for:', user.email);
      const account = await apiService.authenticate({
        email: user.email,
        mentor: user.mentorId || '0',
      });

      const shouldKick =
        account.status === 'not_found' ||
        !account.paid ||
        (account as any).expired ||
        (account as any).device_mismatch;

      if (shouldKick) {
        console.log('Subscription invalid — kicking user:', {
          status: account.status,
          paid: account.paid,
          expired: (account as any).expired,
          device_mismatch: (account as any).device_mismatch,
        });
        // Clear all auth state
        setUserState(null);
        setEAs([]);
        await AsyncStorage.multiRemove(['user', 'eas', 'emailAuthenticated']);
      }
    } catch (error) {
      // Network error — don't kick, let them use cached state
      console.log('Subscription check failed (network) — allowing cached access');
    }
  }, [user?.email, user?.mentorId]);

  // Run verification after user state is hydrated
  useEffect(() => {
    if (isHydrated && user?.email) {
      verifySubscription();
    }
  }, [isHydrated, user?.email]);

  const setUser = useCallback(async (newUser: User) => {
    setUserState(newUser);
    try {
      await AsyncStorage.setItem('user', JSON.stringify(newUser));
    } catch (error) {
      console.error('Error saving user:', error);
    }
  }, []);

  const addEA = useCallback(async (ea: EA) => {
    try {
      console.log('Adding EA:', ea.name, 'Current EAs count:', eas.length);

      // Validate EA object
      if (!ea || !ea.id || !ea.name || !ea.licenseKey) {
        console.error('Invalid EA object:', ea);
        return false;
      }

      // Check for duplicates with current state
      const existingEA = eas.find(existingEa =>
        existingEa.licenseKey.toLowerCase().trim() === ea.licenseKey.toLowerCase().trim() ||
        existingEa.id === ea.id
      );

      if (existingEA) {
        console.warn('Attempted to add duplicate EA:', ea.name);
        return false;
      }

      const updatedEAs = [...eas, ea];
      console.log('Saving EAs to storage, count:', updatedEAs.length);

      // Save to AsyncStorage with error handling
      try {
        await AsyncStorage.setItem('eas', JSON.stringify(updatedEAs));
        console.log('EAs saved to AsyncStorage successfully');
      } catch (storageError) {
        console.error('Failed to save EAs to AsyncStorage:', storageError);
        return false;
      }

      // Update state after successful storage save
      setEAs(updatedEAs);
      console.log('EA added successfully:', ea.name, 'Total EAs:', updatedEAs.length);

      return true;
    } catch (error) {
      console.error('Critical error adding EA:', error);
      return false;
    }
  }, [eas]);

  const removeEA = useCallback(async (id: string) => {
    try {
      const updatedEAs = eas.filter(ea => ea.id !== id);
      await AsyncStorage.setItem('eas', JSON.stringify(updatedEAs));
      setEAs(updatedEAs);
      console.log('EA removed successfully:', id);
      return true;
    } catch (error) {
      console.error('Error removing EA:', error);
      return false;
    }
  }, [eas]);

  const setActiveEA = useCallback(async (id: string) => {
    try {
      console.log('Setting active EA by id:', id);
      const index = eas.findIndex(e => e.id === id);
      if (index <= 0) {
        console.log('Active EA already first or not found, index:', index);
        return;
      }
      const reordered = [eas[index], ...eas.slice(0, index), ...eas.slice(index + 1)];
      await AsyncStorage.setItem('eas', JSON.stringify(reordered));
      setEAs(reordered);
      console.log('Active EA set. New first EA:', reordered[0]?.name);
    } catch (error) {
      console.error('Error setting active EA:', error);
    }
  }, [eas]);

  const setMTAccount = useCallback(async (account: MTAccount) => {
    setMTAccountState(account);
    try {
      await AsyncStorage.setItem('mtAccount', JSON.stringify(account));
    } catch (error) {
      console.error('Error saving MT account:', error);
    }
  }, []);

  const setMT4Account = useCallback(async (account: MT4Account) => {
    setMT4AccountState(account);
    try {
      await AsyncStorage.setItem('mt4Account', JSON.stringify(account));
      console.log('MT4 account saved successfully');
    } catch (error) {
      console.error('Error saving MT4 account:', error);
    }
  }, []);

  const setMT5Account = useCallback(async (account: MT5Account) => {
    setMT5AccountState(account);
    try {
      await AsyncStorage.setItem('mt5Account', JSON.stringify(account));
      console.log('MT5 account saved successfully');
    } catch (error) {
      console.error('Error saving MT5 account:', error);
    }
  }, []);

  const setIsFirstTime = useCallback(async (value: boolean) => {
    setIsFirstTimeState(value);
    try {
      await AsyncStorage.setItem('isFirstTime', JSON.stringify(value));
    } catch (error) {
      console.error('Error saving first time flag:', error);
    }
  }, []);

  const activateSymbol = useCallback(async (symbolConfig: Omit<ActiveSymbol, 'activatedAt'>) => {
    const newActiveSymbol: ActiveSymbol = {
      ...symbolConfig,
      activatedAt: new Date()
    };

    // Ensure single-platform config per symbol: remove from MT4/MT5 lists
    setMT4Symbols(current => {
      const updated = current.filter(s => s.symbol !== symbolConfig.symbol);
      AsyncStorage.setItem('mt4Symbols', JSON.stringify(updated)).catch(error => {
        console.error('Error saving MT4 symbols:', error);
      });
      return updated;
    });
    setMT5Symbols(current => {
      const updated = current.filter(s => s.symbol !== symbolConfig.symbol);
      AsyncStorage.setItem('mt5Symbols', JSON.stringify(updated)).catch(error => {
        console.error('Error saving MT5 symbols:', error);
      });
      return updated;
    });

    setActiveSymbols(currentSymbols => {
      const filteredSymbols = currentSymbols.filter(s => s.symbol !== symbolConfig.symbol);
      const updatedSymbols = [...filteredSymbols, newActiveSymbol];

      AsyncStorage.setItem('activeSymbols', JSON.stringify(updatedSymbols)).catch(error => {
        console.error('Error saving active symbols:', error);
      });

      return updatedSymbols;
    });
  }, []);

  const deactivateSymbol = useCallback(async (symbol: string) => {
    setActiveSymbols(currentSymbols => {
      const updatedSymbols = currentSymbols.filter(s => s.symbol !== symbol);

      AsyncStorage.setItem('activeSymbols', JSON.stringify(updatedSymbols)).catch(error => {
        console.error('Error saving active symbols:', error);
      });

      return updatedSymbols;
    });
  }, []);

  const activateMT4Symbol = useCallback(async (symbolConfig: Omit<MT4Symbol, 'activatedAt'>) => {
    const newActiveSymbol: MT4Symbol = {
      ...symbolConfig,
      activatedAt: new Date()
    };

    // Ensure single-platform config per symbol: clear legacy and MT5 entries
    setActiveSymbols(current => {
      const updated = current.filter(s => s.symbol !== symbolConfig.symbol);
      AsyncStorage.setItem('activeSymbols', JSON.stringify(updated)).catch(error => {
        console.error('Error saving active symbols:', error);
      });
      return updated;
    });
    setMT5Symbols(current => {
      const updated = current.filter(s => s.symbol !== symbolConfig.symbol);
      AsyncStorage.setItem('mt5Symbols', JSON.stringify(updated)).catch(error => {
        console.error('Error saving MT5 symbols:', error);
      });
      return updated;
    });

    setMT4Symbols(currentSymbols => {
      const filteredSymbols = currentSymbols.filter(s => s.symbol !== symbolConfig.symbol);
      const updatedSymbols = [...filteredSymbols, newActiveSymbol];

      AsyncStorage.setItem('mt4Symbols', JSON.stringify(updatedSymbols)).catch(error => {
        console.error('Error saving MT4 symbols:', error);
      });

      console.log('MT4 symbol activated:', symbolConfig.symbol);
      return updatedSymbols;
    });
  }, []);

  const activateMT5Symbol = useCallback(async (symbolConfig: Omit<MT5Symbol, 'activatedAt'>) => {
    const newActiveSymbol: MT5Symbol = {
      ...symbolConfig,
      activatedAt: new Date()
    };

    // Ensure single-platform config per symbol: clear legacy and MT4 entries
    setActiveSymbols(current => {
      const updated = current.filter(s => s.symbol !== symbolConfig.symbol);
      AsyncStorage.setItem('activeSymbols', JSON.stringify(updated)).catch(error => {
        console.error('Error saving active symbols:', error);
      });
      return updated;
    });
    setMT4Symbols(current => {
      const updated = current.filter(s => s.symbol !== symbolConfig.symbol);
      AsyncStorage.setItem('mt4Symbols', JSON.stringify(updated)).catch(error => {
        console.error('Error saving MT4 symbols:', error);
      });
      return updated;
    });

    setMT5Symbols(currentSymbols => {
      const filteredSymbols = currentSymbols.filter(s => s.symbol !== symbolConfig.symbol);
      const updatedSymbols = [...filteredSymbols, newActiveSymbol];

      AsyncStorage.setItem('mt5Symbols', JSON.stringify(updatedSymbols)).catch(error => {
        console.error('Error saving MT5 symbols:', error);
      });

      console.log('MT5 symbol activated:', symbolConfig.symbol);
      return updatedSymbols;
    });
  }, []);

  const deactivateMT4Symbol = useCallback(async (symbol: string) => {
    setMT4Symbols(currentSymbols => {
      const updatedSymbols = currentSymbols.filter(s => s.symbol !== symbol);

      AsyncStorage.setItem('mt4Symbols', JSON.stringify(updatedSymbols)).catch(error => {
        console.error('Error saving MT4 symbols:', error);
      });

      console.log('MT4 symbol deactivated:', symbol);
      return updatedSymbols;
    });
  }, []);

  const deactivateMT5Symbol = useCallback(async (symbol: string) => {
    setMT5Symbols(currentSymbols => {
      const updatedSymbols = currentSymbols.filter(s => s.symbol !== symbol);

      AsyncStorage.setItem('mt5Symbols', JSON.stringify(updatedSymbols)).catch(error => {
        console.error('Error saving MT5 symbols:', error);
      });

      console.log('MT5 symbol deactivated:', symbol);
      return updatedSymbols;
    });
  }, []);

  const requestOverlayPermission = useCallback(async (): Promise<boolean> => {
    if (Platform.OS !== 'android') {
      return true;
    }

    try {
      console.log('Requesting overlay permission for Android...');

      return new Promise((resolve) => {
        Alert.alert(
          'Permission Required',
          'This app needs permission to draw over other apps to show trading notifications. Please enable "Display over other apps" in the next screen.',
          [
            {
              text: 'Cancel',
              style: 'cancel',
              onPress: () => {
                console.log('Overlay permission cancelled');
                resolve(false);
              }
            },
            {
              text: 'Open Settings',
              onPress: () => {
                console.log('Opening overlay permission settings...');
                // Mock permission granted for demo
                setTimeout(() => {
                  console.log('Overlay permission granted (mock)');
                  resolve(true);
                }, 1000);
              }
            }
          ]
        );
      });
    } catch (error) {
      console.error('Error requesting overlay permission:', error);
      return false;
    }
  }, []);

  const setBotActive = useCallback(async (active: boolean) => {
    console.log('setBotActive called with:', active);

    // If activating on Android, request overlay permission
    if (active && Platform.OS === 'android') {
      const hasPermission = await requestOverlayPermission();
      if (!hasPermission) {
        console.log('Overlay permission denied, not activating bot');
        return;
      }
    }

    try {
      setIsBotActive(active);
      await AsyncStorage.setItem('isBotActive', JSON.stringify(active));
      console.log('Bot active state saved:', active);

      if (active) {
        // Start database signals polling when bot is activated.
        // We poll via the PHP legacy endpoint (same as Android APK) using
        // phoneSecretKey as auth — NOT licenseKey — because the render Node
        // server can't reach the MySQL DB directly.
        const primaryEA = Array.isArray(eas) && eas.length > 0 ? eas[0] : null;

        // Re-fetch phone_secret_key from auth proxy if it's missing on the EA
        // object (happens for EAs added before proxyAuthLicense was wired).
        // Mirrors the Android APK: Android calls POST /auth/ on service start
        // and uses whatever phone_secret_key comes back.
        let phoneSecret: string | undefined = primaryEA?.phoneSecretKey;
        if (primaryEA && !phoneSecret && primaryEA.licenseKey) {
          console.log('phoneSecretKey missing on EA — re-authenticating to fetch it');
          try {
            const authRes = await proxyAuthLicense(primaryEA.licenseKey);
            if (authRes.message === 'accept' && authRes.data?.phone_secret_key) {
              phoneSecret = String(authRes.data.phone_secret_key);
              console.log('Got fresh phone_secret_key from auth proxy');
              // Persist so we don't re-fetch every toggle
              setEAs(prev => {
                const updated = prev.map(e =>
                  e.id === primaryEA.id ? { ...e, phoneSecretKey: phoneSecret } : e
                );
                AsyncStorage.setItem('eas', JSON.stringify(updated)).catch(err =>
                  console.error('Failed to persist updated EA:', err)
                );
                return updated;
              });
            } else {
              console.error('Re-auth failed:', authRes);
            }
          } catch (err) {
            console.error('Re-auth threw:', err);
          }
        }

        if (primaryEA && phoneSecret) {
          console.log('Starting database signals polling for EA:', primaryEA.name || primaryEA.licenseKey);

          const onDatabaseSignalFound = (signal: DatabaseSignal) => {
            console.log('🎯 Database signal found:', signal);
            setDatabaseSignal(signal);
            // Add database signal to existing signals monitoring system
            const signalLog: SignalLog = {
              id: signal.id,
              asset: signal.asset,
              action: signal.action,
              price: signal.price,
              tp: signal.tp,
              sl: signal.sl,
              time: signal.time,
              type: 'DATABASE_SIGNAL',
              source: 'database',
              latestupdate: signal.latestupdate
            };

            console.log('🎯 Converted to SignalLog:', signalLog);

            // Add to signal logs
            setSignalLogs(prev => {
              const newLogs = [...prev, signalLog];
              console.log('🎯 Updated signal logs:', newLogs);
              return newLogs;
            });

            // Update new signal for dynamic island (unchanged — keeps the
            // existing visual notification path working).
            console.log('🎯 Setting new signal for dynamic island:', signalLog);
            setNewSignal(signalLog);

            // Trigger trade execution directly from the poll, rather than
            // relying on Dynamic Island being mounted. Same active-symbol
            // gate is applied so EA-locking / user config is respected.
            const symbolName = signal.asset;
            const isActiveInLegacy = activeSymbols.some(s => s.symbol === symbolName);
            const isActiveInMT4 = mt4Symbols.some(s => s.symbol === symbolName);
            const isActiveInMT5 = mt5Symbols.some(s => s.symbol === symbolName);

            if (isActiveInLegacy || isActiveInMT4 || isActiveInMT5) {
              console.log('✅ DB signal is for active symbol, triggering trade WebView:', symbolName);
              setTradingSignal(signalLog);
              setShowTradingWebView(true);
            } else {
              console.log('❌ DB signal ignored - not for active symbol:', symbolName);
            }
          };

          const onDatabaseError = (error: string) => {
            console.error('Database signals polling error:', error);
          };

          databaseSignalsPollingService.startPolling(
            phoneSecret,
            onDatabaseSignalFound,
            onDatabaseError
          );
          setIsDatabaseSignalsPolling(true);
        } else {
          console.error('Cannot start polling — no EA or no phone_secret_key available');
        }
      } else {
        // Clear signal logs and stop database signals polling when stopping the bot
        console.log('Bot stopped - clearing signal logs and stopping database signals polling');
        signalsMonitor.clearSignalLogs();
        databaseSignalsPollingService.stopPolling();
        setSignalLogs([]);
        setNewSignal(null);
        setDatabaseSignal(null);
        setIsDatabaseSignalsPolling(false);
      }
    } catch (error) {
      console.error('Error saving bot active state:', error);
      // Revert state on error
      setIsBotActive(!active);
    }
  }, [requestOverlayPermission, eas, activeSymbols, mt4Symbols, mt5Symbols]);

  const setGlowColor = useCallback(async (color: string) => {
    setGlowColorState(color);
    try {
      await AsyncStorage.setItem('glowColor', color);
    } catch (e) {
      console.error('Error saving glow color:', e);
    }
  }, []);

  const setShowHeroAvatar = useCallback(async (show: boolean) => {
    setShowHeroAvatarState(show);
    try {
      await AsyncStorage.setItem('showHeroAvatar', JSON.stringify(show));
    } catch (e) {
      console.error('Error saving hero avatar setting:', e);
    }
  }, []);

  const setBackgroundVideo = useCallback(async (uri: string | null) => {
    setBackgroundVideoState(uri);
    try {
      if (uri) {
        await AsyncStorage.setItem('backgroundVideo', uri);
        // Force avatar on when video is set
        setShowHeroAvatarState(true);
        await AsyncStorage.setItem('showHeroAvatar', JSON.stringify(true));
      } else {
        await AsyncStorage.removeItem('backgroundVideo');
      }
    } catch (e) {
      console.error('Error saving background video:', e);
    }
  }, []);

  const setPanelStyle = useCallback(async (style: string) => {
    setPanelStyleState(style);
    try { await AsyncStorage.setItem('panelStyle', style); } catch (e) { console.error('Error saving panelStyle:', e); }
  }, []);

  const setVoiceStyle = useCallback(async (style: string) => {
    setVoiceStyleState(style);
    try { await AsyncStorage.setItem('voiceStyle', style); } catch (e) { console.error('Error saving voiceStyle:', e); }
  }, []);

  const setLayoutStyle = useCallback(async (style: string) => {
    setLayoutStyleState(style);
    try { await AsyncStorage.setItem('layoutStyle', style); } catch (e) { console.error('Error saving layoutStyle:', e); }
  }, []);

  const setScannerStyle = useCallback(async (style: string) => {
    setScannerStyleState(style);
    try { await AsyncStorage.setItem('scannerStyle', style); } catch (e) { console.error('Error saving scannerStyle:', e); }
  }, []);

  const setHeroHidden = useCallback(async (hidden: boolean) => {
    setHeroHiddenState(hidden);
    try { await AsyncStorage.setItem('heroHidden', JSON.stringify(hidden)); } catch (e) { console.error('Error saving heroHidden:', e); }
  }, []);

  const requestOpenScanner = useCallback(() => {
    setScannerOpenRequest(c => c + 1);
  }, []);

  const setChatVisible = useCallback(async (visible: boolean) => {
    setChatVisibleState(visible);
    try { await AsyncStorage.setItem('chatVisible', JSON.stringify(visible)); } catch (e) { console.error('Error saving chatVisible:', e); }
  }, []);

  const startSignalsMonitoring = useCallback((phoneSecret: string) => {
    console.log('Starting signals monitoring with phone secret:', phoneSecret);

    const onSignalReceived = (signal: SignalLog) => {
      console.log('Signal received in app provider:', signal);
      setSignalLogs(currentLogs => {
        const newLogs = [signal, ...currentLogs];
        // Keep only last 50 signals in state for performance
        return newLogs.slice(0, 50);
      });

      // Set as new signal for dynamic island notification
      setNewSignal(signal);

      // Check if this signal is for an active symbol and should trigger trading
      const symbolName = signal.asset;
      const isActiveInLegacy = activeSymbols.some(s => s.symbol === symbolName);
      const isActiveInMT4 = mt4Symbols.some(s => s.symbol === symbolName);
      const isActiveInMT5 = mt5Symbols.some(s => s.symbol === symbolName);

      console.log('Signal received - checking if active:', {
        symbolName,
        isActiveInLegacy,
        isActiveInMT4,
        isActiveInMT5,
        activeSymbols: activeSymbols.map(s => s.symbol),
        mt4Symbols: mt4Symbols.map(s => s.symbol),
        mt5Symbols: mt5Symbols.map(s => s.symbol)
      });

      if (isActiveInLegacy || isActiveInMT4 || isActiveInMT5) {
        console.log('✅ Signal is for active symbol, triggering trading WebView:', symbolName);
        console.log('Setting trading signal:', signal);
        console.log('Setting showTradingWebView to true');
        setTradingSignal(signal);
        setShowTradingWebView(true);
      } else {
        console.log('❌ Signal ignored - not for active symbol:', symbolName);
      }
    };

    const onError = (error: string) => {
      console.error('Signals monitoring error:', error);
    };

    signalsMonitor.startMonitoring(phoneSecret, onSignalReceived, onError);
    setIsSignalsMonitoring(true);
  }, [activeSymbols, mt4Symbols, mt5Symbols]);

  const stopSignalsMonitoring = useCallback(() => {
    console.log('Stopping signals monitoring');
    signalsMonitor.stopMonitoring();
    setIsSignalsMonitoring(false);
  }, []);

  const clearSignalLogs = useCallback(() => {
    console.log('Clearing signal logs');
    signalsMonitor.clearSignalLogs();
    setSignalLogs([]);
  }, []);

  const dismissNewSignal = useCallback(() => {
    console.log('Dismissing new signal notification');
    setNewSignal(null);
  }, []);

  const setTradingSignalCallback = useCallback((signal: SignalLog | null) => {
    setTradingSignal(signal);
  }, []);

  const setShowTradingWebViewCallback = useCallback((show: boolean) => {
    setShowTradingWebView(show);
    if (!show) {
      // Clear trading signal when closing WebView
      setTradingSignal(null);
      setManualTradeRequest(null);
    }
  }, []);

  const placeManualTrade = useCallback((req: Omit<ManualTradeRequest, 'platform'> & { platform?: 'MT4' | 'MT5' }): PlaceManualTradeResult => {
    const symbol = req.symbol.trim().toUpperCase();
    if (!symbol) return { ok: false, error: 'Missing symbol.' };

    const inMt4 = mt4Symbols.some(s => s.symbol.toUpperCase() === symbol);
    const inMt5 = mt5Symbols.some(s => s.symbol.toUpperCase() === symbol);
    const hasMt4Account = !!(mt4Account?.login && mt4Account?.password && mt4Account?.server);
    const hasMt5Account = !!(mt5Account?.login && mt5Account?.password && mt5Account?.server);

    if (!hasMt4Account && !hasMt5Account) {
      return {
        ok: false,
        error: 'No MT4/MT5 account configured. Add one in settings before placing trades.',
      };
    }

    let platform: 'MT4' | 'MT5';
    if (req.platform) {
      if (req.platform === 'MT4' && !hasMt4Account) {
        return { ok: false, error: 'MT4 account not configured.' };
      }
      if (req.platform === 'MT5' && !hasMt5Account) {
        return { ok: false, error: 'MT5 account not configured.' };
      }
      platform = req.platform;
    } else if (inMt5 && hasMt5Account) {
      platform = 'MT5';
    } else if (inMt4 && hasMt4Account) {
      platform = 'MT4';
    } else if (hasMt5Account) {
      platform = 'MT5';
    } else {
      platform = 'MT4';
    }

    const manual: ManualTradeRequest = {
      symbol,
      action: req.action,
      lot: req.lot,
      count: req.count,
      platform,
      slPrice: req.slPrice,
      tpPrice: req.tpPrice,
    };

    const synthetic: SignalLog = {
      id: `manual-${Date.now()}`,
      asset: symbol,
      action: req.action,
      price: '0',
      tp: req.tpPrice !== undefined ? String(req.tpPrice) : '',
      sl: req.slPrice !== undefined ? String(req.slPrice) : '',
      time: new Date().toISOString(),
      latestupdate: new Date().toISOString(),
      receivedAt: new Date(),
    };

    console.log('[placeManualTrade] dispatching', { symbol, action: req.action, lot: req.lot, count: req.count, platform, configured: inMt4 || inMt5 });

    setManualTradeRequest(manual);
    setTradingSignal(synthetic);
    setShowTradingWebView(true);

    return { ok: true, platform };
  }, [mt4Symbols, mt5Symbols, mt4Account, mt5Account]);

  // Initialize signals monitoring state on mount
  useEffect(() => {
    setIsSignalsMonitoring(signalsMonitor.isRunning());
    setSignalLogs(signalsMonitor.getSignalLogs());
  }, []);

  // Auto-start/stop signals monitoring based on EA status and bot active state
  useEffect(() => {
    const connectedEAWithSecret = eas.find(ea =>
      ea.status === 'connected' && ea.phoneSecretKey
    );

    console.log('Signals monitoring effect triggered:', {
      isBotActive,
      hasConnectedEA: !!connectedEAWithSecret,
      phoneSecretKey: connectedEAWithSecret?.phoneSecretKey ? 'present' : 'missing',
      isCurrentlyMonitoring: signalsMonitor.isRunning()
    });

    if (isBotActive && connectedEAWithSecret && connectedEAWithSecret.phoneSecretKey) {
      // Start monitoring if bot is active and we have a connected EA with phone secret
      if (!signalsMonitor.isRunning()) {
        console.log('Auto-starting signals monitoring for EA:', connectedEAWithSecret.name);
        startSignalsMonitoring(connectedEAWithSecret.phoneSecretKey);
      } else {
        console.log('Signals monitoring already running, continuing...');
      }
    } else {
      // Stop monitoring if bot is not active or no connected EA with phone secret
      if (signalsMonitor.isRunning()) {
        console.log('Auto-stopping signals monitoring - bot inactive or no connected EA');
        stopSignalsMonitoring();
      }
    }
  }, [eas, isBotActive, startSignalsMonitoring, stopSignalsMonitoring]);



  return useMemo(() => ({
    user,
    eas,
    mtAccount,
    mt4Account,
    mt5Account,
    isFirstTime,
    isHydrated,
    activeSymbols,
    mt4Symbols,
    mt5Symbols,
    isBotActive,
    signalLogs,
    isSignalsMonitoring,
    newSignal,
    tradingSignal,
    showTradingWebView,
    manualTradeRequest,
    databaseSignal,
    isDatabaseSignalsPolling,
    glowColor,
    setGlowColor,
    showHeroAvatar,
    setShowHeroAvatar,
    backgroundVideo,
    setBackgroundVideo,
    panelStyle,
    setPanelStyle,
    voiceStyle,
    setVoiceStyle,
    layoutStyle,
    setLayoutStyle,
    scannerStyle,
    setScannerStyle,
    heroHidden,
    setHeroHidden,
    scannerOpenRequest,
    requestOpenScanner,
    chatVisible,
    setChatVisible,
    setUser,
    addEA,
    removeEA,
    setActiveEA,
    setMTAccount,
    setMT4Account,
    setMT5Account,
    setIsFirstTime,
    activateSymbol,
    activateMT4Symbol,
    activateMT5Symbol,
    deactivateSymbol,
    deactivateMT4Symbol,
    deactivateMT5Symbol,
    setBotActive,
    requestOverlayPermission,
    startSignalsMonitoring,
    stopSignalsMonitoring,
    clearSignalLogs,
    dismissNewSignal,
    setTradingSignal: setTradingSignalCallback,
    setShowTradingWebView: setShowTradingWebViewCallback,
    placeManualTrade,
  }), [user, eas, mtAccount, mt4Account, mt5Account, isFirstTime, isHydrated, activeSymbols, mt4Symbols, mt5Symbols, isBotActive, signalLogs, isSignalsMonitoring, newSignal, tradingSignal, showTradingWebView, manualTradeRequest, databaseSignal, isDatabaseSignalsPolling, glowColor, setGlowColor, showHeroAvatar, setShowHeroAvatar, backgroundVideo, setBackgroundVideo, panelStyle, setPanelStyle, voiceStyle, setVoiceStyle, layoutStyle, setLayoutStyle, scannerStyle, setScannerStyle, heroHidden, setHeroHidden, scannerOpenRequest, requestOpenScanner, chatVisible, setChatVisible, setUser, addEA, removeEA, setActiveEA, setMTAccount, setMT4Account, setMT5Account, setIsFirstTime, activateSymbol, activateMT4Symbol, activateMT5Symbol, deactivateSymbol, deactivateMT4Symbol, deactivateMT5Symbol, setBotActive, requestOverlayPermission, startSignalsMonitoring, stopSignalsMonitoring, clearSignalLogs, dismissNewSignal, setTradingSignalCallback, setShowTradingWebViewCallback, placeManualTrade]);
});