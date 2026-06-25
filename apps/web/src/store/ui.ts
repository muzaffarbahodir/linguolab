import { create } from 'zustand';

interface UIState {
  bottomSheetOpen: boolean;
  setBottomSheetOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  bottomSheetOpen: false,
  setBottomSheetOpen: (open) => set({ bottomSheetOpen: open }),
}));
