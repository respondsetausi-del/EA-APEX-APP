import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

type Props = {
  /** Whenever this number increments, a new burst fires. */
  trigger: number;
  color: string;
  count?: number;
  /** Pixel radius the particles fly outwards. */
  radius?: number;
  /** Animation duration in ms. */
  duration?: number;
};

type Particle = {
  x: Animated.Value;
  y: Animated.Value;
  opacity: Animated.Value;
  scale: Animated.Value;
  angle: number;
  size: number;
};

export function ParticleBurst({
  trigger,
  color,
  count = 14,
  radius = 140,
  duration = 750,
}: Props) {
  const particles = useMemo<Particle[]>(
    () =>
      Array.from({ length: count }, (_, i) => ({
        x: new Animated.Value(0),
        y: new Animated.Value(0),
        opacity: new Animated.Value(0),
        scale: new Animated.Value(0),
        angle: (i / count) * Math.PI * 2 + Math.random() * 0.3,
        size: 5 + Math.random() * 5,
      })),
    [count]
  );
  const fired = useRef(0);

  useEffect(() => {
    if (trigger === fired.current) return;
    fired.current = trigger;
    if (trigger === 0) return;

    const animations = particles.map(p => {
      // Slight random variance per fire
      const r = radius * (0.6 + Math.random() * 0.55);
      const dx = Math.cos(p.angle) * r;
      const dy = Math.sin(p.angle) * r;
      p.x.setValue(0);
      p.y.setValue(0);
      p.opacity.setValue(1);
      p.scale.setValue(1);
      return Animated.parallel([
        Animated.timing(p.x, {
          toValue: dx,
          duration,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(p.y, {
          toValue: dy,
          duration,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(p.opacity, {
          toValue: 0,
          duration,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(p.scale, {
          toValue: 0.3,
          duration,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]);
    });
    Animated.parallel(animations).start();
  }, [trigger, particles, radius, duration]);

  return (
    <View pointerEvents="none" style={styles.wrap}>
      {particles.map((p, i) => (
        <Animated.View
          key={i}
          style={[
            styles.particle,
            {
              width: p.size,
              height: p.size,
              borderRadius: p.size / 2,
              backgroundColor: color,
              shadowColor: color,
              opacity: p.opacity,
              transform: [
                { translateX: p.x },
                { translateY: p.y },
                { scale: p.scale },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  particle: {
    position: 'absolute',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 6,
  },
});
