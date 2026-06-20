import { ComponentType, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { appendSession } from '../lib/sessions';
import { useSpeed } from '../lib/SpeedContext';

// ── Constants ─────────────────────────────────────────────────────────

const DURATIONS = [
  { emoji: '🌱', minutes: 5 },
  { emoji: '🌿', minutes: 10 },
  { emoji: '🪴', minutes: 15 },
  { emoji: '🌲', minutes: 20 },
  { emoji: '🌳', minutes: 25 },
];

const MOTIVATIONAL: Record<TimerState, string> = {
  idle: 'Plant your seed. Start focusing.',
  running: 'Growing... stay focused 🌿',
  paused: 'Paused. Come back soon 🌱',
  completed: 'Amazing! Your tree has grown! 🌳',
};

const PARTICLE_EMOJIS = ['🍃', '✨', '🍃', '✨', '🍃', '✨'];
const PARTICLE_X = [-72, -38, -8, 18, 44, 72]; // horizontal spread around center
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// ── Types ─────────────────────────────────────────────────────────────

type TimerState = 'idle' | 'running' | 'paused' | 'completed';
type Stage = 1 | 2 | 3 | 4 | 5;
type Weather = 'sunny' | 'windy' | 'rainy' | 'snowy';

const WEATHER_META: Record<Weather, { emoji: string; label: string }> = {
  sunny: { emoji: '☀️', label: 'Sunny' },
  windy: { emoji: '🌬️', label: 'Windy' },
  rainy: { emoji: '🌧️', label: 'Rainy' },
  snowy: { emoji: '❄️', label: 'Snowy' },
};

// ── Pure helpers ──────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function deriveStage(secondsLeft: number, timerState: TimerState, totalSeconds: number): Stage {
  if (timerState === 'idle') return 1;
  if (timerState === 'completed') return 5;
  const ratio = secondsLeft / totalSeconds;
  if (ratio > 0.8) return 1;
  if (ratio > 0.6) return 2;
  if (ratio > 0.4) return 3;
  if (ratio > 0.2) return 4;
  return 5;
}

// ── Palette ───────────────────────────────────────────────────────────

const TRUNK = '#9C6B43';
const TRUNK_DK = '#85583A';
const STEM = '#6BAE4A';
const LEAF_LIGHT = '#8FD05A';
const LEAF_MID = '#6FBF44';
const LEAF_DARK = '#4F9E33';
const SEED_BODY = '#C7915F';
const SEED_SHADE = '#B07A4C';
const GRASS = '#7CC242';
const GRASS_HI = '#95D45C';
const SOIL = '#9B6B4A';
const SOIL_DK = '#85583A';
const ROOT = '#C49A6C';
const FACE = '#3D3A38';
const BLUSH = 'rgba(255, 142, 138, 0.55)';

// ── Cute face (eyes + blush + smile, with an excited variant) ─────────

function Face({ excited }: { excited: boolean }) {
  return (
    <View style={fc.face} pointerEvents="none">
      <View style={fc.eyesRow}>
        <View style={excited ? fc.eyeHappy : fc.eye} />
        <View style={excited ? fc.eyeHappy : fc.eye} />
      </View>
      <View style={fc.blushLeft} />
      <View style={fc.blushRight} />
      <View style={excited ? fc.mouthExcited : fc.mouth} />
    </View>
  );
}

// ── Tree stage shapes (pure RN views — no SVG library) ────────────────
// Each stage layers a few rounded shapes for a fuller, cuter look and
// carries a Face. Shapes are rooted near the grass line (~bottom 40).

function TreeSeed({ excited }: { excited: boolean }) {
  return (
    <View style={ts.canvas}>
      <View style={ts.seedSprout} />
      <View style={ts.seedBody} />
      <View style={ts.seedShade} />
      <View style={ts.faceSeed}><Face excited={excited} /></View>
    </View>
  );
}

function TreeSprout({ excited }: { excited: boolean }) {
  return (
    <View style={ts.canvas}>
      <View style={ts.sproutLeafL} />
      <View style={ts.sproutLeafR} />
      <View style={ts.sproutStem} />
      <View style={ts.seedBody} />
      <View style={ts.seedShade} />
      <View style={ts.faceSeed}><Face excited={excited} /></View>
    </View>
  );
}

function TreeSmallPlant({ excited }: { excited: boolean }) {
  return (
    <View style={ts.canvas}>
      <View style={ts.plantStem} />
      <View style={ts.plantLeafL} />
      <View style={ts.plantLeafR} />
      <View style={ts.plantCrownBack} />
      <View style={ts.plantCrown} />
      <View style={ts.facePlant}><Face excited={excited} /></View>
    </View>
  );
}

function TreeMedium({ excited }: { excited: boolean }) {
  return (
    <View style={ts.canvas}>
      <View style={ts.trunkMedium} />
      <View style={ts.medCanopyBack} />
      <View style={ts.medCanopyTop} />
      <View style={ts.medCanopyFront} />
      <View style={ts.faceMedium}><Face excited={excited} /></View>
    </View>
  );
}

function TreeFull({ excited }: { excited: boolean }) {
  return (
    <View style={ts.canvas}>
      <View style={ts.trunkFull} />
      <View style={ts.fullCanopyBack} />
      <View style={ts.fullCanopyTop} />
      <View style={ts.fullCanopyLeft} />
      <View style={ts.fullCanopyRight} />
      <View style={ts.fullCanopyFront} />
      <View style={ts.faceFull}><Face excited={excited} /></View>
    </View>
  );
}

const STAGES: Record<Stage, ComponentType<{ excited: boolean }>> = {
  1: TreeSeed,
  2: TreeSprout,
  3: TreeSmallPlant,
  4: TreeMedium,
  5: TreeFull,
};

// ── Ground (static — does not sway or jump with the plant) ────────────

