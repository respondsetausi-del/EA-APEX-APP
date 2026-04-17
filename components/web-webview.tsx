import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { View, StyleSheet, Platform } from 'react-native';

interface WebWebViewProps {
  url: string;
  script?: string;
  onMessage?: (event: any) => void;
  onLoadEnd?: () => void;
  onDestroy?: () => void;
  style?: any;
}

export interface WebWebViewHandle {
  injectJavaScript: (code: string) => void;
  reload: () => void;
}

const WebWebView = forwardRef<WebWebViewHandle, WebWebViewProps>(({
  url,
  script,
  onMessage,
  onLoadEnd,
  onDestroy,
  style
}, ref) => {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useImperativeHandle(ref, () => ({
    injectJavaScript: (code: string) => {
      const iframe = iframeRef.current;
      if (!iframe || !iframe.contentWindow) {
        console.warn('[WebWebView] injectJavaScript: iframe or contentWindow not available');
        return;
      }
      try {
        // Ensure ReactNativeWebView shim exists before running injected code
        const shim = `
          if (!window.ReactNativeWebView) {
            window.ReactNativeWebView = {
              postMessage: function(data) {
                window.parent.postMessage(data, '*');
              }
            };
          }
        `;
        iframe.contentWindow.eval(shim + '\n' + code);
        console.log('[WebWebView] Script injected successfully');
      } catch (e: any) {
        console.warn('[WebWebView] injectJavaScript failed (likely CORS):', e?.message || e);
        // Fallback: try postMessage-based injection
        try {
          iframe.contentWindow.postMessage({ type: '__inject', code }, '*');
        } catch (e2) {
          console.warn('[WebWebView] postMessage fallback also failed:', e2);
        }
      }
    },
    reload: () => {
      const iframe = iframeRef.current;
      if (iframe) {
        iframe.src = url;
      }
    },
  }), [url]);

  // Function to clear cache and destroy the WebView
  const clearCacheAndDestroy = () => {
    const iframe = iframeRef.current;
    if (iframe) {
      try {
        // Clear iframe content
        iframe.src = 'about:blank';

        // Clear any stored data
        if (iframe.contentWindow) {
          try {
            iframe.contentWindow.location.replace('about:blank');
          } catch (e) {
            // CORS might prevent this, that's okay
          }
        }

        // Remove the iframe from DOM
        iframe.remove();

        console.log('WebView cache cleared and destroyed');
      } catch (error) {
        console.log('Error clearing WebView cache:', error);
      }
    }

    if (onDestroy) {
      onDestroy();
    }
  };

  // Expose the clear function globally for external access
  useEffect(() => {
    (window as any).clearWebViewCache = clearCacheAndDestroy;

    return () => {
      delete (window as any).clearWebViewCache;
    };
  }, []);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const handleLoad = () => {
      console.log('Web WebView iframe loaded');
      setIsLoaded(true);

      // Debug iframe content
      try {
        if (iframe.contentDocument) {
          console.log('Iframe content document found:', iframe.contentDocument.title);
          console.log('Iframe content body:', iframe.contentDocument.body?.innerHTML?.substring(0, 200) + '...');
        } else {
          console.log('Iframe content document not accessible (CORS)');
        }
      } catch (e) {
        console.log('Cannot access iframe content (CORS):', e.message);
      }

      if (onLoadEnd) {
        onLoadEnd();
      }
    };

    const handleError = (error: any) => {
      console.error('Web WebView iframe error:', error);
    };

    iframe.addEventListener('load', handleLoad);
    iframe.addEventListener('error', handleError);

    return () => {
      if (iframe) {
        iframe.removeEventListener('load', handleLoad);
        iframe.removeEventListener('error', handleError);
      }
    };
  }, [url, onMessage, onLoadEnd]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearCacheAndDestroy();
    };
  }, []);

  // Handle messages from the iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Accept any message that looks like our trading-script format.
      // The strict event.source === iframe.contentWindow check was rejecting
      // legitimate messages when the iframe loads nested frames or redirects.
      try {
        const raw = event.data;
        if (raw == null) return;

        let data: any = null;
        if (typeof raw === 'string') {
          // Only try parsing strings that look like JSON
          if (raw.startsWith('{') || raw.startsWith('[')) {
            try { data = JSON.parse(raw); } catch { return; }
          } else {
            return;
          }
        } else if (typeof raw === 'object') {
          data = raw;
        } else {
          return;
        }

        // Must have a `type` field to be one of our messages
        if (!data || typeof data.type !== 'string') return;

        // Ignore obvious non-trading message types (React DevTools, etc.)
        if (data.type.startsWith('__') || data.type.includes('devtools')) return;

        console.log('[WebWebView] Trading message received:', data);

        if (onMessage) {
          const rnEvent = {
            nativeEvent: {
              data: typeof raw === 'string' ? raw : JSON.stringify(data),
            },
          };
          onMessage(rnEvent);
        }
      } catch (error) {
        // Swallow — noise from other postMessage sources on the page
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onMessage]);

  return (
    <View style={[styles.container, style]}>
      <iframe
        ref={iframeRef}
        src={url}
        style={styles.iframe}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation allow-modals allow-downloads"
        allow="payment *; clipboard-write; camera; microphone; geolocation; autoplay; fullscreen"
        referrerPolicy="strict-origin-when-cross-origin"
        title="Web Terminal WebView"
        loading="eager"
        frameBorder="0"
        scrolling="auto"
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  iframe: {
    width: 1280,
    height: 800,
    border: 'none',
    backgroundColor: '#000000',
    display: 'block',
    visibility: 'visible',
    opacity: 1,
  },
});

export default WebWebView;
