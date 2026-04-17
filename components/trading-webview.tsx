import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { WebView } from 'react-native-webview';
import CustomWebView from './custom-webview';
import WebWebView from './web-webview';
import { X, AlertCircle, CheckCircle, TrendingUp } from 'lucide-react-native';
import { SignalLog } from '@/services/signals-monitor';
import { useApp } from '@/providers/app-provider';



interface TradingWebViewProps {
  visible: boolean;
  signal: SignalLog | null;
  onClose: () => void;
}

interface TradeConfig {
  symbol: string;
  lotSize: string;
  platform: 'MT4' | 'MT5';
  direction: 'BUY' | 'SELL' | 'BOTH';
  numberOfTrades: string;
}

const KEEP_ALIVE_MS = 5 * 60 * 1000; // 5 minutes idle timeout

export function TradingWebView({ visible, signal, onClose }: TradingWebViewProps) {
  const { activeSymbols, mt4Symbols, mt5Symbols, mt4Account, mt5Account, eas, manualTradeRequest } = useApp();
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [tradeExecuted, setTradeExecuted] = useState<boolean>(false);
  const [currentStep, setCurrentStep] = useState<string>('Initializing...');
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const heartbeatIndexRef = useRef<number>(0);
  const lastUpdateRef = useRef<number>(Date.now());
  const webViewRef = useRef<WebView>(null);

  // Keep-alive session state
  const [sessionWarm, setSessionWarm] = useState<boolean>(false);
  const [sessionPlatform, setSessionPlatform] = useState<'MT4' | 'MT5' | null>(null);
  const keepAliveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetKeepAliveTimer = useCallback(() => {
    if (keepAliveTimerRef.current) clearTimeout(keepAliveTimerRef.current);
    keepAliveTimerRef.current = setTimeout(() => {
      console.log('[TradingWebView] Keep-alive expired — tearing down session');
      setSessionWarm(false);
      setSessionPlatform(null);
      onClose();
    }, KEEP_ALIVE_MS);
  }, [onClose]);

  const teardownSession = useCallback(() => {
    if (keepAliveTimerRef.current) clearTimeout(keepAliveTimerRef.current);
    setSessionWarm(false);
    setSessionPlatform(null);
    onClose();
  }, [onClose]);

  // Get trade configuration for the signal
  const getTradeConfig = useCallback((): TradeConfig | null => {
    if (!signal) return null;

    const symbolName = signal.asset;

    // Manual trade request (from voice/chat command) overrides saved config
    if (manualTradeRequest && manualTradeRequest.symbol.toUpperCase() === symbolName.toUpperCase()) {
      return {
        symbol: manualTradeRequest.symbol,
        lotSize: String(manualTradeRequest.lot),
        platform: manualTradeRequest.platform,
        direction: manualTradeRequest.action,
        numberOfTrades: String(manualTradeRequest.count),
      };
    }

    // Check MT4 symbols first
    const mt4Config = mt4Symbols.find(s => s.symbol === symbolName);
    if (mt4Config) {
      return {
        symbol: symbolName,
        lotSize: mt4Config.lotSize,
        platform: 'MT4',
        direction: mt4Config.direction,
        numberOfTrades: mt4Config.numberOfTrades
      };
    }

    // Check MT5 symbols
    const mt5Config = mt5Symbols.find(s => s.symbol === symbolName);
    if (mt5Config) {
      return {
        symbol: symbolName,
        lotSize: mt5Config.lotSize,
        platform: 'MT5',
        direction: mt5Config.direction,
        numberOfTrades: mt5Config.numberOfTrades
      };
    }

    // Check legacy active symbols
    const legacyConfig = activeSymbols.find(s => s.symbol === symbolName);
    if (legacyConfig) {
      return {
        symbol: symbolName,
        lotSize: legacyConfig.lotSize,
        platform: legacyConfig.platform,
        direction: legacyConfig.direction,
        numberOfTrades: legacyConfig.numberOfTrades
      };
    }

    return null;
  }, [signal, activeSymbols, mt4Symbols, mt5Symbols, manualTradeRequest]);

  const tradeConfig = useMemo(() => getTradeConfig(), [getTradeConfig]);

  // Debug logging for trade configuration
  useEffect(() => {
    if (tradeConfig) {
      console.log('🎯 Trade Configuration Applied:', {
        symbol: tradeConfig.symbol,
        lotSize: tradeConfig.lotSize,
        platform: tradeConfig.platform,
        direction: tradeConfig.direction,
        numberOfTrades: tradeConfig.numberOfTrades
      });
      console.log('🎯 Signal Details:', {
        asset: signal?.asset,
        action: signal?.action,
        price: signal?.price,
        tp: signal?.tp,
        sl: signal?.sl
      });
    } else {
      console.log('❌ No trade configuration found for signal:', signal?.asset);
    }
  }, [tradeConfig, signal]);

  const eaName = useMemo<string>(() => {
    try {
      const connected = eas?.find(e => e.status === 'connected');
      const name = (connected?.name || '').trim();
      if (name.length > 0) return name;
    } catch { }
    return 'AutoTrader';
  }, [eas]);

  // Get account credentials based on platform
  const getAccountCredentials = useCallback(() => {
    if (!tradeConfig) return null;

    if (tradeConfig.platform === 'MT4' && mt4Account) {
      return {
        login: mt4Account.login,
        password: mt4Account.password,
        server: mt4Account.server
      };
    }

    if (tradeConfig.platform === 'MT5' && mt5Account) {
      return {
        login: mt5Account.login,
        password: mt5Account.password,
        server: mt5Account.server
      };
    }

    return null;
  }, [tradeConfig, mt4Account, mt5Account]);

  const credentials = useMemo(() => getAccountCredentials(), [getAccountCredentials]);

  // Generate MT4 authentication and trading JavaScript - Reverted to working state
  const generateMT4JavaScript = useCallback(() => {
    if (!signal || !tradeConfig || !credentials) return '';

    const numberOfOrders = parseInt(tradeConfig.numberOfTrades) || 1;
    const volume = tradeConfig.lotSize;
    const asset = signal.asset;
    const tp = signal.tp;
    const sl = signal.sl;
    const action = signal.action;
    const botname = `${eaName}`;

    return `
      (function(){
        // Shim for web iframe: route postMessage to parent window
        if (!window.ReactNativeWebView) {
          window.ReactNativeWebView = {
            postMessage: function(data) { window.parent.postMessage(data, '*'); }
          };
        }
        console.log('Starting MT4 trading sequence - optimized version...');

        // Enhanced field input function with proper validation
        function typeInput(el, value) {
          try {
            el.focus();
            el.select();
            el.value = '';
            el.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
            el.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
            
            setTimeout(function() {
              el.focus();
              el.value = String(value);
              el.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
              el.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
              el.dispatchEvent(new Event('blur', { bubbles: true, cancelable: true }));
            }, 100);
            
            return true;
          } catch(e) { return false; }
        }
        
        // Login credentials script
        const js = \`
          var loginEl = document.getElementById('login');
          var serverEl = document.getElementById('server');
          var passEl = document.getElementById('password');
          
          if (loginEl) {
            loginEl.focus();
            loginEl.select();
            loginEl.value = '${credentials.login}';
            loginEl.dispatchEvent(new Event('input', { bubbles: true }));
            loginEl.dispatchEvent(new Event('change', { bubbles: true }));
          }
          
          if (serverEl) {
            serverEl.focus();
            serverEl.select();
            serverEl.value = '${credentials.server}';
            serverEl.dispatchEvent(new Event('input', { bubbles: true }));
            serverEl.dispatchEvent(new Event('change', { bubbles: true }));
          }
          
          if (passEl) {
            passEl.focus();
            passEl.select();
            passEl.value = '${credentials.password}';
            passEl.dispatchEvent(new Event('input', { bubbles: true }));
            passEl.dispatchEvent(new Event('change', { bubbles: true }));
          }
        \`;
        
        // Login button press
        const jsPress = \`
          var btns = document.querySelectorAll('button.input-button');
          if (btns && btns[3]) {
            btns[3].removeAttribute('disabled');
            btns[3].disabled = false;
            btns[3].click();
          }
        \`;
        
        // Right-click on first symbol in Market Watch
        const item1InSymbolsRightClick = \`
          var element = document.querySelector('body > div.page-window.market-watch.compact > div > div.b > div.page-block > div > table > tbody > tr:nth-child(1)');
          if (element) {
            var rect = element.getBoundingClientRect();
            var ev1 = new MouseEvent("mousedown", {
              bubbles: true,
              cancelable: false,
              view: window,
              button: 2,
              buttons: 2,
              clientX: rect.x,
              clientY: rect.y
            });
            element.dispatchEvent(ev1);
            
            var ev2 = new MouseEvent("mouseup", {
              bubbles: true,
              cancelable: false,
              view: window,
              button: 2,
              buttons: 0,
              clientX: rect.x,
              clientY: rect.y
            });
            element.dispatchEvent(ev2);
            
            var ev3 = new MouseEvent("contextmenu", {
              bubbles: true,
              cancelable: false,
              view: window,
              button: 2,
              buttons: 0,
              clientX: rect.x,
              clientY: rect.y
            });
            element.dispatchEvent(ev3);
          }
        \`;
        
        // Press "Show All"
        const press_show_all = \`
          var sall = document.querySelector('body > div.page-menu.context.expanded > div > div > span.box > span > div:nth-child(7)');
          if (sall) {
            sall.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
            sall.click();
          }
        \`;
        
        // Main execution function
        function executeTrading() {
          window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'step',
            message: 'Initializing MT4...'
          }));
          
          // Step 1: Login
          setTimeout(function() {
            window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'step',
              message: 'Logging in...'
            }));
            eval(js);
            eval(jsPress);
            
            // Step 2: Wait for login and show all symbols
            setTimeout(function() {
              window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'step',
                message: 'Accessing symbol list...'
              }));
              eval(item1InSymbolsRightClick);
              
              setTimeout(function() {
                eval(press_show_all);
                
                // Step 3: Start trading after authentication
                setTimeout(function() {
                  startTradingSequence();
                }, 3000);
              }, 2000);
            }, 8000);
          }, 3000);
        }
        
        // Trading sequence - optimized for multiple orders
        function startTradingSequence() {
          window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'step',
            message: 'Starting trade execution for ${asset}...'
          }));
          
          // Select symbol
          const selectSymbol = \`
            var tableB = document.querySelector('body > div.page-window.market-watch.compact > div > div.b > div.page-block > div > table > tbody');
            if (tableB) {
              var allTRs = tableB.querySelectorAll('tr');
              for (var i = 0; i < allTRs.length; i++) {
                var a = allTRs[i].getElementsByTagName('td')[0];
                if (a && a.textContent && a.textContent.trim() === '${asset}') {
                  a.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
                  console.log('Selected symbol: ${asset}');
                  break;
                }
              }
            }
          \`;
          
          // Optimized field setting with proper SL/TP handling - Enhanced version
          const setTradeParams = \`
            function setFieldValueOptimized(selector, value, fieldName) {
              var field = document.querySelector(selector);
              if (field) {
                console.log('Setting ' + fieldName + ' to: ' + value);
                
                // Clear field completely first
                field.focus();
                field.select();
                field.value = '';
                
                // Trigger clear events
                field.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
                field.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
                field.dispatchEvent(new Event('keyup', { bubbles: true, cancelable: true }));
                
                // Wait for clear to process, then set new value
                setTimeout(function() {
                  field.focus();
                  field.value = String(value);
                  
                  // Trigger all relevant events for the new value
                  field.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
                  field.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
                  field.dispatchEvent(new Event('keyup', { bubbles: true, cancelable: true }));
                  field.dispatchEvent(new Event('blur', { bubbles: true, cancelable: true }));
                  
                  // Final verification with retry mechanism
                  setTimeout(function() {
                    var currentValue = field.value;
                    console.log('Expected ' + fieldName + ': ' + value + ' but actual ' + fieldName + ' field shows: ' + currentValue);
                    
                    // If value still doesn't match, use alternative method
                    if (currentValue !== String(value)) {
                      console.log('Value mismatch detected for ' + fieldName + ', using alternative input method...');
                      
                      // Method 2: Simulate typing character by character
                      field.focus();
                      field.select();
                      field.value = '';
                      
                      var targetValue = String(value);
                      var currentIndex = 0;
                      
                      function typeNextCharacter() {
                        if (currentIndex < targetValue.length) {
                          var char = targetValue.charAt(currentIndex);
                          field.value += char;
                          
                          // Simulate key events for each character
                          var keyEvent = new KeyboardEvent('keydown', {
                            key: char,
                            code: 'Digit' + char,
                            keyCode: char.charCodeAt(0),
                            bubbles: true,
                            cancelable: true
                          });
                          field.dispatchEvent(keyEvent);
                          
                          field.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
                          
                          currentIndex++;
                          setTimeout(typeNextCharacter, 100);
                        } else {
                          // Final events after typing complete
                          field.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
                          field.dispatchEvent(new Event('blur', { bubbles: true, cancelable: true }));
                          
                          // Final verification
                          setTimeout(function() {
                            var finalValue = field.value;
                            console.log('Final verification - ' + fieldName + ' expected: ' + value + ', final: ' + finalValue);
                            
                            // If still not matching, try direct DOM manipulation
                            if (finalValue !== String(value)) {
                              console.log('Using direct DOM manipulation for ' + fieldName);
                              field.setAttribute('value', String(value));
                              field.value = String(value);
                              
                              // Trigger final events
                              field.dispatchEvent(new Event('input', { bubbles: true }));
                              field.dispatchEvent(new Event('change', { bubbles: true }));
                            }
                          }, 200);
                        }
                      }
                      
                      typeNextCharacter();
                    }
                  }, 500);
                }, 200);
                
                return true;
              } else {
                console.log('Field not found: ' + selector);
                return false;
              }
            }
            
            // Set Volume first
            setFieldValueOptimized('#volume', '${volume}', 'Volume');
            
            // Set SL with longer delay to ensure Volume is processed
            setTimeout(function() {
              setFieldValueOptimized('#sl', '${sl}', 'SL');
            }, 1000);
            
            // Set TP with even longer delay to ensure SL is processed
            setTimeout(function() {
              setFieldValueOptimized('#tp', '${tp}', 'TP');
            }, 2000);
            
            // Set Comment last
            setTimeout(function() {
              setFieldValueOptimized('#comment', '${botname}', 'Comment');
            }, 3000);
          \`;
          
          const executeOrder = \`
            ${action === 'BUY' ?
        "var buyBtn = document.querySelector('button.input-button.blue'); if (buyBtn) { buyBtn.click(); console.log('BUY order executed'); }" :
        "var sellBtn = document.querySelector('button.input-button.red'); if (sellBtn) { sellBtn.click(); console.log('SELL order executed'); }"
      }
          \`;
          
          // Execute trading sequence with optimized timing
          setTimeout(function() {
            window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'step',
              message: 'Selecting symbol ${asset}...'
            }));
            eval(selectSymbol);
            
            // Execute multiple orders with proper delays and enhanced tracking
            console.log('Starting execution of ${numberOfOrders} orders for ${asset}');
            
            function executeOrderSequence(orderIndex) {
              if (orderIndex >= ${numberOfOrders}) {
                // All orders completed
                setTimeout(function() {
                  window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'success',
                    message: 'All ${numberOfOrders} order(s) executed successfully for ${asset}'
                  }));
                  
                  // Close execution window after 3 seconds
                  setTimeout(function() {
                    window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
                      type: 'close',
                      message: 'Execution completed - closing window'
                    }));
                  }, 3000);
                }, 2000);
                return;
              }
              
              console.log('Executing MT4 order ' + (orderIndex + 1) + ' of ${numberOfOrders}');
              window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'step',
                message: 'Executing MT4 order ' + (orderIndex + 1) + ' of ${numberOfOrders} for ${asset}...'
              }));
              
              // Set parameters for this order
              eval(setTradeParams);
              
              // Execute order after parameters are set
              setTimeout(function() {
                console.log('Placing MT4 order ' + (orderIndex + 1) + ' - ${action}');
                eval(executeOrder);
                
                // Wait before next order
                setTimeout(function() {
                  executeOrderSequence(orderIndex + 1);
                }, 8000); // 8 second delay between orders
              }, 4500); // Delay to allow field setting to complete
            }
            
            // Start the sequence
            executeOrderSequence(0);
          }, 2000);
        }
        
        // Start the execution
        setTimeout(function() {
          executeTrading();
        }, 2000);
      })();
    `;
  }, [signal, tradeConfig, credentials, eaName]);

  // Generate MT5 trading JavaScript
  const generateMT5JavaScript = useCallback(() => {
    if (!signal || !tradeConfig || !credentials) return '';

    const numberOfOrders = parseInt(tradeConfig.numberOfTrades) || 1;
    const volume = tradeConfig.lotSize;
    const asset = signal.asset;
    const tp = signal.tp;
    const sl = signal.sl;
    const action = signal.action;
    const botname = `${eaName}`;

    return `
      // MT5 Trading Script
      // Shim for web iframe: route postMessage to parent window
      if (!window.ReactNativeWebView) {
        window.ReactNativeWebView = {
          postMessage: function(data) { window.parent.postMessage(data, '*'); }
        };
      }
      console.log('Starting MT5 trade execution for ${asset}');

      const loginScript = \`
        // Try multiple selectors for login fields (broker-specific)
        var x = document.querySelector('input[name="login"]') || 
                document.querySelector('input[placeholder*="Login"]') ||
                document.querySelector('input[placeholder*="login"]');
        if (x != null) {
          x.focus();
          x.value = '';
          x.value = '${credentials.login}';
          x.dispatchEvent(new Event('input', { bubbles: true }));
          x.dispatchEvent(new Event('change', { bubbles: true }));
          x.dispatchEvent(new Event('blur', { bubbles: true }));
          console.log('Login field filled');
        }
        var y = document.querySelector('input[name="password"]') ||
                document.querySelector('input[type="password"]') ||
                document.querySelector('input[placeholder*="Password"]') ||
                document.querySelector('input[placeholder*="password"]');
        if (y != null) {
          y.focus();
          y.value = '';
          y.value = '${credentials.password}';
          y.dispatchEvent(new Event('input', { bubbles: true }));
          y.dispatchEvent(new Event('change', { bubbles: true }));
          y.dispatchEvent(new Event('blur', { bubbles: true }));
          console.log('Password field filled');
        }
      \`;
      
      const loginPress = \`
        // Try RazorMarkets selector first
        var button = document.querySelector('.button.svelte-1wrky82.active');
        if(button !== null) {
          button.click();
          console.log('Login button clicked using RazorMarkets selector');
        } else {
          // Try other brokers - search for Connect/Login button by text
          var buttons = document.querySelectorAll('button');
          for (var i = 0; i < buttons.length; i++) {
            var btnText = (buttons[i].textContent || '').trim().toLowerCase();
            if (btnText.includes('connect') || btnText.includes('login') || btnText.includes('sign in')) {
              buttons[i].click();
              console.log('Login button clicked using text-based selector: ' + btnText);
              break;
            }
          }
        }
      \`;
      
      // Enhanced search bar reveal and verification function
      const revealAndVerifySearchBar = \`
        function ensureSearchBarVisible(callback) {
          var attempts = 0;
          var maxAttempts = 3;
          
          function tryRevealSearchBar() {
            attempts++;
            console.log('Attempting to reveal search bar, attempt: ' + attempts);
            
            // First, try to click the title to reveal search bar
            var titleEl = document.querySelector('.title-wrap.svelte-19c9jff .title.svelte-19c9jff');
            if (titleEl) {
              titleEl.click();
              console.log('Clicked title element to reveal search bar');
            }
            
            // Wait a moment then check if search bar is visible
            setTimeout(function() {
              var searchInput = document.querySelector('input[placeholder="Search symbol"]') ||
                               document.querySelector('label.search.svelte-1mvzp7f input') ||
                               document.querySelector('.search input');
              
              if (searchInput && searchInput.offsetParent !== null) {
                console.log('Search bar is now visible and ready');
                callback(searchInput);
              } else if (attempts < maxAttempts) {
                console.log('Search bar not visible yet, retrying...');
                setTimeout(tryRevealSearchBar, 1000);
              } else {
                console.log('Failed to reveal search bar after ' + maxAttempts + ' attempts');
                // Try to proceed anyway with any input field found
                var fallbackInput = document.querySelector('input[type="text"]');
                if (fallbackInput) {
                  console.log('Using fallback input field');
                  callback(fallbackInput);
                } else {
                  console.log('No input field found at all');
                  callback(null);
                }
              }
            }, 800);
          }
          
          tryRevealSearchBar();
        }
      \`;
      
      const searchSymbol = \`
        ensureSearchBarVisible(function(searchInput) {
          if (searchInput) {
            console.log('Setting search value to: ${asset}');
            searchInput.focus();
            searchInput.select();
            searchInput.value = '';
            searchInput.value = '${asset}';
            searchInput.dispatchEvent(new Event('input', { bubbles: true }));
            searchInput.dispatchEvent(new Event('change', { bubbles: true }));
            searchInput.dispatchEvent(new Event('keyup', { bubbles: true }));
            searchInput.dispatchEvent(new Event('keydown', { bubbles: true }));
            
            // Verify the value was set
            setTimeout(function() {
              console.log('Search input value after setting: "' + searchInput.value + '"');
            }, 200);
          } else {
            console.log('Could not find or reveal search input field');
            // If search bar not found, try to work with visible symbols directly
            var visibleSymbols = document.querySelectorAll('[class*="symbol"]');
            if (visibleSymbols.length > 0) {
              console.log('Working with visible symbols instead of search');
            }
          }
        });
      \`;
      
      const selectSymbol = \`
        // Try RazorMarkets selectors first
        var candidates = document.querySelectorAll('.name.svelte-19bwscl .symbol.svelte-19bwscl, .symbol.svelte-19bwscl, [class*="symbol"], .name .symbol');
        var found = false;
        for (var i = 0; i < candidates.length; i++) {
          var el = candidates[i];
          var txt = (el.innerText || '').trim();
          if (txt === '${asset}' || txt === '${asset}.mic' || txt.includes('${asset}')) {
            el.click();
            found = true;
            console.log('Symbol selected using class-based selector: ' + txt);
            break;
          }
        }
        
        // If not found, try fallback approach - click on symbol in the list
        if (!found) {
          var allElements = document.querySelectorAll('*');
          for (var i = 0; i < allElements.length; i++) {
            var elText = (allElements[i].textContent || '').trim();
            // Only match exact symbol or symbol with .mic suffix
            if (elText === '${asset}' || elText === '${asset}.mic') {
              // Make sure this is a clickable symbol element (not just text)
              var parentClickable = allElements[i].closest('button, [role="button"], [onclick], td, tr');
              if (parentClickable || allElements[i].tagName === 'BUTTON' || allElements[i].onclick) {
                (parentClickable || allElements[i]).click();
                found = true;
                console.log('Symbol selected using text-based selector: ' + elText);
                break;
              }
            }
          }
        }
        
        // If still not found and there are candidates, try the first one
        if (!found && candidates.length > 0) {
          candidates[0].click();
          console.log('Selected first available symbol as fallback');
        }
      \`;
      
      const openOrderDialog = \`
        // Try multiple selectors for opening order dialog (broker-specific)
        var element = document.querySelector('.icon-button.withText span.button-text');
        if (element !== null) {
          element.scrollIntoView();
          element.click();
          console.log('Opened order dialog using RazorMarkets selector');
        } else {
          // Try fallback selector - "Create New Order" button
          var createOrderBtn = document.querySelector('button[class*="create"], button');
          var buttons = document.querySelectorAll('button');
          for (var i = 0; i < buttons.length; i++) {
            var btnText = (buttons[i].textContent || '').trim().toLowerCase();
            if (btnText.includes('create') && btnText.includes('order')) {
              buttons[i].scrollIntoView();
              buttons[i].click();
              console.log('Opened order dialog using fallback selector');
              break;
            }
          }
        }
      \`;
      
      const setOrderParams = \`
        // Universal MT5 field setting function with enhanced validation and broker-specific logic
        function setMT5FieldValue(selector, value, fieldName) {
          var field = document.querySelector(selector);
          if (field) {
            console.log('Setting MT5 ' + fieldName + ' to: ' + value);
            
            // Clear the field first
            field.focus();
            field.select();
            field.value = '';
            
            // Trigger clear events
            field.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
            field.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
            field.dispatchEvent(new Event('keyup', { bubbles: true, cancelable: true }));
            field.dispatchEvent(new Event('keydown', { bubbles: true, cancelable: true }));
            
            // Small delay before setting new value
            setTimeout(function() {
              field.focus();
              field.value = String(value);
              
              // Trigger input events for the new value
              field.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
              field.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
              field.dispatchEvent(new Event('keyup', { bubbles: true, cancelable: true }));
              field.dispatchEvent(new Event('blur', { bubbles: true, cancelable: true }));
              
              // Verify the value was set correctly
              setTimeout(function() {
                var currentValue = field.value;
                console.log('Expected MT5 ' + fieldName + ': ' + value + ' but actual ' + fieldName + ' field shows: ' + currentValue);
                
                // If value doesn't match, try alternative setting method
                if (currentValue !== String(value)) {
                  console.log('Retrying MT5 ' + fieldName + ' with alternative method...');
                  field.focus();
                  
                  // Try using execCommand if available
                  if (document.execCommand) {
                    field.select();
                    document.execCommand('delete', false, null);
                    document.execCommand('insertText', false, String(value));
                  } else {
                    // Fallback: character by character input simulation
                    field.value = '';
                    var chars = String(value).split('');
                    chars.forEach(function(char, index) {
                      setTimeout(function() {
                        field.value += char;
                        field.dispatchEvent(new Event('input', { bubbles: true }));
                        if (index === chars.length - 1) {
                          field.dispatchEvent(new Event('change', { bubbles: true }));
                          field.blur();
                        }
                      }, index * 50);
                    });
                  }
                }
              }, 200);
            }, 100);
            
            return true;
          } else {
            console.log('MT5 Field not found: ' + selector);
            return false;
          }
        }
        
        // Try multiple selectors for Volume (broker-specific)
        var volumeSet = setMT5FieldValue('.trade-input input[type="text"]', '${volume}', 'Volume');
        if (!volumeSet) {
          // Try alternative selectors for other brokers
          var volumeField = document.querySelector('input[type="text"]') || 
                           document.querySelector('input[inputmode="decimal"]') ||
                           document.querySelector('input[role="textbox"]');
          if (volumeField && volumeField.closest('[class*="volume"], [class*="lot"]')) {
            volumeField.focus();
            volumeField.value = '';
            volumeField.value = '${volume}';
            volumeField.dispatchEvent(new Event('input', { bubbles: true }));
            volumeField.dispatchEvent(new Event('change', { bubbles: true }));
            volumeField.dispatchEvent(new Event('blur', { bubbles: true }));
            console.log('Set volume using alternative selector');
          }
        }
        
        // Set Stop Loss with enhanced validation and multiple selector attempts
        setTimeout(function() {
          var slSet = setMT5FieldValue('.sl input[type="text"]', '${sl}', 'SL');
          if (!slSet) {
            // Try alternative selectors for other brokers
            var allInputs = document.querySelectorAll('input[type="text"]');
            for (var i = 0; i < allInputs.length; i++) {
              var input = allInputs[i];
              var parent = input.closest('[class*="loss"], [class*="sl"]');
              if (parent || input.placeholder && input.placeholder.toLowerCase().includes('stop')) {
                input.focus();
                input.value = '';
                input.value = '${sl}';
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
                input.dispatchEvent(new Event('blur', { bubbles: true }));
                console.log('Set SL using alternative selector');
                break;
              }
            }
          }
        }, 400);
        
        // Set Take Profit with enhanced validation and multiple selector attempts
        setTimeout(function() {
          var tpSet = setMT5FieldValue('.tp input[type="text"]', '${tp}', 'TP');
          if (!tpSet) {
            // Try alternative selectors for other brokers
            var allInputs = document.querySelectorAll('input[type="text"]');
            for (var i = 0; i < allInputs.length; i++) {
              var input = allInputs[i];
              var parent = input.closest('[class*="profit"], [class*="tp"]');
              if (parent || input.placeholder && input.placeholder.toLowerCase().includes('take') || input.placeholder && input.placeholder.toLowerCase().includes('profit')) {
                input.focus();
                input.value = '';
                input.value = '${tp}';
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
                input.dispatchEvent(new Event('blur', { bubbles: true }));
                console.log('Set TP using alternative selector');
                break;
              }
            }
          }
        }, 800);
        
        // Set Comment - try multiple selectors
        setTimeout(function() {
          var commentSelector = '.input.svelte-mtorg2 input[type="text"]';
          var commentField = document.querySelector(commentSelector);
          if (!commentField) {
            commentSelector = '.input.svelte-1d8k9kk input[type="text"]';
            commentField = document.querySelector(commentSelector);
          }
          if (!commentField) {
            // Try finding comment field by searching all inputs
            var allInputs = document.querySelectorAll('input[type="text"]');
            for (var i = 0; i < allInputs.length; i++) {
              var input = allInputs[i];
              if (input.placeholder && (input.placeholder.toLowerCase().includes('comment') || input.placeholder.toLowerCase().includes('note'))) {
                commentField = input;
                break;
              }
            }
          }
          if (commentField) {
            commentField.focus();
            commentField.value = '';
            commentField.value = '${botname}';
            commentField.dispatchEvent(new Event('input', { bubbles: true }));
            commentField.dispatchEvent(new Event('change', { bubbles: true }));
            commentField.dispatchEvent(new Event('blur', { bubbles: true }));
            console.log('Set comment field');
          }
        }, 1200);
      \`;
      
      const executeOrder = \`
        ${action === 'BUY' ?
        `// Try RazorMarkets selector first
        var buyButton = document.querySelector('.footer-row button.trade-button:not(.red)');
        if (buyButton !== null) { 
          buyButton.click(); 
          console.log('Executed BUY using RazorMarkets selector');
        } else {
          // Try other brokers - search for Buy button by text
          var buttons = document.querySelectorAll('button');
          for (var i = 0; i < buttons.length; i++) {
            var btnText = (buttons[i].textContent || '').trim().toLowerCase();
            if (btnText.includes('buy') && !btnText.includes('sell')) {
              buttons[i].click();
              console.log('Executed BUY using text-based selector');
              break;
            }
          }
        }` :
        `// Try RazorMarkets selector first
        var sellButton = document.querySelector('.footer-row button.trade-button.red');
        if (sellButton !== null) { 
          sellButton.click(); 
          console.log('Executed SELL using RazorMarkets selector');
        } else {
          // Try other brokers - search for Sell button by text
          var buttons = document.querySelectorAll('button');
          for (var i = 0; i < buttons.length; i++) {
            var btnText = (buttons[i].textContent || '').trim().toLowerCase();
            if (btnText.includes('sell') && !btnText.includes('buy')) {
              buttons[i].click();
              console.log('Executed SELL using text-based selector');
              break;
            }
          }
        }`
      }
      \`;
      
      const confirmOrder = \`
        // Try RazorMarkets selector first
        var okButton = document.querySelector('.trade-button.svelte-16cwwe0');
        if (okButton !== null) {
          okButton.click();
          console.log('Confirmed order using RazorMarkets selector');
        } else {
          // Try other brokers - search for OK/Confirm button by text
          var buttons = document.querySelectorAll('button');
          for (var i = 0; i < buttons.length; i++) {
            var btnText = (buttons[i].textContent || '').trim().toLowerCase();
            if (btnText.includes('ok') || btnText.includes('confirm') || btnText.includes('yes')) {
              buttons[i].click();
              console.log('Confirmed order using text-based selector: ' + btnText);
              break;
            }
          }
        }
      \`;
      
      // ========================================
      // SMART MT5 TRADING FLOW - AUTO-DETECTS LOGIN STATE
      // ========================================
      
      var globalOrdersCompleted = 0;
      var globalTotalOrders = ${numberOfOrders};
      var globalStartTime = Date.now();
      
      function sendProgress(message) {
        console.log('[MT5 Trading] ' + message);
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'step', 
          message: message
        }));
      }
      
      function sendSuccess(message) {
        console.log('[MT5 Success] ' + message);
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'success', 
          message: message
        }));
      }
      
      function sendError(message) {
        console.error('[MT5 Error] ' + message);
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'error', 
          message: message
        }));
      }
      
      // Check if already logged in
      function checkIfLoggedIn() {
        console.log('[MT5] Checking if already logged in...');
        
        // Look for login screen elements
        var loginField = document.querySelector('input[name="login"], input[placeholder*="Login"], input[placeholder*="login"]');
        var passwordField = document.querySelector('input[type="password"]');
        var connectButton = document.querySelector('button');
        var hasLoginScreen = loginField && passwordField;
        
        // Look for terminal elements (indicates logged in)
        var searchBar = document.querySelector('input[placeholder*="Search"], input[placeholder*="search"]');
        var createOrderBtn = Array.from(document.querySelectorAll('button')).find(btn => 
          (btn.textContent || '').toLowerCase().includes('create') && 
          (btn.textContent || '').toLowerCase().includes('order')
        );
        var balanceText = document.body.innerText.toLowerCase();
        var hasBalance = balanceText.includes('balance') || balanceText.includes('equity');
        var symbolElements = document.querySelectorAll('[class*="symbol"]');
        
        var isLoggedIn = !hasLoginScreen && (searchBar || createOrderBtn || hasBalance || symbolElements.length > 5);
        
        console.log('[MT5] Login check:', {
          hasLoginScreen: hasLoginScreen,
          hasSearchBar: !!searchBar,
          hasCreateOrderBtn: !!createOrderBtn,
          hasBalance: hasBalance,
          symbolCount: symbolElements.length,
          isLoggedIn: isLoggedIn
        });
        
        return isLoggedIn;
      }
      
      // Main entry point
      function startTrading() {
        sendProgress('Initializing trading session...');
        
        if (checkIfLoggedIn()) {
          console.log('[MT5] Already logged in - skipping login');
          sendProgress('Already logged in - starting trade execution...');
          setTimeout(step3_RevealSearchBar, 1000);
        } else {
          console.log('[MT5] Not logged in - performing login');
          sendProgress('Logging into MT5 account...');
          step1_Login();
        }
      }
      
      // Step 1: Login (only if needed)
      function step1_Login() {
        eval(loginScript);
        eval(loginPress);
        setTimeout(step2_WaitForLogin, 6000);
      }
      
      // Step 2: Wait for login to complete
      function step2_WaitForLogin() {
        sendProgress('Waiting for login to complete...');
        
        var attempts = 0;
        var maxAttempts = 10;
        
        function checkLoginStatus() {
          attempts++;
          console.log('[MT5] Checking login status, attempt ' + attempts + ' of ' + maxAttempts);
          
          if (checkIfLoggedIn()) {
            console.log('[MT5] Login successful - terminal loaded');
            sendProgress('Login successful!');
            setTimeout(step3_RevealSearchBar, 2000);
          } else if (attempts < maxAttempts) {
            console.log('[MT5] Terminal not ready yet, waiting...');
            setTimeout(checkLoginStatus, 2000);
          } else {
            console.log('[MT5] Login timeout - proceeding anyway');
            sendProgress('Login timeout - attempting to continue...');
            setTimeout(step3_RevealSearchBar, 2000);
          }
        }
        
        checkLoginStatus();
      }
      
      // Step 3: Reveal and verify search bar
      function step3_RevealSearchBar() {
        sendProgress('Accessing symbol search...');
        eval(revealAndVerifySearchBar);
        setTimeout(step4_SearchSymbol, 3000);
      }
      
      // Step 4: Search for symbol
      function step4_SearchSymbol() {
        sendProgress('Searching for ${asset}...');
        eval(searchSymbol);
        setTimeout(step5_SelectSymbol, 2000);
      }
      
      // Step 5: Select symbol
      function step5_SelectSymbol() {
        sendProgress('Selecting ${asset}...');
        eval(selectSymbol);
        setTimeout(step6_ExecuteTrades, 2000);
      }
      
      // Step 6: Execute all trades
      function step6_ExecuteTrades() {
        sendProgress('Starting trade execution (${numberOfOrders} order(s))...');
        executeSingleTrade(0);
      }
      
      // Execute a single trade
      function executeSingleTrade(orderIndex) {
        if (orderIndex >= globalTotalOrders) {
          // All trades completed
          var elapsed = ((Date.now() - globalStartTime) / 1000).toFixed(1);
          sendSuccess('✅ All ' + globalTotalOrders + ' order(s) executed for ${asset} in ' + elapsed + 's');
          
          setTimeout(function() {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'close', 
              message: 'Trading completed'
            }));
          }, 3000);
          return;
        }
        
        var orderNum = orderIndex + 1;
        sendProgress('Executing order ' + orderNum + ' of ' + globalTotalOrders + '...');
        
        // Open order dialog
        setTimeout(function() {
          console.log('[Order ' + orderNum + '] Opening order dialog');
          eval(openOrderDialog);
          
          // Set parameters
          setTimeout(function() {
            console.log('[Order ' + orderNum + '] Setting parameters (Vol: ${volume}, SL: ${sl}, TP: ${tp})');
            sendProgress('Setting parameters for order ' + orderNum + '...');
            eval(setOrderParams);
            
            // Execute the trade
            setTimeout(function() {
              console.log('[Order ' + orderNum + '] Executing ${action} order');
              sendProgress('Placing ${action} order ' + orderNum + '...');
              eval(executeOrder);
              
              // Confirm the order
              setTimeout(function() {
                console.log('[Order ' + orderNum + '] Confirming order');
                eval(confirmOrder);
                
                // Wait for order to process, then move to next
                setTimeout(function() {
                  globalOrdersCompleted++;
                  console.log('[Order ' + orderNum + '] Completed (' + globalOrdersCompleted + '/' + globalTotalOrders + ')');
                  
                  // Close any confirmation dialogs
                  var closeButtons = document.querySelectorAll('button');
                  for (var i = 0; i < closeButtons.length; i++) {
                    var btnText = (closeButtons[i].textContent || '').trim().toLowerCase();
                    if (btnText.includes('close') || btnText.includes('ok') || btnText === 'x') {
                      closeButtons[i].click();
                      console.log('[Order ' + orderNum + '] Closed confirmation dialog');
                      break;
                    }
                  }
                  
                  // Move to next order
                  setTimeout(function() {
                    executeSingleTrade(orderIndex + 1);
                  }, 2000);
                }, 3000); // Wait for confirmation
              }, 1500); // Wait before confirming
            }, 2000); // Wait before executing
          }, 2500); // Wait for parameters to be set
        }, 2000); // Wait for dialog to open
      }
      
      // Start the trading flow
      setTimeout(startTrading, 1000);
    `;
  }, [signal, tradeConfig, credentials, eaName]);

  // MT5 Broker URL mapping (Fix #8: generic removed — migrated to Razor Markets)
  const MT5_BROKER_URLS: Record<string, string> = {
    'RazorMarkets-Live': 'https://webtrader.razormarkets.co.za/terminal/',
  };

  // Get WebView URL for trading based on platform — uses session token for credentials
  const [sessionWebViewUrl, setSessionWebViewUrl] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function resolveProxyUrl() {
      if (!tradeConfig || !credentials) { setSessionWebViewUrl(''); return; }

      // Determine the correct action based on trade config direction and signal
      let action = signal?.action || '';
      if (tradeConfig.direction === 'BUY') { action = 'BUY'; }
      else if (tradeConfig.direction === 'SELL') { action = 'SELL'; }

      // Determine MT5 broker URL based on server name
      let mt5Url = 'https://webtrader.razormarkets.co.za/terminal/';
      if (tradeConfig.platform === 'MT5' && credentials.server) {
        mt5Url = MT5_BROKER_URLS[credentials.server] || MT5_BROKER_URLS['RazorMarkets-Live'];
      }

      const payload: Record<string, string> = {
        url: tradeConfig.platform === 'MT4' ? 'https://metatraderweb.app/trade?version=4' : mt5Url,
        login: credentials.login,
        password: credentials.password,
        server: credentials.server,
        asset: signal?.asset || '',
        action,
        price: signal?.price || '',
        tp: signal?.tp || '',
        sl: signal?.sl || '',
        volume: tradeConfig.lotSize,
        numberOfTrades: tradeConfig.numberOfTrades,
        botname: eaName,
      };

      const proxyEndpoint = tradeConfig.platform === 'MT4' ? '/api/mt4-proxy' : '/api/mt5-proxy';

      try {
        // POST credentials to get a one-time session token
        const res = await fetch('/api/proxy-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (cancelled) return;

        if (data.token) {
          const finalUrl = `${proxyEndpoint}?session=${encodeURIComponent(data.token)}`;
          console.log('🎯 Trading WebView URL (session):', { platform: tradeConfig.platform, proxyEndpoint });
          setSessionWebViewUrl(finalUrl);
        } else {
          console.error('Failed to create proxy session');
          setSessionWebViewUrl('');
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Proxy session error:', err);
          setSessionWebViewUrl('');
        }
      }
    }

    resolveProxyUrl();
    return () => { cancelled = true; };
  }, [tradeConfig, credentials, signal, eaName]);

  // Storage clear script for MT5 cleanup
  const getStorageClearScript = useCallback(() => {
    return `
      (async function() {
        try {
          try { localStorage.clear(); } catch(e) {}
          try { sessionStorage.clear(); } catch(e) {}
          try {
            if (indexedDB && indexedDB.databases) {
              const dbs = await indexedDB.databases();
              for (const db of dbs) {
                const name = (db && db.name) ? db.name : null;
                if (name) {
                  try { indexedDB.deleteDatabase(name); } catch(e) {}
                }
              }
            }
          } catch(e) {}
          try {
            if ('caches' in window) {
              const names = await caches.keys();
              for (const n of names) { try { await caches.delete(n); } catch(e) {} }
            }
          } catch(e) {}
          try {
            if ('serviceWorker' in navigator) {
              const regs = await navigator.serviceWorker.getRegistrations();
              for (const r of regs) { try { await r.unregister(); } catch(e) {} }
            }
          } catch(e) {}
          try {
            if (document && document.cookie) {
              document.cookie.split(';').forEach(function(c){
                const eq = c.indexOf('=');
                const name = eq > -1 ? c.substr(0, eq) : c;
                document.cookie = name + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/';
              });
            }
          } catch(e) {}
        } catch(e) {}
        true;
      })();
    `;
  }, []);

  // Cleanup function for MT5 trading webview
  const cleanupMT5WebView = useCallback(() => {
    if (tradeConfig?.platform === 'MT5' && webViewRef.current) {
      console.log('Cleaning up MT5 trading webview - clearing all stored data...');

      // Clear all storage before closing
      const clearScript = getStorageClearScript();
      webViewRef.current.injectJavaScript(clearScript);

      // Small delay to allow cleanup to complete
      setTimeout(() => {
        console.log('MT5 trading webview cleanup completed - destroying webview');
        // The webview will be destroyed when the modal closes
      }, 500);
    }
  }, [tradeConfig, getStorageClearScript]);

  // Handle WebView messages
  const stopHeartbeat = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
  }, []);

  const startHeartbeat = useCallback(() => {
    stopHeartbeat();
    const phases: string[] = [
      'Loading terminal...', 'Connecting to broker...', 'Preparing login...', 'Authenticating...', 'Searching symbol...', 'Setting up order...'
    ];
    heartbeatIndexRef.current = 0;
    setCurrentStep('Initializing...');
    lastUpdateRef.current = Date.now();
    heartbeatRef.current = setInterval(() => {
      // If there was a recent real update, skip heartbeat
      if (Date.now() - lastUpdateRef.current < 2000) return;
      heartbeatIndexRef.current = (heartbeatIndexRef.current + 1) % phases.length;
      setCurrentStep(phases[heartbeatIndexRef.current]);
    }, 2000) as unknown as ReturnType<typeof setInterval>;
  }, [stopHeartbeat]);

  const handleWebViewMessage = useCallback((event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      console.log('Trading WebView Message:', data);
      lastUpdateRef.current = Date.now();

      switch (data.type) {
        case 'step':
        case 'step_update':
          console.log('Trading step update:', data.message);
          stopHeartbeat();
          if (data.message) setCurrentStep(data.message);
          setTimeout(() => {
            if (Date.now() - lastUpdateRef.current > 3000) {
              startHeartbeat();
            }
          }, 3000);
          break;
        case 'success':
        case 'authentication_success':
          console.log('Trading success:', data.message);
          stopHeartbeat();
          if (data.message) setCurrentStep(data.message);
          // Mark session as warm — ready for on-demand trades
          if (tradeConfig?.platform) {
            setSessionWarm(true);
            setSessionPlatform(tradeConfig.platform);
            resetKeepAliveTimer();
          }
          setLoading(false);
          break;
        case 'close':
          // Keep-alive: DON'T tear down — stay warm for next trade
          console.log('Trade complete, keeping session alive:', data.message);
          stopHeartbeat();
          if (data.message) setCurrentStep(data.message);
          setTradeExecuted(true);
          setLoading(false);
          resetKeepAliveTimer();
          break;
        case 'authentication_failed':
          console.log('Auth failed:', data.message);
          stopHeartbeat();
          setCurrentStep(data.message);
          setError(data.message);
          setLoading(false);
          break;
        case 'error':
          console.log('Trading error:', data.message);
          stopHeartbeat();
          setError(data.message);
          setLoading(false);
          break;
        case 'trade_executed':
          console.log('Trade executed:', data.message);
          stopHeartbeat();
          if (data.message) setCurrentStep(data.message);
          setTradeExecuted(true);
          setLoading(false);
          resetKeepAliveTimer();
          break;
        default:
          if (data.message && typeof data.message === 'string') {
            console.log('Unknown type, showing message anyway:', data.type, data.message);
            setCurrentStep(data.message);
          }
          break;
      }
    } catch (parseError) {
      console.error('Error parsing WebView message:', parseError);
    }
  }, [tradeConfig, stopHeartbeat, startHeartbeat, resetKeepAliveTimer]);

  // Handle WebView load events
  // Note: the proxy server embeds the full login+trade script into the HTML
  // response itself (see handleMT5Proxy / handleMT4Proxy in server.ts). So we
  // do NOT inject a second client-side script here — it would conflict with
  // the proxy-embedded script. We just surface status updates sent via
  // postMessage from the embedded script.
  const handleWebViewLoad = useCallback(() => {
    console.log('[TradingWebView] WebView loaded. Platform:', Platform.OS, 'Type:', Platform.OS === 'web' ? 'WebWebView' : 'CustomWebView');
    setLoading(true);
    stopHeartbeat();
    setCurrentStep('Terminal loaded — waiting for proxy script...');
    lastUpdateRef.current = Date.now();

    // Arm heartbeat fallback if no step messages arrive within 4s
    setTimeout(() => {
      if (Date.now() - lastUpdateRef.current > 3500) {
        console.log('[TradingWebView] No step messages yet — starting heartbeat fallback');
        startHeartbeat();
      }
    }, 4000);

    // Diagnostic: if we still haven't heard anything from the proxy script
    // after 15s, surface a helpful hint rather than spinning forever.
    setTimeout(() => {
      if (Date.now() - lastUpdateRef.current > 14000) {
        console.warn('[TradingWebView] No messages from proxy script after 15s');
        setCurrentStep('⚠️ Proxy script not responding — check browser console');
      }
    }, 15000);
  }, [stopHeartbeat, startHeartbeat]);

  const handleWebViewError = useCallback((syntheticEvent: any) => {
    const { nativeEvent } = syntheticEvent;
    setError(`WebView error: ${nativeEvent.description}`);
    setLoading(false);
  }, []);

  // Dispatch a trade command to the warm iframe via postMessage
  const dispatchTradeToWarmSession = useCallback(() => {
    if (!sessionWarm || !webViewRef.current || !tradeConfig || !signal) return false;
    const cmd = JSON.stringify({
      type: 'execute_trade',
      asset: signal.asset,
      action: signal.action,
      volume: tradeConfig.lotSize,
      sl: signal.sl || '',
      tp: signal.tp || '',
      count: tradeConfig.numberOfTrades,
      botname: eaName,
    });
    console.log('[TradingWebView] Dispatching to warm session:', cmd);
    try {
      webViewRef.current.injectJavaScript(
        `window.postMessage(${JSON.stringify(cmd)}, '*'); true;`
      );
      return true;
    } catch (e) {
      console.warn('[TradingWebView] Warm dispatch failed, will reload:', e);
      return false;
    }
  }, [sessionWarm, tradeConfig, signal, eaName]);

  // Reset state when modal opens and cleanup when closing
  useEffect(() => {
    if (visible) {
      // If we have a warm session on the same platform, reuse it
      if (sessionWarm && sessionPlatform === tradeConfig?.platform && signal) {
        console.log('[TradingWebView] Reusing warm session for', signal.asset);
        setError(null);
        setTradeExecuted(false);
        setLoading(true);
        setCurrentStep('Sending trade to active session...');
        // Give a tick for state to settle, then dispatch
        setTimeout(() => {
          const ok = dispatchTradeToWarmSession();
          if (!ok) {
            console.log('[TradingWebView] Warm dispatch failed — falling back to cold start');
            setSessionWarm(false);
            setSessionPlatform(null);
            setCurrentStep('Initializing...');
            startHeartbeat();
          }
        }, 100);
      } else {
        // Cold start: new session
        setLoading(true);
        setError(null);
        setTradeExecuted(false);
        setCurrentStep('Initializing...');
        startHeartbeat();
      }
    } else if (!sessionWarm) {
      // Only cleanup when truly closing (not keep-alive)
      stopHeartbeat();
      if (tradeConfig?.platform === 'MT5') {
        cleanupMT5WebView();
      }
    }
  }, [visible, tradeConfig, signal, sessionWarm, sessionPlatform, cleanupMT5WebView, startHeartbeat, stopHeartbeat, dispatchTradeToWarmSession]);

  // Cleanup keep-alive timer on unmount
  useEffect(() => {
    return () => {
      if (keepAliveTimerRef.current) clearTimeout(keepAliveTimerRef.current);
    };
  }, []);

  // Debug logging
  useEffect(() => {
    console.log('TradingWebView render state:', {
      visible,
      hasSignal: !!signal,
      hasTradeConfig: !!tradeConfig,
      hasCredentials: !!credentials,
      signal: signal ? {
        id: signal.id,
        asset: signal.asset,
        action: signal.action,
        price: signal.price,
        tp: signal.tp,
        sl: signal.sl
      } : null,
      tradeConfig: tradeConfig ? {
        symbol: tradeConfig.symbol,
        platform: tradeConfig.platform,
        lotSize: tradeConfig.lotSize
      } : null,
      credentials: credentials ? {
        login: credentials.login,
        server: credentials.server,
        hasPassword: !!credentials.password
      } : null
    });
  }, [visible, signal, tradeConfig, credentials]);

  // Keep rendering if session is warm (even if no current signal)
  if (!sessionWarm && (!signal || !tradeConfig || !credentials)) {
    console.log('TradingWebView not rendering:', {
      hasSignal: !!signal,
      hasTradeConfig: !!tradeConfig,
      hasCredentials: !!credentials,
      sessionWarm,
    });
    return null;
  }

  console.log('TradingWebView rendering:', {
    signal: signal?.asset,
    platform: tradeConfig?.platform,
    sessionWarm,
  });

  const webViewUrl = sessionWebViewUrl;

  const { width: screenWidth } = Dimensions.get('window');

  return (
    <>
      {/* Compact Progress Toast */}
      {visible && (
        <View style={[
          styles.toastContainer,
          {
            width: screenWidth - 40,
            // Position toast at top of screen, above menu
            top: Platform.OS === 'ios' ? 50 : 30,
          }
        ]}>
          <View style={styles.toastContent}>
            <View style={styles.toastLeft}>
              <View style={styles.toastIcon}>
                {error ? (
                  <AlertCircle color="#FF4444" size={16} />
                ) : tradeExecuted ? (
                  <CheckCircle color="#00FF88" size={16} />
                ) : (
                  <TrendingUp color="#CCCCCC" size={16} />
                )}
              </View>
              <View style={styles.toastInfo}>
                <Text style={styles.toastTitle}>
                  {signal?.asset || '—'} • {signal?.action || '—'} • {tradeConfig?.platform || sessionPlatform || '—'}
                </Text>
                <Text style={[styles.toastStatus, {
                  color: error ? '#FF4444' : tradeExecuted ? '#00FF88' : sessionWarm ? '#00BFFF' : '#CCCCCC'
                }]}>
                  {error || currentStep || (tradeExecuted ? 'Execution Complete' : 'Initializing...')}
                </Text>
              </View>
            </View>

            <View style={styles.toastRight}>
              {loading && !tradeExecuted && !error && (
                <ActivityIndicator size="small" color="#CCCCCC" />
              )}
              {error && (
                <TouchableOpacity
                  style={styles.toastRetryButton}
                  onPress={() => {
                    setError(null);
                    setLoading(true);
                    setTradeExecuted(false);
                    setCurrentStep('Retrying...');
                    // Reload the WebView
                    if (webViewRef.current) {
                      webViewRef.current.reload();
                    }
                  }}
                >
                  <Text style={styles.toastRetryText}>Retry</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.toastCloseButton}
                onPress={() => {
                  // Full teardown — kills keep-alive session too
                  if (tradeConfig?.platform === 'MT5') {
                    cleanupMT5WebView();
                    setTimeout(teardownSession, 600);
                  } else {
                    teardownSession();
                  }
                }}
              >
                <X color="#FFFFFF" size={16} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Progress Bar */}
          {!error && !tradeExecuted && (
            <View style={styles.progressBarContainer}>
              <View style={styles.progressBar} />
            </View>
          )}
        </View>
      )}

      {/* WebView for trading execution - Completely invisible, runs in background */}
      {visible && webViewUrl !== '' && (
        <View style={styles.invisibleWebViewContainer}>
          {Platform.OS === 'web' ? (
            <WebWebView
              ref={webViewRef as any}
              url={webViewUrl}
              onMessage={handleWebViewMessage}
              onLoadEnd={handleWebViewLoad}
              style={styles.invisibleWebView}
            />
          ) : (
            <CustomWebView
              url={webViewUrl}
              onMessage={handleWebViewMessage}
              onLoadEnd={handleWebViewLoad}
              style={styles.invisibleWebView}
            />
          )}
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  // Toast Styles - Clean positioning at top of screen
  toastContainer: {
    position: 'absolute',
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.8,
    shadowRadius: 16,
    elevation: 10000, // Very high elevation to stay on top
    zIndex: 10000, // Highest z-index to appear above everything
  },
  toastContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  toastLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  toastIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  toastInfo: {
    flex: 1,
  },
  toastTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  toastStatus: {
    fontSize: 12,
    fontWeight: '500',
  },
  toastRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toastRetryButton: {
    backgroundColor: '#00FF00',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginRight: 8,
  },
  toastRetryText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '600',
  },
  toastCloseButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  progressBarContainer: {
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#CCCCCC',
    width: '100%',
    opacity: 0.8,
  },

  // Full-screen WebView Styles
  webViewContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000000',
    zIndex: 10000,
  },
  webView: {
    flex: 1,
    backgroundColor: '#000000',
  },

  // Visible WebView Styles - Full screen for debugging
  visibleWebViewContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000000',
    zIndex: 10000,
    elevation: 10000,
  },
  visibleWebView: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  webViewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    backgroundColor: '#1A1A1A',
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  webViewHeaderTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  webViewCloseButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },

  // Invisible WebView Styles - Completely invisible and non-interactive
  invisibleWebViewContainer: {
    position: 'absolute',
    top: -10000,
    left: -10000,
    width: 800,
    height: 600,
    opacity: 0,
    zIndex: -10000,
    overflow: 'hidden',
    pointerEvents: 'none',
    elevation: -10000,
  },
  invisibleWebView: {
    width: 800,
    height: 600,
    opacity: 0,
    backgroundColor: 'transparent',
    pointerEvents: 'none',
    elevation: -10000,
  },
  closeButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 20,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10001,
  },

  // Legacy styles (kept for compatibility)
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    color: '#CCCCCC',
    fontSize: 12,
    marginTop: 2,
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#1A1A1A',
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  statusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  successBadge: {
    backgroundColor: '#00FF00',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  successText: {
    color: '#000000',
    fontSize: 10,
    fontWeight: 'bold',
  },
  tradeDetails: {
    backgroundColor: '#1A1A1A',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  tradeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  tradeLabel: {
    color: '#CCCCCC',
    fontSize: 12,
    fontWeight: '500',
  },
  tradeValue: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  webViewContainer: {
    flex: 1,
  },
  webView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
  },
  loadingText: {
    color: '#CCCCCC',
    fontSize: 16,
    marginTop: 16,
    fontWeight: '500',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  errorTitle: {
    color: '#FF4444',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  errorMessage: {
    color: '#CCCCCC',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#00FF00',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    display: 'none',
  },
});