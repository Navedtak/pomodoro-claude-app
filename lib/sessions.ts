import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'focustree_sessions';

export interface Session {
  id: string;
  duration: number;    // minutes
  completedAt: string; // ISO timestamp
  stage: number;       // 1-5
}

export async function loadSessions(): Promise<Session[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Session[]) : [];
  } catch {
    return [];
  }
}

export async function appendSession(entry: Omit<Session, 'id'>): Promise<void> {
  const existing = await loadSessions();
  const session: Session = { id: Date.now().toString(), ...entry };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...existing, session]));
}