function Ground({ stage }: { stage: Stage }) {
  return (
    <View style={ts.groundWrap} pointerEvents="none">
      <View style={ts.soil} />
      <View style={ts.grass} />
      <View style={ts.grassHi} />
      {/* Per-stage roots rendered above the grass so they visibly emerge from soil */}
      {stage >= 3 && (
        <View style={StyleSheet.absoluteFill}>
          {stage === 3 && <>
            <View style={[ts.rootBase, ts.r3C]} />
            <View style={[ts.rootBase, ts.r3L]} />
            <View style={[ts.rootBase, ts.r3R]} />
          </>}
          {stage === 4 && <>
            <View style={[ts.rootBase, ts.r4C]} />
            <View style={[ts.rootBase, ts.r4L]} />
            <View style={[ts.rootBase, ts.r4R]} />
            <View style={[ts.rootBase, ts.r4LL]} />
            <View style={[ts.rootBase, ts.r4RR]} />
          </>}
          {stage === 5 && <>
            <View style={[ts.rootBase, ts.r5C]} />
            <View style={[ts.rootBase, ts.r5L]} />
            <View style={[ts.rootBase, ts.r5R]} />
            <View style={[ts.rootBase, ts.r5LL]} />
            <View style={[ts.rootBase, ts.r5RR]} />
          </>}
        </View>
      )}
      <View style={[ts.bladeBase, ts.bladeL]} />
      <View style={[ts.bladeBase, ts.bladeR]} />
    </View>
  );
}

