/**
 * Modulo: frontend/services
 * Arquivo: apiClient.js
 * Funcao no sistema: cliente HTTP para integracao da UI com o backend Node.js.
 */
const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL || "http://localhost:3001").replace(/\/+$/, "");
const API_BASE_ORIGIN = (() => {
  try {
    const fallbackOrigin = typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : "http://localhost:3001";
    return new URL(API_BASE_URL, fallbackOrigin).origin;
  } catch {
    return API_BASE_URL;
  }
})();

const AUTH_TOKEN_KEY = "cjm_auth_token_v1";

export function getAuthToken() {
  try {
    return window.localStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAuthToken(token) {
  try {
    if (!token) {
      window.localStorage.removeItem(AUTH_TOKEN_KEY);
      return;
    }
    window.localStorage.setItem(AUTH_TOKEN_KEY, String(token));
  } catch {
    // Storage pode estar bloqueado; ainda permite uso em memoria (a UI tratara).
  }
}

export function getFotoUrl(path) {
  if (!path) return "";
  const raw = String(path).trim();
  if (!raw) return "";
  if (raw.startsWith("data:")) return raw;

  if (/^https?:\/\//i.test(raw)) {
    try {
      const u = new URL(raw);
      const host = String(u.hostname || "").toLowerCase();
      // Corrige URLs legadas salvas com host local/container.
      if (host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0" || host === "cjm_backend") {
        return `${API_BASE_URL}${(u.pathname || "").startsWith("/") ? "" : "/"}${u.pathname || ""}${u.search || ""}${u.hash || ""}`;
      }
      return raw;
    } catch {
      return raw;
    }
  }

  if (raw.startsWith("//")) {
    const protocol = typeof window !== "undefined" && window.location?.protocol ? window.location.protocol : "https:";
    return `${protocol}${raw}`;
  }
  // Em producao, o frontend expoe backend via /api/* (proxy nginx).
  if (raw.startsWith("/fotos/")) return `${API_BASE_URL}${raw}`;
  if (raw.startsWith("fotos/")) return `${API_BASE_URL}/${raw}`;
  return `${API_BASE_URL}${raw.startsWith("/") ? "" : "/"}${raw}`;
}

export function clearAuthToken() {
  setAuthToken(null);
}

function withAuthHeaders(init) {
  const headers = new Headers(init?.headers || {});
  const token = getAuthToken();
  if (token && !headers.has("Authorization")) headers.set("Authorization", `Bearer ${token}`);
  return { ...(init || {}), headers };
}

async function safeFetch(url, init) {
  try {
    return await fetch(url, withAuthHeaders(init));
  } catch (error) {
    const detail = error?.message ? ` Detalhe: ${error.message}` : "";
    throw new Error(
      `Nao foi possivel conectar com a API em ${API_BASE_URL}. Verifique se o backend esta rodando e se VITE_API_BASE_URL esta correto.${detail}`,
    );
  }
}

async function parseResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const errorMessage =
      typeof body === "object"
        ? body?.error?.message || body?.message || "Falha na requisicao."
        : String(body || "Falha na requisicao.");
    const error = new Error(errorMessage);
    error.status = response.status;
    error.payload = body;
    throw error;
  }

  return body;
}

/**
 * Consulta healthcheck da API backend.
 * @returns {Promise<object>} Status retornado por /health.
 */
export async function getHealth() {
  const response = await safeFetch(`${API_BASE_URL}/health`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  return parseResponse(response);
}

/**
 * Login por matricula/senha -> recebe JWT (quando autenticacao estiver ativa no backend).
 * @param {{matricula: string, senha: string}} payload Credenciais.
 * @returns {Promise<{requestId: string, token: string, perfil: object}>} Token + perfil.
 */
export async function authLogin(payload) {
  const response = await safeFetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });
  const body = await parseResponse(response);
  if (body?.token) setAuthToken(body.token);
  return body;
}

/**
 * Primeiro acesso: define senha para um perfil ja cadastrado (bootstrap controlado).
 * @param {{matricula: string, nome: string, senha: string}} payload Dados.
 * @returns {Promise<{requestId: string, token: string, perfil: object}>} Token + perfil.
 */
export async function authPrimeiroAcesso(payload) {
  const response = await safeFetch(`${API_BASE_URL}/auth/primeiro-acesso`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });
  const body = await parseResponse(response);
  if (body?.token) setAuthToken(body.token);
  return body;
}

/**
 * Consulta perfil autenticado no backend.
 * @returns {Promise<{requestId: string, authEnabled: boolean, perfil: object|null}>} Perfil atual.
 */
