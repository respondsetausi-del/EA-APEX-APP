import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, SafeAreaView, Alert, ActivityIndicator, Image, Platform, KeyboardAvoidingView, ScrollView } from 'react-native';
import { WebView } from 'react-native-webview';
import { router } from 'expo-router';
// Networking disabled: avoid external browser/payment flows
import { useApp } from '@/providers/app-provider';
import { apiService } from '@/services/api';
import Colors, { neonWebShadow } from '@/constants/colors';
import { apexPaymentRenewUrl, apexShopIndexIosUrl } from '@/constants/apex-backend';
import { APEX_LOGO } from '@/constants/brand-assets';

export default function LoginScreen() {
  const [mentorId, setMentorId] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isPaymentProcessing, setIsPaymentProcessing] = useState<boolean>(false);
  // In-app modal (reliable on iOS Safari)
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [modalTitle, setModalTitle] = useState<string>('');
  const [modalMessage, setModalMessage] = useState<string>('');
  const [paymentVisible, setPaymentVisible] = useState<boolean>(false);
  const [paymentUrl, setPaymentUrl] = useState<string>('');
  // When set, the modal's OK button transitions into the payment WebView
  // (used for device-mismatch reactivation: show the explanation first,
  // then offer payment as the recovery path).
  const [pendingPaymentUrl, setPendingPaymentUrl] = useState<string>('');
  const { setUser, eas, isHydrated, emailAuthenticated, setEmailAuthenticated, glowColor } = useApp();

  // If the user is already authenticated, bounce them to the right place.
  // Read from context (the provider is the single source of truth now), so
  // we don't race with AuthGate doing its own AsyncStorage read.
  useEffect(() => {
    if (!isHydrated) return;
    if (!emailAuthenticated) return;
    if (eas.length > 0) {
      router.replace('/(tabs)');
    } else {
      router.replace('/license');
    }
  }, [isHydrated, emailAuthenticated, eas.length]);

  // Open a merchant URL from a web context, picking the right strategy:
  //  - iOS / Android standalone PWA (display: standalone) silently drops
  //    window.open(_blank), leaving the user with a "spinner reverts"
  //    feeling. In that mode we replace the document instead — PayFast
  //    handles return navigation and the user can swipe back to the PWA.
  //  - In a regular browser tab we try _blank first; if the popup gets
  //    blocked (returns null) we still fall back to the same-tab redirect
  //    so the flow always becomes visible.
  const openPaymentUrlOnWeb = (url: string) => {
    if (typeof window === 'undefined') return;
    const w: any = window;
    const isStandalone =
      w.navigator?.standalone === true ||
      (typeof w.matchMedia === 'function' && w.matchMedia('(display-mode: standalone)').matches);
    if (isStandalone) {
      w.location.href = url;
      return;
    }
    const popup = w.open(url, '_blank', 'noopener,noreferrer');
    if (!popup) {
      w.location.href = url;
    }
  };

  const handleProceed = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email');
      return;
    }

    if (!email.includes('@')) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    setIsLoading(true);

    try {
      const trimmedEmail = email.trim();
      // Email is the only required field. Empty mentor IDs silently fall
      // back to the house default so existing affiliate-tracking and
      // backwards-compat reports keep working.
      const trimmedMentor = mentorId.trim() || '115';
      const account = await apiService.authenticate({ email: trimmedEmail, mentor: trimmedMentor });

      // If user doesn't exist or hasn't paid: redirect to payment/shop page.
      // On web, pop into a new tab (PayFast often refuses to be iframed).
      if (account.status === 'not_found' || !account.paid) {
        const url = apexShopIndexIosUrl(trimmedEmail, trimmedMentor);
        if (Platform.OS === 'web') {
          openPaymentUrlOnWeb(url);
        } else {
          setPaymentUrl(url);
          setPaymentVisible(true);
        }
        return;
      }

      // If invalid mentor id is returned, block with message
      if ((account as any).invalidMentor === 1) {
        setModalTitle('Invalid Mentor ID');
        setModalMessage('The Mentor ID does not match our records for this email.');
        setModalVisible(true);
        return;
      }

      // Subscription expired
      if ((account as any).expired) {
        const expiryStr = (account as any).expiry_date
          ? new Date((account as any).expiry_date).toLocaleDateString()
          : 'recently';
        setModalTitle('Subscription Expired');
        setModalMessage(`Your subscription expired on ${expiryStr}. Please renew to continue using EA APEX.`);
        setModalVisible(true);
        return;
      }

      // Device mismatch — show the explanation modal first, then transition
      // into the PayFast reactivate flow (`payment/renew.php`) when the user
      // taps Reactivate. The webhook (payfast_webhook.php) clears the bound
      // device_id on payment success so the next login from this device
      // auto-rebinds via check_email_device.php.
      if ((account as any).device_mismatch) {
        const url = apexPaymentRenewUrl(trimmedEmail, trimmedMentor);
        setModalTitle('Device Not Authorized');
        setModalMessage('This subscription is already active on another device. Tap Reactivate to pay and bind this device.');
        setPendingPaymentUrl(url);
        setModalVisible(true);
        return;
      }

      // If already used: show iOS-safe in-app modal and block
      if (account.used) {
        setModalTitle('Email Already Used');
        setModalMessage('This email has already been used on a device. Please contact support if you need assistance.');
        setModalVisible(true);
        return;
      }

      // Allow only existing + not used
      // Mark that email authentication was successful (context update + persisted).
      // Both writes are awaited so the user record is on disk before the
      // redirect — if the app is killed during the navigation transition,
      // the next cold start still finds a complete { user, emailAuthenticated }
      // pair and doesn't kick the user back to /login.
      await setEmailAuthenticated(true);
      await setUser({ mentorId: trimmedMentor, email: account.email });
      // Returning users with a saved license skip the /license detour —
      // sending them through it was the cause of the "login appears twice"
      // flash where the license screen briefly rendered before the auth-gate
      // effect bounced them to tabs. Route directly based on EA state.
      if (eas.length > 0) {
        router.replace('/(tabs)');
      } else {
        router.replace('/license');
      }
    } catch (error) {
      console.error('Login error:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePaymentFlow = async () => {
    // Offline mode: do nothing
    setIsPaymentProcessing(false);
    Alert.alert('Offline mode', 'Payments are disabled. Continuing locally.');
  };

  return (
    <SafeAreaView style={styles.container}>
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
              <View
                style={[
                  styles.logoRing,
                  Platform.OS === 'web' && { borderWidth: 0, boxShadow: neonWebShadow(glowColor, 'medium') } as any,
                  { borderColor: glowColor + '40' },
                ]}
              >
                <Image source={APEX_LOGO} style={styles.appIcon} resizeMode="contain" />
              </View>
              <Text style={[styles.title, { color: glowColor, textShadowColor: glowColor + '66', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 12 }]}>
                EA APEX
              </Text>
              <Text style={[styles.subtitle, { color: glowColor + '99' }]}>Login</Text>
            </View>

            <View style={styles.form}>
              <View
                style={[
                  styles.inputShell,
                  Platform.OS === 'web' && { borderWidth: 0, boxShadow: neonWebShadow(glowColor, 'soft') } as any,
                  { borderColor: glowColor + '35' },
                ]}
              >
                <TextInput
                  style={styles.input}
                  placeholder="Mentor ID"
                  placeholderTextColor="rgba(255,255,255,0.38)"
                  value={mentorId}
                  onChangeText={setMentorId}
                  autoCapitalize="none"
                />
              </View>

              <View
                style={[
                  styles.inputShell,
                  Platform.OS === 'web' && { borderWidth: 0, boxShadow: neonWebShadow(glowColor, 'soft') } as any,
                  { borderColor: glowColor + '35' },
                ]}
              >
                <TextInput
                  style={styles.input}
                  placeholder="Email"
                  placeholderTextColor="rgba(255,255,255,0.38)"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <TouchableOpacity
                style={[
                  styles.proceedButton,
                  { backgroundColor: glowColor },
                  Platform.OS === 'web' && { boxShadow: neonWebShadow(glowColor, 'medium') } as any,
                  (isLoading || isPaymentProcessing) && styles.proceedButtonDisabled,
                ]}
                onPress={handleProceed}
                disabled={isLoading || isPaymentProcessing}
              >
                {isLoading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator color="#0a0a0c" size="small" />
                    <Text style={styles.proceedButtonText}>Checking...</Text>
                  </View>
                ) : isPaymentProcessing ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator color="#0a0a0c" size="small" />
                    <Text style={styles.proceedButtonText}>Processing Payment...</Text>
                  </View>
                ) : (
                  <Text style={styles.proceedButtonText}>Proceed</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      {modalVisible && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{modalTitle}</Text>
            <Text style={styles.modalMessage}>{modalMessage}</Text>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => {
                setModalVisible(false);
                if (pendingPaymentUrl) {
                  // On web, pop the payment page out into a new tab — PayFast
                  // often blocks iframing, and a real tab gives the user the
                  // full PayFast UX. In iOS PWA standalone mode openPaymentUrlOnWeb
                  // falls back to a same-window redirect so the action stays
                  // visible. Native still uses the in-app WebView.
                  if (Platform.OS === 'web') {
                    openPaymentUrlOnWeb(pendingPaymentUrl);
                  } else {
                    setPaymentUrl(pendingPaymentUrl);
                    setPaymentVisible(true);
                  }
                  setPendingPaymentUrl('');
                }
              }}
            >
              <Text style={styles.modalButtonText}>{pendingPaymentUrl ? 'Reactivate' : 'OK'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      {paymentVisible && (
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { width: '100%', maxWidth: 800, height: '80%' }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text style={styles.modalTitle}>Complete Payment</Text>
              <TouchableOpacity onPress={() => setPaymentVisible(false)}>
                <Text style={[styles.modalButtonText, { color: Colors.textSecondary }]}>Close</Text>
              </TouchableOpacity>
            </View>
            {Platform.OS === 'web' ? (
              <View style={{ flex: 1, borderRadius: 8, overflow: 'hidden' }}>
                {/* On web, render the payment page inline via iframe inside the modal */}
                <iframe
                  src={paymentUrl}
                  style={{ width: '100%', height: '100%', border: '0' }}
                  loading="eager"
                  allow="payment *; clipboard-write;"
                />
              </View>
            ) : (
              <View style={{ flex: 1, borderRadius: 8, overflow: 'hidden' }}>
                <WebView source={{ uri: paymentUrl }} startInLoadingState />
              </View>
            )}
          </View>
        </View>
      )}
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
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logoRing: {
    width: 108,
    height: 108,
    borderRadius: 26,
    borderWidth: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
  },
  appIcon: {
    width: 88,
    height: 88,
    borderRadius: 18,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 2,
    marginTop: 18,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 2,
    marginTop: 6,
  },
  form: {
    width: '100%',
    maxWidth: 320,
  },
  inputShell: {
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: '#000000',
    marginBottom: 14,
    overflow: 'hidden',
  },
  input: {
    backgroundColor: 'transparent',
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#FFFFFF',
  },
  proceedButton: {
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 10,
  },
  proceedButtonText: {
    color: '#0a0a0c',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginLeft: 8,
  },
  proceedButtonDisabled: {
    opacity: 0.7,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
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
    backgroundColor: '#000000',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(0, 251, 255, 0.22)',
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  modalMessage: {
    fontSize: 14,
    color: '#CCCCCC',
    marginBottom: 16,
  },
  modalButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: 12,
  },
  modalButtonText: {
    color: '#0a0a0c',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
  },
});