const fc = StyleSheet.create({
  face: { width: 48, height: 30, alignItems: 'center' },
  eyesRow: { flexDirection: 'row', gap: 13, marginTop: 2 },
  eye: { width: 6, height: 6, borderRadius: 3, backgroundColor: FACE },
  eyeHappy: {
    width: 10,
    height: 6,
    borderTopWidth: 2.5,
    borderColor: FACE,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    backgroundColor: 'transparent',
  },
  mouth: {
    marginTop: 5,
    width: 13,
    height: 7,
    borderBottomWidth: 2.5,
    borderColor: FACE,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
  mouthExcited: {
    marginTop: 4,
    width: 14,
    height: 11,
    backgroundColor: '#7A4438',
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    borderTopLeftRadius: 5,
    borderTopRightRadius: 5,
  },
  blushLeft: {
    position: 'absolute',
    top: 13,
    left: 3,
    width: 8,
    height: 5,
    borderRadius: 3,
    backgroundColor: BLUSH,
  },
  blushRight: {
    position: 'absolute',
    top: 13,
    right: 3,
    width: 8,
    height: 5,
    borderRadius: 3,
    backgroundColor: BLUSH,
  },
});

const ts = StyleSheet.create({
  canvas: { width: 200, height: 200 },

  // ── Ground ──
  groundWrap: { ...StyleSheet.absoluteFillObject },
  soil: {
    position: 'absolute',
    width: 172,
    height: 34,
    bottom: 8,
    left: 14,
    backgroundColor: SOIL,
    borderTopLeftRadius: 70,
    borderTopRightRadius: 70,
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
    borderBottomWidth: 4,
    borderBottomColor: SOIL_DK,
  },
  grass: {
    position: 'absolute',
    width: 172,
    height: 26,
    bottom: 28,
    left: 14,
    backgroundColor: GRASS,
    borderTopLeftRadius: 86,
    borderTopRightRadius: 86,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
  },
  grassHi: {
    position: 'absolute',
    width: 150,
    height: 12,
    bottom: 40,
    left: 25,
    backgroundColor: GRASS_HI,
    borderRadius: 8,
  },
  bladeBase: {
    position: 'absolute',
    width: 5,
    height: 14,
    backgroundColor: GRASS_HI,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
    bottom: 44,
  },
  bladeL: { left: 44, transform: [{ rotate: '-12deg' }] },
  bladeR: { right: 44, transform: [{ rotate: '12deg' }] },

  // ── Roots — per-stage, top edge aligns with trunk/stem base ──
  rootBase: {
    position: 'absolute',
    backgroundColor: ROOT,
    borderRadius: 4,
  },
  // Stage 3: plantStem bottom:40, left:96, width:7  → root top = bottom:16+24 = 40 ✓
  r3C:  { width: 7,  height: 24, bottom: 16, left: 96 },
  r3L:  { width: 5,  height: 20, bottom: 12, left: 77,  transform: [{ rotate: '30deg'  }] },
  r3R:  { width: 5,  height: 20, bottom: 12, left: 118, transform: [{ rotate: '-30deg' }] },
  // Stage 4: trunkMedium bottom:36, left:92, width:16 → root top = bottom:10+26 = 36 ✓
  r4C:  { width: 14, height: 26, bottom: 10, left: 93 },
  r4L:  { width: 5,  height: 22, bottom: 8,  left: 72,  transform: [{ rotate: '35deg'  }] },
  r4R:  { width: 5,  height: 22, bottom: 8,  left: 123, transform: [{ rotate: '-35deg' }] },
  r4LL: { width: 4,  height: 18, bottom: 6,  left: 58,  transform: [{ rotate: '50deg'  }] },
  r4RR: { width: 4,  height: 18, bottom: 6,  left: 138, transform: [{ rotate: '-50deg' }] },
  // Stage 5: trunkFull bottom:36, left:88, width:24 → root top = bottom:8+28 = 36 ✓
  r5C:  { width: 18, height: 28, bottom: 8,  left: 91 },
  r5L:  { width: 6,  height: 24, bottom: 6,  left: 66,  transform: [{ rotate: '34deg'  }] },
  r5R:  { width: 6,  height: 24, bottom: 6,  left: 128, transform: [{ rotate: '-34deg' }] },
  r5LL: { width: 4,  height: 20, bottom: 4,  left: 48,  transform: [{ rotate: '50deg'  }] },
  r5RR: { width: 4,  height: 20, bottom: 4,  left: 152, transform: [{ rotate: '-50deg' }] },

  // ── Stage 1: seed ──
  seedBody: {
    position: 'absolute',
    width: 36,
    height: 42,
    bottom: 30,
    left: 82,
    backgroundColor: SEED_BODY,
    borderRadius: 18,
  },
  seedShade: {
    position: 'absolute',
    width: 16,
    height: 30,
    bottom: 32,
    left: 96,
    backgroundColor: SEED_SHADE,
    borderRadius: 10,
    opacity: 0.55,
  },
  seedSprout: {
    position: 'absolute',
    width: 8,
    height: 14,
    bottom: 70,
    left: 96,
    backgroundColor: STEM,
    borderTopLeftRadius: 5,
    borderTopRightRadius: 5,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
  },

  // ── Stage 2: sprout ──
  sproutStem: {
    position: 'absolute',
    width: 6,
    height: 40,
    bottom: 52,
    left: 97,
    backgroundColor: STEM,
    borderRadius: 3,
  },
  sproutLeafL: {
    position: 'absolute',
    width: 30,
    height: 18,
    bottom: 80,
    left: 66,
    backgroundColor: LEAF_MID,
    borderRadius: 12,
    transform: [{ rotate: '-28deg' }],
  },
  sproutLeafR: {
    position: 'absolute',
    width: 30,
    height: 18,
    bottom: 80,
    left: 104,
    backgroundColor: LEAF_LIGHT,
    borderRadius: 12,
    transform: [{ rotate: '28deg' }],
  },

  // ── Stage 3: small plant ──
  plantStem: {
    position: 'absolute',
    width: 7,
    height: 34,
    bottom: 40,
    left: 96,
    backgroundColor: STEM,
    borderRadius: 4,
  },
  plantLeafL: {
    position: 'absolute',
    width: 34,
    height: 20,
    bottom: 56,
    left: 56,
    backgroundColor: LEAF_MID,
    borderRadius: 12,
    transform: [{ rotate: '-22deg' }],
  },
  plantLeafR: {
    position: 'absolute',
    width: 34,
    height: 20,
    bottom: 56,
    left: 110,
    backgroundColor: LEAF_LIGHT,
    borderRadius: 12,
    transform: [{ rotate: '22deg' }],
  },
  plantCrownBack: {
    position: 'absolute',
    width: 74,
    height: 64,
    bottom: 66,
    left: 63,
    backgroundColor: LEAF_DARK,
    borderRadius: 36,
  },
  plantCrown: {
    position: 'absolute',
    width: 62,
    height: 54,
    bottom: 72,
    left: 69,
    backgroundColor: LEAF_LIGHT,
    borderRadius: 30,
  },

  // ── Stage 4: medium tree ──
  trunkMedium: {
    position: 'absolute',
    width: 16,
    height: 56,
    bottom: 36,
    left: 92,
    backgroundColor: TRUNK,
    borderRadius: 7,
    borderRightWidth: 4,
    borderRightColor: TRUNK_DK,
  },
  medCanopyBack: {
    position: 'absolute',
    width: 92,
    height: 84,
    bottom: 78,
    left: 54,
    backgroundColor: LEAF_DARK,
    borderRadius: 44,
  },
  medCanopyTop: {
    position: 'absolute',
    width: 58,
    height: 54,
    bottom: 112,
    left: 71,
    backgroundColor: LEAF_MID,
    borderRadius: 29,
  },
  medCanopyFront: {
    position: 'absolute',
    width: 76,
    height: 70,
    bottom: 84,
    left: 62,
    backgroundColor: LEAF_LIGHT,
    borderRadius: 38,
  },

  // ── Stage 5: full tree ──
  trunkFull: {
    position: 'absolute',
    width: 24,
    height: 64,
    bottom: 36,
    left: 88,
    backgroundColor: TRUNK,
    borderRadius: 9,
    borderRightWidth: 5,
    borderRightColor: TRUNK_DK,
  },
  fullCanopyBack: {
    position: 'absolute',
    width: 132,
    height: 104,
    bottom: 80,
    left: 34,
    backgroundColor: LEAF_DARK,
    borderRadius: 60,
  },
  fullCanopyLeft: {
    position: 'absolute',
    width: 72,
    height: 70,
    bottom: 82,
    left: 36,
    backgroundColor: LEAF_MID,
    borderRadius: 36,
  },
  fullCanopyRight: {
    position: 'absolute',
    width: 72,
    height: 70,
    bottom: 82,
    left: 92,
    backgroundColor: LEAF_MID,
    borderRadius: 36,
  },
  fullCanopyTop: {
    position: 'absolute',
    width: 78,
    height: 72,
    bottom: 116,
    left: 61,
    backgroundColor: LEAF_MID,
    borderRadius: 39,
  },
  fullCanopyFront: {
    position: 'absolute',
    width: 100,
    height: 92,
    bottom: 90,
    left: 50,
    backgroundColor: LEAF_LIGHT,
    borderRadius: 50,
  },

  // ── Face anchors per stage (centered horizontally) ──
  faceSeed: { position: 'absolute', bottom: 40, left: 76 },
  facePlant: { position: 'absolute', bottom: 84, left: 76 },
  faceMedium: { position: 'absolute', bottom: 102, left: 76 },
  faceFull: { position: 'absolute', bottom: 112, left: 76 },
});

// ── CloudBubble — fluffy multi-bump cloud shape ───────────────────────

function CloudBubble({
  width: w,
  height: h,
  style,
}: {
  width: number;
  height: number;
  style?: object;
}) {
  const bright = 'rgba(255,255,255,0.93)';
  const dim    = 'rgba(255,255,255,0.84)';
  return (
    <View style={[{ width: w, height: h, position: 'absolute' }, style]} pointerEvents="none">
      {/* base bar */}
      <View style={{ position: 'absolute', bottom: 0, left: w * 0.08, right: w * 0.08, height: h * 0.46, borderRadius: h * 0.23, backgroundColor: bright }} />
      {/* left bump */}
      <View style={{ position: 'absolute', bottom: h * 0.3,  left: w * 0.06, width: w * 0.35, height: w * 0.35, borderRadius: w * 0.175, backgroundColor: dim }} />
      {/* centre bump — tallest */}
      <View style={{ position: 'absolute', bottom: h * 0.44, left: w * 0.28, width: w * 0.44, height: w * 0.44, borderRadius: w * 0.22,  backgroundColor: bright }} />
      {/* right bump */}
      <View style={{ position: 'absolute', bottom: h * 0.22, right: w * 0.05, width: w * 0.3,  height: w * 0.3,  borderRadius: w * 0.15,  backgroundColor: dim }} />
    </View>
  );
}

// ── AnimatedBackground ────────────────────────────────────────────────

function AnimatedBackground({ timerState }: { timerState: TimerState }) {
  const runningOpacity = useRef(new Animated.Value(0)).current;
  const completedOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const isActiveOrPaused = timerState === 'running' || timerState === 'paused';
    Animated.parallel([
      Animated.timing(runningOpacity, {
        toValue: isActiveOrPaused ? 1 : 0,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(completedOpacity, {
        toValue: timerState === 'completed' ? 1 : 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();
  }, [timerState]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* idle: light cream */}
      <LinearGradient colors={['#FFFDF5', '#FFFFFF']} style={StyleSheet.absoluteFill} />
      {/* running/paused: soft green */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: runningOpacity }]}>
        <LinearGradient colors={['#F0FFF0', '#FFFFFF']} style={StyleSheet.absoluteFill} />
      </Animated.View>
      {/* completed: warm gold */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: completedOpacity }]}>
        <LinearGradient colors={['#FFFACD', '#FFFFFF']} style={StyleSheet.absoluteFill} />
      </Animated.View>
    </View>
  );
}

