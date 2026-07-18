import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface PinState {
  pin: string | null;
  isUnlocked: boolean;
  setPin: (newPin: string | null) => void;
  unlock: () => void;
  lock: () => void;
}

export const usePinStore = create<PinState>()(
  persist(
    (set) => ({
      pin: null,
      isUnlocked: false, // Par défaut, non déverrouillé au lancement
      
      setPin: (newPin) => set({ pin: newPin }),
      
      unlock: () => set({ isUnlocked: true }),
      
      lock: () => set({ isUnlocked: false }),
    }),
    {
      name: 'trading-journal-pin',
      // On ne persiste pas "isUnlocked", seulement "pin"
      partialize: (state) => ({ pin: state.pin }),
    }
  )
);
