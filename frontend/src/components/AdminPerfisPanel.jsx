/**
 * Modulo: frontend/components
 * Arquivo: AdminPerfisPanel.jsx
 * Funcao no sistema: gerenciar perfis de acesso (CRUD parcial + reset de senha) no escopo ADMIN.
 */
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import {
  atualizarRolePermissoes,
  atualizarPerfil,
  atualizarPerfilRoleAcesso,
  criarPerfil,
  listarAclMatriz,
  listarPerfis,
  listarRolesAcesso,
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

const CARGO_OPTIONS = [
  { value: "Juiz Federal", label: "Juiz Federal" },
  { value: "Juiz Federal Substituto", label: "Juiz Federal Substituto" },
  { value: "Analista Judiciario", label: "Analista Judiciario" },
  { value: "Tecnico Judiciario", label: "Tecnico Judiciario" },
  { value: "Militar", label: "Militar" },
  { value: "OUTRO", label: "Outro" },
];

function buildCargoValue(form) {
  const selected = String(form.cargo || "").trim();
  if (!selected) return "";
  if (selected !== "OUTRO") return selected;
  return String(form.cargoOutro || "").trim();
}

const PERMISSION_LABEL_OVERRIDES = {
  "menu.inventario_admin.view": "Ver menu Inventário -> Administração, Acuracidade e Regularização",
  "menu.inventario_contagem.view": "Ver menu Inventário -> Contagem",
  "action.bem.alterar_responsavel.execute":
    "Executar ação com responsável patrimonial (modal do bem; também usado em Transferência/Cautela)",
  "action.bem.alterar_responsavel.request":
    "Solicitar ação com responsável patrimonial (modal do bem; também usado em Transferência/Cautela)",
  "action.bem.alterar_status.execute":
    "Executar alteração de status do bem (usado em Cautela saída/retorno)",
  "action.bem.alterar_status.request":
    "Solicitar alteração de status do bem (usado em Cautela saída/retorno)",
};

function toHumanPermissionLabel(permission) {
  const code = String(permission?.codigo || "").trim();
  const override = PERMISSION_LABEL_OVERRIDES[code];
  if (override) return override;
  const descricao = String(permission?.descricao || "").trim();
  if (descricao) return descricao;
  if (!code) return "Permissao";
  return code
    .replace(/^menu\./i, "")
    .replace(/^action\./i, "")
    .replace(/[._]+/g, " ")
    .trim()
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

export default function AdminPerfisPanel({ canAdmin }) {
  const auth = useAuth();
  const [perfilState, setPerfilState] = useState({
    loading: false,
    response: null,
    error: null,
  });
  const [perfilForm, setPerfilForm] = useState({
    tipoCadastro: "NAO_USUARIO",
    matricula: "",
    nome: "",
    email: "",
    unidadeId: "",
    cargo: "",
    cargoOutro: "",
  });
  const [perfisState, setPerfisState] = useState({ loading: false, data: null, error: null });
  const [rolesAcessoState, setRolesAcessoState] = useState({ loading: false, data: [], error: null });
  const [roleAcessoDraftByPerfil, setRoleAcessoDraftByPerfil] = useState({});
  const [aclMatrixState, setAclMatrixState] = useState({ loading: false, data: null, error: null });
  const [aclRoleSelecionada, setAclRoleSelecionada] = useState("OPERADOR_AVANCADO");
  const [aclPermissoesDraft, setAclPermissoesDraft] = useState([]);
  const [aclAdminPassword, setAclAdminPassword] = useState("");
  const [aclSaveState, setAclSaveState] = useState({ loading: false, error: null, message: null });
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
      const draft = {};
      for (const perfil of data?.items || []) {
        const roleAcesso = String(perfil?.roleAcessoCodigo || "").trim().toUpperCase();
        const legacyRole = String(perfil?.role || "").trim().toUpperCase();
        draft[String(perfil.id)] = roleAcesso || (legacyRole === "ADMIN" ? "ADMIN_COMPLETO" : "OPERADOR_AVANCADO");
      }
      setRoleAcessoDraftByPerfil(draft);
    } catch (error) {
      setPerfisState({ loading: false, data: null, error: formatApiError(error) });
    }
  };

  const loadRolesAcesso = async () => {
    if (!canAdmin) return;
    setRolesAcessoState({ loading: true, data: [], error: null });
    try {
      const data = await listarRolesAcesso();
      setRolesAcessoState({ loading: false, data: Array.isArray(data?.items) ? data.items : [], error: null });
    } catch (error) {
      setRolesAcessoState({ loading: false, data: [], error: formatApiError(error) });
    }
  };

  const loadAclMatriz = async () => {
    if (!canAdmin) return;
    setAclMatrixState({ loading: true, data: null, error: null });
    try {
      const data = await listarAclMatriz();
      setAclMatrixState({ loading: false, data, error: null });
      const firstRole = String(data?.roles?.[0]?.codigo || "OPERADOR_AVANCADO");
      setAclRoleSelecionada((prev) => (prev && (data?.rolePermissions?.[prev] || prev === firstRole) ? prev : firstRole));
    } catch (error) {
      setAclMatrixState({ loading: false, data: null, error: formatApiError(error) });
    }
  };

  useEffect(() => {
    if (!canAdmin) return;
    void loadPerfis();
    void loadRolesAcesso();
    void loadAclMatriz();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAdmin]);

  useEffect(() => {
    const roleCode = String(aclRoleSelecionada || "").trim().toUpperCase();
    if (!roleCode) return;
    const rolePerms = aclMatrixState.data?.rolePermissions?.[roleCode];
    setAclPermissoesDraft(Array.isArray(rolePerms) ? rolePerms : []);
  }, [aclRoleSelecionada, aclMatrixState.data]);

  const onCreatePerfil = async (event) => {
    event.preventDefault();
    if (!canAdmin) {
      setPerfilState({ loading: false, response: null, error: "Operacao restrita ao perfil ADMIN." });
      return;
    }

    const payload = {
      tipoCadastro: String(perfilForm.tipoCadastro || "NAO_USUARIO").trim().toUpperCase(),
      matricula: perfilForm.matricula.trim(),
      nome: perfilForm.nome.trim(),
      unidadeId: perfilForm.unidadeId ? Number(perfilForm.unidadeId) : null,
      email: perfilForm.email.trim() || undefined,
      cargo: buildCargoValue(perfilForm) || undefined,
      role: "OPERADOR",
      ativo: String(perfilForm.tipoCadastro || "").trim().toUpperCase() !== "NAO_USUARIO",
    };

    if (!payload.matricula || !payload.nome || !payload.unidadeId) {
      setPerfilState({
        loading: false,
        response: null,
        error: "Preencha matricula, nome e unidadeId.",
      });
      return;
    }
    if (!payload.cargo) {
      setPerfilState({
        loading: false,
        response: null,
        error: "Selecione o cargo (ou informe o cargo quando escolher 'Outro').",
      });
      return;
    }
    if (payload.tipoCadastro === "NAO_USUARIO" && !payload.email) {
      setPerfilState({
        loading: false,
        response: null,
        error: "Para nao-usuario, informe e-mail para contato institucional.",
      });
      return;
    }

    setPerfilState({ loading: true, response: null, error: null });
    try {
      const responseData = await criarPerfil({
        matricula: payload.matricula,
        nome: payload.nome,
        unidadeId: payload.unidadeId,
        email: payload.email,
        cargo: payload.cargo,
        role: payload.role,
        ativo: payload.ativo,
      });
      if (payload.tipoCadastro === "NAO_USUARIO") {
        responseData.observacao = "Perfil criado como NAO_USUARIO (sem login).";
      }

      setPerfilState({ loading: false, response: responseData, error: null });
      setPerfilForm({
        tipoCadastro: "NAO_USUARIO",
        matricula: "",
        nome: "",
        email: "",
        unidadeId: "",
        cargo: "",
        cargoOutro: "",
      });
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

  const saveRoleAcessoPerfil = async (perfil) => {
    if (!canAdmin || !perfil?.id) return;
    const perfilId = String(perfil.id);
    const roleCodigo = String(roleAcessoDraftByPerfil[perfilId] || "").trim().toUpperCase();
    if (!roleCodigo) {
      setPerfilEditState({ loading: false, response: null, error: "Selecione uma Role ACL antes de salvar." });
      return;
    }
    setPerfilEditState({ loading: true, response: null, error: null });
    try {
      await atualizarPerfilRoleAcesso(perfilId, roleCodigo);
      await loadPerfis();
      setPerfilEditState({ loading: false, response: { ok: true }, error: null });
    } catch (error) {
      setPerfilEditState({ loading: false, response: null, error: formatApiError(error) });
    }
  };

  const toggleAclPermissao = (codigo) => {
    const code = String(codigo || "").trim();
    if (!code) return;
    setAclPermissoesDraft((prev) => {
      const set = new Set(prev.map((x) => String(x)));
      if (set.has(code)) set.delete(code);
      else set.add(code);
      return Array.from(set).sort();
    });
  };

  const setAclPermissoesPorCategoria = (categoria, marcado) => {
    const cat = String(categoria || "").trim().toUpperCase();
    const catCodes = (aclMatrixState.data?.permissions || [])
      .filter((p) => String(p?.categoria || "").toUpperCase() === cat)
      .map((p) => String(p.codigo || "").trim())
      .filter(Boolean);
    if (!catCodes.length) return;
    setAclPermissoesDraft((prev) => {
      const set = new Set(prev.map((x) => String(x)));
      for (const code of catCodes) {
        if (marcado) set.add(code);
        else set.delete(code);
      }
      return Array.from(set).sort();
    });
  };

  const salvarMatrizRole = async () => {
    if (!canAdmin) return;
    const roleCode = String(aclRoleSelecionada || "").trim().toUpperCase();
    if (!roleCode) {
      setAclSaveState({ loading: false, error: "Selecione a role para editar.", message: null });
      return;
    }
    setAclSaveState({ loading: true, error: null, message: null });
    try {
      const resp = await atualizarRolePermissoes(roleCode, aclPermissoesDraft, aclAdminPassword);
      setAclSaveState({ loading: false, error: null, message: String(resp?.message || "Permissoes atualizadas.") });
      await loadAclMatriz();
    } catch (error) {
      setAclSaveState({ loading: false, error: formatApiError(error), message: null });
    }
  };

  const allPermissions = Array.isArray(aclMatrixState.data?.permissions) ? aclMatrixState.data.permissions : [];
  const menuPermissions = allPermissions.filter((p) => String(p?.categoria || "").toUpperCase() === "MENU");
  const actionPermissions = allPermissions.filter((p) => String(p?.categoria || "").toUpperCase() === "ACTION");
  const aclSelectedSet = new Set(aclPermissoesDraft.map((x) => String(x)));

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">Perfis (usuarios)</h3>
          <p className="mt-1 text-xs text-slate-600">
            Admin cadastra perfis de usuarios e nao-usuarios (detentores de carga). O usuario com acesso define a propria senha em{" "}
            <strong>Primeiro acesso</strong> na tela de login.
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
      {rolesAcessoState.error ? <p className="mt-1 text-sm text-rose-700">{rolesAcessoState.error}</p> : null}

      <form onSubmit={onCreatePerfil} className="mt-3 grid gap-3 md:grid-cols-2">
        <label className="space-y-1 md:col-span-2">
          <span className="text-xs text-slate-600">Tipo de cadastro</span>
          <select
            value={perfilForm.tipoCadastro}
            onChange={(event) => setPerfilField("tipoCadastro", event.target.value)}
            disabled={!canAdmin && auth.authEnabled}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="NAO_USUARIO">Nao-usuario do sistema (detentor/carga)</option>
            <option value="USUARIO">Usuario com acesso ao sistema</option>
          </select>
          <p className="text-[11px] text-slate-500">
            Nao-usuario e criado automaticamente sem acesso (ativo=NAO, role=OPERADOR).
          </p>
        </label>
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
          <span className="text-xs text-slate-600">
            Email {perfilForm.tipoCadastro === "NAO_USUARIO" ? "(obrigatorio)" : "(opcional)"}
          </span>
          <input
            value={perfilForm.email}
            onChange={(event) => setPerfilField("email", event.target.value)}
            disabled={!canAdmin && auth.authEnabled}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          />
        </label>
        <label className="space-y-1 md:col-span-2">
          <span className="text-xs text-slate-600">Cargo</span>
          <select
            value={perfilForm.cargo}
            onChange={(event) => setPerfilField("cargo", event.target.value)}
            disabled={!canAdmin && auth.authEnabled}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">Selecione...</option>
            {CARGO_OPTIONS.map((cargo) => (
              <option key={cargo.value} value={cargo.value}>
                {cargo.label}
              </option>
            ))}
          </select>
        </label>
        {perfilForm.cargo === "OUTRO" ? (
          <label className="space-y-1 md:col-span-2">
            <span className="text-xs text-slate-600">Descreva o cargo</span>
            <input
              value={perfilForm.cargoOutro}
              onChange={(event) => setPerfilField("cargoOutro", event.target.value)}
              disabled={!canAdmin && auth.authEnabled}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            />
          </label>
        ) : null}
        <label className="space-y-1">
          <span className="text-xs text-slate-600">Unidade (1-4)</span>
          <select
            value={perfilForm.unidadeId}
            onChange={(event) => setPerfilField("unidadeId", event.target.value)}
            disabled={!canAdmin && auth.authEnabled}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">Selecione...</option>
            <option value="1">1 - 1a Aud</option>
            <option value="2">2 - 2a Aud</option>
            <option value="3">3 - Foro</option>
            <option value="4">4 - Almox</option>
          </select>
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
        <p className="mt-1 text-[11px] text-slate-500">Acoes: editar, ativar/desativar, resetar senha e definir Role ACL (RBAC).</p>

        {perfilEditState.error ? <p className="mt-2 text-sm text-rose-700">{perfilEditState.error}</p> : null}

        <div className="mt-3 max-h-96 overflow-auto rounded-lg border border-slate-200">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-slate-100 text-[11px] uppercase tracking-wider text-slate-600">
              <tr>
                <th className="px-3 py-2">Matricula</th>
                <th className="px-3 py-2">Nome</th>
                <th className="px-3 py-2">Cargo</th>
                <th className="px-3 py-2">Unid.</th>
                <th className="px-3 py-2">Role</th>
                <th className="px-3 py-2">Role ACL</th>
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
                  <td className="px-3 py-2 text-slate-600">{p.cargo || "-"}</td>
                  <td className="px-3 py-2 text-slate-600">{p.unidadeId}</td>
                  <td className="px-3 py-2 text-slate-600">{p.role}</td>
                  <td className="px-3 py-2 text-slate-600">
                    <div className="flex min-w-[220px] items-center gap-2">
                      <select
                        value={roleAcessoDraftByPerfil[String(p.id)] || ""}
                        onChange={(e) => setRoleAcessoDraftByPerfil((prev) => ({ ...prev, [String(p.id)]: e.target.value }))}
                        className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px]"
                        disabled={!canAdmin || perfilEditState.loading || rolesAcessoState.loading}
                      >
                        <option value="">Selecione...</option>
                        {rolesAcessoState.data.map((role) => (
                          <option key={role.id || role.codigo} value={role.codigo}>
                            {role.codigo}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => saveRoleAcessoPerfil(p)}
                        className="rounded-md border border-indigo-300 px-2 py-1 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
                        disabled={!canAdmin || perfilEditState.loading || !roleAcessoDraftByPerfil[String(p.id)]}
                        title="Salvar role ACL principal do perfil."
                      >
                        Salvar ACL
                      </button>
                    </div>
                  </td>
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
                  <td className="px-3 py-3 text-slate-600" colSpan={9}>
                    Nenhum perfil cadastrado ainda.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h4 className="text-sm font-semibold text-slate-900">Matriz de permissoes por role</h4>
            <p className="mt-1 text-[11px] text-slate-500">
              Defina visualmente o que cada role pode ver e executar. No menu Inventário, Contagem usa permissão própria e
              Administração/Acuracidade/Regularização compartilham a permissão administrativa. Alteração exige senha do admin.
            </p>
          </div>
          <button
            type="button"
            onClick={loadAclMatriz}
            className="rounded-lg border border-slate-300 px-3 py-2 text-xs hover:bg-slate-100 disabled:opacity-50"
            disabled={!canAdmin || aclMatrixState.loading || aclSaveState.loading}
          >
            {aclMatrixState.loading ? "Atualizando..." : "Atualizar matriz"}
          </button>
        </div>

        {aclMatrixState.error ? <p className="mt-2 text-sm text-rose-700">{aclMatrixState.error}</p> : null}
        {aclSaveState.error ? <p className="mt-2 text-sm text-rose-700">{aclSaveState.error}</p> : null}
        {aclSaveState.message ? <p className="mt-2 text-sm text-emerald-700">{aclSaveState.message}</p> : null}

        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <label className="space-y-1">
            <span className="text-xs text-slate-600">Role</span>
            <select
              value={aclRoleSelecionada}
              onChange={(e) => setAclRoleSelecionada(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              disabled={!canAdmin || aclMatrixState.loading || aclSaveState.loading}
            >
              {(aclMatrixState.data?.roles || []).map((role) => (
                <option key={role.id || role.codigo} value={role.codigo}>
                  {role.codigo}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 md:col-span-2">
            <span className="text-xs text-slate-600">Senha admin para salvar</span>
            <input
              type="password"
              value={aclAdminPassword}
              onChange={(e) => setAclAdminPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              disabled={!canAdmin || aclSaveState.loading}
            />
          </label>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setAclPermissoesPorCategoria("MENU", true)}
            className="rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-100 disabled:opacity-50"
            disabled={!canAdmin || aclSaveState.loading}
          >
            Marcar todos menus
          </button>
          <button
            type="button"
            onClick={() => setAclPermissoesPorCategoria("MENU", false)}
            className="rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-100 disabled:opacity-50"
            disabled={!canAdmin || aclSaveState.loading}
          >
            Limpar menus
          </button>
          <button
            type="button"
            onClick={() => setAclPermissoesPorCategoria("ACTION", true)}
            className="rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-100 disabled:opacity-50"
            disabled={!canAdmin || aclSaveState.loading}
          >
            Marcar todas acoes
          </button>
          <button
            type="button"
            onClick={() => setAclPermissoesPorCategoria("ACTION", false)}
            className="rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-100 disabled:opacity-50"
            disabled={!canAdmin || aclSaveState.loading}
          >
            Limpar acoes
          </button>
          <button
            type="button"
            onClick={() => setAclPermissoesDraft([])}
            className="rounded-md border border-rose-300 px-2 py-1 text-xs text-rose-700 hover:bg-rose-50 disabled:opacity-50"
            disabled={!canAdmin || aclSaveState.loading}
          >
            Limpar tudo
          </button>
        </div>

        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <h5 className="text-xs font-semibold uppercase tracking-wide text-slate-700">Menus</h5>
            <div className="mt-2 max-h-64 space-y-1 overflow-auto pr-1">
              {menuPermissions.map((perm) => {
                const code = String(perm.codigo || "");
                return (
                  <label key={code} className="flex items-start gap-2 rounded px-1 py-1 text-xs hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={aclSelectedSet.has(code)}
                      onChange={() => toggleAclPermissao(code)}
                      className="mt-0.5 h-4 w-4 accent-violet-600"
                      disabled={!canAdmin || aclSaveState.loading}
                    />
                    <span>
                      <span className="block text-slate-700">{toHumanPermissionLabel(perm)}</span>
                    </span>
                  </label>
                );
              })}
              {!menuPermissions.length ? <p className="text-xs text-slate-500">Sem permissoes de menu.</p> : null}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <h5 className="text-xs font-semibold uppercase tracking-wide text-slate-700">Acoes</h5>
            <p className="mt-1 text-[11px] text-slate-500">
              Em "responsável", a permissão trata do responsável patrimonial (posse operacional), não de transferência de carga.
            </p>
            <div className="mt-2 rounded-md border border-slate-200 bg-slate-50 p-2 text-[11px] text-slate-700">
              <p className="font-semibold text-slate-800">Mapa de Movimentações (menu Movimentações)</p>
              <p className="mt-1">
                <strong>Transferência (muda carga):</strong> requer permissão de <em>responsável</em>.
              </p>
              <p>
                <strong>Cautela saída:</strong> requer <em>status</em> + <em>responsável</em>.
              </p>
              <p>
                <strong>Cautela retorno:</strong> requer <em>status</em> e, se limpar responsável, também <em>responsável</em>.
              </p>
            </div>
            <div className="mt-2 max-h-64 space-y-1 overflow-auto pr-1">
              {actionPermissions.map((perm) => {
                const code = String(perm.codigo || "");
                return (
                  <label key={code} className="flex items-start gap-2 rounded px-1 py-1 text-xs hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={aclSelectedSet.has(code)}
                      onChange={() => toggleAclPermissao(code)}
                      className="mt-0.5 h-4 w-4 accent-violet-600"
                      disabled={!canAdmin || aclSaveState.loading}
                    />
                    <span>
                      <span className="block text-slate-700">{toHumanPermissionLabel(perm)}</span>
                    </span>
                  </label>
                );
              })}
              {!actionPermissions.length ? <p className="text-xs text-slate-500">Sem permissoes de acao.</p> : null}
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <p className="text-xs text-slate-600">
            Total selecionado: <strong>{aclPermissoesDraft.length}</strong>
          </p>
          <button
            type="button"
            onClick={salvarMatrizRole}
            className="rounded-md bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
            disabled={!canAdmin || aclSaveState.loading || !aclRoleSelecionada}
          >
            {aclSaveState.loading ? "Salvando permissoes..." : "Salvar permissoes da role"}
          </button>
        </div>
      </div>
    </article>
  );
}
