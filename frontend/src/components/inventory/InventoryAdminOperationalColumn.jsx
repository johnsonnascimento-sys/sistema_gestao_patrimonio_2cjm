/**
 * Modulo: frontend/components/inventory
 * Arquivo: InventoryAdminOperationalColumn.jsx
 * Funcao no sistema: renderizar a coluna operacional da direita no cockpit administrativo do inventario.
 */
import InventoryHistoryPanel from "./InventoryHistoryPanel.jsx";
import InventoryInterunitDivergencesPanel from "./InventoryInterunitDivergencesPanel.jsx";
import InventoryLiveMonitoringPanel from "./InventoryLiveMonitoringPanel.jsx";
import InventoryUncountedAssetsPanel from "./InventoryUncountedAssetsPanel.jsx";

export default function InventoryAdminOperationalColumn(props) {
  const {
    naoLocalizadosQuery,
    naoLocalizadosSummary,
    percentualCoberturaNaoLocalizados,
    naoLocalizadosGroups,
    naoLocalizadosVisibleByGroup,
    openInventoryCountForGroup,
    openAssetDetailFromRow,
    openAssetsExplorerBySku,
    expandNaoLocalizadosGroup,
    formatPercent,
    formatUnidade,
    selectedEventoIdFinal,
    isAdmin,
    monitoramentoQuery,
    monitoramentoRows,
    monitoramentoTotalA,
    monitoramentoTotalB,
    monitoramentoTotalEsperados,
    monitoramentoTotalDesempate,
    divergenciasInterunidadesQuery,
    interDaMinhaUnidadeFora,
    interOutrasNaMinha,
    interPendentes,
    interRegularizadas,
    interEmAndamento,
    interEncerrado,
    interStatusInventario,
    setInterStatusInventario,
    interUnidadeRelacionada,
    setInterUnidadeRelacionada,
    interCodigoFiltro,
    setInterCodigoFiltro,
    interSalaFiltro,
    setInterSalaFiltro,
    clearInterFilters,
    divergenciasInterTotal,
    divergenciasInterItems,
    inventoryStatusPillClass,
    divergenceTypePillClass,
    regularizacaoPillClass,
    formatDateTimeShort,
    historicoEventos,
    hasActiveEvent,
    editingEventoId,
    editForm,
    setEditForm,
    atualizarEventoMutPending,
    setEditingEventoId,
    saveEditEvento,
    setSelectedEventoId,
    setRelatorioEventoId,
    setUiInfo,
    onUpdateStatus,
    handleEditEvento,
    handleDeleteEvento,
  } = props;

  return (
    <div className="space-y-4">
      <InventoryUncountedAssetsPanel
        query={naoLocalizadosQuery}
        summary={naoLocalizadosSummary}
        percentualCobertura={percentualCoberturaNaoLocalizados}
        groups={naoLocalizadosGroups}
        visibleByGroup={naoLocalizadosVisibleByGroup}
        onRefresh={() => naoLocalizadosQuery.refetch()}
        onOpenInventoryCount={openInventoryCountForGroup}
        onOpenAssetDetail={openAssetDetailFromRow}
        onOpenAssetsExplorerBySku={openAssetsExplorerBySku}
        onExpandGroup={expandNaoLocalizadosGroup}
        formatPercent={formatPercent}
        formatUnidade={formatUnidade}
      />

      <InventoryLiveMonitoringPanel
        visible={selectedEventoIdFinal}
        isAdmin={isAdmin}
        query={monitoramentoQuery}
        rows={monitoramentoRows}
        totalA={monitoramentoTotalA}
        totalB={monitoramentoTotalB}
        totalEsperados={monitoramentoTotalEsperados}
        totalDesempate={monitoramentoTotalDesempate}
      />

      <InventoryInterunitDivergencesPanel
        query={divergenciasInterunidadesQuery}
        interDaMinhaUnidadeFora={interDaMinhaUnidadeFora}
        interOutrasNaMinha={interOutrasNaMinha}
        interPendentes={interPendentes}
        interRegularizadas={interRegularizadas}
        interEmAndamento={interEmAndamento}
        interEncerrado={interEncerrado}
        interStatusInventario={interStatusInventario}
        setInterStatusInventario={setInterStatusInventario}
        interUnidadeRelacionada={interUnidadeRelacionada}
        setInterUnidadeRelacionada={setInterUnidadeRelacionada}
        interCodigoFiltro={interCodigoFiltro}
        setInterCodigoFiltro={setInterCodigoFiltro}
        interSalaFiltro={interSalaFiltro}
        setInterSalaFiltro={setInterSalaFiltro}
        clearInterFilters={clearInterFilters}
        isAdmin={isAdmin}
        formatUnidade={formatUnidade}
        divergenciasInterTotal={divergenciasInterTotal}
        divergenciasInterItems={divergenciasInterItems}
        inventoryStatusPillClass={inventoryStatusPillClass}
        divergenceTypePillClass={divergenceTypePillClass}
        regularizacaoPillClass={regularizacaoPillClass}
        formatDateTimeShort={formatDateTimeShort}
      />

      <InventoryHistoryPanel
        historicoEventos={historicoEventos}
        hasActiveEvent={hasActiveEvent}
        editingEventoId={editingEventoId}
        editForm={editForm}
        setEditForm={setEditForm}
        isAdmin={isAdmin}
        atualizarEventoMutPending={atualizarEventoMutPending}
        setEditingEventoId={setEditingEventoId}
        onSaveEditEvento={saveEditEvento}
        onLoadRelatorio={(ev) => {
          setSelectedEventoId(ev.id);
          setRelatorioEventoId(ev.id);
          setUiInfo(`Relatório carregado para o evento ${ev.codigoEvento}.`);
        }}
        onReopenEvento={(ev) => onUpdateStatus("EM_ANDAMENTO", ev.id)}
        onHandleEditEvento={handleEditEvento}
        onHandleDeleteEvento={handleDeleteEvento}
        formatUnidade={formatUnidade}
      />
    </div>
  );
}
