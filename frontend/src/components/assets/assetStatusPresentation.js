/**
 * Modulo: frontend/components/assets
 * Arquivo: assetStatusPresentation.js
 * Funcao no sistema: centralizar a apresentacao visual do status do bem, incluindo destaque para processo de baixa.
 */
const STATUS_LABELS = Object.freeze({
  OK: "Pronto para uso",
  EM_CAUTELA: "Em cautela",
  BAIXADO: "Baixado",
  AGUARDANDO_RECEBIMENTO: "Aguardando recebimento",
});

const DEFAULT_STATUS_META = Object.freeze({
  label: "Status não informado",
  badgeClass: "border-slate-300 bg-slate-100 text-slate-700",
  toneClass: "border-slate-200 bg-slate-50 text-slate-700",
});

function normalize(value) {
  return String(value || "").trim().toUpperCase();
}

export function isBemEmProcessoBaixa(item) {
  if (!item || typeof item !== "object") return false;
  if (item.emProcessoBaixa === true) return true;
  if (normalize(item?.marcacaoAtual?.statusFluxo) === "EM_PROCESSO_BAIXA") return true;
  return normalize(item?.baixaPatrimonialResumo?.statusProcesso) === "RASCUNHO";
}

export function getBemStatusMeta(item) {
  const status = normalize(item?.status);
  const baixaEmProcesso = isBemEmProcessoBaixa(item);
  const processoReferencia = String(
    item?.baixaPatrimonialResumo?.processoReferencia
      || item?.baixaProcessoReferencia
      || "",
  ).trim();

  if (baixaEmProcesso) {
    return {
      status,
      label: "Em processo de baixa",
      shortLabel: "Baixa em processo",
      statusLabel: STATUS_LABELS[status] || (status || "Status não informado"),
      helper: processoReferencia ? `Processo ${processoReferencia}` : "Fluxo iniciado em Material Inservível / Baixa",
      badgeClass: "border-rose-300 bg-rose-50 text-rose-800 ring-2 ring-rose-200",
      toneClass: "border-rose-300 bg-rose-50 text-rose-800",
      dotClass: "bg-rose-600",
    };
  }

  if (status === "EM_CAUTELA") {
    return {
      status,
      label: "Em cautela",
      shortLabel: "Cautela",
      statusLabel: STATUS_LABELS[status],
      helper: "Saída temporária formalizada.",
      badgeClass: "border-amber-300 bg-amber-50 text-amber-800",
      toneClass: "border-amber-200 bg-amber-50 text-amber-800",
      dotClass: "bg-amber-500",
    };
  }

  if (status === "BAIXADO") {
    return {
      status,
      label: "Baixado",
      shortLabel: "Baixado",
      statusLabel: STATUS_LABELS[status],
      helper: "Baixa patrimonial concluída.",
      badgeClass: "border-slate-300 bg-slate-100 text-slate-700",
      toneClass: "border-slate-200 bg-slate-100 text-slate-700",
      dotClass: "bg-slate-500",
    };
  }

  if (status === "AGUARDANDO_RECEBIMENTO") {
    return {
      status,
      label: "Aguardando recebimento",
      shortLabel: "Aguardando",
      statusLabel: STATUS_LABELS[status],
      helper: "Bem importado, ainda não confirmado fisicamente.",
      badgeClass: "border-sky-300 bg-sky-50 text-sky-800",
      toneClass: "border-sky-200 bg-sky-50 text-sky-800",
      dotClass: "bg-sky-500",
    };
  }

  if (status === "OK") {
    return {
      status,
      label: "Pronto para uso",
      shortLabel: "Pronto",
      statusLabel: STATUS_LABELS[status],
      helper: "Sem cautela ou baixa em andamento.",
      badgeClass: "border-emerald-300 bg-emerald-50 text-emerald-800",
      toneClass: "border-emerald-200 bg-emerald-50 text-emerald-800",
      dotClass: "bg-emerald-500",
    };
  }

  return {
    ...DEFAULT_STATUS_META,
    status,
    shortLabel: status || DEFAULT_STATUS_META.label,
    statusLabel: STATUS_LABELS[status] || (status || DEFAULT_STATUS_META.label),
    helper: "Status operacional retornado pela API.",
    dotClass: "bg-slate-400",
  };
}
