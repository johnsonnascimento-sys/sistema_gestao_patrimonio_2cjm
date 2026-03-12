/**
 * Modulo: frontend/components/assets
 * Arquivo: AssetsExplorerDetailModal.jsx
 * Funcao no sistema: exibir e editar os detalhes completos de um bem a partir da consulta.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  atualizarBem,
  atualizarFotoCatalogo,
  buscarPerfisDetentor,
  getBemAuditoria,
  getFotoUrl,
  listarCatalogos,
  listarLocais,
  reverterBemAuditoria,
  uploadFoto,
} from "../../services/apiClient.js";
import { getBemStatusMeta } from "./assetStatusPresentation.js";

function formatUnidade(id) {
  if (id === 1) return "1 (1a Aud)";
  if (id === 2) return "2 (2a Aud)";
  if (id === 3) return "3 (Foro)";
  if (id === 4) return "4 (Almox)";
  return String(id || "");
}

export default function AssetsExplorerDetailModal({ state, onClose, onReload, isAdmin }) {
  const imp = state?.data?.bem || null;
  const catalogo = state?.data?.catalogo || null;
  const movs = state?.data?.movimentacoes || [];
  const baixaPatrimonialResumo = state?.data?.baixaPatrimonialResumo || null;
  const divergenciaPendente = imp?.divergenciaPendente || state?.data?.divergenciaPendente || null;
  const statusMeta = getBemStatusMeta({
    ...imp,
    baixaPatrimonialResumo,
    marcacaoAtual: state?.data?.marcacaoAtual || null,
  });
  const cautelaAtual = useMemo(() => {
    if (String(imp?.status || "").toUpperCase() !== "EM_CAUTELA") return null;
    return movs.find((m) => String(m?.tipoMovimentacao || "").toUpperCase() === "CAUTELA_SAIDA") || null;
  }, [imp?.status, movs]);

  const formatDateTime = (raw) => {
    if (!raw) return "-";
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return String(raw);
    return d.toLocaleString();
  };
  const extractSalaChange = (justificativa) => {
    const s = String(justificativa || "");
    const m = s.match(/Antes:\s*(.+?)\.\s*Depois:\s*(.+?)(?:\.|$)/i);
    if (!m) return null;
    return { antes: String(m[1] || "").trim(), depois: String(m[2] || "").trim() };
  };
  const movementChangeSummary = (m) => {
    const out = [];
    const origem = Number(m?.unidadeOrigemId);
    const destino = Number(m?.unidadeDestinoId);
    if (Number.isInteger(origem) && Number.isInteger(destino) && origem !== destino) {
      out.push(`Unidade: ${formatUnidade(origem)} -> ${formatUnidade(destino)}`);
    }
    const sala = extractSalaChange(m?.justificativa);
    if (sala) {
      out.push(`Endereço: ${sala.antes || "-"} -> ${sala.depois || "-"}`);
    } else if (String(m?.tipoMovimentacao || "").toUpperCase() === "REGULARIZACAO_INVENTARIO" && m?.regularizacaoSalaEncontrada) {
      out.push(`Endereço regularizado: ${m.regularizacaoSalaEncontrada}`);
    }
    return out.length ? out.join(" | ") : "Sem detalhe de alteracao";
  };
  const profileLabel = (nome, matricula, id) => {
    if (nome && matricula) return `${nome} (${matricula})`;
    if (nome) return nome;
    if (matricula) return `Matricula ${matricula}`;
    return id || "-";
  };
  const extractCautelaDestino = (justificativa) => {
    const s = String(justificativa || "");
    const m = s.match(/\[CAUTELA_DESTINO=(EXTERNO|SALA:([^\]]+))\]/i);
    if (!m) return null;
    if (String(m[1] || "").toUpperCase() === "EXTERNO") return { tipo: "EXTERNO", label: "Externo" };
    return { tipo: "SALA", label: String(m[2] || "").trim() || "-" };
  };

  const editBaseState = useMemo(() => ({
    catalogoBemId: imp?.catalogoBemId || "",
    unidadeDonaId: imp?.unidadeDonaId ? String(imp.unidadeDonaId) : "",
    nomeResumo: imp?.nomeResumo || "",
    status: imp?.status || "",
    descricaoComplementar: imp?.descricaoComplementar || "",
    responsavelPerfilId: imp?.responsavelPerfilId || "",
    contratoReferencia: imp?.contratoReferencia || "",
    dataAquisicao: imp?.dataAquisicao ? String(imp.dataAquisicao).slice(0, 10) : "",
    valorAquisicao: imp?.valorAquisicao != null ? String(imp.valorAquisicao) : "",
    observacoes: imp?.observacoes || "",
    localId: imp?.localId || "",
    fotoUrl: imp?.fotoUrl || "",
    fotoReferenciaUrl: catalogo?.fotoReferenciaUrl || "",
  }), [
    catalogo?.fotoReferenciaUrl,
    imp?.catalogoBemId,
    imp?.contratoReferencia,
    imp?.dataAquisicao,
    imp?.descricaoComplementar,
    imp?.fotoUrl,
    imp?.localId,
    imp?.nomeResumo,
    imp?.observacoes,
    imp?.responsavelPerfilId,
    imp?.status,
    imp?.unidadeDonaId,
    imp?.valorAquisicao,
  ]);
  const [edit, setEdit] = useState(editBaseState);
  const [editMsg, setEditMsg] = useState(null);
  const [editErr, setEditErr] = useState(null);
  const [uploadState, setUploadState] = useState({ loading: false, error: null });
  const itemFileRef = useRef(null);
  const itemCameraRef = useRef(null);
  const catalogFileRef = useRef(null);
  const catalogCameraRef = useRef(null);

  useEffect(() => {
    setEdit(editBaseState);
    setEditMsg(null);
    setEditErr(null);
    setUploadState({ loading: false, error: null });
  }, [editBaseState, imp?.id, catalogo?.id]);

  const locaisQuery = useQuery({
    queryKey: ["locais", "todos"],
    enabled: Boolean(imp?.id),
    queryFn: async () => {
      const data = await listarLocais({});
      return data.items || [];
    },
  });

  const locaisOptions = useMemo(() => {
    return (locaisQuery.data || [])
      .filter((l) => l.ativo !== false)
      .sort((a, b) => {
        const ua = Number(a?.unidadeId || 0);
        const ub = Number(b?.unidadeId || 0);
        if (ua !== ub) return ua - ub;
        return String(a?.nome || "").localeCompare(String(b?.nome || ""), "pt-BR", {
          sensitivity: "base",
        });
      });
  }, [locaisQuery.data]);
  const cautelaDestinoAtual = useMemo(
    () => extractCautelaDestino(cautelaAtual?.justificativa),
    [cautelaAtual?.justificativa],
  );
  const salaPadronizadaAtual = useMemo(() => {
    const localId = String(imp?.localId || "").trim();
    if (localId) {
      const found = (locaisQuery.data || []).find((l) => String(l.id) === localId);
      if (found?.nome) return found.nome;
      return localId;
    }
    if (String(imp?.status || "").toUpperCase() === "EM_CAUTELA" && cautelaDestinoAtual?.tipo === "EXTERNO") {
      return "Externo";
    }
    if (String(imp?.localFisico || "").trim().toUpperCase() === "EXTERNO") return "Externo";
    return "-";
  }, [imp?.localId, imp?.status, imp?.localFisico, locaisQuery.data, cautelaDestinoAtual?.tipo]);
  const [expandedMovId, setExpandedMovId] = useState(null);
  const [materialCodigoBusca, setMaterialCodigoBusca] = useState("");
  const [materialBuscaState, setMaterialBuscaState] = useState({
    loading: false,
    error: null,
    candidato: null,
  });

  const [responsavelBusca, setResponsavelBusca] = useState("");
  const [responsavelLookupState, setResponsavelLookupState] = useState({ loading: false, error: null, data: [] });
  const [responsavelSelecionado, setResponsavelSelecionado] = useState(null);
  const [responsavelInputFocusedModal, setResponsavelInputFocusedModal] = useState(false);

  useEffect(() => {
    setMaterialCodigoBusca(String(catalogo?.codigoCatalogo || ""));
    setMaterialBuscaState({ loading: false, error: null, candidato: null });
  }, [catalogo?.codigoCatalogo, imp?.id]);

  useEffect(() => {
    const r = state?.data?.responsavel || null;
    setResponsavelSelecionado(r);
    const label = r?.matricula
      ? `${r.matricula}${r?.nome ? ` - ${r.nome}` : ""}`
      : (r?.nome || "");
    setResponsavelBusca(label);
    setResponsavelLookupState({ loading: false, error: null, data: [] });
  }, [state?.data?.responsavel, imp?.id]);

  useEffect(() => {
    const q = String(responsavelBusca || "").trim();
    if (q.length < 2) {
      setResponsavelLookupState({ loading: false, error: null, data: [] });
      return;
    }
    let active = true;
    setResponsavelLookupState((prev) => ({ ...prev, loading: true, error: null }));
    const timer = window.setTimeout(async () => {
      try {
        const data = await buscarPerfisDetentor({ q, limit: 20 });
        if (!active) return;
        setResponsavelLookupState({ loading: false, error: null, data: data?.items || [] });
      } catch (e) {
        if (!active) return;
        setResponsavelLookupState({ loading: false, error: String(e?.message || "Falha ao buscar responsavel."), data: [] });
      }
    }, 150);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [responsavelBusca]);

  const hasUnsavedChanges = useMemo(() => {
    if (!isAdmin || !imp) return false;
    const normalize = (v) => (v == null ? "" : String(v));
    const serialize = (obj) =>
      JSON.stringify({
        catalogoBemId: normalize(obj.catalogoBemId),
        unidadeDonaId: normalize(obj.unidadeDonaId),
        nomeResumo: normalize(obj.nomeResumo),
        status: normalize(obj.status),
        descricaoComplementar: normalize(obj.descricaoComplementar),
        responsavelPerfilId: normalize(obj.responsavelPerfilId),
        contratoReferencia: normalize(obj.contratoReferencia),
        dataAquisicao: normalize(obj.dataAquisicao),
        valorAquisicao: normalize(obj.valorAquisicao),
        observacoes: normalize(obj.observacoes),
        localId: normalize(obj.localId),
        fotoUrl: normalize(obj.fotoUrl),
        fotoReferenciaUrl: normalize(obj.fotoReferenciaUrl),
      });
    return serialize(edit) !== serialize(editBaseState);
  }, [edit, editBaseState, imp, isAdmin]);

  const requestClose = () => {
    if (hasUnsavedChanges) {
      const ok = window.confirm("Existem alteracoes nao salvas. Deseja fechar o modal sem salvar?");
      if (!ok) return;
    }
    onClose?.();
  };

  const readFileAsBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Falha ao ler arquivo."));
      reader.onload = () => {
        const result = String(reader.result || "");
        const idx = result.indexOf("base64,");
        resolve(idx >= 0 ? result.slice(idx + 7) : result);
      };
      reader.readAsDataURL(file);
    });

  const doUploadFoto = async ({ target, file }) => {
    const maxBytes = 5 * 1024 * 1024;
    if (file.size > maxBytes) throw new Error("Foto grande demais (max 5MB).");
    const base64Data = await readFileAsBase64(file);
    const entityId = target === "BEM" ? String(imp?.id || "") : String(catalogo?.id || imp?.catalogoBemId || "");
    if (!entityId) throw new Error("Id ausente para upload.");
    return uploadFoto({
      target,
      id: entityId,
      filename: String(file.name || "foto.jpg"),
      mimeType: String(file.type || "image/jpeg"),
      base64Data,
    });
  };

  const buscarMaterialPorCodigo = async () => {
    const codigo = String(materialCodigoBusca || "").trim();
    if (!codigo) {
      setMaterialBuscaState({ loading: false, error: "Informe o numero do material (SKU).", candidato: null });
      return;
    }
    setMaterialBuscaState({ loading: true, error: null, candidato: null });
    try {
      const data = await listarCatalogos({ codigoCatalogo: codigo, limit: 30, offset: 0 });
      const items = data?.items || [];
      const exact = items.find((m) => String(m?.codigoCatalogo || "").trim() === codigo) || null;
      const candidato = exact || items[0] || null;
      if (!candidato) {
        setMaterialBuscaState({
          loading: false,
          error: `Nenhum material cadastrado encontrado para o codigo ${codigo}.`,
          candidato: null,
        });
        return;
      }
      setMaterialBuscaState({ loading: false, error: null, candidato });
    } catch (e) {
      setMaterialBuscaState({
        loading: false,
        error: String(e?.message || "Falha ao buscar material por codigo."),
        candidato: null,
      });
    }
  };

  const associarResponsavelComDuplaConfirmacao = (perfil) => {
    if (!perfil?.id) return;
    const nome = perfil?.nome || "-";
    const matricula = perfil?.matricula || "-";
    const ok = window.confirm(`Confirmar associacao do responsavel ${nome} (matricula ${matricula}) para este bem?`);
    if (!ok) return;
    const frase = window.prompt("Digite ASSOCIAR_RESPONSAVEL para confirmar a associacao:", "");
    if (String(frase || "").trim() !== "ASSOCIAR_RESPONSAVEL") {
      setEditErr("Associacao cancelada: frase de confirmacao invalida.");
      setEditMsg(null);
      return;
    }
    setEdit((p) => ({ ...p, responsavelPerfilId: String(perfil.id) }));
    setResponsavelSelecionado(perfil);
    setResponsavelBusca(`${perfil.matricula || "-"}${perfil.nome ? ` - ${perfil.nome}` : ""}`);
    setEditMsg(`Responsavel selecionado: ${perfil.nome || "-"}. Clique em Salvar alteracoes do bem para aplicar.`);
    setEditErr(null);
    setResponsavelInputFocusedModal(false);
  };
  const salvarBemMut = useMutation({
    mutationFn: async () => {
      if (!imp?.id) throw new Error("BemId ausente.");

      const bemUpdated = await atualizarBem(imp.id, {
        catalogoBemId: edit.catalogoBemId ? String(edit.catalogoBemId).trim() : undefined,
        responsavelPerfilId: edit.responsavelPerfilId || null,
        contratoReferencia: edit.contratoReferencia || null,
        dataAquisicao: edit.dataAquisicao || null,
        valorAquisicao: edit.valorAquisicao !== "" ? Number(edit.valorAquisicao) : null,
        observacoes: edit.observacoes ? String(edit.observacoes).slice(0, 2000) : null,

        localFisico: null,
        localId: edit.localId ? String(edit.localId) : null,
        fotoUrl: edit.fotoUrl || null,
      });

      // Atualiza foto do catálogo se houve alteração
      const targetCatalogoId = edit.catalogoBemId || catalogo?.id;
      const currentRefUrl = catalogo?.fotoReferenciaUrl || "";
      const newRefUrl = edit.fotoReferenciaUrl || "";

      // Compara ignorando nulos/vazios iguais
      if (targetCatalogoId && (newRefUrl !== currentRefUrl)) {
        await atualizarFotoCatalogo(targetCatalogoId, newRefUrl || null);
      }

      return bemUpdated;
    },
    onSuccess: async () => {
      setEditMsg("Bem atualizado.");
      setEditErr(null);
      await onReload?.();
    },
    onError: (e) => {
      setEditErr(String(e?.message || "Falha ao atualizar bem."));
      setEditMsg(null);
    },
  });

  const uploadFotoMut = useMutation({
    mutationFn: async ({ target, file }) => doUploadFoto({ target, file }),
    onSuccess: async (data, vars) => {
      const url = data?.fotoUrl || data?.driveUrl || data?.url || "";
      if (!url) throw new Error("Upload retornou sem URL.");

      if (vars?.target === "BEM") {
        setEdit((p) => ({ ...p, fotoUrl: url }));
        setEditMsg("Foto do item salva e vinculada ao bem.");
      } else {
        setEdit((p) => ({ ...p, fotoReferenciaUrl: url }));
        setEditMsg("Foto de referência salva e vinculada ao catálogo.");
      }
      setEditErr(null);
      await onReload?.();
    },
    onError: (e) => {
      setEditErr(String(e?.message || "Falha ao enviar foto."));
      setEditMsg(null);
    },
  });

  const auditoriaQuery = useQuery({
    queryKey: ["bemAuditoria", imp?.id],
    enabled: Boolean(imp?.id),
    queryFn: async () => {
      const data = await getBemAuditoria(imp.id, { limit: 120 });
      return data.items || [];
    },
  });

  const reverterMut = useMutation({
    mutationFn: async ({ auditId }) => {
      if (!imp?.id) throw new Error("BemId ausente.");
      return reverterBemAuditoria(imp.id, auditId);
    },
    onSuccess: async () => {
      setEditMsg("Alteracao revertida com sucesso.");
      setEditErr(null);
      await auditoriaQuery.refetch();
      await onReload?.();
    },
    onError: (e) => {
      setEditErr(String(e?.message || "Falha ao reverter alteracao."));
      setEditMsg(null);
    },
  });

  const formatFieldValue = (v) => {
    if (v == null) return "-";
    if (typeof v === "boolean") return v ? "true" : "false";
    if (typeof v === "object") {
      try {
        return JSON.stringify(v);
      } catch (_e) {
        return String(v);
      }
    }
    const s = String(v);
    return s.trim() ? s : "-";
  };
  const renderAuditValue = (rawValue, resolvedLabel, resolvedId) => {
    const display = resolvedLabel || formatFieldValue(rawValue);
    if (!resolvedId) return <span>{display}</span>;
    return (
      <span
        className="inline-flex max-w-full cursor-help items-center"
        title={`ID: ${resolvedId}`}
        tabIndex={0}
      >
        <span className="truncate border-b border-dotted border-slate-500/80">{display}</span>
      </span>
    );
  };
  const fieldLabel = (field) => {
    const map = {
      __operacao: "Operacao",
      local_fisico: "Endereço / Local",
      local_id: "Local",
      unidade_dona_id: "Unidade dona",
      nome_resumo: "Nome resumo",
      descricao_complementar: "Descricao complementar",
      foto_url: "Foto do item",
      foto_referencia_url: "Foto do catalogo",
      catalogo_bem_id: "Catalogo",
      responsavel_perfil_id: "Responsavel",
      encontrado_por_perfil_id: "Encontrado por",
      regularizado_por_perfil_id: "Regularizado por",
      executada_por_perfil_id: "Executado por",
      autorizada_por_perfil_id: "Autorizado por",
      aberto_por_perfil_id: "Aberto por",
      encerrado_por_perfil_id: "Encerrado por",
      bem_id: "Bem",
      status: "Status",
      contrato_referencia: "Contrato",
      data_aquisicao: "Data aquisicao",
      valor_aquisicao: "Valor aquisicao",
      descricao: "Descricao catalogo",
      grupo: "Classificacao SIAFI",
      material_permanente: "Material permanente",
    };
    return map[field] || field;
  };
  const actorLabel = (item) => {
    if (item?.actorNome && item?.actorMatricula) return `${item.actorNome} (${item.actorMatricula})`;
    if (item?.actorNome) return item.actorNome;
    if (item?.executorNome && item?.executorMatricula) return `${item.executorNome} (${item.executorMatricula})`;
    if (item?.executorNome) return item.executorNome;
    return item?.executadoPor || "-";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-100 p-4 backdrop-blur">
      <div className="w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-widest text-slate-500">Detalhes do bem</p>
            <p className="mt-1 truncate font-[Space_Grotesk] text-lg font-semibold text-slate-900">
              {imp?.numeroTombamento ? `Tombo ${imp.numeroTombamento}` : "Bem"}
              {statusMeta?.label ? <span className="text-slate-500"> {" "}({statusMeta.label})</span> : null}
            </p>
          </div>
          <button
            type="button"
            onClick={requestClose}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-100"
          >
            Fechar
          </button>
        </div>

        <div className="max-h-[75vh] overflow-auto p-4">
          {state.loading && <p className="text-sm text-slate-600">Carregando detalhes...</p>}
          {state.error && <p className="text-sm text-rose-700">{state.error}</p>}

          {!state.loading && !state.error && imp && (
            <div className="space-y-4">
              {statusMeta.label === "Em processo de baixa" ? (
                <section className="rounded-xl border border-rose-300 bg-rose-50 p-4 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-700">Status crítico</p>
                      <h3 className="mt-1 text-lg font-semibold text-rose-900">Em processo de baixa</h3>
                      <p className="mt-2 text-sm text-rose-800">
                        Este bem já entrou no fluxo formal de baixa patrimonial pelo menu Material Inservível / Baixa e
                        deve ser tratado com atenção operacional.
                      </p>
                    </div>
                    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusMeta.badgeClass}`}>
                      {statusMeta.label}
                    </span>
                  </div>
                  <dl className="mt-3 grid gap-2 text-sm md:grid-cols-2">
                    <div className="rounded-lg border border-rose-200 bg-white/70 px-3 py-2">
                      <dt className="text-[11px] uppercase tracking-wider text-rose-700">Status base do bem</dt>
                      <dd className="mt-1 font-semibold text-slate-900">{statusMeta.statusLabel}</dd>
                    </div>
                    <div className="rounded-lg border border-rose-200 bg-white/70 px-3 py-2">
                      <dt className="text-[11px] uppercase tracking-wider text-rose-700">Processo</dt>
                      <dd className="mt-1 font-semibold text-slate-900">
                        {baixaPatrimonialResumo?.processoReferencia || "Rascunho sem referência"}
                      </dd>
                    </div>
                    <div className="rounded-lg border border-rose-200 bg-white/70 px-3 py-2">
                      <dt className="text-[11px] uppercase tracking-wider text-rose-700">Modalidade</dt>
                      <dd className="mt-1 font-semibold text-slate-900">
                        {baixaPatrimonialResumo?.modalidadeBaixa || "Não informada"}
                      </dd>
                    </div>
                    <div className="rounded-lg border border-rose-200 bg-white/70 px-3 py-2">
                      <dt className="text-[11px] uppercase tracking-wider text-rose-700">Situação do processo</dt>
                      <dd className="mt-1 font-semibold text-slate-900">
                        {baixaPatrimonialResumo?.statusProcesso || "Em processo"}
                      </dd>
                    </div>
                  </dl>
                </section>
              ) : null}

              {divergenciaPendente && (
                <div className="rounded-xl border border-rose-300 bg-rose-50 p-4">
                  <div className="flex items-center gap-3 text-rose-700">
                    <svg className="h-6 w-6 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <h3 className="font-bold uppercase tracking-wide">Divergência Pendente Detectada!</h3>
                  </div>
                  <p className="mt-2 text-sm text-slate-800">
                    Este bem foi encontrado em local divergente em <strong>{new Date(divergenciaPendente.encontradoEm).toLocaleString()}</strong>.
                    Local encontrado: <strong>{divergenciaPendente.salaEncontrada}</strong> ({formatUnidade(divergenciaPendente.unidadeEncontradaId)}).
                  </p>
                  <p className="mt-1 text-xs text-rose-700 font-medium">
                    Art. 185 (ATN 303): Regularização pendente.
                  </p>
                </div>
              )}

              <section className="grid gap-3 md:grid-cols-2">

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs uppercase tracking-widest text-slate-500">Operacional</p>
                  <dl className="mt-2 space-y-1 text-sm">
                    <Row k="BemId" v={imp.id} mono />
                    <Row k="Unidade (carga)" v={formatUnidade(Number(imp.unidadeDonaId))} />
                    <Row k="Tomb. Antigo (Azul)" v={imp.cod2Aud} />
                    <Row k="Nome Resumo" v={imp.nomeResumo} />
                    <Row k="Responsavel" v={state?.data?.responsavel?.matricula ? `${state.data.responsavel.matricula}${state?.data?.responsavel?.nome ? ` - ${state.data.responsavel.nome}` : ""}` : (state?.data?.responsavel?.nome || "-")} />
                    <Row k="Endereço (padronizado)" v={salaPadronizadaAtual} />
                    <Row k="Status" v={imp.status} />
                    <Row k="Valor aquisição" v={imp.valorAquisicao} />
                    <Row k="Data aquisição" v={imp.dataAquisicao} />
                    <Row k="Contrato" v={imp.contratoReferencia} />
                    <Row k="Observacoes" v={imp.observacoes} />
                    <Row k="Foto (item)" v={imp.fotoUrl} />
                    <Row k="Criado em" v={imp.createdAt} />
                    <Row k="Atualizado em" v={imp.updatedAt} />
                  </dl>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs uppercase tracking-widest text-slate-500">Material (SKU)</p>
                  <dl className="mt-2 space-y-1 text-sm">
                    <Row k="Material (SKU) id" v={catalogo?.id || imp.catalogoBemId} mono />
                    <Row k="Codigo material (SKU)" v={catalogo?.codigoCatalogo} />
                    <Row k="Descrição" v={catalogo?.descricao} />
                    <Row k="Classificacao SIAFI" v={catalogo?.grupo} />
                    <Row k="Material permanente" v={String(Boolean(catalogo?.materialPermanente))} />
                    <Row k="Foto (referência)" v={catalogo?.fotoReferenciaUrl} />
                  </dl>
                </div>
              </section>

              {isAdmin ? (
                <section className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-xs uppercase tracking-widest text-slate-500">Editar (ADMIN)</p>
                    <p className="text-[11px] text-slate-500">
                      Edite campos operacionais (exceto chaves). Endereço vem do cadastro de locais.
                    </p>
                  </div>

                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <label className="space-y-1 md:col-span-2">
                      <span className="text-xs text-slate-600">Material (SKU)</span>
                      <p className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700">
                        Atual: <strong>{catalogo?.codigoCatalogo || "-"}</strong>
                      </p>
                      <p className="text-[11px] font-semibold text-amber-700">
                        Atenção: o Material (SKU) deve ser o mesmo cadastrado no GEAFIN para evitar divergências.
                      </p>
                      <div className="mt-2 grid gap-2 md:grid-cols-[1fr_auto]">
                        <input
                          value={materialCodigoBusca}
                          onChange={(e) => setMaterialCodigoBusca(e.target.value)}
                          placeholder="Digite o numero do material (SKU)"
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                        />
                        <button
                          type="button"
                          onClick={buscarMaterialPorCodigo}
                          disabled={materialBuscaState.loading}
                          className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                        >
                          {materialBuscaState.loading ? "Buscando..." : "Buscar codigo"}
                        </button>
                      </div>
                      {materialBuscaState.error ? (
                        <p className="text-[11px] text-rose-700">{materialBuscaState.error}</p>
                      ) : null}
                      {materialBuscaState.candidato ? (
                        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-[11px] text-emerald-900">
                          <p>
                            Codigo: <strong>{materialBuscaState.candidato.codigoCatalogo || "-"}</strong>
                          </p>
                          <p>
                            Descrição: <strong>{materialBuscaState.candidato.descricao || "-"}</strong>
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              const c = materialBuscaState.candidato;
                              if (!c?.id) return;
                              const ok = window.confirm(
                                `Confirmar uso do material ${c.codigoCatalogo || "-"}?\n\n${c.descricao || "Sem descricao"}`
                              );
                              if (!ok) return;
                              setEdit((p) => ({ ...p, catalogoBemId: c.id }));
                              setEditMsg(`Material (SKU) ${c.codigoCatalogo || ""} selecionado.`);
                              setEditErr(null);
                            }}
                            className="mt-2 rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100"
                          >
                            Confirmar este material
                          </button>
                        </div>
                      ) : null}
                    </label>

                    <label className="space-y-1">
                      <span className="text-xs text-slate-600">Unidade (carga)</span>
                      <p className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700">
                        {formatUnidade(Number(imp?.unidadeDonaId))}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Alteracao de unidade nao e permitida aqui. Use Movimentacoes / TRANSFERENCIA.
                      </p>
                    </label>

                    <label className="space-y-1">
                      <span className="text-xs text-slate-600">Status do bem</span>
                      <div className={`rounded-lg border px-3 py-2 text-sm ${statusMeta.toneClass}`}>
                        <p className="font-semibold">{statusMeta.label}</p>
                        <p className="mt-1 text-[11px] opacity-80">Status base: {statusMeta.statusLabel}</p>
                        {statusMeta.label === "Em processo de baixa" ? (
                          <p className="mt-2 text-[11px] font-semibold">
                            {statusMeta.helper}
                          </p>
                        ) : null}
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Alteracao de status nao e permitida aqui. Use o procedimento proprio em Movimentacoes (ex.: Cautela).
                      </p>
                    </label>

                    <label className="space-y-1">
                      <span className="text-xs text-slate-600">Endereço (padronizado)</span>
                      <select
                        value={edit.localId || ""}
                        onChange={(e) => setEdit((p) => ({ ...p, localId: e.target.value }))}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                      >
                        <option value="">(nenhum)</option>
                        {locaisOptions.map((l) => (
                          <option key={l.id} value={l.id}>
                            {`${l.nome} (${formatUnidade(Number(l.unidadeId))})`}
                          </option>
                        ))}
                      </select>
                      <p className="text-[11px] text-slate-500">
                        Lista completa de endereços ativas (todas as unidades).
                      </p>
                      {locaisQuery.isLoading ? (
                        <p className="text-[11px] text-slate-500">Carregando locais cadastrados...</p>
                      ) : null}
                    </label>

                    <label className="space-y-1 md:col-span-2">
                      <span className="text-xs text-slate-600">Nome Resumo</span>
                      <p className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700">
                        {imp?.nomeResumo || "-"}
                      </p>
                    </label>

                    <label className="space-y-1 md:col-span-2">
                      <span className="text-xs text-slate-600">Descrição (Material SKU)</span>
                      <p className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700">
                        {catalogo?.descricao || imp?.descricaoComplementar || "-"}
                      </p>
                      <p className="text-[11px] text-amber-700">
                        Para alterar Nome Resumo e Descricao, use o menu Material (SKU).
                      </p>
                    </label>

                    <label className="space-y-1 md:col-span-2">
                      <span className="text-xs text-slate-600">Responsavel patrimonial (buscar por matricula ou nome)</span>
                      <div className="relative">
                        <input
                          value={responsavelBusca}
                          onFocus={() => setResponsavelInputFocusedModal(true)}
                          onBlur={() => window.setTimeout(() => setResponsavelInputFocusedModal(false), 120)}
                          onChange={(e) => {
                            setResponsavelBusca(e.target.value);
                            setEdit((p) => ({ ...p, responsavelPerfilId: "" }));
                            setResponsavelSelecionado(null);
                          }}
                          placeholder="Digite matricula ou nome do responsavel"
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                        />
                        {responsavelInputFocusedModal ? (
                          <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                            {responsavelLookupState.loading ? <p className="px-3 py-2 text-xs text-slate-500">Buscando...</p> : null}
                            {!responsavelLookupState.loading && responsavelLookupState.error ? (
                              <p className="px-3 py-2 text-xs text-rose-700">{responsavelLookupState.error}</p>
                            ) : null}
                            {!responsavelLookupState.loading && !responsavelLookupState.error &&
                              responsavelLookupState.data.length === 0 && String(responsavelBusca || "").trim().length >= 2 ? (
                              <p className="px-3 py-2 text-xs text-slate-500">Nenhum responsavel encontrado.</p>
                            ) : null}
                            {!responsavelLookupState.loading && !responsavelLookupState.error && responsavelLookupState.data.map((perfil) => (
                              <button
                                key={perfil.id}
                                type="button"
                                onMouseDown={(event) => {
                                  event.preventDefault();
                                  associarResponsavelComDuplaConfirmacao(perfil);
                                }}
                                className="block w-full border-b border-slate-100 px-3 py-2 text-left text-xs hover:bg-violet-50"
                              >
                                <p className="font-semibold text-slate-900">{perfil.nome || "-"}</p>
                                <p className="mt-0.5 text-slate-600">Matricula: <span className="font-mono">{perfil.matricula || "-"}</span></p>
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Associa posse operacional (sem cautela). Exige dupla confirmacao para vincular responsavel.
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Usuarios precisam estar cadastrados no menu Perfis e Acessos.
                      </p>
                      <p className="text-[11px] text-emerald-700">
                        Atual: {responsavelSelecionado?.matricula || "-"}{responsavelSelecionado?.nome ? ` - ${responsavelSelecionado.nome}` : ""}
                      </p>
                    </label>

                    <label className="space-y-1">
                      <span className="text-xs text-slate-600">Contrato referência</span>
                      <input
                        value={edit.contratoReferencia}
                        onChange={(e) => setEdit((p) => ({ ...p, contratoReferencia: e.target.value }))}
                        placeholder="Ex.: Contrato 12/2026"
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                      />
                    </label>

                    <label className="space-y-1">
                      <span className="text-xs text-slate-600">Data de aquisição</span>
                      <input
                        value={edit.dataAquisicao}
                        onChange={(e) => setEdit((p) => ({ ...p, dataAquisicao: e.target.value }))}
                        type="date"
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                      />
                    </label>

                    <label className="space-y-1">
                      <span className="text-xs text-slate-600">Valor de aquisição</span>
                      <input
                        value={edit.valorAquisicao}
                        onChange={(e) => setEdit((p) => ({ ...p, valorAquisicao: e.target.value }))}
                        inputMode="decimal"
                        placeholder="Ex.: 3500.00"
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                      />
                    </label>

                    <label className="space-y-1 md:col-span-2">
                      <span className="text-xs text-slate-600">Observacoes</span>
                      <textarea
                        value={edit.observacoes || ""}
                        onChange={(e) => setEdit((p) => ({ ...p, observacoes: e.target.value }))}
                        rows={3}
                        maxLength={2000}
                        placeholder="Texto livre relacionado ao bem"
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                      />
                    </label>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs uppercase tracking-widest text-slate-500">Foto do item</p>
                      {edit.fotoUrl ? (
                        <a href={getFotoUrl(edit.fotoUrl)} target="_blank" rel="noopener noreferrer" className="block mt-2">
                          <img
                            src={getFotoUrl(edit.fotoUrl)}
                            alt="Foto do item"
                            className="h-40 w-full object-contain rounded bg-black/20"
                          />
                        </a>
                      ) : (
                        <p className="mt-2 text-xs text-slate-500 italic text-center py-4 border border-dashed border-slate-200 rounded">Sem foto</p>
                      )}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => itemCameraRef.current?.click()}
                          disabled={uploadFotoMut.isPending}
                          className="rounded-lg border border-slate-300 px-3 py-2 text-xs hover:bg-slate-100 disabled:opacity-50"
                        >
                          Tirar foto
                        </button>
                        <button
                          type="button"
                          onClick={() => itemFileRef.current?.click()}
                          disabled={uploadFotoMut.isPending}
                          className="rounded-lg border border-slate-300 px-3 py-2 text-xs hover:bg-slate-100 disabled:opacity-50"
                        >
                          Enviar arquivo
                        </button>
                      </div>
                      {edit.fotoUrl && (
                        <div className="mt-2">
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm("Remover foto do item?")) {
                                setEdit((p) => ({ ...p, fotoUrl: null }));
                                setEditMsg("Foto removida. Clique em 'Salvar alterações do bem' para confirmar.");
                              }
                            }}
                            disabled={uploadFotoMut.isPending}
                            className="rounded-lg border border-rose-300 px-3 py-2 text-xs text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                          >
                            Remover foto
                          </button>
                        </div>
                      )}
                      <input
                        ref={itemCameraRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          e.target.value = "";
                          if (!file) return;
                          setUploadState({ loading: true, error: null });
                          try {
                            await uploadFotoMut.mutateAsync({ target: "BEM", file });
                          } finally {
                            setUploadState({ loading: false, error: null });
                          }
                        }}
                      />
                      <input
                        ref={itemFileRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          e.target.value = "";
                          if (!file) return;
                          setUploadState({ loading: true, error: null });
                          try {
                            await uploadFotoMut.mutateAsync({ target: "BEM", file });
                          } finally {
                            setUploadState({ loading: false, error: null });
                          }
                        }}
                      />
                    </div>

                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs uppercase tracking-widest text-slate-500">Foto de referência (SKU)</p>
                      {edit.fotoReferenciaUrl ? (
                        <a href={getFotoUrl(edit.fotoReferenciaUrl)} target="_blank" rel="noopener noreferrer" className="block mt-2">
                          <img
                            src={getFotoUrl(edit.fotoReferenciaUrl)}
                            alt="Foto de referência"
                            className="h-40 w-full object-contain rounded bg-black/20"
                          />
                        </a>
                      ) : (
                        <p className="mt-2 text-xs text-slate-500 italic text-center py-4 border border-dashed border-slate-200 rounded">Sem foto</p>
                      )}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => catalogCameraRef.current?.click()}
                          disabled={uploadFotoMut.isPending}
                          className="rounded-lg border border-slate-300 px-3 py-2 text-xs hover:bg-slate-100 disabled:opacity-50"
                        >
                          Tirar foto
                        </button>
                        <button
                          type="button"
                          onClick={() => catalogFileRef.current?.click()}
                          disabled={uploadFotoMut.isPending}
                          className="rounded-lg border border-slate-300 px-3 py-2 text-xs hover:bg-slate-100 disabled:opacity-50"
                        >
                          Enviar arquivo
                        </button>
                      </div>
                      {edit.fotoReferenciaUrl && (
                        <div className="mt-2">
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm("Remover foto de referência?")) {
                                setEdit((p) => ({ ...p, fotoReferenciaUrl: null }));
                                setEditMsg("Foto removida. Clique em 'Salvar alterações do bem' para confirmar.");
                              }
                            }}
                            disabled={uploadFotoMut.isPending}
                            className="rounded-lg border border-rose-300 px-3 py-2 text-xs text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                          >
                            Remover foto
                          </button>
                        </div>
                      )}
                      <input
                        ref={catalogCameraRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          e.target.value = "";
                          if (!file) return;
                          setUploadState({ loading: true, error: null });
                          try {
                            await uploadFotoMut.mutateAsync({ target: "CATALOGO", file });
                          } finally {
                            setUploadState({ loading: false, error: null });
                          }
                        }}
                      />
                      <input
                        ref={catalogFileRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          e.target.value = "";
                          if (!file) return;
                          setUploadState({ loading: true, error: null });
                          try {
                            await uploadFotoMut.mutateAsync({ target: "CATALOGO", file });
                          } finally {
                            setUploadState({ loading: false, error: null });
                          }
                        }}
                      />
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => salvarBemMut.mutate()}
                      disabled={salvarBemMut.isPending}
                      className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      {salvarBemMut.isPending ? "Salvando..." : "Salvar alterações do bem"}
                    </button>
                    {uploadFotoMut.isPending ? <span className="text-xs text-slate-600">Enviando foto...</span> : null}
                    {editMsg ? <span className="text-xs text-emerald-700">{editMsg}</span> : null}
                    {editErr ? <span className="text-xs text-rose-700">{editErr}</span> : null}
                  </div>
                </section>
              ) : null}

              {String(imp?.status || "").toUpperCase() === "EM_CAUTELA" ? (
                <section className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                  <p className="text-xs uppercase tracking-widest text-amber-700">Cautela atual</p>
                  <dl className="mt-2 space-y-1 text-sm">
                    <Row k="Detentor Matrícula" v={cautelaAtual?.detentorTemporarioMatricula} />
                    <Row k="Detentor Nome" v={cautelaAtual?.detentorTemporarioNome} />
                    <Row k="Local da cautela" v={cautelaDestinoAtual?.label || salaPadronizadaAtual} />
                    <Row k="Data da cautela" v={formatDateTime(cautelaAtual?.executadaEm || cautelaAtual?.createdAt)} />
                    <Row k="Data prevista devolução" v={cautelaAtual?.dataPrevistaDevolucao || "Sem data prevista"} />
                  </dl>
                </section>
              ) : null}

              <section className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-widest text-slate-500">Movimentações</p>
                {movs.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-600">Nenhuma movimentacao registrada.</p>
                ) : (
                  <div className="mt-2 space-y-2">
                    {movs.map((m) => {
                      const expanded = expandedMovId === m.id;
                      return (
                        <article key={m.id} className="rounded-lg border border-slate-200 bg-white">
                          <button
                            type="button"
                            onClick={() => setExpandedMovId((prev) => (prev === m.id ? null : m.id))}
                            className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-slate-50"
                          >
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-slate-900">
                                {m.tipoMovimentacao} - {formatDateTime(m.executadaEm || m.createdAt)}
                              </p>
                              <p className="mt-0.5 truncate text-xs text-slate-600">{movementChangeSummary(m)}</p>
                            </div>
                            <span className="text-xs text-slate-500">{expanded ? "Ocultar" : "Detalhes"}</span>
                          </button>
                          {expanded ? (
                            <div className="grid gap-2 border-t border-slate-200 px-3 py-2 text-xs text-slate-700 md:grid-cols-2">
                              <p><span className="text-slate-500">Executado por:</span> {profileLabel(m.executadaPorNome, m.executadaPorMatricula, m.executadaPorPerfilId)}</p>
                              <p><span className="text-slate-500">Termo:</span> <span className="font-mono">{m.termoReferencia || "-"}</span></p>
                              <p><span className="text-slate-500">Origem:</span> {m.unidadeOrigemId != null ? formatUnidade(Number(m.unidadeOrigemId)) : "-"}</p>
                              <p><span className="text-slate-500">Destino:</span> {m.unidadeDestinoId != null ? formatUnidade(Number(m.unidadeDestinoId)) : "-"}</p>
                              <p><span className="text-slate-500">Detentor:</span> {m.detentorTemporarioNome || "-"}</p>
                              <p><span className="text-slate-500">Data prevista devolução:</span> {m.dataPrevistaDevolucao || "-"}</p>
                            </div>
                          ) : null}
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>

              <section className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-widest text-slate-500">Linha do tempo de alterações</p>
                {auditoriaQuery.isLoading ? (
                  <p className="mt-2 text-sm text-slate-600">Carregando auditoria...</p>
                ) : auditoriaQuery.error ? (
                  <p className="mt-2 text-sm text-rose-700">Falha ao carregar auditoria.</p>
                ) : !(auditoriaQuery.data || []).length ? (
                  <p className="mt-2 text-sm text-slate-600">Nenhuma alteração auditada encontrada.</p>
                ) : (
                  <div className="mt-2 space-y-3">
                    {(auditoriaQuery.data || []).map((a) => (
                      <details key={a.id} className="rounded-lg border border-slate-200 bg-white p-3">
                        <summary className="cursor-pointer list-none">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-900">
                                {a.tabela} / {a.operacao}
                              </p>
                              <p className="text-xs text-slate-600">
                                {new Date(a.executadoEm).toLocaleString()} -{" "}
                                {a.actorPerfilId ? (
                                  <span
                                    className="cursor-help border-b border-dotted border-slate-500/80"
                                    title={`ID do responsavel: ${a.actorPerfilId}`}
                                    tabIndex={0}
                                  >
                                    {actorLabel(a)}
                                  </span>
                                ) : (
                                  actorLabel(a)
                                )}
                              </p>
                              <p className="mt-1 text-xs text-violet-700">
                                {(a.changes || []).slice(0, 4).map((c) => fieldLabel(c.field)).join(", ") || "Sem mudanças estruturadas"}
                              </p>
                            </div>
                            {isAdmin && a.canRevert ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  const ok = window.confirm(`Reverter a alteracao ${a.id} em ${a.tabela}?`);
                                  if (!ok) return;
                                  reverterMut.mutate({ auditId: a.id });
                                }}
                                disabled={reverterMut.isPending}
                                className="rounded-lg border border-amber-300/40 bg-amber-200/10 px-3 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-200/20 disabled:opacity-50"
                              >
                                {reverterMut.isPending ? "Revertendo..." : "Reverter esta alteração"}
                              </button>
                            ) : null}
                          </div>
                        </summary>
                        <div className="mt-3 overflow-auto rounded-lg border border-slate-200">
                          <table className="min-w-full text-left text-xs">
                            <thead className="bg-slate-100 text-[11px] uppercase tracking-wider text-slate-600">
                              <tr>
                                <th className="px-2 py-2">Campo</th>
                                <th className="px-2 py-2">Antes</th>
                                <th className="px-2 py-2">Depois</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                              {(a.changes || []).map((c) => (
                                <tr key={`${a.id}-${c.field}`}>
                                  <td className="px-2 py-2 text-slate-800">{fieldLabel(c.field)}</td>
                                  <td className="px-2 py-2 text-slate-600">{renderAuditValue(c.before, c.beforeLabel, c.beforeId)}</td>
                                  <td className="px-2 py-2 text-slate-600">{renderAuditValue(c.after, c.afterLabel, c.afterId)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </details>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ k, v, mono }) {
  const value = v == null || String(v).trim() === "" ? "-" : String(v);
  return (
    <div className="grid grid-cols-[140px_1fr] gap-2">
      <dt className="text-xs text-slate-500">{k}</dt>
      <dd className={mono ? "break-all font-mono text-xs text-slate-800" : "text-sm text-slate-800"}>
        {value}
      </dd>
    </div>
  );
}

