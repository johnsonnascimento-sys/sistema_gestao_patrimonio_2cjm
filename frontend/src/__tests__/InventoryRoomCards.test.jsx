/**
 * Modulo: frontend/tests
 * Arquivo: InventoryRoomCards.test.jsx
 * Funcao no sistema: validar a extracao dos cards operacionais do Inventario - Contagem.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import InventoryAddressOverviewCard from "../components/inventory/InventoryAddressOverviewCard.jsx";
import InventoryCountContextCard from "../components/inventory/InventoryCountContextCard.jsx";

describe("InventoryRoom cards extraidos", () => {
  it("renderiza o resumo do contexto operacional da contagem", () => {
    render(
      <InventoryCountContextCard
        eventCode="INV-2026-001"
        eventHelper="Cego / LOCAIS"
        eventTone="success"
        showRound
        roundValue="A"
        roundHelper="Operador A"
        unitValue="3 (Foro)"
        unitTone="success"
        localValue="Sala 401"
        localHelper="Escopo restrito pelos locais do evento."
        localTone="success"
        roomValue="Sala 401"
        roomHelper="Sincronizado automaticamente com o local escolhido."
        roomTone="success"
      />,
    );

    expect(screen.getByText("Contexto da contagem")).toBeInTheDocument();
    expect(screen.getByText("INV-2026-001")).toBeInTheDocument();
    expect(screen.getByText("Operador A")).toBeInTheDocument();
    expect(screen.getAllByText("Sala 401")).toHaveLength(2);
  });

  it("renderiza a visao rapida do endereco com indicadores operacionais", () => {
    render(
      <InventoryAddressOverviewCard
        accentClassName="border-slate-200"
        expectedValue="138"
        expectedHelper="Itens vinculados ao local cadastrado."
        expectedTone="default"
        countedValue="137"
        countedHelper="Bens ja localizados neste endereco."
        countedTone="success"
        divergencesValue="3"
        divergencesTone="danger"
        missingValue="1"
        missingHelper="Esperados ainda nao conferidos."
        missingTone="warn"
      />,
    );

    expect(screen.getByText("Visão rápida do endereço")).toBeInTheDocument();
    expect(screen.getByText("138")).toBeInTheDocument();
    expect(screen.getByText("137")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
  });
});
