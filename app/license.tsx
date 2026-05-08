import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, SafeAreaView, Alert, ActivityIndicator, Image, KeyboardAvoidingView, ScrollView, Platform } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useApp } from '@/providers/app-provider';
import { apiService } from '@/services/api';
import Colors from '@/constants/colors';

export default function LicenseScreen() {
  const [licenseKey, setLicenseKey] = useState<string>('');
  const [isActivating, setIsActivating] = useState<boolean>(false);
  const { addEA, eas, glowColor, isHydrated, emailAuthenticated } = useApp();
  const hasActiveBots = eas.length > 0;
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [modalTitle, setModalTitle] = useState<string>('');
  const [modalMessage, setModalMessage] = useState<string>('');

  const handleActivate = async () => {
    if (!licenseKey.trim()) {
      Alert.alert('Error', 'Please enter a valid license key');
      return;
    }

    // Check if license key already exists
    const existingEA = eas.find(ea => ea.licenseKey.toLowerCase().trim() === licenseKey.trim().toLowerCase());
    if (existingEA) {
      setModalTitle('License Already Added');
      setModalMessage('This license key is already added on this device.');
      setModalVisible(true);
      return;
    }

    setIsActivating(true);

    try {
      console.log('Starting license activation process...');

      // Attempt: authenticate with just the license key
      const authResponse = await apiService.authenticateLicense({
        licence: licenseKey.trim(),
      });

      if (authResponse.message === 'used') {
        setModalTitle('License Already Used');
        setModalMessage('This license key is bound to another device. Please contact support if you need assistance.');
        setModalVisible(true);
        return;
      }

      if (authResponse.message !== 'accept' || !authResponse.data) {
        setModalTitle('Invalid License');
        setModalMessage('The license key does not exist or authentication failed.');
        setModalVisible(true);
        return;
      }

      // Success path
      const data = authResponse.data;

      // Generate unique ID
      const timestamp = Date.now();
      const randomPart = Math.random().toString(36).substr(2, 9);
      const keyHash = licenseKey.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      const uniqueId = `ea_${timestamp}_${randomPart}_${keyHash}`;

      const newEA = {
        id: uniqueId,
        name: data.ea_name || 'EA CONVERTER',
        licenseKey: licenseKey.trim(),
        status: 'connected' as const,
        description: (data.owner && data.owner.name) ? data.owner.name : 'EA CONVERTER',
        phoneSecretKey: data.phone_secret_key,
        userData: data,
      };

      const success = await addEA(newEA);
      if (success) {
        // Wait longer to ensure state is fully updated before navigation
        await new Promise(resolve => setTimeout(resolve, 600));
        console.log('License added successfully, navigating to tabs...');
        router.replace('/(tabs)');
      } else {
        Alert.alert('Error', 'Failed to save this license locally.');
      }
    } catch (error) {
      console.error('Critical error during license activation:', error);
      Alert.alert('Network Error', 'Failed to reach the server. Please try again.');
    } finally {
      setIsActivating(false);
    }
  };

  const handleBack = () => {
    router.back();
  };

  // Block the render until hydration completes and the AuthGate has had a
  // chance to evaluate. If the user somehow reached this screen without
  // email auth, AuthGate redirects — we just refuse to paint the form in
  // the meantime.
  if (!isHydrated || !emailAuthenticated) {
    return <SafeAreaView style={styles.container} />;
  }

  return (
    <SafeAreaView style={styles.container}>
      {hasActiveBots && (
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <ArrowLeft size={24} color={glowColor} />
          </TouchableOpacity>
        </View>
      )}
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            <View style={styles.logoContainer}>
              <Image
                source={require('@/assets/images/icon.png')}
                style={styles.appIcon}
                resizeMode="contain"
              />
              <Text style={[styles.title, { color: glowColor }]}>Enter License Key</Text>
            </View>

            <View style={styles.form}>
              <TextInput
                style={[styles.input, { borderColor: glowColor + '50' }]}
                placeholder="License Key"
                placeholderTextColor={glowColor + '4D'}
                value={licenseKey}
                onChangeText={setLicenseKey}
                autoCapitalize="characters"
              />

              <TouchableOpacity
                style={[
                  styles.activateButton,
                  { borderColor: glowColor + '80' },
                  isActivating && styles.activateButtonDisabled,
                  Platform.OS === 'web' ? {
                    boxShadow: `0 0 6px 1px ${glowColor}80, 0 0 18px 4px ${glowColor}33`,
                  } as any : {},
                ]}
                onPress={handleActivate}
                disabled={isActivating}
              >
                {isActivating ? (
                  <View style={styles.activatingContainer}>
                    <ActivityIndicator size="small" color={glowColor} />
                    <Text style={[styles.activatingText, { color: glowColor }]}>Activating...</Text>
                  </View>
                ) : (
                  <Text style={[styles.activateButtonText, { color: glowColor }]}>Activate EA</Text>
                )}
              </TouchableOpacity>

              <Text style={styles.hint}>
                Enter your license key to activate EA
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      {modalVisible && (
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { borderColor: glowColor + '50', borderWidth: 1 },
            Platform.OS === 'web' ? { boxShadow: `0 0 10px 2px ${glowColor}60` } as any : {}
          ]}>
            <Text style={[styles.modalTitle, { color: glowColor }]}>{modalTitle}</Text>
            <Text style={styles.modalMessage}>{modalMessage}</Text>
            <TouchableOpacity
              style={[styles.modalButton, { borderWidth: 1, borderColor: glowColor + '80' }]}
              onPress={() => setModalVisible(false)}
            >
              <Text style={[styles.modalButtonText, { color: glowColor }]}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 60,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 16,
    letterSpacing: 1,
  },
  form: {
    width: '100%',
    maxWidth: 300,
  },
  input: {
    backgroundColor: '#080D1A',
    borderWidth: 1,
    borderRadius: 28,
    paddingHorizontal: 20,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 16,
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  activateButton: {
    backgroundColor: '#080D1A',
    paddingVertical: 16,
    borderRadius: 28,
    marginTop: 8,
    borderWidth: 1,
  },
  activateButtonDisabled: {
    backgroundColor: '#999999',
  },
  activatingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activateButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  activatingText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginLeft: 8,
  },
  hint: {
    fontSize: 12,
    color: '#CCCCCC',
    textAlign: 'center',
    marginTop: 12,
  },
  appIcon: {
    width: 80,
    height: 80,
    borderRadius: 20,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#080D1A',
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  modalMessage: {
    fontSize: 14,
    color: '#CCCCCC',
    marginBottom: 16,
    lineHeight: 20,
  },
  modalButton: {
    backgroundColor: '#080D1A',
    paddingVertical: 12,
    borderRadius: 28,
  },
  modalButtonText: {
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
  },
});