export async function authMe() {
  const response = await safeFetch(`${API_BASE_URL}/auth/me`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  return parseResponse(response);
}

/**
 * Consulta ACL (roles/permissoes/menu) do usuario autenticado.
 * @returns {Promise<{requestId:string, authEnabled:boolean, perfilId:string|null, roles:string[], permissions:string[], menuPermissions:string[], source:string}>}
 */
export async function authAcl() {
  const response = await safeFetch(`${API_BASE_URL}/auth/acl`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  return parseResponse(response);
}

export function logout() {
  clearAuthToken();
}

/**
 * Consulta estatisticas basicas do cadastro de bens.
 * @param {boolean} incluirTerceiros Incluir bens de terceiros.
 * @returns {Promise<object>} Estatisticas retornadas por /stats.
 */
export async function getStats(incluirTerceiros = false) {
  const params = new URLSearchParams();
  if (incluirTerceiros) params.set("incluirTerceiros", "true");
  const suffix = params.toString() ? `?${params.toString()}` : "";
  const response = await safeFetch(`${API_BASE_URL}/stats${suffix}`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  return parseResponse(response);
}

/**
 * Consulta estatisticas basicas do cadastro de locais (bens com/sem sala).
 * @param {{ unidadeId?: number }} params Filtros.
 * @returns {Promise<object>} Estatisticas de localizacao.
 */
export async function getEstatisticasLocais(params = {}) {
  const usp = new URLSearchParams();
  if (params.unidadeId) usp.set("unidadeId", String(params.unidadeId));
  const suffix = usp.toString() ? `?${usp.toString()}` : "";
  const response = await safeFetch(`${API_BASE_URL}/locais/estatisticas${suffix}`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  return parseResponse(response);
}

/**
 * Reseta o local_id de bens, limpando o mapeamento de sala (todas, unidade ou salas selecionadas).
 * @param {{ unidadeId?: number, localIds?: string[], adminPassword?: string }} params Filtros + confirmacao.
 * @returns {Promise<{ afetados: number }>}
 */
export async function resetLocais(params = {}) {
  const usp = new URLSearchParams();
  if (params.unidadeId) usp.set("unidadeId", String(params.unidadeId));
  const suffix = usp.toString() ? `?${usp.toString()}` : "";
  const response = await safeFetch(`${API_BASE_URL}/locais/reset${suffix}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      adminPassword: params.adminPassword || "",
      localIds: Array.isArray(params.localIds) ? params.localIds : [],
    }),
  });
  return parseResponse(response);
}

/**
 * Lista bens filtrados por status de localizacao fisica.
 * @param {{ statusLocal: "com_local"|"sem_local", unidadeId?: number, limit?: number, offset?: number }} params
 */
export async function listarBensLocalizacao(params = {}) {
  const usp = new URLSearchParams();
  usp.set("statusLocal", params.statusLocal || "sem_local");
  if (params.unidadeId) usp.set("unidadeId", String(params.unidadeId));
  if (params.limit) usp.set("limit", String(params.limit));
  if (params.offset != null) usp.set("offset", String(params.offset));
  const response = await safeFetch(`${API_BASE_URL}/bens/localizacao?${usp.toString()}`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  return parseResponse(response);
}

/**
 * Lista/consulta bens com paginacao.
 * @param {object} filters Filtros opcionais.
 * @param {string=} filters.numeroTombamento Tombamento GEAFIN (10 digitos) ou codigo de 4 digitos.
 * @param {"antigo"|"novo"=} filters.tipoBusca Obrigatorio quando numeroTombamento tiver 4 digitos.
 * @param {string=} filters.q Texto parcial para descricao.
 * @param {string=} filters.codigoCatalogo Codigo/numero de catalogo para busca.
 * @param {string=} filters.localFisico Texto parcial para filtrar por local_fisico (inventario/sala).
 * @param {string=} filters.localId UUID do local cadastrado (tabela locais) vinculado ao bem.
 * @param {number=} filters.unidadeDonaId Unidade 1..4.
 * @param {string=} filters.status OK|BAIXADO|EM_CAUTELA|AGUARDANDO_RECEBIMENTO.
 * @param {string=} filters.responsavelPerfilId UUID do perfil responsavel associado ao bem.
 * @param {string=} filters.responsavel Texto parcial para filtrar por matricula/nome do responsavel.
 * @param {number=} filters.limit Limite (1..200).
 * @param {number=} filters.offset Offset (>=0).
 * @param {boolean=} filters.incluirTerceiros Incluir bens de terceiros.
 * @returns {Promise<object>} Resultado com paging e items.
 */
export async function listarBens(filters = {}) {
  const params = new URLSearchParams();
  if (filters.numeroTombamento) params.set("numeroTombamento", filters.numeroTombamento);
  if (filters.q) params.set("q", filters.q);
  if (filters.codigoCatalogo) params.set("codigoCatalogo", filters.codigoCatalogo);
  if (filters.localFisico) params.set("localFisico", filters.localFisico);
  if (filters.localId) params.set("localId", String(filters.localId));
  if (filters.unidadeDonaId) params.set("unidadeDonaId", String(filters.unidadeDonaId));
  if (filters.status) params.set("status", filters.status);
  if (filters.responsavelPerfilId) params.set("responsavelPerfilId", String(filters.responsavelPerfilId));
  if (filters.responsavel) params.set("responsavel", String(filters.responsavel));
  if (filters.limit != null) params.set("limit", String(filters.limit));
  if (filters.offset != null) params.set("offset", String(filters.offset));
  if (filters.incluirTerceiros) params.set("incluirTerceiros", "true");
  if (filters.tipoBusca) params.set("tipoBusca", filters.tipoBusca);

  const suffix = params.toString() ? `?${params.toString()}` : "";
  const response = await safeFetch(`${API_BASE_URL}/bens${suffix}`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  return parseResponse(response);
}

/**
 * Sugestoes de "local_fisico" a partir dos bens reais.
 * Usado para orientar o usuario quando "Baixar catalogo da sala" retorna 0 itens.
 *
 * @param {{ q: string, unidadeDonaId?: number }} params Filtros.
 * @returns {Promise<{requestId: string, items: {localFisico: string, total: number}[]}>} Lista de sugestoes.
 */
export async function listarSugestoesLocaisBens(params = {}) {
  const usp = new URLSearchParams();
  if (params.q) usp.set("q", String(params.q));
  if (params.unidadeDonaId) usp.set("unidadeDonaId", String(params.unidadeDonaId));

  const suffix = usp.toString() ? `?${usp.toString()}` : "";
  const response = await safeFetch(`${API_BASE_URL}/bens/locais-sugestoes${suffix}`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  return parseResponse(response);
}

/**
 * Registra bem de terceiro durante inventario (sem tombamento GEAFIN).
 * @param {object} payload Payload.
 * @returns {Promise<object>} Bem + contagem criada.
 */
export async function registrarBemTerceiroInventario(payload) {
  const response = await safeFetch(`${API_BASE_URL}/inventario/bens-terceiros`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });
  return parseResponse(response);
}

/**
 * Registra bem "sem placa" / "não identificado" (Art. 175)
 * @param {object} payload Dados incluindo a foto em base64 e descrição.
 * @returns {Promise<object>} Bem criado e contagem salva localmente.
 */
export async function registrarBemNaoIdentificadoInventario(payload) {
  const response = await safeFetch(`${API_BASE_URL}/inventario/bens-nao-identificados`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });
  return parseResponse(response);
}

/**
 * Busca detalhes de um bem por id (UUID).
 * @param {string} id UUID do bem.
 * @returns {Promise<object>} Detalhe do bem (join com catalogo + historicos).
 */
export async function getBemDetalhe(id) {
  const response = await safeFetch(`${API_BASE_URL}/bens/${encodeURIComponent(id)}`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  return parseResponse(response);
}

/**
 * Lista trilha de auditoria detalhada de um bem (inclui bens/catalogo/movimentacoes/contagens relacionadas).
 * @param {string} id BemId (UUID).
 * @param {{limit?: number}} params Parametros opcionais.
 * @returns {Promise<object>} Lista de alteracoes auditadas.
 */
export async function getBemAuditoria(id, params = {}) {
  const bemId = String(id || "").trim();
  if (!bemId) throw new Error("BemId obrigatorio.");
  const usp = new URLSearchParams();
  if (params.limit != null) usp.set("limit", String(params.limit));
  const suffix = usp.toString() ? `?${usp.toString()}` : "";
  const response = await safeFetch(`${API_BASE_URL}/bens/${encodeURIComponent(bemId)}/auditoria${suffix}`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  return parseResponse(response);
}

/**
 * Lista auditoria patrimonial global (ADMIN), sem precisar abrir o detalhe de um bem.
 * @param {{limit?: number, offset?: number, q?: string, numeroTombamento?: string, tabela?: string, operacao?: string}} params Filtros/paginacao.
 * @returns {Promise<{requestId: string, paging: {limit:number, offset:number, total:number}, items: any[]}>} Lista global.
 */
export async function listarAuditoriaPatrimonio(params = {}) {
  const usp = new URLSearchParams();
  if (params.limit != null) usp.set("limit", String(params.limit));
  if (params.offset != null) usp.set("offset", String(params.offset));
  if (params.q) usp.set("q", String(params.q));
  if (params.numeroTombamento) usp.set("numeroTombamento", String(params.numeroTombamento));
  if (params.tabela) usp.set("tabela", String(params.tabela));
  if (params.operacao) usp.set("operacao", String(params.operacao));
  const suffix = usp.toString() ? `?${usp.toString()}` : "";
  const response = await safeFetch(`${API_BASE_URL}/auditoria/patrimonio${suffix}`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  return parseResponse(response);
}

/**
 * Lista erros runtime registrados pela API (ADMIN).
 * @param {{limit?: number}} params Parametros.
 * @returns {Promise<{requestId: string, total: number, items: any[]}>} Ultimos erros.
 */
export async function listarErrosRuntime(params = {}) {
  const usp = new URLSearchParams();
  if (params.limit != null) usp.set("limit", String(params.limit));
  const suffix = usp.toString() ? `?${usp.toString()}` : "";
  const response = await safeFetch(`${API_BASE_URL}/logs/erros-runtime${suffix}`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  return parseResponse(response);
}

/**
 * Consulta status operacional do backup (ADMIN).
 * @param {{limitOps?: number}} params Parametros opcionais.
 * @returns {Promise<object>} Config, ferramentas, listas de backup e historico de operacoes.
 */
export async function getBackupStatus(params = {}) {
  const usp = new URLSearchParams();
  if (params.limitOps != null) usp.set("limitOps", String(params.limitOps));
  const suffix = usp.toString() ? `?${usp.toString()}` : "";
  const response = await safeFetch(`${API_BASE_URL}/admin/backup/status${suffix}`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  return parseResponse(response);
}

/**
 * Executa snapshot pre-GEAFIN (ADMIN + senha).
 * @param {{adminPassword: string, keepDays?: number, tag?: string}} payload Dados.
 * @returns {Promise<object>} Resultado da operacao.
 */
export async function executarSnapshotPreGeafin(payload) {
  const response = await safeFetch(`${API_BASE_URL}/admin/backup/snapshot`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload || {}),
  });
  return parseResponse(response);
}

/**
 * Executa backup manual (ADMIN + senha).
 * @param {{adminPassword: string, scope: "db"|"media"|"all", keepDays?: number, tag?: string}} payload Dados.
 * @returns {Promise<object>} Resultado da operacao.
 */
export async function executarBackupManual(payload) {
  const response = await safeFetch(`${API_BASE_URL}/admin/backup/manual`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload || {}),
  });
  return parseResponse(response);
}

/**
 * Executa restore de dump do banco (ADMIN + senha + confirmacao RESTORE).
 * @param {{adminPassword: string, remoteFile: string, confirmText: string, keepDays?: number}} payload Dados.
 * @returns {Promise<object>} Resultado da operacao.
 */
export async function executarRestoreBackup(payload) {
  const response = await safeFetch(`${API_BASE_URL}/admin/backup/restore`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload || {}),
  });
  return parseResponse(response);
}

/**
 * Reverte uma alteracao especifica da trilha de auditoria de um bem.
 * @param {string} id BemId (UUID).
 * @param {number|string} auditId ID da linha em auditoria_log.
 * @returns {Promise<object>} Resultado da reversao.
 */
export async function reverterBemAuditoria(id, auditId) {
  const bemId = String(id || "").trim();
  const audit = String(auditId || "").trim();
  if (!bemId) throw new Error("BemId obrigatorio.");
  if (!audit) throw new Error("auditId obrigatorio.");
  const response = await safeFetch(`${API_BASE_URL}/bens/${encodeURIComponent(bemId)}/auditoria/${encodeURIComponent(audit)}/reverter`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({}),
  });
  return parseResponse(response);
}

/**
 * Atualiza dados do bem (ADMIN) exceto chaves.
 * @param {string} id UUID do bem.
 * @param {object} patch Campos parciais.
 * @returns {Promise<{requestId: string, bem: any}>} Bem atualizado.
 */
export async function atualizarBem(id, patch) {
  const response = await safeFetch(`${API_BASE_URL}/bens/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(patch || {}),
  });
  return parseResponse(response);
}

/**
 * Atualiza foto de catálogo (SKU).
 * @param {string} id UUID do catálogo.
 * @param {string|null} fotoReferenciaUrl Nova URL ou null para remover.
 */
export async function atualizarFotoCatalogo(id, fotoReferenciaUrl) {
  const response = await safeFetch(`${API_BASE_URL}/catalogo-bens/${encodeURIComponent(id)}/foto`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ fotoReferenciaUrl }),
  });
  return parseResponse(response);
}

