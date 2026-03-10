/**
 * Modulo: frontend/tests
 * Arquivo: MaterialInservivelBaixaComponents.test.jsx
 * Funcao no sistema: validar os contratos visiveis da fila e do fluxo de baixa patrimonial no frontend.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import BaixaProcessDrawer from "../components/BaixaProcessDrawer.jsx";
import BaixaProcessesList from "../components/BaixaProcessesList.jsx";
import InservivelQueueTable from "../components/InservivelQueueTable.jsx";

describe("InservivelQueueTable", () => {
  it("lista itens da fila, permite selecao e bloqueia retirada sem permissao de edicao", async () => {
    const onToggleSelect = vi.fn();
    const onToggleSelectAll = vi.fn();

    render(
      <InservivelQueueTable
        filters={{
          q: "",
          unidadeDonaId: "",
          tipoInservivel: "",
          destinacaoSugerida: "",
          statusFluxo: "",
          localFisico: "",
        }}
        onFilterChange={vi.fn()}
        items={[
          {
            id: "m1",
            bemId: "b1",
            numeroTombamento: "1290001788",
            catalogoDescricao: "Notebook Dell",
            unidadeDonaId: 2,
            localFisico: "Sala 204",
            tipoInservivel: "OCIOSO",
            destinacaoSugerida: "DOACAO",
            statusFluxo: "AGUARDANDO_DESTINACAO",
            avaliadoEm: "2026-03-10T00:00:00Z",
            totalEvidencias: 1,
          },
          {
            id: "m2",
            bemId: "b2",
            numeroTombamento: "1290001790",
            catalogoDescricao: "Armário metálico",
            unidadeDonaId: 3,
            localFisico: "Depósito",
            tipoInservivel: "ANTIECONOMICO",
            destinacaoSugerida: "VENDA",
            statusFluxo: "MARCADO_TRIAGEM",
            avaliadoEm: "2026-03-10T00:00:00Z",
            totalEvidencias: 0,
          },
        ]}
        selectedIds={[]}
        onToggleSelect={onToggleSelect}
        onToggleSelectAll={onToggleSelectAll}
        onReevaluate={vi.fn()}
        onAttachEvidence={vi.fn()}
        onRemove={vi.fn()}
        canEdit={false}
      />,
    );

    expect(screen.getByText("Notebook Dell")).toBeInTheDocument();
    expect(screen.getByText("Armário metálico")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Retirar da fila/i })[0]).toBeDisabled();

    await userEvent.click(screen.getByLabelText("Selecionar 1290001788"));
    expect(onToggleSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: "m1", numeroTombamento: "1290001788" }),
      true,
    );

    await userEvent.click(screen.getByLabelText("Selecionar todos"));
    expect(onToggleSelectAll).toHaveBeenCalledWith(true);
  });
});

describe("Baixa workflow components", () => {
  it("habilita a abertura do processo pela lista quando ha itens selecionados", async () => {
    const onCreateFromSelection = vi.fn();

    render(
      <BaixaProcessesList
        items={[
          {
            id: "bp-1",
            processoReferencia: "PROC-2026-001",
            modalidadeBaixa: "DOACAO",
            statusProcesso: "RASCUNHO",
            totalItens: 1,
          },
        ]}
        activeId={null}
        onOpen={vi.fn()}
        onCreateFromSelection={onCreateFromSelection}
        onOpenDesaparecimento={vi.fn()}
        selectionCount={2}
        canWrite
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /Abrir processo com 2 item\(ns\)/i }));
    expect(onCreateFromSelection).toHaveBeenCalledTimes(1);
  });

  it("envia os ids selecionados ao criar um rascunho pelo drawer", async () => {
    const onCreateDraft = vi.fn();

    render(
      <BaixaProcessDrawer
        isOpen
        mode=""
        process={null}
        selectedItems={[
          {
            id: "m1",
            marcacaoInservivelId: "m1",
            numeroTombamento: "1290001788",
            catalogoDescricao: "Notebook Dell",
            tipoInservivel: "OCIOSO",
          },
        ]}
        onClose={vi.fn()}
        onCreateDraft={onCreateDraft}
        onUpdateDraft={vi.fn()}
        onConclude={vi.fn()}
        onCancel={vi.fn()}
        canWrite
        canExecute={false}
        busy={false}
      />,
    );

    await userEvent.type(screen.getByLabelText("Processo / referência"), "PROC-2026-002");
    await userEvent.click(screen.getByRole("button", { name: /Criar rascunho/i }));

    expect(onCreateDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        processoReferencia: "PROC-2026-002",
        marcacaoIds: ["m1"],
      }),
    );
  });
});
