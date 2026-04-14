import React, { useEffect, useRef, useState } from 'react';
import { Text, TextStyle, StyleProp } from 'react-native';

type Props = {
  text: string;
  /** Milliseconds per character. */
  speed?: number;
  /** Optional delay before typing starts. */
  startDelay?: number;
  style?: StyleProp<TextStyle>;
  /** Append a blinking cursor while typing. */
  cursor?: boolean;
  /** Called once the text has been fully revealed. */
  onDone?: () => void;
};

/**
 * Reveals `text` character-by-character. Restarts whenever `text` changes.
 */
export function Typewriter({
  text,
  speed = 18,
  startDelay = 0,
  style,
  cursor = true,
  onDone,
}: Props) {
  const [shown, setShown] = useState('');
  const [done, setDone] = useState(false);
  const [blink, setBlink] = useState(true);
  const timerRef = useRef<any>(null);
  const startRef = useRef<any>(null);

  useEffect(() => {
    setShown('');
    setDone(false);
    if (timerRef.current) clearInterval(timerRef.current);
    if (startRef.current) clearTimeout(startRef.current);

    startRef.current = setTimeout(() => {
      let i = 0;
      timerRef.current = setInterval(() => {
        i += 1;
        if (i >= text.length) {
          setShown(text);
          clearInterval(timerRef.current);
          timerRef.current = null;
          setDone(true);
          if (onDone) onDone();
          return;
        }
        setShown(text.slice(0, i));
      }, speed);
    }, startDelay);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (startRef.current) clearTimeout(startRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, speed, startDelay]);

  useEffect(() => {
    if (done) {
      setBlink(false);
      return;
    }
    const id = setInterval(() => setBlink(b => !b), 450);
    return () => clearInterval(id);
  }, [done]);

  return (
    <Text style={style}>
      {shown}
      {cursor && !done ? (blink ? '▌' : ' ') : ''}
    </Text>
  );
}
