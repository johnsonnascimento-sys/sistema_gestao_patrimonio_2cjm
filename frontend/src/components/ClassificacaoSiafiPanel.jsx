/**
 * Modulo: frontend/components
 * Arquivo: ClassificacaoSiafiPanel.jsx
 * Funcao no sistema: cadastrar/editar classificacoes SIAFI para uso obrigatorio no Material (SKU).
 */
import { useEffect, useState } from "react";
import {
  atualizarClassificacaoSiafi,
  criarClassificacaoSiafi,
  listarClassificacoesSiafi,
} from "../services/apiClient.js";

function formatApiError(error) {
  const msg = String(error?.message || "Falha na requisicao.");
  const status = error?.status != null ? String(error.status) : "";
  const code = error?.payload?.error?.code ? String(error.payload.error.code) : "";
  const requestId = error?.payload?.requestId ? String(error.payload.requestId) : "";
  const suffix = [status ? `status=${status}` : null, code ? `code=${code}` : null, requestId ? `requestId=${requestId}` : null]
    .filter(Boolean)
    .join(", ");
  return suffix ? `${msg} (${suffix})` : msg;
}

export default function ClassificacaoSiafiPanel({ canAdmin }) {
  const [listState, setListState] = useState({ loading: false, items: [], error: null });
  const [formState, setFormState] = useState({ loading: false, error: null, info: null });
  const [form, setForm] = useState({ codigoClassificacao: "", descricaoSiafi: "", ativo: true });
  const [editId, setEditId] = useState("");

  const loadData = async () => {
    setListState({ loading: true, items: [], error: null });
    try {
      const data = await listarClassificacoesSiafi({ limit: 500, offset: 0 });
      setListState({ loading: false, items: data?.items || [], error: null });
    } catch (error) {
      setListState({ loading: false, items: [], error: formatApiError(error) });
    }
  };

  useEffect(() => {
    if (!canAdmin) return;
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAdmin]);

  const onSalvar = async (event) => {
    event.preventDefault();
    if (!canAdmin) {
      setFormState({ loading: false, error: "Operacao restrita ao perfil ADMIN.", info: null });
      return;
    }
    const payload = {
      codigoClassificacao: String(form.codigoClassificacao || "").trim(),
      descricaoSiafi: String(form.descricaoSiafi || "").trim(),
      ativo: Boolean(form.ativo),
    };
    if (!payload.codigoClassificacao || !payload.descricaoSiafi) {
      setFormState({ loading: false, error: "Preencha Classificacao SIAFI e Descri SIAFI.", info: null });
      return;
    }
    setFormState({ loading: true, error: null, info: null });
    try {
      if (editId) {
        await atualizarClassificacaoSiafi(editId, payload);
      } else {
        await criarClassificacaoSiafi(payload);
      }
      setFormState({ loading: false, error: null, info: editId ? "Classificacao SIAFI atualizada." : "Classificacao SIAFI criada." });
      setForm({ codigoClassificacao: "", descricaoSiafi: "", ativo: true });
      setEditId("");
      await loadData();
    } catch (error) {
      setFormState({ loading: false, error: formatApiError(error), info: null });
    }
  };

  return (
    <section className="mt-6 space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-[Space_Grotesk] text-2xl font-semibold">Classificacao SIAFI</h2>
          <p className="mt-1 text-sm text-slate-600">
            Cadastro oficial de Classificacao SIAFI e Descri SIAFI para uso no Material (SKU).
          </p>
        </div>
        <button
          type="button"
          onClick={loadData}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100 disabled:opacity-50"
          disabled={listState.loading || !canAdmin}
        >
          {listState.loading ? "Atualizando..." : "Atualizar"}
        </button>
      </header>

      <form onSubmit={onSalvar} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <h3 className="text-sm font-semibold text-slate-900">{editId ? "Editar classificacao" : "Nova classificacao"}</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs text-slate-600">Classificacao SIAFI</span>
            <input
              value={form.codigoClassificacao}
              onChange={(e) => setForm((prev) => ({ ...prev, codigoClassificacao: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              placeholder="Ex.: 12311.02.01"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-slate-600">Descri SIAFI</span>
            <input
              value={form.descricaoSiafi}
              onChange={(e) => setForm((prev) => ({ ...prev, descricaoSiafi: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              placeholder="Ex.: EQUIP DE TECNOLOG DA INFOR E COMUNICACAO/TIC"
            />
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={Boolean(form.ativo)}
              onChange={(e) => setForm((prev) => ({ ...prev, ativo: e.target.checked }))}
              className="h-4 w-4 accent-violet-600"
            />
            Ativo
          </label>
        </div>
        <p className="mt-2 text-[11px] text-amber-700">
          A Classificacao SIAFI deve ser a mesma cadastrada no GEAFIN para evitar divergencias.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={formState.loading || !canAdmin}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {formState.loading ? "Salvando..." : editId ? "Atualizar" : "Criar"}
          </button>
          {editId ? (
            <button
              type="button"
              onClick={() => {
                setEditId("");
                setForm({ codigoClassificacao: "", descricaoSiafi: "", ativo: true });
              }}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100"
            >
              Cancelar
            </button>
          ) : null}
        </div>
        {formState.error ? <p className="mt-2 text-sm text-rose-700">{formState.error}</p> : null}
        {formState.info ? <p className="mt-2 text-sm text-emerald-700">{formState.info}</p> : null}
      </form>

      <div className="max-h-[420px] overflow-auto rounded-xl border border-slate-200">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-100 text-xs uppercase tracking-wider text-slate-600">
            <tr>
              <th className="px-3 py-2">Classificacao SIAFI</th>
              <th className="px-3 py-2">Descri SIAFI</th>
              <th className="px-3 py-2">Ativo</th>
              <th className="px-3 py-2 text-right">Acoes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {listState.items.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50">
                <td className="px-3 py-2 font-mono text-[12px]">{row.codigoClassificacao}</td>
                <td className="px-3 py-2">{row.descricaoSiafi}</td>
                <td className="px-3 py-2">{row.ativo ? "SIM" : "NAO"}</td>
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => {
                      setEditId(String(row.id));
                      setForm({
                        codigoClassificacao: String(row.codigoClassificacao || ""),
                        descricaoSiafi: String(row.descricaoSiafi || ""),
                        ativo: Boolean(row.ativo),
                      });
                    }}
                    className="rounded-md border border-slate-300 px-3 py-1 text-xs font-semibold hover:bg-slate-100"
                  >
                    Editar
                  </button>
                </td>
              </tr>
            ))}
            {!listState.loading && !listState.items.length ? (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-slate-500">
                  Nenhuma classificacao cadastrada.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {listState.error ? <p className="text-sm text-rose-700">{listState.error}</p> : null}
    </section>
  );
}
