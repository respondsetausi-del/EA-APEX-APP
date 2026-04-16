import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Animated,
} from 'react-native';
import { MessageCircle, Send, X, Mic, MicOff } from 'lucide-react-native';
import {
  parseCommand,
  promptForField,
  describeOrder,
  hasAllRequired,
  computeMissing,
  HELP_TEXT,
  type ParsedOrder,
  type MissingField,
} from '@/utils/trade-command-parser';
import { useApp } from '@/providers/app-provider';

export type ChatAuthor = 'user' | 'bot';
export type ChatMessageKind = 'text' | 'confirm-card';

export interface ChatMessage {
  id: string;
  author: ChatAuthor;
  kind: ChatMessageKind;
  text?: string;
  order?: ParsedOrder;
  timestamp: number;
  resolved?: 'confirmed' | 'cancelled';
}

interface TradeChatWidgetProps {
  glowColor: string;
  defaultLot?: number;
  defaultCount?: number;
}

type ConvoState =
  | { phase: 'idle' }
  | { phase: 'asking'; order: ParsedOrder; awaiting: MissingField }
  | { phase: 'confirming'; order: ParsedOrder; cardId: string };

const GREETING: ChatMessage = {
  id: 'greeting',
  author: 'bot',
  kind: 'text',
  text: 'Hi — I\'m your trade assistant. Tap the mic or type: "buy gold 0.01" or "sell EURUSD 3 trades". Say "help" for examples.',
  timestamp: 0,
};

