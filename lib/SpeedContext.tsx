import { createContext, ReactNode, useContext, useState } from 'react';

// Shared time-acceleration factor used by the Home timer and controlled
// from the Stats "simulator" (testing aid: run a session at 2x–10x).

interface SpeedValue {
  speed: number;
  setSpeed: (n: number) => void;
}

const SpeedContext = createContext<SpeedValue>({ speed: 1, setSpeed: () => {} });

export function SpeedProvider({ children }: { children: ReactNode }) {
  const [speed, setSpeed] = useState(1);
  return <SpeedContext.Provider value={{ speed, setSpeed }}>{children}</SpeedContext.Provider>;
}

export function useSpeed(): SpeedValue {
  return useContext(SpeedContext);
}