/**
 * Cria perfil (necessario para autorizar/executar movimentacoes).
 * @param {object} payload Dados do perfil.
 * @param {string} payload.matricula Matricula unica.
 * @param {string} payload.nome Nome completo.
 * @param {string=} payload.email Email opcional.
 * @param {number} payload.unidadeId Unidade 1..4.
 * @param {string=} payload.cargo Cargo opcional.
 * @param {"ADMIN"|"OPERADOR"=} payload.role Papel opcional (default: OPERADOR).
 * @param {boolean=} payload.ativo Ativo/inativo no momento da criacao (default: true).
 * @returns {Promise<object>} Perfil criado.
 */
export async function criarPerfil(payload) {
  const response = await safeFetch(`${API_BASE_URL}/perfis`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });
  return parseResponse(response);
}

/**
 * Lista perfis (ADMIN).
 * @param {{limit?: number}} filters Filtros opcionais.
 * @returns {Promise<{requestId: string, items: any[]}>} Lista de perfis.
 */
export async function listarPerfis(filters = {}) {
  const params = new URLSearchParams();
  if (filters.limit != null) params.set("limit", String(filters.limit));
  const suffix = params.toString() ? `?${params.toString()}` : "";

  const response = await safeFetch(`${API_BASE_URL}/perfis${suffix}`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  return parseResponse(response);
}

/**
 * Lista catalogos (SKU) para operacao/admin.
 * @param {{q?: string, codigoCatalogo?: string, grupo?: string, limit?: number, offset?: number}} filters Filtros.
 * @returns {Promise<{requestId: string, paging: {limit:number, offset:number, total:number}, items: any[]}>}
 */
export async function listarCatalogos(filters = {}) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", String(filters.q));
  if (filters.codigoCatalogo) params.set("codigoCatalogo", String(filters.codigoCatalogo));
  if (filters.grupo) params.set("grupo", String(filters.grupo));
  if (filters.limit != null) params.set("limit", String(filters.limit));
  if (filters.offset != null) params.set("offset", String(filters.offset));
  const suffix = params.toString() ? `?${params.toString()}` : "";
  const response = await safeFetch(`${API_BASE_URL}/catalogo-bens${suffix}`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  return parseResponse(response);
}

/**
 * Cria catalogo (SKU).
 * @param {{codigoCatalogo: string, descricao: string, grupo?: string|null, materialPermanente?: boolean}} payload Dados.
 * @returns {Promise<{requestId: string, catalogo: any}>}
 */
export async function criarCatalogo(payload) {
  const response = await safeFetch(`${API_BASE_URL}/catalogo-bens`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload || {}),
  });
  return parseResponse(response);
}

/**
 * Atualiza catalogo (SKU).
 * @param {string} id UUID do catalogo.
 * @param {{codigoCatalogo?: string, descricao?: string, grupo?: string|null, materialPermanente?: boolean, confirmText?: string, adminPassword?: string}} patch Campos.
 * @returns {Promise<{requestId: string, catalogo: any}>}
 */