function genId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function TradeChatWidget({
  glowColor,
  defaultLot = 0.01,
  defaultCount = 1,
}: TradeChatWidgetProps) {
  const { placeManualTrade } = useApp();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [input, setInput] = useState('');
  const [convo, setConvo] = useState<ConvoState>({ phase: 'idle' });
  const [isListening, setIsListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [voiceSupported, setVoiceSupported] = useState(true);
  const recognitionRef = useRef<any>(null);
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const pulse = useRef(new Animated.Value(1)).current;
  const micPulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (Platform.OS === 'web') {
      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SR) setVoiceSupported(false);
    } else {
      setVoiceSupported(false);
    }
  }, []);

  useEffect(() => {
    if (!isListening) {
      micPulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(micPulse, { toValue: 1.18, duration: 500, useNativeDriver: true }),
        Animated.timing(micPulse, { toValue: 1, duration: 500, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [isListening, micPulse]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.08, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 1200, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const scrollToEnd = useCallback(() => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
  }, []);

  const appendBot = useCallback(
    (text: string) => {
      setMessages(prev => [
        ...prev,
        { id: genId(), author: 'bot', kind: 'text', text, timestamp: Date.now() },
      ]);
      scrollToEnd();
    },
    [scrollToEnd]
  );

  const appendUser = useCallback(
    (text: string) => {
      setMessages(prev => [
        ...prev,
        { id: genId(), author: 'user', kind: 'text', text, timestamp: Date.now() },
      ]);
      scrollToEnd();
    },
    [scrollToEnd]
  );

  const appendConfirmCard = useCallback(
    (order: ParsedOrder): string => {
      const id = genId();
      setMessages(prev => [
        ...prev,
        { id, author: 'bot', kind: 'confirm-card', order, timestamp: Date.now() },
      ]);
      scrollToEnd();
      return id;
    },
    [scrollToEnd]
  );

  const resolveCard = useCallback((cardId: string, outcome: 'confirmed' | 'cancelled') => {
    setMessages(prev => prev.map(m => (m.id === cardId ? { ...m, resolved: outcome } : m)));
  }, []);

  const onConfirm = useCallback(
    (order: ParsedOrder, cardId: string) => {
      if (!order.action || !order.symbol) {
        appendBot('Missing action or symbol — cannot place trade.');
        return;
      }
      resolveCard(cardId, 'confirmed');
      const summary = describeOrder(order, { lot: defaultLot, count: defaultCount });

      const pipsDropped: string[] = [];
      if (order.slPips !== undefined) pipsDropped.push('SL');
      if (order.tpPips !== undefined) pipsDropped.push('TP');

      const result = placeManualTrade({
        symbol: order.symbol,
        action: order.action,
        lot: order.lot ?? defaultLot,
        count: order.count ?? defaultCount,
        slPrice: order.slPrice,
        tpPrice: order.tpPrice,
      });

      if (!result.ok) {
        appendBot(`⚠️ ${result.error ?? 'Could not place trade.'}`);
      } else {
        const lines = [`✅ Sent to ${result.platform}: ${summary}`];
        if (pipsDropped.length > 0) {
          lines.push(`ℹ️ ${pipsDropped.join(' & ')} in pips not supported yet — sent without.`);
        }
        appendBot(lines.join('\n'));
      }
      setConvo({ phase: 'idle' });
    },
    [appendBot, defaultCount, defaultLot, placeManualTrade, resolveCard]
  );

  const onCancel = useCallback(
    (cardId: string) => {
      resolveCard(cardId, 'cancelled');
      appendBot('Order cancelled.');
      setConvo({ phase: 'idle' });
    },
    [appendBot, resolveCard]
  );

  const processText = useCallback((raw: string) => {
    const text = raw.trim();
    if (!text) return;
    appendUser(text);

    const prior = convo.phase === 'idle' ? {} : convo.order;
    const awaiting = convo.phase === 'asking' ? convo.awaiting : undefined;
    const result = parseCommand(text, { prior, awaitingField: awaiting });

    if (result.kind === 'help') {
      appendBot(HELP_TEXT);
      return;
    }

    if (result.kind === 'cancel') {
      if (convo.phase === 'confirming') resolveCard(convo.cardId, 'cancelled');
      appendBot('Cancelled.');
      setConvo({ phase: 'idle' });
      return;
    }

    if (result.kind === 'confirm') {
      if (convo.phase === 'confirming' && hasAllRequired(convo.order)) {
        onConfirm(convo.order, convo.cardId);
      } else if (hasAllRequired(result.order)) {
        const cardId = appendConfirmCard(result.order);
        setConvo({ phase: 'confirming', order: result.order, cardId });
      } else {
        appendBot('Nothing to confirm yet.');
      }
      return;
    }

    if (result.kind === 'unknown') {
      if (result.unknownSymbol) {
        appendBot(
          `"${result.unknownSymbol}" isn't a symbol I know. Try gold, EURUSD, BTCUSD, US100, etc.`
        );
      } else {
        appendBot("Didn't catch that. Try \"buy gold\" or type \"help\".");
      }
      return;
    }

    const merged = result.order;
    const missing = computeMissing(merged);
    if (missing.length > 0) {
      const next = missing[0];
      if (result.unknownSymbol && next === 'symbol') {
        appendBot(
          `"${result.unknownSymbol}" isn't a symbol I know. ${promptForField(next)}`
        );
      } else {
        appendBot(promptForField(next));
      }
      setConvo({ phase: 'asking', order: merged, awaiting: next });
      return;
    }

    const cardId = appendConfirmCard(merged);
    setConvo({ phase: 'confirming', order: merged, cardId });
  }, [convo, appendBot, appendUser, appendConfirmCard, onConfirm, resolveCard]);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text) return;
    setInput('');
    processText(text);
  }, [input, processText]);

  const stopListening = useCallback(() => {
    try {
      recognitionRef.current?.stop();
    } catch {}
    setIsListening(false);
    setInterim('');
  }, []);

  const startListening = useCallback(() => {
    if (Platform.OS !== 'web') {
      appendBot('Voice input is web-only for now. Please type your command.');
      return;
    }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      appendBot('Voice input isn\'t supported in this browser. Please type your command.');
      setVoiceSupported(false);
      return;
    }
    try {
      recognitionRef.current?.stop();
    } catch {}

    const r = new SR();
    r.lang = 'en-US';
    r.interimResults = true;
    r.maxAlternatives = 1;
    r.continuous = false;

    r.onstart = () => {
      setIsListening(true);
      setInterim('');
    };

    r.onresult = (event: any) => {
      const res = event.results[event.results.length - 1];
      const transcript = res[0].transcript as string;
      if (res.isFinal) {
        setIsListening(false);
        setInterim('');
        processText(transcript);
      } else {
        setInterim(transcript);
      }
    };

    r.onerror = (event: any) => {
      setIsListening(false);
      setInterim('');
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        appendBot('🎤 Microphone access denied. Type instead.');
      } else if (event.error === 'no-speech') {
        appendBot('🎤 Didn\'t catch anything. Tap the mic and try again.');
      } else if (event.error !== 'aborted') {
        appendBot(`🎤 Voice error: ${event.error}. Type instead.`);
      }
    };

    r.onend = () => {
      setIsListening(false);
      setInterim('');
    };

    recognitionRef.current = r;
    try {
      r.start();
    } catch (err) {
      setIsListening(false);
      appendBot('🎤 Could not start voice input. Type instead.');
    }
  }, [appendBot, processText]);

  const toggleMic = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.stop();
      } catch {}
    };
  }, []);

  useEffect(() => {
    if (!isOpen && isListening) stopListening();
  }, [isOpen, isListening, stopListening]);

  const renderMessage = useCallback(
    ({ item }: { item: ChatMessage }) => {
      if (item.kind === 'confirm-card' && item.order) {
        return (
          <ConfirmCard
            message={item}
            glowColor={glowColor}
            defaultLot={defaultLot}
            defaultCount={defaultCount}
            onConfirm={() => onConfirm(item.order!, item.id)}
            onCancel={() => onCancel(item.id)}
          />
        );
      }
      const isUser = item.author === 'user';
      return (
        <View style={[styles.msgRow, isUser ? styles.msgRowUser : styles.msgRowBot]}>
          <View
            style={[
              styles.bubble,
              isUser
                ? { backgroundColor: glowColor + '22', borderColor: glowColor + '66' }
                : { backgroundColor: '#15192A', borderColor: '#2A2F45' },
            ]}
          >
            <Text style={[styles.bubbleText, isUser && { color: '#FFFFFF' }]}>{item.text}</Text>
          </View>
        </View>
      );
    },
    [glowColor, defaultCount, defaultLot, onConfirm, onCancel]
  );

  return (
    <>
      {!isOpen && (
        <Animated.View
          style={[styles.fabWrap, { transform: [{ scale: pulse }] }]}
          pointerEvents="box-none"
        >
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setIsOpen(true)}
            style={[
              styles.fab,
              {
                backgroundColor: '#080D1A',
                borderColor: glowColor,
                shadowColor: glowColor,
              },
              Platform.OS === 'web' && ({ boxShadow: `0 0 16px 2px ${glowColor}66` } as any),
            ]}
            testID="trade-chat-fab"
          >
            <MessageCircle color={glowColor} size={24} />
          </TouchableOpacity>
        </Animated.View>
      )}

      <Modal
        visible={isOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setIsOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.sheetWrap}
          >
            <View style={[styles.sheet, { borderColor: glowColor + '55' }]}>
              <View style={[styles.header, { borderBottomColor: glowColor + '33' }]}>
                <View style={styles.headerTitleRow}>
                  <View
                    style={[
                      styles.headerDot,
                      { backgroundColor: glowColor },
                      Platform.OS === 'web' &&
                        ({ boxShadow: `0 0 8px 1px ${glowColor}` } as any),
                    ]}
                  />
                  <Text style={[styles.headerTitle, { color: glowColor }]}>TRADE ASSISTANT</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setIsOpen(false)}
                  style={styles.headerClose}
                  testID="trade-chat-close"
                >
                  <X color="#FFFFFF" size={20} />
                </TouchableOpacity>
              </View>

              <FlatList
                ref={listRef}
                data={messages}
                keyExtractor={m => m.id}
                renderItem={renderMessage}
                contentContainerStyle={styles.listContent}
                onContentSizeChange={scrollToEnd}
                keyboardShouldPersistTaps="handled"
              />

              <View style={[styles.inputBar, { borderTopColor: glowColor + '33' }]}>
                <Animated.View style={{ transform: [{ scale: micPulse }] }}>
                  <TouchableOpacity
                    onPress={toggleMic}
                    disabled={!voiceSupported && Platform.OS !== 'web'}
                    style={[
                      styles.micBtn,
                      {
                        borderColor: isListening ? glowColor : glowColor + '55',
                        backgroundColor: isListening ? glowColor + '33' : '#15192A',
                      },
                      isListening &&
                        Platform.OS === 'web' &&
                        ({ boxShadow: `0 0 12px 2px ${glowColor}AA` } as any),
                    ]}
                    testID="trade-chat-mic"
                  >
                    {isListening ? (
                      <MicOff color={glowColor} size={18} />
                    ) : (
                      <Mic color={voiceSupported ? glowColor : glowColor + '55'} size={18} />
                    )}
                  </TouchableOpacity>
                </Animated.View>
                <TextInput
                  value={isListening ? interim : input}
                  onChangeText={setInput}
                  editable={!isListening}
                  placeholder={
                    isListening
                      ? 'Listening…'
                      : convo.phase === 'asking'
                      ? promptForField(convo.awaiting)
                      : 'Type a command…'
                  }
                  placeholderTextColor={isListening ? glowColor + 'AA' : '#6B7280'}
                  style={[
                    styles.input,
                    isListening && { color: glowColor + 'CC', fontStyle: 'italic' },
                  ]}
                  returnKeyType="send"
                  onSubmitEditing={handleSend}
                  testID="trade-chat-input"
                />
                <TouchableOpacity
                  onPress={handleSend}
                  disabled={!input.trim() || isListening}
                  style={[
                    styles.sendBtn,
                    {
                      backgroundColor: input.trim() && !isListening ? glowColor : '#2A2F45',
                      opacity: input.trim() && !isListening ? 1 : 0.6,
                    },
                  ]}
                  testID="trade-chat-send"
                >
                  <Send color="#000000" size={18} />
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </>
  );
}

