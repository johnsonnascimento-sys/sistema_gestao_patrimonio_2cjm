/**
 * Modulo: frontend/components
 * Arquivo: AuthLogin.jsx
 * Funcao no sistema: tela de login/primeiro acesso (quando AUTH_ENABLED=true no backend).
 */
import { useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";

function normalizeMatricula(raw) {
  if (raw == null) return "";
  return String(raw).trim().replace(/\D+/g, "").slice(0, 20);
}

export default function AuthLogin() {
  const auth = useAuth();
  const [mode, setMode] = useState("login"); // login | primeiro
  const [matricula, setMatricula] = useState("");
  const [nome, setNome] = useState("");
  const [senha, setSenha] = useState("");
  const [localError, setLocalError] = useState(null);
  const [pending, setPending] = useState(false);

  const errorText = useMemo(() => {
    const msg = localError?.message ? String(localError.message) : null;
    if (msg) return msg;
    const apiMsg = auth?.error?.message ? String(auth.error.message) : null;
    return apiMsg || null;
  }, [localError, auth?.error]);

  const submit = async (event) => {
    event.preventDefault();
    setLocalError(null);

    const m = normalizeMatricula(matricula);
    if (!m) {
      setLocalError(new Error("Informe a matricula."));
      return;
    }
    if (!senha || String(senha).length < 8) {
      setLocalError(new Error("Informe a senha (minimo 8 caracteres)."));
      return;
    }
    if (mode === "primeiro" && !String(nome || "").trim()) {
      setLocalError(new Error("Informe o nome completo (deve conferir com o cadastro do perfil)."));
      return;
    }

    setPending(true);
    try {
      if (mode === "primeiro") {
        await auth.primeiroAcesso({ matricula: m, nome: String(nome).trim(), senha: String(senha) });
      } else {
        await auth.login({ matricula: m, senha: String(senha) });
      }
    } catch (e) {
      setLocalError(e);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="min-h-screen bg-app text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-3xl items-center px-4 py-10">
        <section className="w-full rounded-3xl border border-white/15 bg-slate-900/60 p-6 shadow-2xl backdrop-blur">
          <p className="font-[Space_Grotesk] text-sm uppercase tracking-[0.28em] text-amber-300">
            2a Circunscricao Judiciaria Militar
          </p>
          <h1 className="mt-3 font-[Space_Grotesk] text-3xl font-bold md:text-4xl">
            Patrimonio 2a CJM
          </h1>
          <p className="mt-3 text-sm text-slate-200/85">
            Autenticacao ativa na VPS. Entre com sua matricula para acessar o sistema.
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setMode("login")}
              className={`pill ${mode === "login" ? "pill-active" : ""}`}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => setMode("primeiro")}
              className={`pill ${mode === "primeiro" ? "pill-active" : ""}`}
            >
              Primeiro acesso
            </button>
          </div>

          {errorText && (
            <p className="mt-4 rounded-xl border border-rose-300/30 bg-rose-200/10 p-3 text-sm text-rose-200">
              {errorText}
            </p>
          )}

          <form onSubmit={submit} className="mt-5 grid gap-3">
            <label className="space-y-1">
              <span className="text-xs text-slate-300">Matricula</span>
              <input
                value={matricula}
                onChange={(e) => setMatricula(normalizeMatricula(e.target.value))}
                placeholder="Ex.: 9156"
                inputMode="numeric"
                className="w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
              />
            </label>

            {mode === "primeiro" && (
              <label className="space-y-1">
                <span className="text-xs text-slate-300">Nome completo (deve conferir)</span>
                <input
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex.: Johnson Teixeira do Nascimento"
                  className="w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
                />
              </label>
            )}

            <label className="space-y-1">
              <span className="text-xs text-slate-300">Senha</span>
              <input
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                type="password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                className="w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
              />
              <span className="text-[11px] text-slate-400">
                Minimo 8 caracteres. A senha e armazenada como hash (bcrypt) no banco.
              </span>
            </label>

            <button
              type="submit"
              disabled={pending || !auth.ready}
              className="mt-2 rounded-xl bg-cyan-300 px-4 py-2 font-semibold text-slate-900 disabled:opacity-50"
            >
              {pending ? "Processando..." : mode === "primeiro" ? "Definir senha e entrar" : "Entrar"}
            </button>
          </form>

          <div className="mt-5 rounded-xl border border-white/10 bg-slate-950/35 p-3 text-xs text-slate-300">
            <p className="font-semibold">Dica operacional</p>
            <p className="mt-1">
              Se voce ainda nao tem perfil cadastrado, um ADMIN deve criar primeiro em "Operacoes API". Depois use "Primeiro acesso"
              para definir sua senha.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

