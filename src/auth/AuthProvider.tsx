import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { cloudConfigurationError, supabase } from "./client";

interface AuthState {
  user: User | null;
  ready: boolean;
  error: string;
  recovery: boolean;
}
const Context = createContext<AuthState & { finishRecovery?: () => void }>({
  user: null,
  ready: !supabase,
  error: cloudConfigurationError,
  recovery: false,
});
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    ready: !supabase,
    error: cloudConfigurationError,
    recovery: false,
  });
  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    // Never await another SDK auth call inside this synchronous callback.
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (alive)
        setState((previous) => ({
          user: session?.user ?? null,
          ready: true,
          error: "",
          recovery:
            event === "PASSWORD_RECOVERY" ||
            (event !== "SIGNED_OUT" && previous.recovery),
        }));
    });
    void supabase.auth
      .getSession()
      .then(({ error }) => {
        if (alive && error)
          setState({
            user: null,
            ready: true,
            recovery: false,
            error: "Could not restore your login. Try signing in again.",
          });
      })
      .catch(() => {
        if (alive)
          setState({
            user: null,
            ready: true,
            recovery: false,
            error: "Login could not connect. Reload to retry.",
          });
      });
    const timeout = setTimeout(() => {
      if (alive)
        setState((previous) =>
          previous.ready
            ? previous
            : {
                ...previous,
                error:
                  "Login is taking longer than expected. Check your connection and reload.",
              },
        );
    }, 25_000);
    return () => {
      alive = false;
      clearTimeout(timeout);
      data.subscription.unsubscribe();
    };
  }, []);
  return (
    <Context.Provider
      value={{
        ...state,
        finishRecovery: () =>
          setState((previous) => ({ ...previous, recovery: false })),
      }}
    >
      {children}
    </Context.Provider>
  );
}
export const useAuth = () => useContext(Context);
/** Key the whole study UI, not only its data: discard prior-account form drafts. */
export function AccountBoundary({ children }: { children: ReactNode }) {
  const auth = useAuth();
  if (!auth.ready)
    return (
      <div className="account-loading" role="status">
        <h1>Opening your workspace…</h1>
        <p>{auth.error || "Checking your login securely."}</p>
        {auth.error && (
          <button className="btn" onClick={() => location.reload()}>
            Retry
          </button>
        )}
      </div>
    );
  return (
    <div key={auth.user?.id ?? "local"} className="account-root">
      {children}
    </div>
  );
}