interface ConfirmCardProps {
  message: ChatMessage;
  glowColor: string;
  defaultLot: number;
  defaultCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmCard({ message, glowColor, defaultLot, defaultCount, onConfirm, onCancel }: ConfirmCardProps) {
  const order = message.order!;
  const count = order.count ?? defaultCount;
  const lot = order.lot ?? defaultLot;
  const resolved = message.resolved;
  const sl =
    order.slPips !== undefined
      ? `${order.slPips} pips`
      : order.slPrice !== undefined
      ? `@${order.slPrice}`
      : '—';
  const tp =
    order.tpPips !== undefined
      ? `${order.tpPips} pips`
      : order.tpPrice !== undefined
      ? `@${order.tpPrice}`
      : '—';

  return (
    <View style={styles.msgRowBot}>
      <View
        style={[
          styles.card,
          {
            borderColor: resolved ? '#2A2F45' : glowColor + '88',
            shadowColor: glowColor,
          },
          Platform.OS === 'web' &&
            !resolved &&
            ({ boxShadow: `0 0 12px 1px ${glowColor}44` } as any),
        ]}
      >
        <Text style={[styles.cardTitle, { color: glowColor }]}>CONFIRM ORDER</Text>
        <View style={styles.cardRow}>
          <Text style={[styles.cardAction, { color: order.action === 'SELL' ? '#F87171' : '#4ADE80' }]}>
            {order.action}
          </Text>
          <Text style={styles.cardSymbol}>{order.symbol}</Text>
          <Text style={styles.cardCount}>
            × {count}
          </Text>
        </View>
        <View style={styles.cardGrid}>
          <CardField label="Lot" value={String(lot)} />
          <CardField label="SL" value={sl} />
          <CardField label="TP" value={tp} />
        </View>
        {resolved ? (
          <Text
            style={[
              styles.cardResolved,
              { color: resolved === 'confirmed' ? '#4ADE80' : '#9CA3AF' },
            ]}
          >
            {resolved === 'confirmed' ? '✓ Confirmed' : '✕ Cancelled'}
          </Text>
        ) : (
          <View style={styles.cardActions}>
            <TouchableOpacity
              style={[styles.cardBtn, styles.cardBtnCancel]}
              onPress={onCancel}
              testID="trade-chat-card-cancel"
            >
              <Text style={styles.cardBtnCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.cardBtn, { backgroundColor: glowColor }]}
              onPress={onConfirm}
              testID="trade-chat-card-confirm"
            >
              <Text style={styles.cardBtnConfirmText}>Confirm</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

function CardField({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.cardField}>
      <Text style={styles.cardFieldLabel}>{label}</Text>
      <Text style={styles.cardFieldValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fabWrap: {
    position: 'absolute',
    right: 20,
    bottom: 90,
    zIndex: 100,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 8,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheetWrap: {
    width: '100%',
  },
  sheet: {
    height: '75%',
    backgroundColor: '#0A0E1C',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderBottomWidth: 0,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  headerClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#15192A',
  },
  listContent: {
    padding: 14,
    gap: 8,
  },
  msgRow: {
    flexDirection: 'row',
    width: '100%',
    marginBottom: 6,
  },
  msgRowUser: {
    justifyContent: 'flex-end',
  },
  msgRowBot: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '82%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
  },
  bubbleText: {
    color: '#E5E7EB',
    fontSize: 14,
    lineHeight: 20,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    backgroundColor: '#080D1A',
  },
  micBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#15192A',
  },
  input: {
    flex: 1,
    height: 40,
    borderRadius: 20,
    paddingHorizontal: 14,
    backgroundColor: '#15192A',
    color: '#FFFFFF',
    fontSize: 14,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: '92%',
    backgroundColor: '#0F1424',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 10,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 6,
  },
  cardTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
  },
  cardAction: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 1,
  },
  cardSymbol: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  cardCount: {
    color: '#9CA3AF',
    fontSize: 14,
    fontWeight: '600',
  },
  cardGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  cardField: {
    flex: 1,
    backgroundColor: '#15192A',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  cardFieldLabel: {
    color: '#6B7280',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
  },
  cardFieldValue: {
    color: '#E5E7EB',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 2,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  cardBtn: {
    flex: 1,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBtnCancel: {
    backgroundColor: '#1F2333',
    borderWidth: 1,
    borderColor: '#2A2F45',
  },
  cardBtnCancelText: {
    color: '#E5E7EB',
    fontSize: 14,
    fontWeight: '600',
  },
  cardBtnConfirmText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '700',
  },
  cardResolved: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
});

export default TradeChatWidget;