export async function atualizarCatalogo(id, patch) {
  const response = await safeFetch(`${API_BASE_URL}/catalogo-bens/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(patch || {}),
  });
  return parseResponse(response);
}

/**
 * Associa bens a um catalogo por lista de tombamentos.
 * @param {string} id UUID do catalogo.
 * @param {{tombamentos: string[], dryRun?: boolean}} payload Dados.
 * @returns {Promise<object>}
 */
export async function associarBensCatalogo(id, payload) {
  const response = await safeFetch(`${API_BASE_URL}/catalogo-bens/${encodeURIComponent(id)}/associar-bens`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload || {}),
  });
  return parseResponse(response);
}

/**
 * Lista classificacoes SIAFI.
 * @param {{q?: string, ativo?: boolean, limit?: number, offset?: number}} filters Filtros.
 * @returns {Promise<{requestId:string,paging:{limit:number,offset:number,total:number},items:any[]}>}
 */
export async function listarClassificacoesSiafi(filters = {}) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", String(filters.q));
  if (filters.ativo != null) params.set("ativo", String(Boolean(filters.ativo)));
  if (filters.limit != null) params.set("limit", String(filters.limit));
  if (filters.offset != null) params.set("offset", String(filters.offset));
  const suffix = params.toString() ? `?${params.toString()}` : "";
  const response = await safeFetch(`${API_BASE_URL}/classificacoes-siafi${suffix}`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  return parseResponse(response);
}

/**
 * Cria classificacao SIAFI.
 * @param {{codigoClassificacao: string, descricaoSiafi: string}} payload Dados.
 * @returns {Promise<{requestId:string,classificacao:any}>}
 */
export async function criarClassificacaoSiafi(payload) {
  const response = await safeFetch(`${API_BASE_URL}/classificacoes-siafi`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload || {}),
  });
  return parseResponse(response);
}

/**
 * Atualiza classificacao SIAFI.
 * @param {string} id UUID.
 * @param {{codigoClassificacao?: string, descricaoSiafi?: string, ativo?: boolean}} patch Campos.
 * @returns {Promise<{requestId:string,classificacao:any}>}
 */
export async function atualizarClassificacaoSiafi(id, patch) {
  const response = await safeFetch(`${API_BASE_URL}/classificacoes-siafi/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(patch || {}),
  });
  return parseResponse(response);
}

/**
 * Aplica nome_resumo para todos os bens de um SKU (catalogo).
 * @param {string} id UUID do catalogo.
 * @param {{nomeResumo?: string}} payload Dados opcionais.
 * @returns {Promise<{requestId:string,catalogoId:string,nomeResumoAplicado:string,atualizados:number}>}
 */
export async function aplicarNomeResumoCatalogo(id, payload = {}) {
  const response = await safeFetch(`${API_BASE_URL}/catalogo-bens/${encodeURIComponent(id)}/aplicar-nome-resumo`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload || {}),
  });
  return parseResponse(response);
}

/**
 * Busca perfis para selecao operacional (detentor de cautela).
 * Permite pesquisar por matricula, nome ou UUID.
 * @param {{q: string, limit?: number}} filters Filtros de busca.
 * @returns {Promise<{requestId: string, items: any[]}>} Perfis encontrados.
 */
