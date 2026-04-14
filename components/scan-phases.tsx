import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';

type Props = {
  /** -1 = idle, 0..phases.length-1 = active phase, phases.length = all done */
  phase: number;
  color: string;
};

const PHASES = [
  'DETECTING CANDLES',
  'READING STRUCTURE',
  'FINDING LEVELS',
  'BUILDING SIGNAL',
];

export function ScanPhases({ phase, color }: Props) {
  return (
    <View style={styles.wrap}>
      {PHASES.map((label, i) => {
        const status: 'done' | 'active' | 'pending' =
          i < phase ? 'done' : i === phase ? 'active' : 'pending';
        return <PhaseRow key={label} label={label} status={status} color={color} />;
      })}
    </View>
  );
}

function PhaseRow({
  label,
  status,
  color,
}: {
  label: string;
  status: 'done' | 'active' | 'pending';
  color: string;
}) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (status !== 'active') {
      pulse.stopAnimation();
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [status, pulse]);

  const dotOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.35, 1],
  });
  const dotScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.85, 1.15],
  });

  const textColor =
    status === 'done'
      ? '#FFFFFF'
      : status === 'active'
      ? color
      : 'rgba(255,255,255,0.35)';

  return (
    <View style={styles.row}>
      <View style={styles.iconSlot}>
        {status === 'done' ? (
          <View style={[styles.doneRing, { borderColor: color, shadowColor: color }]}>
            <Check color={color} size={12} strokeWidth={3} />
          </View>
        ) : status === 'active' ? (
          <Animated.View
            style={[
              styles.activeDot,
              {
                backgroundColor: color,
                shadowColor: color,
                opacity: dotOpacity,
                transform: [{ scale: dotScale }],
              },
            ]}
          />
        ) : (
          <View style={styles.pendingDot} />
        )}
      </View>
      <Text
        style={[
          styles.label,
          { color: textColor },
          status === 'active' && { textShadowColor: color + 'B3' },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconSlot: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneRing: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 4,
  },
  activeDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 6,
  },
  pendingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
});
