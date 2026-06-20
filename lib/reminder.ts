import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { SchedulableTriggerInputTypes } from 'expo-notifications';

const STORAGE_KEY = 'focustree_reminder';

export interface ReminderPref {
  enabled: boolean;
  hour: number;
  minute: number;
}

const DEFAULT: ReminderPref = { enabled: false, hour: 9, minute: 0 };

export async function loadReminder(): Promise<ReminderPref> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ReminderPref) : DEFAULT;
  } catch {
    return DEFAULT;
  }
}

export async function saveReminder(pref: ReminderPref): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(pref));
}

export async function scheduleReminder(hour: number, minute: number): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Time to Focus 🌱',
      body: 'Plant a tree and grow your focus today.',
    },
    trigger: {
      type: SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });
}

export async function cancelReminder(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}