// ── Weather timeline ──────────────────────────────────────────────────
// Weather follows a repeating sequence, advancing one segment at a time.
// A progress bar at the top fills toward the next weather; when it reaches
// a mark, the weather transitions to it.

const WEATHER_SEQUENCE: Weather[] = ['sunny', 'windy', 'rainy', 'snowy'];
const WINDOW_SIZE = 4;       // upcoming weathers shown on the timeline
const SEGMENT_MS = 9000;     // time spent in each weather
const RAIN_COUNT = 18;
const SNOW_COUNT = 16;
const WIND_COUNT = 12;

interface Drop {
  x: number;
  startDelay: number;
  duration: number;
  drift: number;
  anim: Animated.Value;
}

function makeDrops(count: number): Drop[] {
  return Array.from({ length: count }, () => ({
    x: Math.random() * SCREEN_W,
    startDelay: Math.random() * 2000,
    duration: 600 + Math.random() * 500,
    drift: (Math.random() - 0.5) * 30,
    anim: new Animated.Value(0),
  }));
}

interface Streak {
  y: number;
  len: number;
  startDelay: number;
  duration: number;
  anim: Animated.Value;
}

function makeStreaks(count: number): Streak[] {
  return Array.from({ length: count }, () => ({
    y: 115 + Math.random() * (SCREEN_H * 0.52),
    len: 24 + Math.random() * 36,
    startDelay: Math.random() * 1400,
    duration: 650 + Math.random() * 450,
    anim: new Animated.Value(0),
  }));
}

function useWeatherTimeline() {
  const [baseIndex, setBaseIndex] = useState(0);
  const [activeSeg, setActiveSeg] = useState(0);
  const activeSegRef = useRef(0);
  const barAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let stopped = false;
    let current: Animated.CompositeAnimation | null = null;
    const runSegment = () => {
      if (stopped) return;
      barAnim.setValue(0);
      current = Animated.timing(barAnim, {
        toValue: 1,
        duration: SEGMENT_MS,
        easing: Easing.linear,
        useNativeDriver: false,
      });
      current.start(({ finished }) => {
        if (!finished || stopped) return;
        const next = activeSegRef.current + 1;
        if (next >= WINDOW_SIZE) {
          activeSegRef.current = 0;
          setActiveSeg(0);
          setBaseIndex((b) => b + WINDOW_SIZE);
        } else {
          activeSegRef.current = next;
          setActiveSeg(next);
        }
        runSegment();
      });
    };
    runSegment();
    return () => {
      stopped = true;
      current?.stop();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const window = Array.from(
    { length: WINDOW_SIZE },
    (_, i) => WEATHER_SEQUENCE[(baseIndex + i) % WEATHER_SEQUENCE.length],
  );
  const weather = window[activeSeg];
  return { weather, window, activeSeg, barAnim };
}

// ── WeatherTimelineBar (top progress bar of upcoming weather) ─────────

interface TimelineBarProps {
  window: Weather[];
  activeSeg: number;
  barAnim: Animated.Value;
}

function WeatherTimelineBar({ window, activeSeg, barAnim }: TimelineBarProps) {
  const fillWidth = barAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [
      `${(activeSeg / WINDOW_SIZE) * 100}%`,
      `${((activeSeg + 1) / WINDOW_SIZE) * 100}%`,
    ],
  });

  return (
    <View style={styles.timelineWrap} pointerEvents="none">
      <View style={styles.timelineIcons}>
        {window.map((w, i) => (
          <View key={i} style={[styles.timelineIcon, { left: `${((i + 0.5) / WINDOW_SIZE) * 100}%` }]}>
            <Text
              style={[
                styles.timelineEmoji,
                i === activeSeg && styles.timelineEmojiActive,
                i < activeSeg && styles.timelineEmojiPast,
              ]}
            >
              {WEATHER_META[w].emoji}
            </Text>
          </View>
        ))}
      </View>
      <View style={styles.timelineTrack}>
        <Animated.View style={[styles.timelineFill, { width: fillWidth }]} />
        {window.map((_, i) =>
          i > 0 ? (
            <View key={i} style={[styles.timelineTick, { left: `${(i / WINDOW_SIZE) * 100}%` }]} />
          ) : null,
        )}
      </View>
    </View>
  );
}

