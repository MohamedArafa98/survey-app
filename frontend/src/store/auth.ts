import { create } from "zustand";
import { auth as apiAuth } from "../api/client";

export type AdminUser = {
  id: number;
  username: string;
  role: "owner" | "admin";
  is_active: boolean;
  created_at: string;
};

type State = {
  user: AdminUser | null;
  token: string | null;
  setSession: (token: string, user: AdminUser) => void;
  clear: () => void;
};

export const useAuthStore = create<State>((set) => ({
  user: null,
  token: null,
  setSession: (token, user) => {
    apiAuth.setToken(token);
    set({ token, user });
  },
  clear: () => {
    apiAuth.setToken(null);
    set({ token: null, user: null });
  },
}));
