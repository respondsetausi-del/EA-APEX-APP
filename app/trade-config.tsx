import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, TextInput, ScrollView, Modal, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { ArrowLeft, ChevronDown, Trash2 } from 'lucide-react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useApp } from '@/providers/app-provider';

interface TradeConfig {
  lotSize: string;
  direction: 'BUY' | 'SELL' | 'BOTH';
  platform: 'MT4' | 'MT5';
  numberOfTrades: string;
}

export default function TradeConfigScreen() {
  const { symbol } = useLocalSearchParams<{ symbol: string }>();
  const { activeSymbols, activateSymbol, deactivateSymbol, mt4Symbols, mt5Symbols, activateMT4Symbol, activateMT5Symbol, deactivateMT4Symbol, deactivateMT5Symbol, glowColor } = useApp();
  
  const [config, setConfig] = useState<TradeConfig>({
    lotSize: '0.01',
    direction: 'BUY',
    platform: 'MT5',
    numberOfTrades: '1'
  });
  
  // Check if symbol is active in the current platform's separate storage
  const isSymbolActive = config.platform === 'MT4' 
    ? mt4Symbols.some(s => s.symbol === symbol)
    : mt5Symbols.some(s => s.symbol === symbol);
    
  // Also check legacy activeSymbols for backward compatibility
  const legacySymbolActive = activeSymbols.some(s => s.symbol === symbol);
  const legacySymbolConfig = activeSymbols.find(s => s.symbol === symbol);
  
  // Load existing config when symbol changes (initial load only)
  useEffect(() => {
    const loadInitialConfig = () => {
      // Check legacy config first for backward compatibility
      if (legacySymbolConfig) {
        setConfig({
          lotSize: legacySymbolConfig.lotSize,
          direction: legacySymbolConfig.direction,
          platform: legacySymbolConfig.platform,
          numberOfTrades: legacySymbolConfig.numberOfTrades
        });
        return;
      }
      
      // Check MT5 config first (default platform)
      const mt5Config = mt5Symbols.find(s => s.symbol === symbol);
      if (mt5Config) {
        setConfig(prev => ({
          ...prev,
          lotSize: mt5Config.lotSize,
          direction: mt5Config.direction,
          platform: 'MT5',
          numberOfTrades: mt5Config.numberOfTrades
        }));
        return;
      }
      
      // Check MT4 config
      const mt4Config = mt4Symbols.find(s => s.symbol === symbol);
      if (mt4Config) {
        setConfig(prev => ({
          ...prev,
          lotSize: mt4Config.lotSize,
          direction: mt4Config.direction,
          platform: 'MT4',
          numberOfTrades: mt4Config.numberOfTrades
        }));
        return;
      }
      
      // Reset to defaults if no config found
      setConfig(prev => ({
        ...prev,
        lotSize: '0.01',
        direction: 'BUY',
        platform: 'MT5',
        numberOfTrades: '1'
      }));
    };
    
    // Only load initial config when component mounts or symbol changes
    loadInitialConfig();
  }, [symbol, mt4Symbols, mt5Symbols, legacySymbolConfig]);
  
  const [showDirectionModal, setShowDirectionModal] = useState(false);
  const [showPlatformModal, setShowPlatformModal] = useState(false);

  const handleBack = () => {
    router.back();
  };

  const handleSetSymbol = () => {
    if (symbol) {
      // Save to both legacy and separate storage for compatibility
      activateSymbol({
        symbol,
        lotSize: config.lotSize,
        direction: config.direction,
        platform: config.platform,
        numberOfTrades: config.numberOfTrades
      });
      
      // Save to platform-specific storage (MT4 and MT5 are stored separately)
      if (config.platform === 'MT4') {
        activateMT4Symbol({
          symbol,
          lotSize: config.lotSize,
          direction: config.direction,
          numberOfTrades: config.numberOfTrades
        });
        console.log('MT4 symbol activated:', { symbol, ...config });
      } else {
        activateMT5Symbol({
          symbol,
          lotSize: config.lotSize,
          direction: config.direction,
          numberOfTrades: config.numberOfTrades
        });
        console.log('MT5 symbol activated:', { symbol, ...config });
      }
      
      router.back();
    }
  };
  
  const handleRemoveSymbol = () => {
    if (symbol) {
      // Remove from both legacy and separate storage
      deactivateSymbol(symbol);
      
      // Remove from platform-specific storage (MT4 and MT5 are stored separately)
      if (config.platform === 'MT4') {
        deactivateMT4Symbol(symbol);
        console.log('MT4 symbol deactivated:', symbol);
      } else {
        deactivateMT5Symbol(symbol);
        console.log('MT5 symbol deactivated:', symbol);
      }
      
      router.back();
    }
  };

  const updateConfig = (key: keyof TradeConfig, value: string) => {
    setConfig(prev => {
      const newConfig = { ...prev, [key]: value };
      
      // If platform is being changed, load existing config for that platform
      if (key === 'platform' && symbol) {
        const targetPlatform = value as 'MT4' | 'MT5';
        
        if (targetPlatform === 'MT4') {
          const mt4Config = mt4Symbols.find(s => s.symbol === symbol);
          if (mt4Config) {
            return {
              ...newConfig,
              lotSize: mt4Config.lotSize,
              direction: mt4Config.direction,
              numberOfTrades: mt4Config.numberOfTrades
            };
          }
        } else if (targetPlatform === 'MT5') {
          const mt5Config = mt5Symbols.find(s => s.symbol === symbol);
          if (mt5Config) {
            return {
              ...newConfig,
              lotSize: mt5Config.lotSize,
              direction: mt5Config.direction,
              numberOfTrades: mt5Config.numberOfTrades
            };
          }
        }
        
        // If no config found for target platform, use defaults
        return {
          ...newConfig,
          lotSize: '0.01',
          direction: 'BUY',
          numberOfTrades: '1'
        };
      }
      
      return newConfig;
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: glowColor + '30' }]}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <ArrowLeft color={glowColor} size={24} />
        </TouchableOpacity>
        
        <View style={styles.headerContent}>
          <Text style={[styles.headerTitle, { color: glowColor }]}>TRADE CONFIG</Text>
          <Text style={styles.symbolText}>{symbol}</Text>
        </View>
      </View>

      <KeyboardAvoidingView 
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView 
          style={styles.content} 
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
        {/* Lot Size */}
        <View style={styles.configSection}>
          <Text style={[styles.sectionTitle, { color: glowColor + '80' }]}>LOT SIZE</Text>
          <TextInput
            style={[styles.input, { borderColor: glowColor + '50' }]}
            value={config.lotSize}
            onChangeText={(value) => updateConfig('lotSize', value)}
            keyboardType="decimal-pad"
            placeholder="0.01"
            placeholderTextColor={glowColor + '33'}
          />
        </View>

        {/* Direction */}
        <View style={styles.configSection}>
          <Text style={[styles.sectionTitle, { color: glowColor + '80' }]}>DIRECTION</Text>
          <TouchableOpacity 
            style={[styles.picker, { borderColor: glowColor + '50' }]}
            onPress={() => setShowDirectionModal(true)}
          >
            <Text style={styles.pickerText}>{config.direction}</Text>
            <ChevronDown color={glowColor} size={20} />
          </TouchableOpacity>
        </View>

        {/* Platform */}
        <View style={styles.configSection}>
          <Text style={[styles.sectionTitle, { color: glowColor + '80' }]}>PLATFORM</Text>
          <TouchableOpacity 
            style={[styles.picker, { borderColor: glowColor + '50' }]}
            onPress={() => setShowPlatformModal(true)}
          >
            <Text style={styles.pickerText}>{config.platform}</Text>
            <ChevronDown color={glowColor} size={20} />
          </TouchableOpacity>
        </View>

        {/* Number of Trades */}
        <View style={styles.configSection}>
          <Text style={[styles.sectionTitle, { color: glowColor + '80' }]}>NUMBER OF TRADES</Text>
          <TextInput
            style={[styles.input, { borderColor: glowColor + '50' }]}
            value={config.numberOfTrades}
            onChangeText={(value) => updateConfig('numberOfTrades', value)}
            keyboardType="number-pad"
            placeholder="1"
            placeholderTextColor={glowColor + '33'}
          />
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity style={[styles.executeButton, { borderColor: glowColor + '80' },
            Platform.OS === 'web' ? { boxShadow: `0 0 6px 1px ${glowColor}80, 0 0 18px 4px ${glowColor}33` } as any : {}
          ]} onPress={handleSetSymbol}>
            <Text style={[styles.executeButtonText, { color: glowColor }]}>
              {(isSymbolActive || legacySymbolActive) ? 'UPDATE SYMBOL' : 'SET SYMBOL'}
            </Text>
          </TouchableOpacity>
          
          {(isSymbolActive || legacySymbolActive) && (
            <TouchableOpacity style={[styles.removeButton, { borderColor: '#FF444466' }]} onPress={handleRemoveSymbol}>
              <Trash2 color="#FF4444" size={20} />
              <Text style={styles.removeButtonText}>REMOVE</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
      </KeyboardAvoidingView>

      {/* Direction Modal */}
      <Modal
        visible={showDirectionModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDirectionModal(false)}
      >
        <Pressable 
          style={styles.modalOverlay}
          onPress={() => setShowDirectionModal(false)}
        >
          <View style={[styles.modalContent, { borderColor: glowColor + '50', borderWidth: 1 },
            Platform.OS === 'web' ? { boxShadow: `0 0 10px 2px ${glowColor}60` } as any : {}
          ]}>
            <Text style={[styles.modalTitle, { color: glowColor }]}>Select Direction</Text>
            {['BUY', 'SELL', 'BOTH'].map((direction) => (
              <TouchableOpacity
                key={direction}
                style={[
                  styles.modalOption,
                  config.direction === direction && { backgroundColor: glowColor + '20', borderColor: glowColor + '60' }
                ]}
                onPress={() => {
                  updateConfig('direction', direction as 'BUY' | 'SELL' | 'BOTH');
                  setShowDirectionModal(false);
                }}
              >
                <Text style={[
                  styles.modalOptionText,
                  config.direction === direction && { color: glowColor }
                ]}>
                  {direction}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* Platform Modal */}
      <Modal
        visible={showPlatformModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowPlatformModal(false)}
      >
        <Pressable 
          style={styles.modalOverlay}
          onPress={() => setShowPlatformModal(false)}
        >
          <View style={[styles.modalContent, { borderColor: glowColor + '50', borderWidth: 1 },
            Platform.OS === 'web' ? { boxShadow: `0 0 10px 2px ${glowColor}60` } as any : {}
          ]}>
            <Text style={[styles.modalTitle, { color: glowColor }]}>Select Platform</Text>
            {['MT4', 'MT5'].map((platform) => (
              <TouchableOpacity
                key={platform}
                style={[
                  styles.modalOption,
                  config.platform === platform && { backgroundColor: glowColor + '20', borderColor: glowColor + '60' }
                ]}
                onPress={() => {
                  updateConfig('platform', platform as 'MT4' | 'MT5');
                  setShowPlatformModal(false);
                }}
              >
                <Text style={[
                  styles.modalOptionText,
                  config.platform === platform && { color: glowColor }
                ]}>
                  {platform}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    marginRight: 16,
    padding: 4,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginBottom: 2,
  },
  symbolText: {
    color: '#CCCCCC',
    fontSize: 14,
    fontWeight: '500',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  configSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#080D1A',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  picker: {
    backgroundColor: '#080D1A',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pickerText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  modalContent: {
    backgroundColor: '#080D1A',
    borderRadius: 16,
    paddingVertical: 20,
    width: '100%',
    maxWidth: 300,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    letterSpacing: 0.5,
  },
  modalOption: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'transparent',
    marginHorizontal: 12,
    borderRadius: 10,
    marginBottom: 4,
  },
  selectedModalOption: {
  },
  modalOptionText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
  selectedModalOptionText: {
    fontWeight: 'bold',
  },
  buttonContainer: {
    marginTop: 32,
    marginBottom: 32,
    gap: 12,
  },
  executeButton: {
    backgroundColor: '#080D1A',
    borderRadius: 28,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
  },
  executeButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  removeButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderRadius: 28,
    paddingVertical: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  removeButtonText: {
    color: '#FF4444',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
});