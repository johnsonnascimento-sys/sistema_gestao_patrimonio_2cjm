/**
 * Modulo: frontend/context
 * Arquivo: AuthContext.jsx
 * Funcao no sistema: manter estado de autenticacao (JWT) e perfil logado, de forma deterministica.
 *
 * Observacao:
 * - A autenticacao so e exigida quando o backend estiver com AUTH_ENABLED=true.
 * - O frontend detecta isso via GET /health (campo authEnabled).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import {
  authLogin,
  authMe,
  authPrimeiroAcesso,
  clearAuthToken,
  getAuthToken,
  getHealth,
  logout as apiLogout,
} from "../services/apiClient.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [ready, setReady] = useState(false);
  const [authEnabled, setAuthEnabled] = useState(false);
  const [perfil, setPerfil] = useState(null);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setError(null);
    setReady(false);
    try {
      const health = await getHealth();
      const enabled = Boolean(health?.authEnabled);
      setAuthEnabled(enabled);

      if (!enabled) {
        setPerfil(null);
        setReady(true);
        return;
      }

      const token = getAuthToken();
      if (!token) {
        setPerfil(null);
        setReady(true);
        return;
      }

      const me = await authMe();
      if (me?.perfil) {
        setPerfil(me.perfil);
        setReady(true);
        return;
      }

      clearAuthToken();
      setPerfil(null);
      setReady(true);
    } catch (e) {
      const status = e?.status ? Number(e.status) : null;
      if (status === 401) clearAuthToken();
      setPerfil(null);
      setError(e);
      setReady(true);
    }
  }, []);

  useEffect(() => {
    refresh().catch(() => undefined);
  }, [refresh]);

  const login = useCallback(async ({ matricula, senha }) => {
    setError(null);
    const resp = await authLogin({ matricula, senha });
    if (!resp?.perfil) throw new Error("Login nao retornou perfil.");
    setPerfil(resp.perfil);
    return resp;
  }, []);

  const primeiroAcesso = useCallback(async ({ matricula, nome, senha }) => {
    setError(null);
    const resp = await authPrimeiroAcesso({ matricula, nome, senha });
    if (!resp?.perfil) throw new Error("Primeiro acesso nao retornou perfil.");
    setPerfil(resp.perfil);
    return resp;
  }, []);

  const logout = useCallback(() => {
    apiLogout();
    setPerfil(null);
  }, []);

  const value = useMemo(
    () => ({
      ready,
      authEnabled,
      perfil,
      role: perfil?.role || null,
      isAuthenticated: Boolean(perfil),
      error,
      refresh,
      login,
      primeiroAcesso,
      logout,
    }),
    [ready, authEnabled, perfil, error, refresh, login, primeiroAcesso, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de <AuthProvider>.");
  return ctx;
}

