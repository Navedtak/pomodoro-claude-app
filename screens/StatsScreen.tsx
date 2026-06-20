import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { useFocusEffect } from '@react-navigation/native';
import { loadSessions, Session } from '../lib/sessions';
import { useSpeed } from '../lib/SpeedContext';
import {
  cancelReminder,
  loadReminder,
  ReminderPref,
  saveReminder,
  scheduleReminder,
} from '../lib/reminder';

const SPEED_OPTIONS = [1, 2, 3, 4, 5, 6, 8, 10];

// ── Pure helpers ──────────────────────────────────────────────────────

function bestStreak(sessions: Session[]): number {
  if (sessions.length === 0) return 0;
  const dateSet = new Set(sessions.map((s) => s.completedAt.slice(0, 10)));
  const sorted = Array.from(dateSet).sort();
  let best = 1;
  let cur = 1;
  for (let i = 1; i < sorted.length; i++) {
    const diffDays =
      (new Date(sorted[i]).getTime() - new Date(sorted[i - 1]).getTime()) / 86400000;
    if (Math.round(diffDays) === 1) {
      cur++;
      if (cur > best) best = cur;
    } else {
      cur = 1;
    }
  }
  return best;
}

function weeklyMinutes(sessions: Session[]): number[] {
  const now = new Date();
  const mondayOffset = (now.getDay() + 6) % 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - mondayOffset);
  monday.setHours(0, 0, 0, 0);

  const mins = [0, 0, 0, 0, 0, 0, 0];
  for (const s of sessions) {
    const diffDays = Math.floor(
      (new Date(s.completedAt).getTime() - monday.getTime()) / 86400000,
    );
    if (diffDays >= 0 && diffDays < 7) mins[diffDays] += s.duration;
  }
  return mins;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const time = d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  return `${date} · ${time}`;
}

function stageEmoji(stage: number): string {
  if (stage <= 2) return '🌱';
  if (stage <= 4) return '🌿';
  return '🌳';
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

// ── Sub-components ────────────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardValue}>{value}</Text>
      <Text style={styles.cardLabel}>{label}</Text>
    </View>
  );
}

