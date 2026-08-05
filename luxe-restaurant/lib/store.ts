import { create } from "zustand";

interface AppState {
  isConciergeOpen: boolean;
  toggleConcierge: () => void;

  cart: { menuItemId: string; quantity: number }[];
  addToCart: (menuItemId: string) => void;
  removeFromCart: (menuItemId: string) => void;
  clearCart: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  isConciergeOpen: false,
  toggleConcierge: () => set((s) => ({ isConciergeOpen: !s.isConciergeOpen })),

  cart: [],
  addToCart: (menuItemId) =>
    set((s) => {
      const existing = s.cart.find((c) => c.menuItemId === menuItemId);
      if (existing) {
        return {
          cart: s.cart.map((c) =>
            c.menuItemId === menuItemId ? { ...c, quantity: c.quantity + 1 } : c
          ),
        };
      }
      return { cart: [...s.cart, { menuItemId, quantity: 1 }] };
    }),
  removeFromCart: (menuItemId) =>
    set((s) => ({ cart: s.cart.filter((c) => c.menuItemId !== menuItemId) })),
  clearCart: () => set({ cart: [] }),
}));
