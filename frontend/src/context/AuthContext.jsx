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
  authAcl,
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
  const [acl, setAcl] = useState({ roles: [], permissions: [], menuPermissions: [], source: "none" });
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
        setAcl({ roles: [], permissions: [], menuPermissions: [], source: "auth-disabled" });
        setReady(true);
        return;
      }

      const token = getAuthToken();
      if (!token) {
        setPerfil(null);
        setAcl({ roles: [], permissions: [], menuPermissions: [], source: "sem-token" });
        setReady(true);
        return;
      }

      const me = await authMe();
      if (me?.perfil) {
        setPerfil(me.perfil);
        try {
          const aclResp = await authAcl();
          setAcl({
            roles: Array.isArray(aclResp?.roles) ? aclResp.roles : [],
            permissions: Array.isArray(aclResp?.permissions) ? aclResp.permissions : [],
            menuPermissions: Array.isArray(aclResp?.menuPermissions) ? aclResp.menuPermissions : [],
            source: String(aclResp?.source || "acl"),
          });
        } catch (_aclError) {
          setAcl({ roles: [], permissions: [], menuPermissions: [], source: "acl-error" });
        }
        setReady(true);
        return;
      }

      clearAuthToken();
      setPerfil(null);
      setAcl({ roles: [], permissions: [], menuPermissions: [], source: "token-invalido" });
      setReady(true);
    } catch (e) {
      const status = e?.status ? Number(e.status) : null;
      if (status === 401) clearAuthToken();
      setPerfil(null);
      setAcl({ roles: [], permissions: [], menuPermissions: [], source: "refresh-error" });
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
    try {
      const aclResp = await authAcl();
      setAcl({
        roles: Array.isArray(aclResp?.roles) ? aclResp.roles : [],
        permissions: Array.isArray(aclResp?.permissions) ? aclResp.permissions : [],
        menuPermissions: Array.isArray(aclResp?.menuPermissions) ? aclResp.menuPermissions : [],
        source: String(aclResp?.source || "acl"),
      });
    } catch (_aclError) {
      setAcl({ roles: [], permissions: [], menuPermissions: [], source: "acl-error" });
    }
    return resp;
  }, []);

  const primeiroAcesso = useCallback(async ({ matricula, nome, senha }) => {
    setError(null);
    const resp = await authPrimeiroAcesso({ matricula, nome, senha });
    if (!resp?.perfil) throw new Error("Primeiro acesso nao retornou perfil.");
    setPerfil(resp.perfil);
    try {
      const aclResp = await authAcl();
      setAcl({
        roles: Array.isArray(aclResp?.roles) ? aclResp.roles : [],
        permissions: Array.isArray(aclResp?.permissions) ? aclResp.permissions : [],
        menuPermissions: Array.isArray(aclResp?.menuPermissions) ? aclResp.menuPermissions : [],
        source: String(aclResp?.source || "acl"),
      });
    } catch (_aclError) {
      setAcl({ roles: [], permissions: [], menuPermissions: [], source: "acl-error" });
    }
    return resp;
  }, []);

  const logout = useCallback(() => {
    apiLogout();
    setPerfil(null);
    setAcl({ roles: [], permissions: [], menuPermissions: [], source: "logout" });
  }, []);

  const value = useMemo(
    () => ({
      ready,
      authEnabled,
      perfil,
      acl,
      role: perfil?.role || null,
      isAuthenticated: Boolean(perfil),
      error,
      can: (permission) => {
        if (!authEnabled) return true;
        const code = String(permission || "").trim();
        if (!code) return false;
        const list = Array.isArray(acl?.permissions) ? acl.permissions : [];
        if (list.includes(code) || list.includes("*")) return true;
        return String(perfil?.role || "").toUpperCase() === "ADMIN";
      },
      refresh,
      login,
      primeiroAcesso,
      logout,
    }),
    [ready, authEnabled, perfil, acl, error, refresh, login, primeiroAcesso, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de <AuthProvider>.");
  return ctx;
}
