import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useMemo, useReducer, type PropsWithChildren } from "react";

export type CanonicalTaskContext = {
  kind: "task";
  id: string;
  title: string;
};

type PersistedState = {
  pausedTaskIds: string[];
  activeContext: CanonicalTaskContext | null;
};

type State = PersistedState & { hydrated: boolean };
type Action =
  | { type: "hydrate"; state: PersistedState }
  | { type: "set-active"; context: CanonicalTaskContext }
  | { type: "toggle-paused"; taskId: string }
  | { type: "clear-active" };

const STORAGE_KEY = "kurukoo.mobile.context.v1";
const initialState: State = { pausedTaskIds: [], activeContext: null, hydrated: false };

export function contextReducer(state: State, action: Action): State {
  switch (action.type) {
    case "hydrate":
      return { ...action.state, hydrated: true };
    case "set-active":
      return { ...state, activeContext: action.context };
    case "toggle-paused":
      return state.pausedTaskIds.includes(action.taskId)
        ? { ...state, pausedTaskIds: state.pausedTaskIds.filter((id) => id !== action.taskId) }
        : { ...state, pausedTaskIds: [...state.pausedTaskIds, action.taskId] };
    case "clear-active":
      return { ...state, activeContext: null };
  }
}

const KurukooContext = createContext<
  | {
      state: State;
      setActiveTask: (task: CanonicalTaskContext) => void;
      toggleTaskPaused: (taskId: string) => void;
      clearActiveContext: () => void;
    }
  | undefined
>(undefined);

export function KurukooContextProvider({ children }: PropsWithChildren) {
  const [state, dispatch] = useReducer(contextReducer, initialState);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!mounted) return;
        try {
          const parsed = raw ? (JSON.parse(raw) as PersistedState) : { pausedTaskIds: [], activeContext: null };
          dispatch({
            type: "hydrate",
            state: {
              pausedTaskIds: Array.isArray(parsed.pausedTaskIds) ? parsed.pausedTaskIds : [],
              activeContext: parsed.activeContext?.kind === "task" ? parsed.activeContext : null,
            },
          });
        } catch {
          dispatch({ type: "hydrate", state: { pausedTaskIds: [], activeContext: null } });
        }
      })
      .catch(() => dispatch({ type: "hydrate", state: { pausedTaskIds: [], activeContext: null } }));
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!state.hydrated) return;
    const persisted: PersistedState = { pausedTaskIds: state.pausedTaskIds, activeContext: state.activeContext };
    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
  }, [state.hydrated, state.pausedTaskIds, state.activeContext]);

  const value = useMemo(
    () => ({
      state,
      setActiveTask: (context: CanonicalTaskContext) => dispatch({ type: "set-active", context }),
      toggleTaskPaused: (taskId: string) => dispatch({ type: "toggle-paused", taskId }),
      clearActiveContext: () => dispatch({ type: "clear-active" }),
    }),
    [state],
  );

  return <KurukooContext.Provider value={value}>{children}</KurukooContext.Provider>;
}

export function useKurukooContext() {
  const context = useContext(KurukooContext);
  if (!context) throw new Error("useKurukooContext must be used inside KurukooContextProvider");
  return context;
}