export async function buscarPerfisDetentor(filters = {}) {
  const params = new URLSearchParams();
  if (filters.q != null) params.set("q", String(filters.q));
  if (filters.limit != null) params.set("limit", String(filters.limit));
  const suffix = params.toString() ? `?${params.toString()}` : "";

  const response = await safeFetch(`${API_BASE_URL}/perfis/busca${suffix}`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  return parseResponse(response);
}

/**
 * Atualiza perfil (ADMIN).
 * @param {string} id UUID do perfil.
 * @param {object} patch Campos parciais.
 * @returns {Promise<{requestId: string, perfil: any}>} Perfil atualizado.
 */
export async function atualizarPerfil(id, patch) {
  const response = await safeFetch(`${API_BASE_URL}/perfis/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(patch || {}),
  });
  return parseResponse(response);
}

/**
 * Atualiza role ACL principal do perfil (ADMIN).
 * @param {string} id UUID do perfil.
 * @param {string} roleCodigo Codigo da role RBAC.
 * @returns {Promise<{requestId:string,perfil:any}>}
 */
export async function atualizarPerfilRoleAcesso(id, roleCodigo) {
  const response = await safeFetch(`${API_BASE_URL}/perfis/${encodeURIComponent(id)}/role-acesso`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ roleCodigo }),
  });
  return parseResponse(response);
}

/**
 * Reseta senha (hash) do perfil (ADMIN), habilitando "Primeiro acesso" novamente.
 * @param {string} id UUID do perfil.
 * @returns {Promise<{requestId: string, perfil: any}>} Perfil atualizado.
 */
export async function resetSenhaPerfil(id) {
  const response = await safeFetch(`${API_BASE_URL}/perfis/${encodeURIComponent(id)}/reset-senha`, {
    method: "POST",
    headers: { Accept: "application/json" },
  });
  return parseResponse(response);
}

/**
 * Envia arquivo CSV GEAFIN para importacao com upsert seguro.
 * @param {File} file Arquivo CSV selecionado.
 * @param {number|null} unidadePadraoId Unidade fallback opcional.
 * @param {{signal?: AbortSignal}=} opts Opcoes (ex.: abort).
 * @returns {Promise<object>} Resumo da importacao.
 */
export async function importarGeafin(file, unidadePadraoId, opts = {}) {
  const formData = new FormData();
  formData.append("arquivo", file);
  if (unidadePadraoId) {
    formData.append("unidadePadraoId", String(unidadePadraoId));
  }

  const response = await safeFetch(`${API_BASE_URL}/importar-geafin`, {
    method: "POST",
    body: formData,
    signal: opts.signal,
  });
  return parseResponse(response);
}

/**
 * Cria sessao GEAFIN em modo previa (v2).
 * @param {File} file Arquivo CSV.
 * @param {{modoImportacao?: "INCREMENTAL"|"TOTAL", escopoTipo?: "GERAL"|"UNIDADE", unidadeEscopoId?: number|null, unidadePadraoId?: number|null}} payload Configuracao da sessao.
 * @param {{signal?: AbortSignal}=} opts Opcoes.
 * @returns {Promise<{requestId:string, importacao:any}>} Sessao criada.
 */
export async function criarSessaoImportacaoGeafin(file, payload = {}, opts = {}) {
  const formData = new FormData();
  formData.append("arquivo", file);
  const modoImportacao = String(payload?.modoImportacao || "INCREMENTAL").toUpperCase();
  const escopoTipo = String(payload?.escopoTipo || "GERAL").toUpperCase();
  formData.append("modoImportacao", modoImportacao);
  formData.append("escopoTipo", escopoTipo);
  if (payload?.unidadeEscopoId != null) formData.append("unidadeEscopoId", String(payload.unidadeEscopoId));
  if (payload?.unidadePadraoId != null) formData.append("unidadePadraoId", String(payload.unidadePadraoId));

  const response = await safeFetch(`${API_BASE_URL}/importacoes/geafin/sessoes`, {
    method: "POST",
    body: formData,
    signal: opts.signal,
  });
  return parseResponse(response);
}

/**
 * Consulta uma sessao GEAFIN por id (v2).
 * @param {string} id UUID da sessao.
 * @returns {Promise<{requestId:string, importacao:any}>}
 */
export async function getImportacaoGeafinSessao(id) {
  const response = await safeFetch(`${API_BASE_URL}/importacoes/geafin/${encodeURIComponent(id)}`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  return parseResponse(response);
}

/**
 * Lista acoes planejadas de uma sessao GEAFIN (v2).
 * @param {string} id UUID da sessao.
 * @param {{limit?:number, offset?:number, tipoAcao?:string, decisao?:string, q?:string}} params Filtros/paginacao.
 * @returns {Promise<{requestId:string, paging:any, items:any[]}>}
 */
export async function listarAcoesImportacaoGeafin(id, params = {}) {
  const usp = new URLSearchParams();
  if (params.limit != null) usp.set("limit", String(params.limit));
  if (params.offset != null) usp.set("offset", String(params.offset));
  if (params.tipoAcao) usp.set("tipoAcao", String(params.tipoAcao));
  if (params.decisao) usp.set("decisao", String(params.decisao));
  if (params.q) usp.set("q", String(params.q));
  const suffix = usp.toString() ? `?${usp.toString()}` : "";
  const response = await safeFetch(`${API_BASE_URL}/importacoes/geafin/${encodeURIComponent(id)}/acoes${suffix}`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  return parseResponse(response);
}

/**
 * Define decisao para uma acao individual (v2, incremental).
 * @param {string} id UUID da sessao.
 * @param {string} acaoId UUID da acao.
 * @param {"APROVADA"|"REJEITADA"} decisao Decisao.
 * @returns {Promise<{requestId:string, acao:any}>}
 */
export async function decidirAcaoImportacaoGeafin(id, acaoId, decisao) {
  const response = await safeFetch(
    `${API_BASE_URL}/importacoes/geafin/${encodeURIComponent(id)}/acoes/${encodeURIComponent(acaoId)}/decisao`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ decisao }),
    },
  );
  return parseResponse(response);
}

/**
 * Define decisao em lote para acoes da sessao (v2, incremental).
 * @param {string} id UUID da sessao.
 * @param {{decisao:"APROVADA"|"REJEITADA", tipoAcao?:string, q?:string, somentePendentes?:boolean}} payload Configuracao.
 * @returns {Promise<{requestId:string, atualizados:number, decisao:string}>}
 */
export async function decidirAcoesLoteImportacaoGeafin(id, payload) {
  const response = await safeFetch(`${API_BASE_URL}/importacoes/geafin/${encodeURIComponent(id)}/acoes/decisao-lote`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload || {}),
  });
  return parseResponse(response);
}

/**
 * Aplica sessao GEAFIN (v2).
 * @param {string} id UUID da sessao.
 * @param {{adminPassword:string, confirmText?:string, acaoAusentes?: "MANTER"|"BAIXAR", keepDays?:number}} payload Confirmacoes.
 * @returns {Promise<{requestId:string, message:string, resumo:any, importacao:any}>}
 */
export async function aplicarImportacaoGeafinSessao(id, payload) {
  const response = await safeFetch(`${API_BASE_URL}/importacoes/geafin/${encodeURIComponent(id)}/aplicar`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload || {}),
  });
  return parseResponse(response);
}

/**
 * Cancela sessao GEAFIN (v2).
 * @param {string} id UUID da sessao.
 * @param {string=} motivo Motivo opcional.
 * @returns {Promise<{requestId:string, importacao:any}>}
 */
export async function cancelarImportacaoGeafinSessao(id, motivo) {
  const response = await safeFetch(`${API_BASE_URL}/importacoes/geafin/${encodeURIComponent(id)}/cancelar`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ motivo }),
  });
  return parseResponse(response);
}

/**
 * Consulta progresso da ultima importacao GEAFIN (para barra de progresso).
 * @returns {Promise<{requestId: string, importacao: object}>} Estado da ultima importacao.
 */
export async function getUltimaImportacaoGeafin() {
  const response = await safeFetch(`${API_BASE_URL}/importacoes/geafin/ultimo`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  return parseResponse(response);
}

/**
 * Cancela importacao GEAFIN (ADMIN).
 * @param {string} id UUID da importacao (geafin_import_arquivos.id).
 * @param {string=} motivo Texto opcional.
 * @returns {Promise<{requestId: string, importacao: any}>} Importacao atualizada.
 */
export async function cancelarImportacaoGeafin(id, motivo) {
  const response = await safeFetch(`${API_BASE_URL}/importacoes/geafin/${encodeURIComponent(id)}/cancelar`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ motivo }),
  });
  return parseResponse(response);
}

/**
 * Solicita movimentacao de bem no backend.
 * @param {object} payload Payload conforme contrato de /movimentar.
 * @returns {Promise<object>} Resultado da movimentacao.
 */
export async function movimentarBem(payload) {
  const response = await safeFetch(`${API_BASE_URL}/movimentar`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });
  return parseResponse(response);
}

/**
 * Lista documentos/evidencias (metadados) associados a movimentacoes/contagens/avaliacoes.
 * @param {{movimentacaoId?: string, contagemId?: string, avaliacaoInservivelId?: string}} filters Filtros.
 * @returns {Promise<{requestId: string, items: any[]}>} Lista de documentos.
 */
export async function listarDocumentos(filters = {}) {
  const params = new URLSearchParams();
  if (filters.movimentacaoId) params.set("movimentacaoId", String(filters.movimentacaoId));
  if (filters.contagemId) params.set("contagemId", String(filters.contagemId));
  if (filters.avaliacaoInservivelId) params.set("avaliacaoInservivelId", String(filters.avaliacaoInservivelId));
  const suffix = params.toString() ? `?${params.toString()}` : "";

  const response = await safeFetch(`${API_BASE_URL}/documentos${suffix}`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  return parseResponse(response);
}

/**
 * Registra metadados de documento (Drive/PDF) para auditoria.
 * Endpoint restrito a ADMIN quando autenticacao estiver ativa.
 * @param {object} payload Payload.
 * @returns {Promise<{requestId: string, documento: object}>} Documento criado.
 */
export async function criarDocumento(payload) {
  const response = await safeFetch(`${API_BASE_URL}/documentos`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });
  return parseResponse(response);
}

/**
 * Lista ocorrencias de bens de terceiros registradas no inventario (controle segregado).
 * @param {{eventoInventarioId?: string, salaEncontrada?: string, limit?: number}} params Filtros.
 * @returns {Promise<{requestId: string, items: any[]}>} Lista de bens de terceiros.
 */
export async function listarBensTerceirosInventario(params = {}) {
  const usp = new URLSearchParams();
  if (params.eventoInventarioId) usp.set("eventoInventarioId", String(params.eventoInventarioId));
  if (params.salaEncontrada) usp.set("salaEncontrada", String(params.salaEncontrada));
  if (params.limit != null) usp.set("limit", String(params.limit));

  const suffix = usp.toString() ? `?${usp.toString()}` : "";
  const response = await safeFetch(`${API_BASE_URL}/inventario/bens-terceiros${suffix}`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  return parseResponse(response);
}

/**
 * Cria avaliacao de inservivel via Wizard do Art. 141 (persistencia no backend).
 * Endpoint restrito a ADMIN quando autenticacao estiver ativa.
 * @param {object} payload Dados da avaliacao.
 * @returns {Promise<object>} Avaliacao criada.
 */
export async function criarAvaliacaoInservivel(payload) {
  const response = await safeFetch(`${API_BASE_URL}/inserviveis/avaliacoes`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });
  return parseResponse(response);
}

/**
 * Lista historico de avaliacoes de inservivel por bem.
 * @param {string} bemId UUID do bem.
 * @returns {Promise<object>} Lista de avaliacoes.
 */
export async function listarAvaliacoesInservivel(bemId) {
  const params = new URLSearchParams();
  params.set("bemId", String(bemId));
  const response = await safeFetch(`${API_BASE_URL}/inserviveis/avaliacoes?${params.toString()}`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  return parseResponse(response);
}

/**
 * Lista locais padronizados (salas).
 * @param {{unidadeId?: number}} filters Filtros.
 * @returns {Promise<object>} Lista de locais.
 */
export async function listarLocais(filters = {}) {
  const params = new URLSearchParams();
  if (filters.unidadeId) params.set("unidadeId", String(filters.unidadeId));
  if (filters.includeInativos) params.set("includeInativos", "true");
  const suffix = params.toString() ? `?${params.toString()}` : "";
  const response = await safeFetch(`${API_BASE_URL}/locais${suffix}`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  return parseResponse(response);
}

/**
 * Cria/atualiza um local (sala) padronizado.
 * Endpoint restrito a ADMIN quando autenticacao estiver ativa.
 *
 * @param {{nome: string, unidadeId?: number|null, tipo?: string|null, observacoes?: string|null}} payload
 * @returns {Promise<{requestId: string, local: any}>} Local criado/atualizado.
 */
export async function criarLocal(payload) {
  const response = await safeFetch(`${API_BASE_URL}/locais`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload || {}),
  });
  return parseResponse(response);
}

/**
 * Atualiza local por id (ADMIN).
 * @param {string} id UUID do local.
 * @param {object} patch Campos parciais.
 * @returns {Promise<{requestId: string, local: any}>} Local atualizado.
 */
export async function atualizarLocal(id, patch) {
  const response = await safeFetch(`${API_BASE_URL}/locais/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(patch || {}),
  });
  return parseResponse(response);
}

