import { create } from "zustand";
import { SessionInfo } from "../api/types";

interface SessionState {
  sessions: SessionInfo[];
  activeSessionId: string | null;
  isLoading: boolean;
  
  setSessions: (sessions: SessionInfo[]) => void;
  setActiveSession: (id: string | null) => void;
  setLoading: (loading: boolean) => void;
}

export const useSessionStore = create<SessionState>()((set) => ({
  sessions: [],
  activeSessionId: null,
  isLoading: false,

  setSessions: (sessions) => set({ sessions }),
  setActiveSession: (id) => set({ activeSessionId: id }),
  setLoading: (isLoading) => set({ isLoading }),
}));