// ── WeatherLayer ──────────────────────────────────────────────────────
// Renders the active weather's effects. Cross-fades smoothly between
// states. Rain/snow/wind loops always run; visibility is via opacity.

function WeatherLayer({ weather }: { weather: Weather }) {
  const sunnyOp = useRef(new Animated.Value(1)).current;
  const windyOp = useRef(new Animated.Value(0)).current;
  const rainyOp = useRef(new Animated.Value(0)).current;
  const snowyOp = useRef(new Animated.Value(0)).current;
  const cloudOp = useRef(new Animated.Value(0)).current;
  const flashOp = useRef(new Animated.Value(0)).current;
  const sunPulse = useRef(new Animated.Value(0)).current;

  const rainDrops = useRef(makeDrops(RAIN_COUNT)).current;
  const snowFlakes = useRef(makeDrops(SNOW_COUNT)).current;
  const windStreaks = useRef(makeStreaks(WIND_COUNT)).current;

  // Smooth cross-fade between weather states.
  useEffect(() => {
    const fade = (v: Animated.Value, to: number) =>
      Animated.timing(v, { toValue: to, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true });
    Animated.parallel([
      fade(sunnyOp, weather === 'sunny' ? 1 : 0),
      fade(windyOp, weather === 'windy' ? 1 : 0),
      fade(rainyOp, weather === 'rainy' ? 1 : 0),
      fade(snowyOp, weather === 'snowy' ? 1 : 0),
      fade(cloudOp, weather === 'sunny' ? 0 : 1),
    ]).start();
  }, [weather]); // eslint-disable-line react-hooks/exhaustive-deps

  // Continuous sun glow pulse.
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(sunPulse, { toValue: 1, duration: 2200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(sunPulse, { toValue: 0, duration: 2200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Continuous falling loops (rain + snow) and horizontal wind streaks.
  useEffect(() => {
    const fallers = [...rainDrops, ...snowFlakes];
    const loops = fallers.map((d) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(d.startDelay),
          Animated.timing(d.anim, { toValue: 1, duration: d.duration, easing: Easing.linear, useNativeDriver: true }),
        ]),
      ),
    );
    const windLoops = windStreaks.map((s) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(s.startDelay),
          Animated.timing(s.anim, { toValue: 1, duration: s.duration, easing: Easing.linear, useNativeDriver: true }),
        ]),
      ),
    );
    [...loops, ...windLoops].forEach((l) => l.start());
    return () => [...loops, ...windLoops].forEach((l) => l.stop());
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Lightning flashes while it's raining.
  useEffect(() => {
    if (weather !== 'rainy') return;
    let cancelled = false;
    const flash = () => {
      if (cancelled) return;
      Animated.sequence([
        Animated.timing(flashOp, { toValue: 0.55, duration: 70, useNativeDriver: true }),
        Animated.timing(flashOp, { toValue: 0, duration: 110, useNativeDriver: true }),
        Animated.delay(90),
        Animated.timing(flashOp, { toValue: 0.35, duration: 60, useNativeDriver: true }),
        Animated.timing(flashOp, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start();
    };
    const t = setTimeout(flash, 1400);
    const id = setInterval(flash, 3800);
    return () => {
      cancelled = true;
      clearTimeout(t);
      clearInterval(id);
    };
  }, [weather]); // eslint-disable-line react-hooks/exhaustive-deps

  const sunScale = sunPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Sky tints — darken the scene per weather so rain / snow / wind
          are actually visible against the otherwise bright theme. */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: windyOp }]}>
        <LinearGradient colors={['#AEBEC8', '#E4EAEE']} style={StyleSheet.absoluteFill} />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: rainyOp }]}>
        <LinearGradient colors={['#4E6273', '#93A9B9']} style={StyleSheet.absoluteFill} />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: snowyOp }]}>
        <LinearGradient colors={['#7E94A6', '#D4E1EA']} style={StyleSheet.absoluteFill} />
      </Animated.View>

      {/* Sun */}
      <Animated.View style={[styles.sunWrap, { opacity: sunnyOp, transform: [{ scale: sunScale }] }]}>
        <View style={styles.sunGlow} />
        <View style={styles.sun} />
      </Animated.View>

      {/* Fluffy clouds (shown for windy + rain + snow) — sit below timeline */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: cloudOp }]} pointerEvents="none">
        <CloudBubble width={120} height={60} style={{ top: 118, left: 14 }} />
        <CloudBubble width={88}  height={46} style={{ top: 100, left: 64, opacity: 0.78 }} />
        <CloudBubble width={104} height={54} style={{ top: 148, right: 10 }} />
      </Animated.View>

      {/* Wind streaks */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: windyOp }]} pointerEvents="none">
        {windStreaks.map((s, i) => {
          const translateX = s.anim.interpolate({ inputRange: [0, 1], outputRange: [-80, SCREEN_W + 80] });
          return (
            <Animated.View
              key={i}
              style={[styles.windStreak, { top: s.y, width: s.len, transform: [{ translateX }] }]}
            />
          );
        })}
        {windStreaks.slice(0, 5).map((s, i) => {
          const translateX = s.anim.interpolate({ inputRange: [0, 1], outputRange: [-60, SCREEN_W + 60] });
          const translateY = s.anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -14, 6] });
          return (
            <Animated.Text
              key={`leaf-${i}`}
              style={{ position: 'absolute', top: s.y - 18, fontSize: 16, transform: [{ translateX }, { translateY }] }}
            >
              🍃
            </Animated.Text>
          );
        })}
      </Animated.View>

      {/* Rain */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: rainyOp }]} pointerEvents="none">
        {rainDrops.map((d, i) => {
          const translateY = d.anim.interpolate({ inputRange: [0, 1], outputRange: [-30, SCREEN_H + 30] });
          return (
            <Animated.View
              key={i}
              style={[styles.raindrop, { left: d.x, transform: [{ translateY }] }]}
            />
          );
        })}
      </Animated.View>

      {/* Snow */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: snowyOp }]} pointerEvents="none">
        {snowFlakes.map((d, i) => {
          const translateY = d.anim.interpolate({ inputRange: [0, 1], outputRange: [-20, SCREEN_H + 20] });
          const translateX = d.anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, d.drift, 0] });
          return (
            <Animated.View
              key={i}
              style={[styles.snowflake, { left: d.x, transform: [{ translateY }, { translateX }] }]}
            />
          );
        })}
      </Animated.View>

      {/* Lightning flash */}
      <Animated.View style={[StyleSheet.absoluteFill, styles.lightning, { opacity: flashOp }]} pointerEvents="none" />
    </View>
  );
}

