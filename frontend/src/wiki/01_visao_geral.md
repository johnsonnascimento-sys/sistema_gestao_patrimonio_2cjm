<!--
Modulo: wiki
Arquivo: frontend/src/wiki/01_visao_geral.md
Funcao no sistema: explicar objetivo, camadas e fluxo principal do sistema.
-->

# Visao geral do sistema

## Objetivo

O sistema de Gestao Patrimonial da 2a CJM foi desenhado para ser:

- Deterministico: sem IA decidindo regras em runtime.
- Auditavel: todo ato relevante deixa rastros (importacao, alteracoes, inventario, movimentacoes).
- Aderente ao ATN 303/2008: regras de compliance implementadas como comportamento verificavel.

## Conceitos base (em linguagem simples)

### Bem (item fisico)

Um **bem** e o objeto fisico com tombamento (ex.: `1290001788`). Cada tombamento identifica um item unico.

### Catalogo (SKU)

O **catalogo** descreve "o que e" (modelo/tipo), por exemplo:

- "Cadeira executiva marrom"
- "Monitor Dell 24"

Varios bens (itens) podem apontar para o mesmo catalogo. Isso reduz duplicacao de descricoes (evita "Cadeira 1/10", "Cadeira 2/10"...).

### Unidade (carga/dono)

No sistema, "unidade dona" representa a **carga** do bem (responsabilidade patrimonial).

### Local fisico (sala/ambiente)

Representa "onde o item esta no predio" (ex.: "Sala 101 - 1a Aud"). No inventario, o foco e comparar:

- O que deveria estar (carga/unidade)
- O que foi encontrado naquela sala/unidade inventariada

## Modulos principais do site

### 1) Consulta de Bens

Uso:

- Pesquisar por tombamento (10 digitos) ou texto na descricao.
- Ver lista paginada e abrir "Detalhes" do bem (campos completos + historicos).

### 2) Modo Inventario

Uso:

- Registrar contagens por sala (modo "sala a sala").
- Trabalhar agrupado por catalogo (SKU) para ganhar velocidade.
- Registrar divergencias ("intruso") sem transferir carga durante inventario.

### 3) Wizard Art. 141

Uso:

- Classificar bens inserviveis (Ocioso/Recuperavel/Antieconomico/Irrecuperavel).
- Esse fluxo deve ser guiado (questionario) e auditavel.

### 4) Operacoes API

Uso:

- Testar conectividade com backend (`/health`).
- Importar GEAFIN (CSV Latin1) e acompanhar progresso.

## Regras de compliance que afetam o usuario (resumo)

- **Congelamento de inventario**: durante inventario `EM_ANDAMENTO`, transferencias (mudanca de carga) ficam bloqueadas no banco.
  - Regra legal: Art. 183 (AN303_Art183)
- **Intrusos**: se um bem de outra unidade aparece na sala inventariada, registra divergencia e regulariza depois (com termo).
  - Regra legal: Art. 185 (AN303_Art185)
- **Cautela x Transferencia**: cautela nao muda carga; transferencia muda carga e exige formalizacao.
  - Regra legal: Art. 124 (AN303_Art124) e Art. 127 (AN303_Art127)

