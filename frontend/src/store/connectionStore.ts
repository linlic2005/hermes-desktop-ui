import { create } from "zustand";
import { persist } from "zustand/middleware";
import { ConnectionConfig, ConnectionState } from "../api/types";

export const LOCAL_DEFAULT: ConnectionConfig = {
  id: "local-default",
  name: "本机 Hermes",
  mode: "local",
  apiBaseUrl: "http://127.0.0.1:9788",
  wsBaseUrl: "ws://127.0.0.1:9788",
  dashboardUrl: "http://127.0.0.1:9119",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

interface ConnectionStateStore {
  connections: ConnectionConfig[];
  activeConnectionId: string | null;
  status: ConnectionState;
  addConnection: (conn: Omit<ConnectionConfig, "createdAt" | "updatedAt">) => ConnectionConfig;
  updateConnection: (id: string, updates: Partial<ConnectionConfig>) => void;
  deleteConnection: (id: string) => void;
  setActiveConnection: (id: string | null) => void;
  setStatus: (status: ConnectionState) => void;
}

export const useConnectionStore = create<ConnectionStateStore>()(
  persist(
    (set) => ({
      connections: [LOCAL_DEFAULT],
      activeConnectionId: null,
      status: "disconnected",

      addConnection: (conn) => {
        const newConn: ConnectionConfig = {
          ...conn,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        set((state) => ({ connections: [...state.connections, newConn] }));
        return newConn;
      },
      updateConnection: (id, updates) => {
        set((state) => ({
          connections: state.connections.map((connection) =>
            connection.id === id ? { ...connection, ...updates, updatedAt: new Date().toISOString() } : connection,
          ),
        }));
      },
      deleteConnection: (id) => {
        set((state) => ({
          connections: state.connections.filter((connection) => connection.id !== id),
          activeConnectionId: state.activeConnectionId === id ? null : state.activeConnectionId,
        }));
      },
      setActiveConnection: (id) => set({ activeConnectionId: id, status: "disconnected" }),
      setStatus: (status) => set({ status }),
    }),
    {
      name: "hermes-connections",
      partialize: (state) => ({
        connections: state.connections,
        activeConnectionId: state.activeConnectionId,
      }),
    },
  ),
);
