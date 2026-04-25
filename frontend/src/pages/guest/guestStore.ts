import { create } from "zustand";

export type Demographics = {
  survey_id: number;
  occupation: string;
  gender: "male" | "female";
  age: number;
  name?: string;
};

type State = {
  data: Demographics | null;
  set: (d: Demographics) => void;
  clear: () => void;
};

export const useGuestForm = create<State>((set) => ({
  data: null,
  set: (d) => set({ data: d }),
  clear: () => set({ data: null }),
}));
