/**
 * Modulo: frontend/tests
 * Arquivo: InventoryRoomCards.test.jsx
 * Funcao no sistema: validar a extracao dos cards operacionais do Inventario - Contagem.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import InventoryAddressOverviewCard from "../components/inventory/InventoryAddressOverviewCard.jsx";
import InventoryCountContextCard from "../components/inventory/InventoryCountContextCard.jsx";
import InventoryDivergencesPanel from "../components/inventory/InventoryDivergencesPanel.jsx";
import InventoryExceptionPanels from "../components/inventory/InventoryExceptionPanels.jsx";
import InventoryExpectedAssetsPanel from "../components/inventory/InventoryExpectedAssetsPanel.jsx";
import InventoryPrimaryReadPanel from "../components/inventory/InventoryPrimaryReadPanel.jsx";

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

  it("renderiza o painel principal de leitura com contexto e scanner", () => {
    render(
      <InventoryPrimaryReadPanel
        canRegister
        canRegisterHint="Leitura liberada para este contexto."
        roomPendingOfflineCount={2}
        selectedEventoId="evt-1"
        setSelectedEventoId={vi.fn()}
        eventos={[{ id: "evt-1", codigoEvento: "INV-2026-010", modoContagem: "PADRAO", escopoTipo: "UNIDADE", unidadeInventariadaId: 3 }]}
        selectedEventoIdFinal="evt-1"
        eventoAtivo={{ codigoEvento: "INV-2026-010", modoContagem: "PADRAO", escopoTipo: "UNIDADE", unidadeInventariadaId: 3 }}
        formatModeLabel={() => "Padrão"}
        modoContagemEvento="PADRAO"
        eventoSelecionadoIncompativel={false}
        sessaoContagemLoading={false}
        sessaoDesignado
        rodadaSelecionada="A"
        setRodadaSelecionada={vi.fn()}
        rodadasPermitidas={["A", "B"]}
        podeDesempate={false}
        unidadeEncontradaId="3"
        setUnidadeEncontradaId={vi.fn()}
        formatUnidade={(value) => `${value} (Teste)`}
        selectedLocalId="loc-1"
        setSelectedLocalId={vi.fn()}
        locaisOptions={[{ id: "loc-1", nome: "Sala 401" }]}
        locaisLoading={false}
        localIdsPermitidosEvento={null}
        setSalaEncontrada={vi.fn()}
        registerScan={(event) => event.preventDefault()}
        scannerInputRef={{ current: null }}
        scannerValue=""
        setScannerValue={vi.fn()}
        normalizeTombamentoInput={(value) => value}
        handleScannerInputKeyDown={vi.fn()}
        scannerMode="single"
        setScannerMode={vi.fn()}
        setShowScanner={vi.fn()}
        salaEncontrada="Sala 401"
        showScanner={false}
        cameraScanPreview=""
        handleScanValue={vi.fn()}
        lastScans={[
          {
            id: "scan-1",
            numeroTombamento: "1290001788",
            when: "agora",
            divergente: false,
            statusLabel: "Conforme",
          },
        ]}
      />,
    );

    expect(screen.getByText("Leitura principal")).toBeInTheDocument();
    expect(screen.getByText("Fila do endereço: 2")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Ex.: 1290001788")).toBeInTheDocument();
    expect(screen.getByText("Últimos registros")).toBeInTheDocument();
    expect(screen.getAllByText("1290001788").length).toBeGreaterThan(0);
  });

  it("renderiza o painel de bens esperados com filtros e resumo agrupado", () => {
    render(
      <InventoryExpectedAssetsPanel
        expectedAssetsFilter="ALL"
        setExpectedAssetsFilter={vi.fn()}
        totalEsperadosEndereco={3}
        totalConferidosEndereco={2}
        totalFaltantesEndereco={1}
        bensSalaItems={[
          {
            id: "bem-1",
            numeroTombamento: "1290001788",
            nomeResumo: "Notebook",
            catalogoDescricao: "Notebook Dell",
            unidadeDonaId: 3,
            codigoCatalogo: "37201",
          },
        ]}
        bensSalaLoading={false}
        bensSalaError={null}
        showItemPhotoList={false}
        setShowItemPhotoList={vi.fn()}
        showCatalogPhotoList={false}
        setShowCatalogPhotoList={vi.fn()}
        isOnline
        salaEncontrada="Sala 401"
        filteredGrouped={[
          {
            catalogoBemId: "cat-1",
            catalogoDescricao: "Notebook Dell",
            items: [
              {
                id: "bem-1",
                numeroTombamento: "1290001788",
                nomeResumo: "Notebook",
                catalogoDescricao: "Notebook Dell",
                unidadeDonaId: 3,
                codigoCatalogo: "37201",
              },
            ],
          },
        ]}
        foundSet={new Set(["1290001788"])}
        getConferenciaMeta={() => ({ encontrado: true, divergente: false, fonte: "SERVIDOR" })}
        formatUnidade={(value) => `${value} (Teste)`}
        getFotoUrl={(value) => value}
      />,
    );

    expect(screen.getByText("Bens esperados do endereço")).toBeInTheDocument();
    expect(screen.getByText("Esperados 3")).toBeInTheDocument();
    expect(screen.getByText("Conferidos 2")).toBeInTheDocument();
    expect(screen.getByText("Faltantes 1")).toBeInTheDocument();
    expect(screen.getByText("Notebook")).toBeInTheDocument();
  });

  it("renderiza os paineis de excecao e terceiros registrados", () => {
    render(
      <InventoryExceptionPanels
        canRegisterTerceiro
        onRegistrarBemTerceiro={(event) => event.preventDefault()}
        terceiroDescricao="Notebook externo"
        setTerceiroDescricao={vi.fn()}
        terceiroProprietario="Empresa XPTO"
        setTerceiroProprietario={vi.fn()}
        terceiroIdentificador="EXT-001"
        setTerceiroIdentificador={vi.fn()}
        registrarBemTerceiroMut={{ isPending: false, error: null }}
        terceiroStatus={{ kind: "ok" }}
        canRegisterNaoIdentificado
        onRegistrarNaoIdentificado={(event) => event.preventDefault()}
        naoIdDescricao="Cadeira azul sem tombo"
        setNaoIdDescricao={vi.fn()}
        naoIdLocalizacao="Sala 401"
        setNaoIdLocalizacao={vi.fn()}
        handleFotoNaoId={vi.fn()}
        naoIdFotoBase64="data:image/png;base64,abc123"
        registrarNaoIdentificadoMut={{ isPending: false, error: null }}
        naoIdStatus={{ kind: "ok" }}
        selectedEventoIdFinal="evt-1"
        salaEncontrada="Sala 401"
        isOnline
        terceirosSalaLoading={false}
        terceirosSalaItems={[
          {
            contagemId: "ct-1",
            identificadorExterno: "EXT-001",
            descricao: "Notebook externo",
            proprietarioExterno: "Empresa XPTO",
            encontradoEm: "2026-03-09T00:00:00.000Z",
          },
        ]}
      />,
    );

    expect(screen.getByText("Bem de terceiro")).toBeInTheDocument();
    expect(screen.getByText("Bem sem identificação")).toBeInTheDocument();
    expect(screen.getByText("Terceiros registrados")).toBeInTheDocument();
    expect(screen.getAllByText("Foto anexada")).toHaveLength(2);
    expect(screen.getByText("Empresa XPTO")).toBeInTheDocument();
  });

  it("renderiza o painel de divergencias do endereco", () => {
    render(
      <InventoryDivergencesPanel
        salaEncontrada="Sala 401"
        contagens={[
          {
            tipoOcorrencia: "ENCONTRADO_EM_LOCAL_DIVERGENTE",
            regularizacaoPendente: true,
            numeroTombamento: "1290001788",
            codigoCatalogo: "37201",
            catalogoDescricao: "Notebook Dell",
            unidadeDonaId: 2,
            unidadeEncontradaId: 3,
            salaEncontrada: "Sala 401",
            localEsperadoTexto: "Sala 201",
            encontradoEm: "2026-03-09T00:00:00.000Z",
          },
        ]}
        offlineItems={[]}
        bensSala={[]}
        eventoInventarioId="evt-1"
        formatUnidade={(value) => `${value} (Teste)`}
        getFotoUrl={(value) => value}
      />,
    );

    expect(screen.getByText("Divergências no endereço (Art. 185)")).toBeInTheDocument();
    expect(screen.getByText("Pendentes 1")).toBeInTheDocument();
    expect(screen.getAllByText("1290001788").length).toBeGreaterThan(0);
    expect(screen.getByText("UNIDADE + ENDEREÇO")).toBeInTheDocument();
  });
});