/**
 * Vincula (em lote) bens a um local cadastrado (bens.local_id) usando filtro por local_fisico (texto GEAFIN).
 * Endpoint restrito a ADMIN quando autenticacao estiver ativa.
 *
 * @param {{ localId: string, termoLocalFisico: string, somenteSemLocalId?: boolean, unidadeDonaId?: number, dryRun?: boolean }} payload
 * @returns {Promise<{requestId: string, dryRun: boolean, totalAlvo: number, atualizados?: number, exemplo: any[]}>}
 */
export async function vincularBensAoLocal(payload) {
  const response = await safeFetch(`${API_BASE_URL}/bens/vincular-local`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload || {}),
  });
  return parseResponse(response);
}

/**
 * Cria/atualiza local padronizado (ADMIN).
 * @param {object} payload Dados do local.
 * @returns {Promise<object>} Local criado/atualizado.
 */
export async function salvarLocal(payload) {
  const response = await safeFetch(`${API_BASE_URL}/locais`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });
  return parseResponse(response);
}

/**
 * Atualiza dados operacionais do bem (local/foto) (ADMIN).
 * @param {string} bemId UUID do bem.
 * @param {object} payload Campos operacionais.
 * @returns {Promise<object>} Bem atualizado.
 */
export async function atualizarBemOperacional(bemId, payload) {
  const response = await safeFetch(`${API_BASE_URL}/bens/${encodeURIComponent(bemId)}/operacional`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });
  return parseResponse(response);
}



/**
 * Upload de foto para VPS com otimizacao automatica (WebP, max 1200px) (ADMIN).
 * @param {{target: 'BEM'|'CATALOGO', id: string, base64Data: string, filename?: string, mimeType?: string}} payload Payload.
 * @returns {Promise<object>} Resposta com fotoUrl e entidade atualizada.
 */
export async function uploadFoto(payload) {
  const response = await safeFetch(`${API_BASE_URL}/fotos/upload`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload || {}),
  });
  return parseResponse(response);
}

/**
 * Lista eventos de inventario.
 * @param {string=} status Filtra por status (ex.: EM_ANDAMENTO).
 * @returns {Promise<object>} Lista de eventos.
 */
export async function listarEventosInventario(status) {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  const suffix = params.toString() ? `?${params.toString()}` : "";
  const response = await safeFetch(`${API_BASE_URL}/inventario/eventos${suffix}`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  return parseResponse(response);
}

/**
 * Consulta o progresso de itens por sala para um evento especifico.
 * @param {string} eventoId UUID do evento.
 * @returns {Promise<{items: Array<{salaEncontrada: string, qtdEsperados: number, qtdInventariados: number}>}>} Progresso agrupado.
 */
export async function getProgressoInventario(eventoId) {
  const response = await safeFetch(`${API_BASE_URL}/inventario/eventos/${encodeURIComponent(eventoId)}/progresso`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  return parseResponse(response);
}

/**
 * Cria um evento de inventario (EM_ANDAMENTO), incluindo modo ciclico e modo de contagem.
 * @param {{codigoEvento: string, unidadeInventariadaId?: number|null, tipoCiclo?: "SEMANAL"|"MENSAL"|"ANUAL"|"ADHOC", escopoTipo?: "GERAL"|"UNIDADE"|"LOCAIS", escopoLocalIds?: string[], modoContagem?: "PADRAO"|"CEGO"|"DUPLO_CEGO", operadoresDesignados?: Array<{perfilId:string,papelContagem:"OPERADOR_UNICO"|"OPERADOR_A"|"OPERADOR_B",permiteDesempate?:boolean}>, abertoPorPerfilId: string, observacoes?: string}} payload Payload.
 * @returns {Promise<object>} Evento criado.
 */
export async function criarEventoInventario(payload) {
  const response = await safeFetch(`${API_BASE_URL}/inventario/eventos`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });
  return parseResponse(response);
}

/**
 * Solicita movimentacao em lote no backend.
 * @param {object} payload Payload conforme contrato de /movimentar/lote.
 * @returns {Promise<object>} Resultado consolidado do lote.
 */
export async function movimentarBemLote(payload) {
  const response = await safeFetch(`${API_BASE_URL}/movimentar/lote`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });
  return parseResponse(response);
}

/**
 * Lista solicitacoes de aprovacao administrativa.
 * @param {{status?:string, tipoAcao?:string, solicitantePerfilId?:string, limit?:number, offset?:number}} filters Filtros.
 * @returns {Promise<{requestId:string, paging:{limit:number,offset:number,total:number}, items:any[]}>}
 */