// ── Celebration sparkles (pop on stage transition) ────────────────────

const SPARKLES = [
  { emoji: '✨', x: 44, y: 58 },
  { emoji: '⭐', x: 138, y: 46 },
  { emoji: '✨', x: 100, y: 24 },
  { emoji: '🌟', x: 70, y: 36 },
];

function Sparkles({ anim }: { anim: Animated.Value }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {SPARKLES.map((s, i) => {
        const opacity = anim.interpolate({ inputRange: [0, 0.15, 0.7, 1], outputRange: [0, 1, 1, 0] });
        const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [4, -18] });
        const scale = anim.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.3, 1.2, 0.8] });
        return (
          <Animated.Text
            key={i}
            style={{ position: 'absolute', top: s.y, left: s.x, fontSize: 16, opacity, transform: [{ translateY }, { scale }] }}
          >
            {s.emoji}
          </Animated.Text>
        );
      })}
    </View>
  );
}

// ── GrowingTree ───────────────────────────────────────────────────────
// Combines: a static ground, a constant ambient sway (seed vibrates;
// plants & trees sway in the breeze), and — on each stage transition — an
// excited "I did it!" celebration: a determined jump, a happy face, and
// a burst of sparkles. Plus the completion pulse.

type SwayProfile = 'seed' | 'plant' | 'tree';

function GrowingTree({ stage, timerState, weather }: { stage: Stage; timerState: TimerState; weather: Weather }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const swayAnim = useRef(new Animated.Value(0.5)).current;
  const jumpAnim = useRef(new Animated.Value(0)).current;
  const sparkleAnim = useRef(new Animated.Value(0)).current;
  const [excited, setExcited] = useState(false);
  const timerStateRef = useRef(timerState);

  const swayProfile: SwayProfile = stage === 1 ? 'seed' : stage <= 3 ? 'plant' : 'tree';
  const windy = weather === 'windy';

  useEffect(() => {
    timerStateRef.current = timerState;
  }, [timerState]);

  // Stage transition → excited celebration (jump + happy face + sparkles).
  // Instant calm reset when returning to idle.
  useEffect(() => {
    if (timerStateRef.current === 'idle') {
      scaleAnim.setValue(1);
      jumpAnim.setValue(0);
      sparkleAnim.setValue(0);
      setExcited(false);
      return;
    }
    setExcited(true);

    scaleAnim.setValue(0.7);
    Animated.spring(scaleAnim, { toValue: 1, friction: 4, tension: 140, useNativeDriver: true }).start();

    // Determined little jump: spring up, then settle back down.
    jumpAnim.setValue(0);
    Animated.sequence([
      Animated.timing(jumpAnim, { toValue: -24, duration: 240, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.spring(jumpAnim, { toValue: 0, friction: 4, tension: 110, useNativeDriver: true }),
    ]).start();

    // Sparkle burst.
    sparkleAnim.setValue(0);
    Animated.timing(sparkleAnim, { toValue: 1, duration: 1000, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();

    const t = setTimeout(() => setExcited(false), 1150);
    return () => clearTimeout(t);
  }, [stage]); // eslint-disable-line react-hooks/exhaustive-deps

  // Completion pulse + lingering happy face.
  useEffect(() => {
    if (timerState !== 'completed') return;
    setExcited(true);
    Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 1.1, duration: 500, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1.0, duration: 500, useNativeDriver: true }),
      ]),
      { iterations: 3 },
    ).start();
  }, [timerState]); // eslint-disable-line react-hooks/exhaustive-deps

  // Continuous ambient sway — restarts when the profile or wind changes.
  // Wind makes the sway faster, wider, and leaning into the gust.
  useEffect(() => {
    swayAnim.setValue(0.5);
    const basePeriod = swayProfile === 'seed' ? 1400 : swayProfile === 'plant' ? 1500 : 2300;
    const period = windy ? (swayProfile === 'seed' ? 520 : 460) : basePeriod;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(swayAnim, { toValue: 1, duration: period, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(swayAnim, { toValue: 0, duration: period, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [swayProfile, windy]); // eslint-disable-line react-hooks/exhaustive-deps

  const baseAmp = swayProfile === 'seed' ? 2 : swayProfile === 'plant' ? 6 : 4;
  const amp  = windy ? (swayProfile === 'seed' ? 6 : 14) : baseAmp;
  const lean = windy ? (swayProfile === 'seed' ? 2 : 8)  : 0;
  const rotate = swayAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [`${lean - amp}deg`, `${lean + amp}deg`],
  });

  const StageComponent = STAGES[stage];
  return (
    <View style={ts.canvas}>
      {/* Static ground — stays put while the plant jumps & sways */}
      <Ground stage={stage} />

      {/* Plant: jump + scale outer, sway inner.
          Bottom-centre pivot: translateY(+100) rotates around canvas bottom, then restore. */}
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateY: jumpAnim }, { scale: scaleAnim }] }]}>
        <Animated.View style={{ transform: [{ translateY: 100 }, { rotate }, { translateY: -100 }] }}>
          <StageComponent excited={excited} />
        </Animated.View>
      </Animated.View>

      {/* Celebration sparkles */}
      <Sparkles anim={sparkleAnim} />
    </View>
  );
}

