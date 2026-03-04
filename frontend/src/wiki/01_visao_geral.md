<!--
Modulo: wiki
Arquivo: frontend/src/wiki/01_visao_geral.md
Funcao no sistema: explicar objetivo, camadas e fluxo principal do sistema.
-->

# VisÃ£o geral do sistema

## Objetivo

O sistema de GestÃ£o Patrimonial da 2a CJM foi desenhado para ser:

- DeterminÃ­stico: sem IA decidindo regras em runtime.
- AuditÃ¡vel: todo ato relevante deixa rastros (importaÃ§Ã£o, alteraÃ§Ãµes, inventÃ¡rio, movimentaÃ§Ãµes).
- Aderente ao ATN 303/2008: regras de compliance implementadas como comportamento verificÃ¡vel.

## Conceitos base (em linguagem simples)

### Bem (item fÃ­sico)

Um **bem** Ã© o objeto fÃ­sico com tombamento (ex.: `1290001788`). Cada tombamento identifica um item Ãºnico.

### material (SKU)

O **catÃ¡logo** descreve "o que Ã©" (modelo/tipo), por exemplo:

- "Cadeira executiva marrom"
- "Monitor Dell 24"

VÃ¡rios bens (itens) podem apontar para o mesmo catÃ¡logo. Isso reduz duplicaÃ§Ã£o de descriÃ§Ãµes (evita "Cadeira 1/10", "Cadeira 2/10"...).

### Unidade (carga/dono)

No sistema, "unidade dona" representa a **carga** do bem (responsabilidade patrimonial).

### Local fÃ­sico (endereço/ambiente)

Representa "onde o item estÃ¡ no prÃ©dio" (ex.: "endereço 101 - 1a Aud"). No inventÃ¡rio, o foco Ã© comparar:

- O que deveria estar (carga/unidade)
- O que foi encontrado naquela endereço/unidade inventariada

## MÃ³dulos principais do site

### 1) Consulta de Bens

Uso:

- Pesquisar por tombamento (10 dÃ­gitos) ou texto na descriÃ§Ã£o.
- Ver lista paginada e abrir "Detalhes" do bem (campos completos + historicos).

### 2) Modo InventÃ¡rio

Uso:

- Registrar contagens por endereço (modo "endereço a endereço").
- Trabalhar agrupado por material (SKU) para ganhar velocidade.
- Registrar divergÃªncias ("intruso") sem transferir carga durante inventÃ¡rio.

### 3) Wizard Art. 141

Uso:

- Classificar bens inservÃ­veis (Ocioso/RecuperÃ¡vel/AntieconÃ´mico/IrrecuperÃ¡vel).
- Esse fluxo deve ser guiado (questionÃ¡rio) e auditÃ¡vel.

### 4) AdministraÃ§Ã£o do Painel

Uso:

- Testar conectividade com backend (`/health`).
- Operar backups/restores e snapshots pre-GEAFIN.
- Gerir perfis/acessos e locais (endereços) cadastrados.
- Operar infraestrutura e seguranca do painel sem alterar regras de negocio.

## Regras de compliance que afetam o usuÃ¡rio (resumo)

- **Congelamento de inventÃ¡rio**: durante inventÃ¡rio `EM_ANDAMENTO`, transferÃªncias (mudanÃ§a de carga) ficam bloqueadas no banco.
  - Regra legal: Art. 183 (AN303_Art183)
- **Intrusos**: se um bem de outra unidade aparece na endereço inventariada, registra divergÃªncia e regulariza depois (com termo).
  - Regra legal: Art. 185 (AN303_Art185)
- **Cautela x TransferÃªncia**: cautela nÃ£o muda carga; transferÃªncia muda carga e exige formalizaÃ§Ã£o.
  - Regra legal: Art. 124 (AN303_Art124) e Art. 127 (AN303_Art127)

## Atualiza?o 2026-02-26 - Reorganiza?o do menu

O sistema agora abre no Dashboard Executivo Operacional.

Distribuicao de modulos:

- Dashboard: abertura com KPIs, inventario ativo e atividade recente.
- Opera?es Patrimoniais: consulta, movimenta?es, cadastro por endereço, inventario, wizard Art. 141, cat?logo (material), gestao de normas e importa?o GEAFIN.
- Auditoria e Logs: log geral, auditoria patrimonial global e erros runtime.
- Administra?o do Painel: backup, conectividade, perfis e locais (endereços) cadastrados.
- Topbar padronizada com status do inventario (status + evento), sem repetir titulo da aba no cabecalho.

## Menu atual - inventario

No grupo **Opera?es Patrimoniais**, o inventario esta dividido em dois menus:

- `Invent?rio - Contagem`: execu?o operacional (leitura, contagens, diverg?ncias, offline-first).
- `Invent?rio - Administra?o`: abertura/encerramento/reabertura de eventos, micro-ciclos e relatorios.

Essa separa?o existe para evitar mistura de funcoes entre operador de endereço e administrador do evento.