// Simple up/down spinner for a numeric value that wraps around.
function TimeSpinner({
  value,
  max,
  step = 1,
  onChange,
}: {
  value: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  const increment = () => onChange((value + step) % (max + 1));
  const decrement = () => onChange((value - step + max + 1) % (max + 1));
  return (
    <View style={styles.spinner}>
      <TouchableOpacity onPress={increment} style={styles.spinnerBtn} hitSlop={8}>
        <Text style={styles.spinnerArrow}>▲</Text>
      </TouchableOpacity>
      <Text style={styles.spinnerValue}>{pad(value)}</Text>
      <TouchableOpacity onPress={decrement} style={styles.spinnerBtn} hitSlop={8}>
        <Text style={styles.spinnerArrow}>▼</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────

const BAR_TRACK_HEIGHT = 64;
const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export default function StatsScreen() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const { speed, setSpeed } = useSpeed();
  const [reminder, setReminder] = useState<ReminderPref>({
    enabled: false,
    hour: 9,
    minute: 0,
  });

  // Reload sessions and reminder prefs whenever the tab gains focus.
  useFocusEffect(
    useCallback(() => {
      loadSessions().then(setSessions);
      loadReminder().then(setReminder);
    }, []),
  );

  // ── Stats ──
  const totalPomodoros = sessions.length;
  const totalMinutes = sessions.reduce((sum, s) => sum + s.duration, 0);
  const streak = useMemo(() => bestStreak(sessions), [sessions]);
  const weekMins = useMemo(() => weeklyMinutes(sessions), [sessions]);
  const maxDayMins = Math.max(...weekMins, 1);
  const todayIndex = (new Date().getDay() + 6) % 7;

  // ── Reminder handlers ──
  const handleToggle = useCallback(
    async (enabled: boolean) => {
      const updated: ReminderPref = { ...reminder, enabled };
      setReminder(updated);
      await saveReminder(updated);
      if (enabled) {
        await scheduleReminder(updated.hour, updated.minute);
      } else {
        await cancelReminder();
      }
    },
    [reminder],
  );

  const handleHourChange = useCallback(
    async (hour: number) => {
      const updated: ReminderPref = { ...reminder, hour };
      setReminder(updated);
      await saveReminder(updated);
      if (updated.enabled) await scheduleReminder(hour, updated.minute);
    },
    [reminder],
  );

  const handleMinuteChange = useCallback(
    async (minute: number) => {
      const updated: ReminderPref = { ...reminder, minute };
      setReminder(updated);
      await saveReminder(updated);
      if (updated.enabled) await scheduleReminder(updated.hour, minute);
    },
    [reminder],
  );

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {/* Summary cards */}
      <View style={styles.cardRow}>
        <StatCard label="Pomodoros" value={String(totalPomodoros)} />
        <StatCard label="Focus time" value={`${totalMinutes}m`} />
        <StatCard label="Best streak" value={`${streak}d`} />
      </View>

      {/* Weekly bar chart */}
      <View style={styles.weekRow}>
        {weekMins.map((mins, i) => {
          const barHeightPx =
            mins > 0 ? Math.max((mins / maxDayMins) * BAR_TRACK_HEIGHT, 6) : 0;
          const isToday = i === todayIndex;
          const isPast = i < todayIndex;
          const barColor = isToday ? '#4A8230' : isPast ? '#B0C9A8' : 'transparent';
          return (
            <View key={i} style={styles.dayCol}>
              <View style={styles.barTrack}>
                {mins > 0 && (
                  <View
                    style={[styles.bar, { height: barHeightPx, backgroundColor: barColor }]}
                  />
                )}
              </View>
              <Text style={[styles.dayLabel, isToday && styles.dayLabelToday]}>
                {DAY_LABELS[i]}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Simulator (testing aid) */}
      <Text style={[styles.sectionTitle, styles.simTitle]}>⏩ Time Simulator</Text>
      <Text style={styles.simHint}>
        Speeds up a running Focus timer for testing. Start a session, then pick a speed.
      </Text>
      <View style={styles.simRow}>
        {SPEED_OPTIONS.map((s) => {
          const isActive = s === speed;
          return (
            <Pressable
              key={s}
              onPress={() => setSpeed(s)}
              style={[styles.simChip, isActive && styles.simChipActive]}
            >
              <Text style={[styles.simChipText, isActive && styles.simChipTextActive]}>
                {s}x
              </Text>
            </Pressable>
          );
        })}
      </View>
      {speed > 1 && (
        <Text style={styles.simActive}>Running at {speed}× speed</Text>
      )}

      {/* Session list */}
      <Text style={[styles.sectionTitle, styles.simTitle]}>Sessions</Text>
      {sessions.length === 0 ? (
        <Text style={styles.empty}>
          No sessions yet.{'\n'}Complete a Pomodoro to get started!
        </Text>
      ) : (
        [...sessions].reverse().map((s) => (
          <View key={s.id} style={styles.sessionRow}>
            <Text style={styles.emoji}>{stageEmoji(s.stage)}</Text>
            <View>
              <Text style={styles.sessionDate}>{formatDate(s.completedAt)}</Text>
              <Text style={styles.sessionDuration}>{s.duration} min</Text>
            </View>
          </View>
        ))
      )}

      {/* Section 2: Settings */}
      <Text style={[styles.sectionTitle, styles.settingsTitle]}>Settings</Text>

      <Pressable
        style={styles.signOutBtn}
        onPress={() =>
          Alert.alert('Sign out', 'Are you sure?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Sign out', style: 'destructive', onPress: () => supabase.auth.signOut() },
          ])
        }
      >
        <Text style={styles.signOutText}>Sign Out</Text>
      </Pressable>

      <View style={styles.settingsCard}>
        {/* Toggle row */}
        <View style={styles.settingRow}>
          <View>
            <Text style={styles.settingLabel}>Daily Reminder</Text>
            <Text style={styles.settingHint}>Get nudged to start a session</Text>
          </View>
          <Switch
            value={reminder.enabled}
            onValueChange={handleToggle}
            trackColor={{ false: '#E0E0E0', true: '#A8D5A2' }}
            thumbColor={reminder.enabled ? '#4A8230' : '#F0F0F0'}
          />
        </View>

        {/* Time picker — only visible when enabled */}
        {reminder.enabled && (
          <View style={styles.timePickerRow}>
            <Text style={styles.settingLabel}>Reminder Time</Text>
            <View style={styles.timePicker}>
              <TimeSpinner
                value={reminder.hour}
                max={23}
                onChange={handleHourChange}
              />
              <Text style={styles.timeSep}>:</Text>
              <TimeSpinner
                value={reminder.minute}
                max={55}
                step={5}
                onChange={handleMinuteChange}
              />
            </View>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  content: {
    padding: 20,
    paddingTop: 56,
    paddingBottom: 48,
  },
  // Stat cards
  cardRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 28,
  },
  card: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  cardValue: {
    fontSize: 22,
    fontWeight: '600',
    color: '#222',
  },
  cardLabel: {
    fontSize: 11,
    color: '#888',
    marginTop: 4,
    textAlign: 'center',
  },
  // Bar chart
  weekRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 32,
  },
  dayCol: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  barTrack: {
    width: '100%',
    height: BAR_TRACK_HEIGHT,
    backgroundColor: '#F0F0F0',
    borderRadius: 6,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  bar: {
    width: '100%',
    borderRadius: 6,
  },
  dayLabel: {
    fontSize: 11,
    color: '#AAA',
  },
  dayLabelToday: {
    color: '#4A8230',
    fontWeight: '600',
  },
  // Section titles
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.5,
    color: '#AAA',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  // Simulator
  simTitle: {
    marginTop: 28,
  },
  simHint: {
    fontSize: 12,
    color: '#AAA',
    marginBottom: 12,
    lineHeight: 17,
  },
  simRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  simChip: {
    minWidth: 44,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
  },
  simChipActive: {
    backgroundColor: '#4A8230',
  },
  simChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  simChipTextActive: {
    color: '#FFFFFF',
  },
  simActive: {
    marginTop: 10,
    fontSize: 13,
    color: '#4A8230',
    fontWeight: '600',
  },
  settingsTitle: {
    marginTop: 36,
    marginBottom: 12,
  },
  // Session list
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EBEBEB',
  },
  emoji: {
    fontSize: 26,
    width: 36,
    textAlign: 'center',
  },
  sessionDate: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  sessionDuration: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  empty: {
    color: '#BBB',
    textAlign: 'center',
    marginTop: 48,
    lineHeight: 24,
    fontSize: 15,
  },
  // Settings
  settingsCard: {
    backgroundColor: '#F8F8F8',
    borderRadius: 14,
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  settingLabel: {
    fontSize: 15,
    color: '#333',
    fontWeight: '500',
  },
  settingHint: {
    fontSize: 12,
    color: '#AAA',
    marginTop: 2,
  },
  timePickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E8E8E8',
  },
  timePicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  spinner: {
    alignItems: 'center',
    gap: 2,
  },
  spinnerBtn: {
    padding: 4,
  },
  spinnerArrow: {
    fontSize: 12,
    color: '#4A8230',
    fontWeight: '600',
  },
  spinnerValue: {
    fontSize: 20,
    fontWeight: '600',
    color: '#222',
    fontVariant: ['tabular-nums'],
    minWidth: 32,
    textAlign: 'center',
  },
  timeSep: {
    fontSize: 20,
    fontWeight: '300',
    color: '#888',
  },
  signOutBtn: {
    marginBottom: 16,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFCCCC',
    backgroundColor: '#FFF5F5',
    alignItems: 'center',
  },
  signOutText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#CC4444',
  },
});
