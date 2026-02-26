/**
 * Modulo: frontend/components
 * Arquivo: AdminPerfisPanel.jsx
 * Funcao no sistema: gerenciar perfis de acesso (CRUD parcial + reset de senha) no escopo ADMIN.
 */
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import {
  atualizarPerfil,
  criarPerfil,
  listarPerfis,
  resetSenhaPerfil,
} from "../services/apiClient.js";

function formatApiError(error) {
  const msg = String(error?.message || "Falha na requisicao.");
  const status = error?.status != null ? String(error.status) : "";
  const code = error?.payload?.error?.code ? String(error.payload.error.code) : "";
  const requestId = error?.payload?.requestId ? String(error.payload.requestId) : "";
  const suffixParts = [
    status ? `status=${status}` : null,
    code ? `code=${code}` : null,
    requestId ? `requestId=${requestId}` : null,
  ].filter(Boolean);
  return suffixParts.length ? `${msg} (${suffixParts.join(", ")})` : msg;
}

export default function AdminPerfisPanel({ canAdmin }) {
  const auth = useAuth();
  const [perfilState, setPerfilState] = useState({
    loading: false,
    response: null,
    error: null,
  });
  const [perfilForm, setPerfilForm] = useState({
    matricula: "",
    nome: "",
    email: "",
    unidadeId: "",
    cargo: "",
  });
  const [perfisState, setPerfisState] = useState({ loading: false, data: null, error: null });
  const [perfilEditId, setPerfilEditId] = useState("");
  const [perfilEditForm, setPerfilEditForm] = useState({
    nome: "",
    email: "",
    unidadeId: "",
    cargo: "",
    role: "OPERADOR",
    ativo: true,
  });
  const [perfilEditState, setPerfilEditState] = useState({
    loading: false,
    response: null,
    error: null,
  });

  const setPerfilField = (key, value) =>
    setPerfilForm((prev) => ({
      ...prev,
      [key]: value,
    }));

  const loadPerfis = async () => {
    if (!canAdmin) return;
    setPerfisState({ loading: true, data: null, error: null });
    try {
      const data = await listarPerfis({ limit: 200 });
      setPerfisState({ loading: false, data, error: null });
    } catch (error) {
      setPerfisState({ loading: false, data: null, error: formatApiError(error) });
    }
  };

  useEffect(() => {
    if (!canAdmin) return;
    void loadPerfis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAdmin]);

  const onCreatePerfil = async (event) => {
    event.preventDefault();
    if (!canAdmin) {
      setPerfilState({ loading: false, response: null, error: "Operacao restrita ao perfil ADMIN." });
      return;
    }

    const payload = {
      matricula: perfilForm.matricula.trim(),
      nome: perfilForm.nome.trim(),
      unidadeId: perfilForm.unidadeId ? Number(perfilForm.unidadeId) : null,
      email: perfilForm.email.trim() || undefined,
      cargo: perfilForm.cargo.trim() || undefined,
    };

    if (!payload.matricula || !payload.nome || !payload.unidadeId) {
      setPerfilState({
        loading: false,
        response: null,
        error: "Preencha matricula, nome e unidadeId.",
      });
      return;
    }

    setPerfilState({ loading: true, response: null, error: null });
    try {
      const data = await criarPerfil(payload);
      setPerfilState({ loading: false, response: data, error: null });
      setPerfilForm({ matricula: "", nome: "", email: "", unidadeId: "", cargo: "" });
      await loadPerfis();
    } catch (error) {
      setPerfilState({ loading: false, response: null, error: formatApiError(error) });
    }
  };

  const beginEditPerfil = (perfil) => {
    if (!perfil?.id) return;
    setPerfilEditId(String(perfil.id));
    setPerfilEditForm({
      nome: String(perfil.nome || ""),
      email: String(perfil.email || ""),
      unidadeId: perfil.unidadeId != null ? String(perfil.unidadeId) : "",
      cargo: String(perfil.cargo || ""),
      role: String(perfil.role || "OPERADOR"),
      ativo: Boolean(perfil.ativo),
    });
    setPerfilEditState({ loading: false, response: null, error: null });
  };

  const cancelEditPerfil = () => {
    setPerfilEditId("");
    setPerfilEditState({ loading: false, response: null, error: null });
  };

  const savePerfilEdit = async () => {
    if (!canAdmin) return;
    const id = String(perfilEditId || "").trim();
    if (!id) return;
    const patch = {
      nome: String(perfilEditForm.nome || "").trim(),
      email: String(perfilEditForm.email || "").trim() || null,
      unidadeId: perfilEditForm.unidadeId ? Number(perfilEditForm.unidadeId) : null,
      cargo: String(perfilEditForm.cargo || "").trim() || null,
      role: String(perfilEditForm.role || "OPERADOR").trim(),
      ativo: Boolean(perfilEditForm.ativo),
    };
    if (!patch.nome || !patch.unidadeId) {
      setPerfilEditState({ loading: false, response: null, error: "Preencha nome e unidadeId." });
      return;
    }
    setPerfilEditState({ loading: true, response: null, error: null });
    try {
      const data = await atualizarPerfil(id, patch);
      setPerfilEditState({ loading: false, response: data, error: null });
      await loadPerfis();
      cancelEditPerfil();
    } catch (error) {
      setPerfilEditState({ loading: false, response: null, error: formatApiError(error) });
    }
  };

  const togglePerfilAtivo = async (perfil) => {
    if (!canAdmin || !perfil?.id) return;
    setPerfilEditState({ loading: true, response: null, error: null });
    try {
      await atualizarPerfil(String(perfil.id), { ativo: !perfil.ativo });
      await loadPerfis();
      setPerfilEditState({ loading: false, response: null, error: null });
    } catch (error) {
      setPerfilEditState({ loading: false, response: null, error: formatApiError(error) });
    }
  };

  const onResetSenhaPerfil = async (perfil) => {
    if (!canAdmin || !perfil?.id) return;
    setPerfilEditState({ loading: true, response: null, error: null });
    try {
      await resetSenhaPerfil(String(perfil.id));
      await loadPerfis();
      setPerfilEditState({ loading: false, response: null, error: null });
    } catch (error) {
      setPerfilEditState({ loading: false, response: null, error: formatApiError(error) });
    }
  };

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">Perfis (usuarios)</h3>
          <p className="mt-1 text-xs text-slate-600">
            Admin cadastra perfis aqui. O usuario define a propria senha em <strong>Primeiro acesso</strong> na tela de login.
          </p>
        </div>
        <button
          type="button"
          onClick={loadPerfis}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100 disabled:opacity-50"
          disabled={!canAdmin || perfisState.loading}
          title={!canAdmin ? "Somente ADMIN." : "Recarregar lista de perfis."}
        >
          {perfisState.loading ? "Atualizando..." : "Atualizar"}
        </button>
      </div>
      {!canAdmin && auth.authEnabled ? (
        <p className="mt-2 text-xs text-rose-700">
          Operacao restrita ao perfil <strong>ADMIN</strong>.
        </p>
      ) : null}

      {perfisState.error ? <p className="mt-3 text-sm text-rose-700">{perfisState.error}</p> : null}

      <form onSubmit={onCreatePerfil} className="mt-3 grid gap-3 md:grid-cols-2">
        <label className="space-y-1">
          <span className="text-xs text-slate-600">Matricula</span>
          <input
            value={perfilForm.matricula}
            onChange={(event) => setPerfilField("matricula", event.target.value)}
            placeholder="Ex.: 123456"
            disabled={!canAdmin && auth.authEnabled}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs text-slate-600">Nome</span>
          <input
            value={perfilForm.nome}
            onChange={(event) => setPerfilField("nome", event.target.value)}
            placeholder="Ex.: Fulano de Tal"
            disabled={!canAdmin && auth.authEnabled}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs text-slate-600">Unidade (1-4)</span>
          <input
            type="number"
            min="1"
            max="4"
            value={perfilForm.unidadeId}
            onChange={(event) => setPerfilField("unidadeId", event.target.value)}
            disabled={!canAdmin && auth.authEnabled}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs text-slate-600">Email (opcional)</span>
          <input
            value={perfilForm.email}
            onChange={(event) => setPerfilField("email", event.target.value)}
            disabled={!canAdmin && auth.authEnabled}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          />
        </label>
        <label className="space-y-1 md:col-span-2">
          <span className="text-xs text-slate-600">Cargo (opcional)</span>
          <input
            value={perfilForm.cargo}
            onChange={(event) => setPerfilField("cargo", event.target.value)}
            disabled={!canAdmin && auth.authEnabled}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          />
        </label>
        <div className="md:col-span-2">
          <button
            type="submit"
            disabled={perfilState.loading || (!canAdmin && auth.authEnabled)}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
          >
            {perfilState.loading ? "Criando..." : "Criar perfil"}
          </button>
        </div>
      </form>
      {perfilState.error ? <p className="mt-2 text-sm text-rose-700">{perfilState.error}</p> : null}
      {perfilState.response ? (
        <pre className="mt-2 max-h-56 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
          {JSON.stringify(perfilState.response, null, 2)}
        </pre>
      ) : null}

      {perfilEditId ? (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">Editar perfil</p>
              <p className="mt-1 text-[11px] text-slate-500">perfilId: <span className="font-mono">{perfilEditId}</span></p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={cancelEditPerfil}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold hover:bg-slate-100"
                disabled={perfilEditState.loading}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={savePerfilEdit}
                className="rounded-md bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
                disabled={perfilEditState.loading}
              >
                {perfilEditState.loading ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>

          {perfilEditState.error ? <p className="mt-2 text-sm text-rose-700">{perfilEditState.error}</p> : null}

          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-xs text-slate-600">Nome</span>
              <input
                value={perfilEditForm.nome}
                onChange={(e) => setPerfilEditForm((prev) => ({ ...prev, nome: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                disabled={perfilEditState.loading}
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-slate-600">Email</span>
              <input
                value={perfilEditForm.email}
                onChange={(e) => setPerfilEditForm((prev) => ({ ...prev, email: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                disabled={perfilEditState.loading}
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-slate-600">Unidade (1-4)</span>
              <input
                type="number"
                min="1"
                max="4"
                value={perfilEditForm.unidadeId}
                onChange={(e) => setPerfilEditForm((prev) => ({ ...prev, unidadeId: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                disabled={perfilEditState.loading}
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-slate-600">Cargo</span>
              <input
                value={perfilEditForm.cargo}
                onChange={(e) => setPerfilEditForm((prev) => ({ ...prev, cargo: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                disabled={perfilEditState.loading}
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-slate-600">Role</span>
              <select
                value={perfilEditForm.role}
                onChange={(e) => setPerfilEditForm((prev) => ({ ...prev, role: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                disabled={perfilEditState.loading}
              >
                <option value="OPERADOR">OPERADOR</option>
                <option value="ADMIN">ADMIN</option>
              </select>
            </label>
            <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800">
              <input
                type="checkbox"
                checked={Boolean(perfilEditForm.ativo)}
                onChange={(e) => setPerfilEditForm((prev) => ({ ...prev, ativo: e.target.checked }))}
                className="h-4 w-4 accent-violet-600"
                disabled={perfilEditState.loading}
              />
              Ativo
            </label>
          </div>
        </div>
      ) : null}

      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <h4 className="text-sm font-semibold text-slate-900">Lista de perfis</h4>
        <p className="mt-1 text-[11px] text-slate-500">Acoes: editar, ativar/desativar, resetar senha.</p>

        {perfilEditState.error ? <p className="mt-2 text-sm text-rose-700">{perfilEditState.error}</p> : null}

        <div className="mt-3 max-h-96 overflow-auto rounded-lg border border-slate-200">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-slate-100 text-[11px] uppercase tracking-wider text-slate-600">
              <tr>
                <th className="px-3 py-2">Matricula</th>
                <th className="px-3 py-2">Nome</th>
                <th className="px-3 py-2">Unid.</th>
                <th className="px-3 py-2">Role</th>
                <th className="px-3 py-2">Ativo</th>
                <th className="px-3 py-2">Senha</th>
                <th className="px-3 py-2">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {(perfisState.data?.items || []).map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-mono text-[11px] text-slate-800">{p.matricula}</td>
                  <td className="px-3 py-2 text-slate-900">{p.nome}</td>
                  <td className="px-3 py-2 text-slate-600">{p.unidadeId}</td>
                  <td className="px-3 py-2 text-slate-600">{p.role}</td>
                  <td className="px-3 py-2 text-slate-600">{p.ativo ? "SIM" : "NAO"}</td>
                  <td className="px-3 py-2 text-slate-600">{p.senhaDefinidaEm ? "DEFINIDA" : "NAO"}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => beginEditPerfil(p)}
                        className="rounded-md border border-slate-300 px-3 py-1.5 text-[11px] font-semibold hover:bg-slate-100"
                        disabled={!canAdmin || perfilEditState.loading}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => togglePerfilAtivo(p)}
                        className="rounded-md border border-slate-300 px-3 py-1.5 text-[11px] font-semibold hover:bg-slate-100"
                        disabled={!canAdmin || perfilEditState.loading}
                        title="Ativa/desativa o perfil (soft-disable)."
                      >
                        {p.ativo ? "Desativar" : "Ativar"}
                      </button>
                      <button
                        type="button"
                        onClick={() => onResetSenhaPerfil(p)}
                        className="rounded-md border border-amber-300/30 bg-amber-200/10 px-3 py-1.5 text-[11px] font-semibold text-amber-800 hover:bg-amber-200/20"
                        disabled={!canAdmin || perfilEditState.loading}
                        title="Remove hash de senha para permitir 'Primeiro acesso' novamente."
                      >
                        Resetar senha
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {(perfisState.data?.items || []).length === 0 && !perfisState.loading ? (
                <tr>
                  <td className="px-3 py-3 text-slate-600" colSpan={7}>
                    Nenhum perfil cadastrado ainda.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </article>
  );
}