// ── Leaf particle overlay ─────────────────────────────────────────────

interface ParticleOverlayProps {
  anims: Animated.Value[];
}

function ParticleOverlay({ anims }: ParticleOverlayProps) {
  const originY = SCREEN_H * 0.38;
  const originX = SCREEN_W / 2;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {anims.map((anim, i) => {
        const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [0, -160] });
        const opacity = anim.interpolate({ inputRange: [0, 0.15, 0.75, 1], outputRange: [0, 1, 1, 0] });
        const scale = anim.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0.3, 1.1, 0.6] });
        return (
          <Animated.Text
            key={i}
            style={{
              position: 'absolute',
              fontSize: 20,
              top: originY,
              left: originX + PARTICLE_X[i] - 12,
              transform: [{ translateY }, { scale }],
              opacity,
            }}
          >
            {PARTICLE_EMOJIS[i]}
          </Animated.Text>
        );
      })}
    </View>
  );
}

// ── GrowthTimer ───────────────────────────────────────────────────────
// A creative replacement for the plain countdown: a circular "growth
// meter" that fills with green from the bottom as the session progresses,
// with the time and a playful caption in the center.

const GROWTH_SIZE = 152;

function GrowthTimer({
  secondsLeft,
  totalSeconds,
}: {
  secondsLeft: number;
  totalSeconds: number;
}) {
  const fillAnim = useRef(new Animated.Value(0)).current;
  const progress = totalSeconds > 0 ? (totalSeconds - secondsLeft) / totalSeconds : 0;

  useEffect(() => {
    Animated.timing(fillAnim, {
      toValue: progress,
      duration: 700,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [progress]); // eslint-disable-line react-hooks/exhaustive-deps

  const fillHeight = fillAnim.interpolate({ inputRange: [0, 1], outputRange: [0, GROWTH_SIZE] });

  return (
    <View style={styles.growthWrap}>
      <Animated.View style={[styles.growthFill, { height: fillHeight }]}>
        <View style={styles.growthFillTop} />
      </Animated.View>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={styles.growthCenter}>
          <Text style={styles.growthTime}>{formatTime(secondsLeft)}</Text>
        </View>
      </View>
    </View>
  );
}

// ── Duration selector ─────────────────────────────────────────────────

interface DurationSelectorProps {
  selected: number;
  onSelect: (minutes: number) => void;
  disabled: boolean;
}

function DurationSelector({ selected, onSelect, disabled }: DurationSelectorProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.durationRow}
      style={[styles.durationScroll, disabled && { opacity: 0.45 }]}
    >
      {DURATIONS.map((d) => {
        const isActive = d.minutes === selected;
        return (
          <Pressable
            key={d.minutes}
            onPress={() => !disabled && onSelect(d.minutes)}
            style={[styles.durationChip, isActive && styles.durationChipActive]}
          >
            <Text style={styles.durationEmoji}>{d.emoji}</Text>
            <Text style={[styles.durationMinutes, isActive && styles.durationTextActive]}>
              {d.minutes}m
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

// ── HomeScreen ────────────────────────────────────────────────────────

export default function HomeScreen() {
  const [selectedDuration, setSelectedDuration] = useState(25);
  const [timerState, setTimerState] = useState<TimerState>('idle');
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [showParticles, setShowParticles] = useState(false);

  const { speed } = useSpeed();
  const { weather, window, activeSeg, barAnim } = useWeatherTimeline();

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const selectedDurationRef = useRef(selectedDuration);
  const speedRef = useRef(speed);
  const particleAnims = useRef(Array.from({ length: 6 }, () => new Animated.Value(0))).current;

  useEffect(() => {
    selectedDurationRef.current = selectedDuration;
  }, [selectedDuration]);

  // Keep the speed ref live so a running timer picks up changes from Stats.
  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  const totalSeconds = selectedDuration * 60;

  const stage = useMemo(
    () => deriveStage(secondsLeft, timerState, totalSeconds),
    [secondsLeft, timerState, totalSeconds],
  );

  const clearTimer = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    return clearTimer;
  }, [clearTimer]);

  // Haptics on completion.
  useEffect(() => {
    if (timerState !== 'completed') return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const t1 = setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 500);
    const t2 = setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium), 1000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [timerState]);

  // Particle burst on completion.
  useEffect(() => {
    if (timerState !== 'completed') {
      setShowParticles(false);
      particleAnims.forEach((a) => a.stopAnimation());
      return;
    }
    setShowParticles(true);
    particleAnims.forEach((a) => a.setValue(0));

    const composite = Animated.parallel(
      particleAnims.map((anim, i) =>
        Animated.sequence([
          Animated.delay(i * 160),
          Animated.timing(anim, { toValue: 1, duration: 1800, useNativeDriver: true }),
        ]),
      ),
    );
    composite.start(({ finished }) => {
      if (finished) setShowParticles(false);
    });
    return () => composite.stop();
  }, [timerState]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleStart = useCallback(() => {
    if (timerState === 'completed') return;
    setTimerState('running');
    intervalRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        const dec = speedRef.current; // accelerated time (Stats simulator)
        if (prev - dec <= 0) {
          clearInterval(intervalRef.current!);
          intervalRef.current = null;
          setTimerState('completed');
          appendSession({
            duration: selectedDurationRef.current,
            completedAt: new Date().toISOString(),
            stage: 5,
          }).catch(() => {});
          return 0;
        }
        return prev - dec;
      });
    }, 1000);
  }, [timerState]);

  const handlePause = useCallback(() => {
    clearTimer();
    setTimerState('paused');
  }, [clearTimer]);

  const handleReset = useCallback(() => {
    clearTimer();
    setTimerState('idle');
    setSecondsLeft(selectedDuration * 60);
  }, [clearTimer, selectedDuration]);

  const handleSelectDuration = useCallback((minutes: number) => {
    clearTimer();
    setSelectedDuration(minutes);
    setSecondsLeft(minutes * 60);
    setTimerState('idle');
  }, [clearTimer]);

  const canChangeDuration = timerState === 'idle' || timerState === 'completed';

  return (
    <View style={styles.container}>
      <StatusBar style="auto" />

      {/* Animated gradient background */}
      <AnimatedBackground timerState={timerState} />

      {/* Ambient weather, driven by the timeline */}
      <WeatherLayer weather={weather} />

      {/* Upcoming-weather timeline bar */}
      <WeatherTimelineBar window={window} activeSeg={activeSeg} barAnim={barAnim} />

      {/* Duration chips */}
      <DurationSelector
        selected={selectedDuration}
        onSelect={handleSelectDuration}
        disabled={!canChangeDuration}
      />

      {/* Tree */}
      <GrowingTree stage={stage} timerState={timerState} weather={weather} />

      {/* Creative growth-meter timer */}
      <GrowthTimer secondsLeft={secondsLeft} totalSeconds={totalSeconds} />

      {/* Motivational text */}
      <Text style={styles.motivationalText}>{MOTIVATIONAL[timerState]}</Text>

      {/* Buttons */}
      <View style={styles.buttonRow}>
        {(timerState === 'idle' || timerState === 'paused') && (
          <Pressable style={styles.button} onPress={handleStart}>
            <Text style={styles.buttonText}>Start</Text>
          </Pressable>
        )}
        {timerState === 'running' && (
          <Pressable style={styles.button} onPress={handlePause}>
            <Text style={styles.buttonText}>Pause</Text>
          </Pressable>
        )}
        <Pressable style={[styles.button, styles.buttonSecondary]} onPress={handleReset}>
          <Text style={[styles.buttonText, styles.buttonTextSecondary]}>Reset</Text>
        </Pressable>
      </View>

      {/* Leaf particles on completion */}
      {showParticles && <ParticleOverlay anims={particleAnims} />}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  // Duration selector
  durationScroll: {
    flexGrow: 0,
    maxHeight: 64,
  },
  durationRow: {
    paddingHorizontal: 20,
    gap: 8,
    alignItems: 'center',
  },
  durationChip: {
    width: 52,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    gap: 2,
  },
  durationChipActive: {
    backgroundColor: '#4A8230',
  },
  durationEmoji: {
    fontSize: 18,
  },
  durationMinutes: {
    fontSize: 11,
    color: '#666',
    fontWeight: '600',
  },
  durationTextActive: {
    color: '#FFFFFF',
  },
  // Weather timeline bar (top)
  timelineWrap: {
    position: 'absolute',
    top: 56,        // clear status bar + a bit of breathing room
    left: 18,
    right: 18,
  },
  timelineIcons: {
    height: 30,     // taller for better emoji legibility
    marginBottom: 5,
  },
  timelineIcon: {
    position: 'absolute',
    width: 28,
    marginLeft: -14,
    alignItems: 'center',
  },
  timelineEmoji: {
    fontSize: 17,
    opacity: 0.65,  // clearly visible on any sky tint
  },
  timelineEmojiActive: {
    fontSize: 24,   // bigger active icon pops
    opacity: 1,
  },
  timelineEmojiPast: {
    opacity: 0.35,
  },
  timelineTrack: {
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.28)', // light on dark sky, subtle on light
    overflow: 'hidden',
    justifyContent: 'center',
  },
  timelineFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.82)', // visible on any background
    borderRadius: 4,
  },
  timelineTick: {
    position: 'absolute',
    width: 2,
    height: 7,
    marginLeft: -1,
    backgroundColor: 'rgba(0,0,0,0.18)', // dark tick on light fill
  },
  // Growth-meter timer
  growthWrap: {
    width: GROWTH_SIZE,
    height: GROWTH_SIZE,
    borderRadius: GROWTH_SIZE / 2,
    backgroundColor: '#EEF7E6',
    borderWidth: 3,
    borderColor: '#D6EAC2',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  growthFill: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(124, 194, 66, 0.45)',
  },
  growthFillTop: {
    height: 6,
    backgroundColor: 'rgba(124, 194, 66, 0.8)',
  },
  growthCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  growthTime: {
    fontSize: 40,
    fontWeight: '300',
    color: '#33402C',
    letterSpacing: 1,
    fontVariant: ['tabular-nums'],
  },
  motivationalText: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  // Buttons
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  button: {
    backgroundColor: '#222',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 8,
  },
  buttonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#ccc',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  buttonTextSecondary: {
    color: '#555',
  },
  // Weather — sun (sits below the timeline bar)
  sunWrap: {
    position: 'absolute',
    top: 110,
    right: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sunGlow: {
    position: 'absolute',
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(255, 214, 102, 0.35)',
  },
  sun: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#FFD23F',
  },
  // Weather — wind
  windStreak: {
    position: 'absolute',
    height: 2.5,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
  },
  // Weather — rain
  raindrop: {
    position: 'absolute',
    top: 0,
    width: 2.5,
    height: 18,
    borderRadius: 2,
    backgroundColor: 'rgba(220, 240, 255, 0.95)',
  },
  // Weather — snow
  snowflake: {
    position: 'absolute',
    top: 0,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
  // Weather — lightning
  lightning: {
    backgroundColor: 'rgba(255, 255, 235, 1)',
  },
});
