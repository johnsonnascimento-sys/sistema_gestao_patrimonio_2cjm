/**
 * Modulo: frontend/services
 * Arquivo: apiClient.js
 * Funcao no sistema: cliente HTTP para integracao da UI com o backend Node.js.
 */
const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL || "http://localhost:3001").replace(/\/+$/, "");

async function safeFetch(url, init) {
  try {
    return await fetch(url, init);
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
 * Envia arquivo CSV GEAFIN para importacao com upsert seguro.
 * @param {File} file Arquivo CSV selecionado.
 * @param {number|null} unidadePadraoId Unidade fallback opcional.
 * @returns {Promise<object>} Resumo da importacao.
 */
export async function importarGeafin(file, unidadePadraoId) {
  const formData = new FormData();
  formData.append("arquivo", file);
  if (unidadePadraoId) {
    formData.append("unidadePadraoId", String(unidadePadraoId));
  }

  const response = await safeFetch(`${API_BASE_URL}/importar-geafin`, {
    method: "POST",
    body: formData,
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

export { API_BASE_URL };
