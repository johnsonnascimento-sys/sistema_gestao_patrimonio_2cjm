/**
 * Modulo: frontend/services
 * Arquivo: apiClient.js
 * Funcao no sistema: cliente HTTP para integracao da UI com o backend Node.js.
 */
const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL || "http://localhost:3001").replace(/\/+$/, "");

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
 * Lista/consulta bens com paginacao.
 * @param {object} filters Filtros opcionais.
 * @param {string=} filters.numeroTombamento Tombamento exato (10 digitos).
 * @param {string=} filters.q Texto parcial para descricao.
 * @param {string=} filters.localFisico Texto parcial para filtrar por local_fisico (inventario/sala).
 * @param {string=} filters.localId UUID do local cadastrado (tabela locais) vinculado ao bem.
 * @param {number=} filters.unidadeDonaId Unidade 1..4.
 * @param {string=} filters.status OK|BAIXADO|EM_CAUTELA|AGUARDANDO_RECEBIMENTO.
 * @param {number=} filters.limit Limite (1..200).
 * @param {number=} filters.offset Offset (>=0).
 * @param {boolean=} filters.incluirTerceiros Incluir bens de terceiros.
 * @returns {Promise<object>} Resultado com paging e items.
 */
export async function listarBens(filters = {}) {
  const params = new URLSearchParams();
  if (filters.numeroTombamento) params.set("numeroTombamento", filters.numeroTombamento);
  if (filters.q) params.set("q", filters.q);
  if (filters.localFisico) params.set("localFisico", filters.localFisico);
  if (filters.localId) params.set("localId", String(filters.localId));
  if (filters.unidadeDonaId) params.set("unidadeDonaId", String(filters.unidadeDonaId));
  if (filters.status) params.set("status", filters.status);
  if (filters.limit != null) params.set("limit", String(filters.limit));
  if (filters.offset != null) params.set("offset", String(filters.offset));
  if (filters.incluirTerceiros) params.set("incluirTerceiros", "true");

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
 * Cria perfil (necessario para autorizar/executar movimentacoes).
 * @param {object} payload Dados do perfil.
 * @param {string} payload.matricula Matricula unica.
 * @param {string} payload.nome Nome completo.
 * @param {string=} payload.email Email opcional.
 * @param {number} payload.unidadeId Unidade 1..4.
 * @param {string=} payload.cargo Cargo opcional.
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
 * Atualiza foto de referencia do catalogo (ADMIN).
 * @param {string} catalogoBemId UUID do catalogo.
 * @param {string} fotoReferenciaUrl URL.
 * @returns {Promise<object>} Catalogo atualizado.
 */
export async function atualizarFotoCatalogo(catalogoBemId, fotoReferenciaUrl) {
  const response = await safeFetch(`${API_BASE_URL}/catalogo-bens/${encodeURIComponent(catalogoBemId)}/foto`, {
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
 * Cria um evento de inventario (EM_ANDAMENTO).
 * @param {{codigoEvento: string, unidadeInventariadaId: number|null, abertoPorPerfilId: string, observacoes?: string}} payload Payload.
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
 * Atualiza status do evento de inventario (ENCERRADO/CANCELADO).
 * @param {string} id UUID do evento.
 * @param {{status: "ENCERRADO"|"CANCELADO", encerradoPorPerfilId: string, observacoes?: string}} payload Payload.
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
 * Regulariza uma divergencia ("forasteiro") apos ENCERRAR o inventario.
 * @param {{contagemId: string, acao: "TRANSFERIR_CARGA"|"MANTER_CARGA", regularizadoPorPerfilId: string, termoReferencia?: string, observacoes?: string}} payload Payload.
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

export { API_BASE_URL };