export async function listarSolicitacoesAprovacao(filters = {}) {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", String(filters.status));
  if (filters.tipoAcao) params.set("tipoAcao", String(filters.tipoAcao));
  if (filters.solicitantePerfilId) params.set("solicitantePerfilId", String(filters.solicitantePerfilId));
  if (filters.limit != null) params.set("limit", String(filters.limit));
  if (filters.offset != null) params.set("offset", String(filters.offset));
  const suffix = params.toString() ? `?${params.toString()}` : "";
  const response = await safeFetch(`${API_BASE_URL}/aprovacoes/solicitacoes${suffix}`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  return parseResponse(response);
}

/**
 * Lista roles de acesso RBAC (ADMIN).
 * @returns {Promise<{requestId:string,items:{id:string,codigo:string,nome:string,nivel:number,ativo:boolean}[]}>}
 */
export async function listarRolesAcesso() {
  const response = await safeFetch(`${API_BASE_URL}/roles-acesso`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  return parseResponse(response);
}

/**
 * Consulta matriz RBAC (roles, permissoes e vinculos role-permissao).
 * @returns {Promise<{requestId:string,roles:any[],permissions:any[],rolePermissions:Record<string,string[]>}>}
 */
export async function listarAclMatriz() {
  const response = await safeFetch(`${API_BASE_URL}/acl/matriz`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  return parseResponse(response);
}

/**
 * Atualiza permissoes de uma role RBAC (ADMIN + senha).
 * @param {string} roleCodigo Codigo da role.
 * @param {string[]} permissions Lista de codigos de permissao.
 * @param {string} adminPassword Senha do administrador autenticado.
 * @returns {Promise<{requestId:string,roleCodigo:string,permissions:string[],message:string}>}
 */
export async function atualizarRolePermissoes(roleCodigo, permissions, adminPassword) {
  const response = await safeFetch(`${API_BASE_URL}/roles-acesso/${encodeURIComponent(roleCodigo)}/permissoes`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      permissions: Array.isArray(permissions) ? permissions : [],
      adminPassword: adminPassword || "",
    }),
  });
  return parseResponse(response);
}

/**
 * Aprova solicitacao pendente.
 * @param {string} id UUID da solicitacao.
 * @param {{adminPassword:string, justificativaAdmin?:string}} payload Dados de aprovacao.
 * @returns {Promise<object>}
 */
export async function aprovarSolicitacaoAprovacao(id, payload) {
  const response = await safeFetch(`${API_BASE_URL}/aprovacoes/solicitacoes/${encodeURIComponent(id)}/aprovar`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload || {}),
  });
  return parseResponse(response);
}

/**
 * Reprova solicitacao pendente.
 * @param {string} id UUID da solicitacao.
 * @param {{adminPassword:string, justificativaAdmin:string}} payload Dados de reprovacao.
 * @returns {Promise<object>}
 */
export async function reprovarSolicitacaoAprovacao(id, payload) {
  const response = await safeFetch(`${API_BASE_URL}/aprovacoes/solicitacoes/${encodeURIComponent(id)}/reprovar`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload || {}),
  });
  return parseResponse(response);
}

/**
 * Consulta contexto de contagem para o usuario autenticado em um evento.
 * @param {string} eventoId UUID do evento.
 * @returns {Promise<{modoContagem:string, papel:string|null, rodadasPermitidas:string[], podeDesempate:boolean, uiReduzida:boolean, designado:boolean}>}
 */
