/**
 * Modulo: frontend/tests
 * Arquivo: AssetsExplorerOperationalGuidance.test.jsx
 * Funcao no sistema: validar a orientacao operacional embutida na Consulta de Bens.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AssetsExplorerHeader from "../components/assets/AssetsExplorerHeader.jsx";
import AssetsExplorerSearchPanel from "../components/assets/AssetsExplorerSearchPanel.jsx";

describe("AssetsExplorer orientacao operacional", () => {
  it("exibe os caminhos mais comuns e o contexto de origem no cabecalho", () => {
    render(
      <AssetsExplorerHeader
        originLabel="Inventário - Administração"
        originContext="Atalho vindo do painel de bens não contados."
      />,
    );

    expect(screen.getByText("Operacao mais comum")).toBeInTheDocument();
    expect(screen.getByText("Tombo 10 digitos")).toBeInTheDocument();
    expect(screen.getByText("Etiqueta 4 digitos")).toBeInTheDocument();
    expect(screen.getByText("Material (SKU)")).toBeInTheDocument();
    expect(screen.getByText(/Contexto aplicado de Inventário - Administração/i)).toBeInTheDocument();
    expect(screen.getByText(/Atalho vindo do painel de bens não contados/i)).toBeInTheDocument();
  });

  it("explica quando usar consulta rapida e quando abrir filtros avancados", () => {
    render(
      <AssetsExplorerSearchPanel
        filters={{
          numeroTombamento: "",
          codigoCatalogo: "",
          q: "",
          unidadeDonaId: "",
          status: "",
          localId: "",
          responsavel: "",
        }}
        formError=""
        listError=""
        listLoading={false}
        scannerMode="single"
        setScannerMode={vi.fn()}
        setShowScanner={vi.fn()}
        showAdvancedFilters={false}
        setShowAdvancedFilters={vi.fn()}
        tipoBusca4Digitos=""
        tombamentoInputRef={{ current: null }}
        onFiltersChange={vi.fn()}
        onTombamentoChange={vi.fn()}
        onSubmit={(event) => event.preventDefault()}
        onClear={vi.fn()}
        onTombamentoInputKeyDown={vi.fn()}
        formatUnidade={(value) => String(value)}
        unitOptions={[""]}
        statusOptions={[""]}
        locaisFiltroOptions={[]}
        locaisFiltroLoading={false}
        responsavelLookup={{ loading: false, error: "", data: [] }}
        responsavelInputFocused={false}
        setResponsavelInputFocused={vi.fn()}
        onSelectResponsavelPerfil={vi.fn()}
      />,
    );

    expect(screen.getByText("Consulta rapida")).toBeInTheDocument();
    expect(screen.getByText("Use primeiro")).toBeInTheDocument();
    expect(screen.getByText(/Tombamento, etiqueta de 4 digitos, camera e material \(SKU\)/i)).toBeInTheDocument();
    expect(screen.getByText("Abra filtros avancados quando")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mostrar filtros avancados" })).toBeInTheDocument();
  });
});
