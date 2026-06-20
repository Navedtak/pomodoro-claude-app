# 🌱 FocusTree — Pomodoro Timer App

A beautiful Pomodoro timer app built with React Native and Expo, where a tree grows as you focus. The longer you concentrate, the more your tree flourishes.

---

## Features

- **Animated growing tree** — 5 stages from seed to full tree, with cute face expressions and excited reactions on each growth transition
- **Per-stage roots** — roots visually connect to the trunk at every stage
- **Live weather system** — sunny, windy, rainy, and snowy weather cycles with sky tints, fluffy clouds, rain, snow, lightning, and wind streaks + flying leaves
- **Weather timeline bar** — shows upcoming weather at the top of the screen
- **Pomodoro timer** — 5, 10, 15, 20, or 25 minute sessions with Start / Pause / Reset
- **Session history** — every completed session is saved locally with AsyncStorage
- **Stats screen** — total pomodoros, total focus time, best streak, weekly bar chart, and full session log
- **Daily reminders** — optional push notification to nudge you to start a session
- **Speed simulator** — run the timer at 1×–10× speed for testing (in Stats tab)
- **Haptic feedback** — satisfying haptics on session completion
- **Web support** — runs in the browser via react-native-web

---

## Tech Stack

| Library | Version |
|---|---|
| Expo SDK | ~54.0.0 |
| React Native | 0.76.5 |
| React | 18.3.1 |
| TypeScript | ~5.6.0 |
| React Navigation (bottom tabs) | ^7 |
| AsyncStorage | 2.2.0 |
| expo-linear-gradient | — |
| expo-haptics | — |
| expo-notifications | 0.32.17 |
| react-native-web | 0.19.10 |

All tree and weather graphics are built from pure React Native `View` shapes — no SVG library required.

---

## Getting Started

### Prerequisites

- Node.js 18+
- [Expo Go](https://expo.dev/go) installed on your phone (iOS or Android)

### Install

```bash
git clone https://github.com/Navedtak/pomodoro-claude-app.git
cd pomodoro-claude-app
npm install
```

### Run on phone

```bash
npx expo start
```

Scan the QR code with Expo Go.

### Run in browser

```bash
npm run web
```

---

## Project Structure

```
├── App.tsx                  # Navigation root + notification handler
├── screens/
│   ├── HomeScreen.tsx       # Timer, tree, weather — main screen
│   └── StatsScreen.tsx      # Session stats, bar chart, settings
├── lib/
│   ├── sessions.ts          # AsyncStorage session persistence
│   ├── reminder.ts          # Push notification scheduling
│   └── SpeedContext.tsx     # Speed simulator shared context
└── app.json                 # Expo config (bundle IDs, plugins)
```

---

## Screenshots

> Coming soon

---

## Built with Claude

This app was built entirely through natural language conversation with [Claude](https://claude.ai/claude-code) using Claude Code.
