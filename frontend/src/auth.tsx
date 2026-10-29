import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, tokenStore } from "./api";

interface AuthState {
  email: string | null;
  signedIn: boolean;
  submit: (mode: "login" | "register", email: string, password: string) => Promise<void>;
  logout: () => void;
}

const Ctx = createContext<AuthState | null>(null);
const EMAIL_KEY = "jobradar.email";

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [token, setToken] = useState(tokenStore.get());
  const [email, setEmail] = useState(localStorage.getItem(EMAIL_KEY));

  const logout = useCallback(() => {
    tokenStore.clear();
    localStorage.removeItem(EMAIL_KEY);
    setToken(null);
    setEmail(null);
    queryClient.clear(); // never show the next person the previous person's data
  }, [queryClient]);

  useEffect(() => {
    window.addEventListener("jobradar:logout", logout);
    return () => window.removeEventListener("jobradar:logout", logout);
  }, [logout]);

  const submit = useCallback(async (mode: "login" | "register", mail: string, password: string) => {
    const res = await api<{ token: string; email: string }>(`/auth/${mode}`, {
      method: "POST",
      body: { email: mail, password },
    });
    tokenStore.set(res.token);
    localStorage.setItem(EMAIL_KEY, res.email);
    setToken(res.token);
    setEmail(res.email);
  }, []);

  const value = useMemo(() => ({ email, signedIn: !!token, submit, logout }), [email, token, submit, logout]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const value = useContext(Ctx);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