export async function getMinhaSessaoContagemInventario(eventoId) {
  const response = await safeFetch(`${API_BASE_URL}/inventario/eventos/${encodeURIComponent(eventoId)}/minha-sessao-contagem`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  return parseResponse(response);
}

/**
 * Painel administrativo de monitoramento da contagem.
 * @param {string} eventoId UUID do evento.
 * @returns {Promise<object>} Dados consolidados por sala/rodada.
 */
export async function getMonitoramentoContagemInventario(eventoId) {
  const response = await safeFetch(`${API_BASE_URL}/inventario/eventos/${encodeURIComponent(eventoId)}/monitoramento-contagem`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  return parseResponse(response);
}

/**
 * Sugestoes de salas para proximo ciclo de inventario.
 * @param {{unidadeId?: number, somenteAtivos?: boolean, limit?: number, offset?: number}} params Parametros.
 * @returns {Promise<{requestId: string, paging: {limit:number, offset:number, total:number}, items: any[]}>}
 */
export async function listarSugestoesCicloInventario(params = {}) {
  const usp = new URLSearchParams();
  if (params.unidadeId) usp.set("unidadeId", String(params.unidadeId));
  if (params.somenteAtivos === false) usp.set("somenteAtivos", "false");
  if (params.limit != null) usp.set("limit", String(params.limit));
  if (params.offset != null) usp.set("offset", String(params.offset));
  const suffix = usp.toString() ? `?${usp.toString()}` : "";
  const response = await safeFetch(`${API_BASE_URL}/inventario/sugestoes-ciclo${suffix}`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  return parseResponse(response);
}

/**
 * Consulta indicadores operacionais de acuracidade do inventario por periodo.
 * @param {{dataInicio: string, dataFim: string, unidadeId?: number, statusEvento?: "EM_ANDAMENTO"|"ENCERRADO"|"CANCELADO", toleranciaPct?: number}} params Parametros.
 * @returns {Promise<object>} Consolidado com resumo, por evento/sala e series semanal/mensal.
 */
export async function getIndicadoresAcuracidadeInventario(params = {}) {
  const dataInicio = String(params.dataInicio || "").trim();
  const dataFim = String(params.dataFim || "").trim();
  if (!dataInicio) throw new Error("dataInicio obrigatoria.");
  if (!dataFim) throw new Error("dataFim obrigatoria.");

  const usp = new URLSearchParams();
  usp.set("dataInicio", dataInicio);
  usp.set("dataFim", dataFim);
  if (params.unidadeId) usp.set("unidadeId", String(params.unidadeId));
  if (params.statusEvento) usp.set("statusEvento", String(params.statusEvento));
  if (params.toleranciaPct != null) usp.set("toleranciaPct", String(params.toleranciaPct));

  const response = await safeFetch(`${API_BASE_URL}/inventario/indicadores-acuracidade?${usp.toString()}`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  return parseResponse(response);
}

/**
 * Atualiza status do evento de inventario (EM_ANDAMENTO/ENCERRADO/CANCELADO).
 * @param {string} id UUID do evento.
 * @param {{status: "EM_ANDAMENTO"|"ENCERRADO"|"CANCELADO", encerradoPorPerfilId: string, observacoes?: string}} payload Payload.
 * @returns {Promise<object>} Evento atualizado.
 */
export async function atualizarStatusEventoInventario(id, payload) {
  const response = await safeFetch(`${API_BASE_URL}/inventario/eventos/${id}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });
  return parseResponse(response);
}

/**
 * Obtem relatorio detalhado de encerramento do inventario (evento ENCERRADO).
 * @param {string} id UUID do evento.
 * @returns {Promise<object>} Relatorio consolidado.
 */
export async function getRelatorioEncerramentoInventario(id) {
  const response = await safeFetch(`${API_BASE_URL}/inventario/eventos/${encodeURIComponent(id)}/relatorio-encerramento`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  return parseResponse(response);
}

/**
 * Faz download do CSV editavel do relatorio de encerramento do inventario.
 * @param {string} id UUID do evento.
 * @returns {Promise<{blob: Blob, filename: string}>} Arquivo CSV.
 */
export async function baixarRelatorioEncerramentoInventarioCsv(id) {
  const response = await safeFetch(`${API_BASE_URL}/inventario/eventos/${encodeURIComponent(id)}/relatorio-encerramento.csv`, {
    method: "GET",
    headers: { Accept: "text/csv,application/octet-stream,*/*" },
  });
  if (!response.ok) throw await createHttpError(response);
  const blob = await response.blob();
  const cd = response.headers.get("content-disposition") || "";
  const match = cd.match(/filename=\"?([^\";]+)\"?/i);
  return { blob, filename: match ? String(match[1]) : "relatorio_encerramento.csv" };
}

/**
 * Atualiza dados gerais do evento de inventario (codigo, unidade, observacoes).
 * @param {string} id UUID do evento.
 * @param {{codigoEvento?: string, unidadeInventariadaId?: number|null, observacoes?: string}} payload Payload.
 * @returns {Promise<object>} Evento atualizado.
 */
export async function atualizarEventoInventario(id, payload) {
  const response = await safeFetch(`${API_BASE_URL}/inventario/eventos/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });
  return parseResponse(response);
}

/**
 * Exclui um evento de inventario e em cascata suas contagens (forasteiros).
 * @param {string} id UUID do evento.
 * @returns {Promise<object>}
 */
export async function excluirEventoInventario(id) {
  const response = await safeFetch(`${API_BASE_URL}/inventario/eventos/${id}`, {
    method: "DELETE",
    headers: { Accept: "application/json" },
  });
  return parseResponse(response);
}

/**
 * Sincroniza contagens do inventario (offline-first).
 * @param {object} payload Payload conforme contrato de /inventario/sync.
 * @returns {Promise<object>} Resumo do sync.
 */
export async function syncInventario(payload) {
  const response = await safeFetch(`${API_BASE_URL}/inventario/sync`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });
  return parseResponse(response);
}

/**
 * Lista contagens de inventario por evento (e opcionalmente por sala).
 * @param {{eventoInventarioId: string, salaEncontrada?: string, limit?: number}} params Parametros.
 * @returns {Promise<object>} Lista de contagens.
 */
export async function listarContagensInventario(params) {
  const eventoInventarioId = String(params?.eventoInventarioId || "").trim();
  if (!eventoInventarioId) throw new Error("eventoInventarioId e obrigatorio para listar contagens.");

  const usp = new URLSearchParams();
  usp.set("eventoInventarioId", eventoInventarioId);
  if (params?.salaEncontrada) usp.set("salaEncontrada", String(params.salaEncontrada));
  if (params?.limit != null) usp.set("limit", String(params.limit));

  const suffix = usp.toString() ? `?${usp.toString()}` : "";
  const response = await safeFetch(`${API_BASE_URL}/inventario/contagens${suffix}`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  return parseResponse(response);
}

/**
 * Lista divergencias pendentes ("forasteiros") para regularizacao pos-inventario.
 * @param {{eventoInventarioId?: string, salaEncontrada?: string, numeroTombamento?: string, limit?: number}} params Parametros opcionais.
 * @returns {Promise<object>} Lista de divergencias pendentes.
 */
export async function listarForasteirosInventario(params = {}) {
  const usp = new URLSearchParams();
  if (params.eventoInventarioId) usp.set("eventoInventarioId", String(params.eventoInventarioId));
  if (params.salaEncontrada) usp.set("salaEncontrada", String(params.salaEncontrada));
  if (params.numeroTombamento) usp.set("numeroTombamento", String(params.numeroTombamento));
  if (params.limit != null) usp.set("limit", String(params.limit));

  const suffix = usp.toString() ? `?${usp.toString()}` : "";
  const response = await safeFetch(`${API_BASE_URL}/inventario/forasteiros${suffix}`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  return parseResponse(response);
}

/**
 * Lista divergencias interunidades em tempo real para monitoramento da administracao.
 * @param {{statusInventario?: "EM_ANDAMENTO"|"ENCERRADO"|"TODOS", eventoInventarioId?: string, unidadeDonaId?: number, unidadeEncontradaId?: number, unidadeRelacionadaId?: number, limit?: number, offset?: number}} params Filtros opcionais.
 * @returns {Promise<object>} Lista de divergencias com contexto do inventario e regularizacao.
 */
export async function listarDivergenciasInterunidades(params = {}) {
  const usp = new URLSearchParams();
  if (params.statusInventario) usp.set("statusInventario", String(params.statusInventario));
  if (params.eventoInventarioId) usp.set("eventoInventarioId", String(params.eventoInventarioId));
  if (params.unidadeDonaId != null) usp.set("unidadeDonaId", String(params.unidadeDonaId));
  if (params.unidadeEncontradaId != null) usp.set("unidadeEncontradaId", String(params.unidadeEncontradaId));
  if (params.unidadeRelacionadaId != null) usp.set("unidadeRelacionadaId", String(params.unidadeRelacionadaId));
  if (params.limit != null) usp.set("limit", String(params.limit));
  if (params.offset != null) usp.set("offset", String(params.offset));

  const suffix = usp.toString() ? `?${usp.toString()}` : "";
  const response = await safeFetch(`${API_BASE_URL}/inventario/divergencias-interunidades${suffix}`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  return parseResponse(response);
}

/**
 * Regulariza uma divergencia ("forasteiro") apos ENCERRAR o inventario.
 * @param {{contagemId: string, acao: "TRANSFERIR_CARGA"|"MANTER_CARGA"|"ATUALIZAR_LOCAL", regularizadoPorPerfilId: string, termoReferencia?: string, localDestinoId?: string, observacoes?: string}} payload Payload.
 * @returns {Promise<object>} Resultado da regularizacao.
 */
export async function regularizarForasteiro(payload) {
  const response = await safeFetch(`${API_BASE_URL}/inventario/regularizacoes`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });
  return parseResponse(response);
}

/**
 * Regulariza divergencias em lote (sem transferencia direta).
 * @param {{contagemIds: string[], acao: "MANTER_CARGA"|"ATUALIZAR_LOCAL", regularizadoPorPerfilId?: string, localDestinoId?: string, observacoes?: string}} payload
 * @returns {Promise<object>}
 */
export async function regularizarForasteiroLote(payload) {
  const response = await safeFetch(`${API_BASE_URL}/inventario/regularizacoes/lote`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload || {}),
  });
  return parseResponse(response);
}

/**
 * Encaminha divergencias para transferencia formal no menu Movimentacoes.
 * @param {{contagemIds: string[], encaminhadoPorPerfilId?: string, observacoes?: string}} payload
 * @returns {Promise<object>}
 */
export async function encaminharTransferenciaRegularizacao(payload) {
  const response = await safeFetch(`${API_BASE_URL}/inventario/regularizacoes/encaminhar-transferencia`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload || {}),
  });
  return parseResponse(response);
}

/**
 * Lista pendencias de transferencia encaminhadas pela regularizacao.
 * @param {{status?: string, limit?: number, offset?: number}} params
 * @returns {Promise<object>}
 */
export async function listarTransferenciasPendentesRegularizacao(params = {}) {
  const usp = new URLSearchParams();
  if (params.status) usp.set("status", String(params.status));
  if (params.limit != null) usp.set("limit", String(params.limit));
  if (params.offset != null) usp.set("offset", String(params.offset));
  const suffix = usp.toString() ? `?${usp.toString()}` : "";
  const response = await safeFetch(`${API_BASE_URL}/inventario/regularizacoes/transferencias-pendentes${suffix}`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  return parseResponse(response);
}

/**
 * Conclui regularizacao de transferencias formalizadas.
 * @param {{itens: Array<{contagemId:string,movimentacaoId:string}>, regularizadoPorPerfilId?: string, observacoes?: string}} payload
 * @returns {Promise<object>}
 */
export async function concluirTransferenciasRegularizacao(payload) {
  const response = await safeFetch(`${API_BASE_URL}/inventario/regularizacoes/concluir-transferencias`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload || {}),
  });
  return parseResponse(response);
}

export { API_BASE_URL };
