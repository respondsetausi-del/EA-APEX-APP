import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Platform } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type Props = {
  value: number; // 0-100
  color: string;
  size?: number;
  strokeWidth?: number;
  label?: string;
};

/**
 * Radial confidence gauge. Animates from 0 → value on mount / when value changes.
 */
export function ConfidenceGauge({
  value,
  color,
  size = 110,
  strokeWidth = 9,
  label,
}: Props) {
  const clamped = Math.max(0, Math.min(100, value));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const progress = useRef(new Animated.Value(0)).current;
  const displayedNumber = useRef(new Animated.Value(0)).current;
  const [shown, setShown] = React.useState(0);

  useEffect(() => {
    progress.setValue(0);
    displayedNumber.setValue(0);
    Animated.timing(progress, {
      toValue: clamped,
      duration: 900,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    Animated.timing(displayedNumber, {
      toValue: clamped,
      duration: 900,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();

    const listenerId = displayedNumber.addListener(({ value: v }) => {
      setShown(Math.round(v));
    });
    return () => {
      displayedNumber.removeListener(listenerId);
    };
  }, [clamped, progress, displayedNumber]);

  // strokeDashoffset = circumference - (value/100)*circumference
  const strokeDashoffset = progress.interpolate({
    inputRange: [0, 100],
    outputRange: [circumference, 0],
  });

  const center = size / 2;

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <G rotation={-90} origin={`${center}, ${center}`}>
          <Circle
            cx={center}
            cy={center}
            r={radius}
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={strokeWidth}
            fill="none"
          />
          <AnimatedCircle
            cx={center}
            cy={center}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={strokeDashoffset as any}
            strokeLinecap="round"
            {...(Platform.OS === 'web'
              ? ({ style: { filter: `drop-shadow(0 0 6px ${color})` } } as any)
              : null)}
          />
        </G>
      </Svg>
      <View style={styles.center}>
        <Text style={[styles.value, { color: '#FFFFFF' }]}>{shown}</Text>
        {label ? (
          <Text style={[styles.label, { color: color + 'CC' }]}>{label}</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 1,
  },
  label: {
    marginTop: 2,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
});
