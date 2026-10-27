import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { isLocalMode } from "@/data";
import { supabase } from "@/lib/supabase";

type AuthStatus = "loading" | "signed-in" | "signed-out";

interface AuthState {
  status: AuthStatus;
  session: Session | null;
  email: string | null;
  /** true setelah membuka link reset kata sandi dari email */
  recovering: boolean;
  /** Mode Coba: tanpa login, data di browser */
  localMode: boolean;
  signOut: () => Promise<void>;
  clearRecovery: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<AuthStatus>(isLocalMode ? "signed-in" : "loading");
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setStatus(data.session ? "signed-in" : "signed-out");
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === "PASSWORD_RECOVERY") setRecovering(true);
      setSession((prev) => {
        // Ganti akun → buang cache data akun sebelumnya.
        if (prev?.user.id !== s?.user.id) qc.clear();
        return s;
      });
      setStatus(s ? "signed-in" : "signed-out");
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [qc]);

  const value = useMemo<AuthState>(
    () => ({
      status,
      session,
      email: session?.user.email ?? null,
      recovering,
      localMode: isLocalMode,
      clearRecovery: () => setRecovering(false),
      signOut: async () => {
        if (supabase) await supabase.auth.signOut();
        qc.clear();
      },
    }),
    [status, session, recovering, qc],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth harus dipakai di dalam <AuthProvider>");
  return ctx;
}
