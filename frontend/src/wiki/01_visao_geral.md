<!--
Modulo: wiki
Arquivo: frontend/src/wiki/01_visao_geral.md
Funcao no sistema: explicar objetivo, camadas e fluxo principal do sistema.
-->

# Visão geral do sistema

## Objetivo

O sistema de Gestão Patrimonial da 2a CJM foi desenhado para ser:

- Determinístico: sem IA decidindo regras em runtime.
- Auditável: todo ato relevante deixa rastros (importação, alterações, inventário, movimentações).
- Aderente ao ATN 303/2008: regras de compliance implementadas como comportamento verificável.

## Conceitos base (em linguagem simples)

### Bem (item físico)

Um **bem** é o objeto físico com tombamento (ex.: `1290001788`). Cada tombamento identifica um item único.

### Catálogo (SKU)

O **catálogo** descreve "o que é" (modelo/tipo), por exemplo:

- "Cadeira executiva marrom"
- "Monitor Dell 24"

Vários bens (itens) podem apontar para o mesmo catálogo. Isso reduz duplicação de descrições (evita "Cadeira 1/10", "Cadeira 2/10"...).

### Unidade (carga/dono)

No sistema, "unidade dona" representa a **carga** do bem (responsabilidade patrimonial).

### Local físico (sala/ambiente)

Representa "onde o item está no prédio" (ex.: "Sala 101 - 1a Aud"). No inventário, o foco é comparar:

- O que deveria estar (carga/unidade)
- O que foi encontrado naquela sala/unidade inventariada

## Módulos principais do site

### 1) Consulta de Bens

Uso:

- Pesquisar por tombamento (10 dígitos) ou texto na descrição.
- Ver lista paginada e abrir "Detalhes" do bem (campos completos + historicos).

### 2) Modo Inventário

Uso:

- Registrar contagens por sala (modo "sala a sala").
- Trabalhar agrupado por catálogo (SKU) para ganhar velocidade.
- Registrar divergências ("intruso") sem transferir carga durante inventário.

### 3) Wizard Art. 141

Uso:

- Classificar bens inservíveis (Ocioso/Recuperável/Antieconômico/Irrecuperável).
- Esse fluxo deve ser guiado (questionário) e auditável.

### 4) Operações API

Uso:

- Testar conectividade com backend (`/health`).
- Importar GEAFIN (CSV Latin1) e acompanhar progresso.

## Regras de compliance que afetam o usuário (resumo)

- **Congelamento de inventário**: durante inventário `EM_ANDAMENTO`, transferências (mudança de carga) ficam bloqueadas no banco.
  - Regra legal: Art. 183 (AN303_Art183)
- **Intrusos**: se um bem de outra unidade aparece na sala inventariada, registra divergência e regulariza depois (com termo).
  - Regra legal: Art. 185 (AN303_Art185)
- **Cautela x Transferência**: cautela não muda carga; transferência muda carga e exige formalização.
  - Regra legal: Art. 124 (AN303_Art124) e Art. 127 (AN303_Art127)
