<!--
Modulo: wiki
Arquivo: frontend/src/wiki/01_visao_geral.md
Funcao no sistema: explicar objetivo, camadas e fluxos principais do sistema.
-->

# Visão geral do sistema

## Objetivo

O sistema de Gestão Patrimonial da 2ª CJM foi desenhado para ser:

- determinístico: sem IA decidindo regras de negócio em runtime;
- auditável: cada alteração relevante deixa trilha em banco, API, UI e documentação;
- aderente ao ATN 303/2008: a norma é implementada como regra verificável.

## Conceitos centrais

### Bem

Um **bem** é a instância física tombada. O número de tombamento é a referência operacional mais comum na consulta, no inventário e na triagem de inservíveis.

### Material (SKU)

O **catálogo** representa o tipo ou modelo do item. Vários bens podem apontar para o mesmo material, reduzindo duplicidade descritiva.

### Unidade dona

A unidade dona representa a **carga patrimonial** do bem.

### Local físico

O local físico representa onde o item está no prédio. Inventário, consulta e triagem sempre combinam unidade e local para contextualizar a situação do bem.

## Módulos principais

### 1) Consulta de Bens

Uso:

- localizar bens por tombamento, descrição, material, unidade e filtros operacionais;
- abrir detalhes completos, histórico e vínculos documentais.

### 2) Inventário

Uso:

- registrar contagens por endereço;
- gerir eventos administrativos do inventário;
- monitorar faltantes e divergências;
- medir acuracidade;
- tratar regularização em fluxo próprio.

Estrutura atual da área administrativa:

- `Inventário - Administração`
- `Inventário - Monitoramento`
- `Inventário - Acuracidade`
- `Inventário - Regularização`

Observação técnica:

- a divisão em submenus não alterou a permissão `menu.inventario_admin.view`;
- a mudança é de navegação e foco operacional.

### 3) Material Inservível / Baixa

Uso:

- classificar bens potencialmente inservíveis conforme os Arts. 141 a 152;
- marcar bens para fila de destinação;
- abrir e concluir processos de baixa patrimonial conforme os Arts. 153 a 157.

Observação técnica:

- o sistema preserva o `tab id` `classificacao` e a permissão `menu.classificacao.view` por compatibilidade;
- a interface exibida ao usuário se chama **Material Inservível / Baixa**.

### 4) Administração do Painel

Uso:

- gerenciar perfis, ACL, locais, conectividade, backup e aprovações;
- operar o ambiente sem alterar regras legais do patrimônio.

### 5) Wiki / Manual do Sistema

Uso:

- documentar telas, contratos de API, regras legais e procedimentos operacionais;
- cumprir a política **Wiki-First** do projeto.

## Fluxos operacionais em destaque

### Inventário administrativo

1. `Inventário - Administração` abre e governa o ciclo.
2. `Inventário - Monitoramento` acompanha pendências e divergências.
3. `Inventário - Acuracidade` consolida histórico e indicadores.
4. `Inventário - Regularização` trata o pós-inventário em fluxo formal.

### Material Inservível / Baixa

1. O operador localiza o bem.
2. O stepper determina a classificação `OCIOSO`, `RECUPERÁVEL`, `ANTIECONÔMICO` ou `IRRECUPERÁVEL`.
3. A avaliação vira histórico auditável.
4. O bem recebe uma marcação atual na fila de candidatos.
5. A fila alimenta um processo de baixa patrimonial.
6. Ao concluir, o bem passa a `status = BAIXADO`, com causa formal, data e documentos vinculados.

## Regras legais que mais afetam o usuário

- Art. 141 (AN303_Art141_*): classificação obrigatória e guiada de inservíveis.
- Art. 142 (AN303_Art142): só avançar para destinação quando permanência ou remanejamento forem desaconselháveis ou inexequíveis.
- Arts. 143 a 157 (AN303_Art143 a AN303_Art157): venda, doação, permuta, inutilização, abandono e baixa exigem formalização específica.
- Art. 183 (AN303_Art183): inventário ativo bloqueia movimentação de carga.
- Art. 185 (AN303_Art185): divergência de inventário não transfere carga automaticamente.

## Limites atuais

- não há integração automática com GEAFIN, SEI, SIAFI ou n8n para o fluxo de baixa;
- o sistema registra referências formais, anexos e placeholders documentais para posterior instrução do processo;
- a área de inventário administrativo foi reorganizada visualmente, mas preserva o mesmo backend, os mesmos fluxos e as mesmas regras legais.
