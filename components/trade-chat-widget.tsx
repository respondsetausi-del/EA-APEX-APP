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
import { MessageCircle, Send, X, Mic } from 'lucide-react-native';

export type ChatAuthor = 'user' | 'bot';

export interface ChatMessage {
  id: string;
  author: ChatAuthor;
  text: string;
  timestamp: number;
}

interface TradeChatWidgetProps {
  glowColor: string;
}

const GREETING: ChatMessage = {
  id: 'greeting',
  author: 'bot',
  text: 'Hi — I\'m your trade assistant. Try: "buy gold 0.01" or "sell EURUSD 3 trades". (Phase 1: echo only — no trades are placed yet.)',
  timestamp: 0,
};

function genId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function TradeChatWidget({ glowColor }: TradeChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [input, setInput] = useState('');
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const pulse = useRef(new Animated.Value(1)).current;

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

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text) return;
    const userMsg: ChatMessage = { id: genId(), author: 'user', text, timestamp: Date.now() };
    const botMsg: ChatMessage = {
      id: genId(),
      author: 'bot',
      text: `Got it: "${text}". Parsing & trading come in Phase 2/3.`,
      timestamp: Date.now() + 1,
    };
    setMessages(prev => [...prev, userMsg, botMsg]);
    setInput('');
    scrollToEnd();
  }, [input, scrollToEnd]);

  const renderMessage = useCallback(
    ({ item }: { item: ChatMessage }) => {
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
    [glowColor]
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
                <TouchableOpacity
                  style={[styles.micBtn, { borderColor: glowColor + '55' }]}
                  disabled
                  testID="trade-chat-mic-placeholder"
                >
                  <Mic color={glowColor + '66'} size={18} />
                </TouchableOpacity>
                <TextInput
                  value={input}
                  onChangeText={setInput}
                  placeholder="Type a command…"
                  placeholderTextColor="#6B7280"
                  style={styles.input}
                  returnKeyType="send"
                  onSubmitEditing={handleSend}
                  testID="trade-chat-input"
                />
                <TouchableOpacity
                  onPress={handleSend}
                  disabled={!input.trim()}
                  style={[
                    styles.sendBtn,
                    {
                      backgroundColor: input.trim() ? glowColor : '#2A2F45',
                      opacity: input.trim() ? 1 : 0.6,
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
});

export default TradeChatWidget;
