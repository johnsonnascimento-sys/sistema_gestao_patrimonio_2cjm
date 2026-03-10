<!--
Modulo: wiki
Arquivo: frontend/src/wiki/01_visao_geral.md
Funcao no sistema: explicar objetivo, camadas e fluxos principais do sistema.
-->

# Visão geral do sistema

## Objetivo

O sistema de Gestão Patrimonial da 2ª CJM foi desenhado para ser:

- Determinístico: sem IA decidindo regras de negócio em runtime.
- Auditável: cada alteração relevante deixa trilha em banco, API, UI e documentação.
- Aderente ao ATN 303/2008: a norma é implementada como regra verificável.

## Conceitos centrais

### Bem

Um **bem** é a instância física tombada. O número de tombamento identifica um item único e é a referência operacional mais comum na consulta e na triagem.

### Material (SKU)

O **catálogo** representa o tipo/modelo do item. Vários bens podem apontar para o mesmo material, reduzindo duplicidade descritiva.

### Unidade dona

A unidade dona representa a **carga patrimonial** do bem.

### Local físico

O local físico representa onde o item está no prédio. Inventário e triagem trabalham sempre com unidade e local para contextualizar a situação do bem.

## Módulos principais

### 1) Consulta de Bens

Uso:

- localizar bens por tombamento, descrição, material, unidade e filtros operacionais;
- abrir detalhes completos, histórico e vínculos documentais.

### 2) Inventário

Uso:

- registrar contagens por endereço;
- tratar divergências sem trocar carga automaticamente;
- manter regularização posterior em fluxo formal.

### 3) Material Inservível / Baixa

Uso:

- classificar bens potencialmente inservíveis conforme os Arts. 141 a 152;
- marcar bens para fila de destinação;
- abrir e concluir processos de baixa patrimonial conforme os Arts. 153 a 157.

Observação técnica:

- o sistema preserva o `tab id` `classificacao` e a permissão `menu.classificacao.view` por compatibilidade;
- a interface exibida ao usuário passou a se chamar **Material Inservível / Baixa**.

### 4) Administração do Painel

Uso:

- gerenciar perfis, ACL, locais, conectividade, backup e aprovações;
- operar o ambiente sem alterar regras legais do patrimônio.

### 5) Wiki / Manual do Sistema

Uso:

- documentar telas, contratos de API, regras legais e procedimentos operacionais;
- cumprir a política **Wiki-First** do projeto.

## Fluxo novo de Material Inservível / Baixa

### Triagem

1. O operador localiza o bem.
2. O stepper determina a classificação `OCIOSO`, `RECUPERÁVEL`, `ANTIECONÔMICO` ou `IRRECUPERÁVEL`.
3. A avaliação vira histórico auditável.
4. O bem recebe uma marcação atual na fila de candidatos.

### Baixa patrimonial

1. A fila alimenta um rascunho de processo.
2. O processo define modalidade principal:
   - `VENDA`
   - `CESSÃO`
   - `DOAÇÃO`
   - `PERMUTA`
   - `INUTILIZAÇÃO`
   - `ABANDONO`
   - `DESAPARECIMENTO`
3. O backend valida exigências legais por modalidade.
4. Ao concluir, o bem passa a `status = BAIXADO`, com causa formal, data e documentos vinculados.

## Regras legais que mais afetam o usuário

- Art. 141 (AN303_Art141_*): classificação obrigatória e guiada de inservíveis.
- Art. 142 (AN303_Art142): só avançar para destinação quando permanência/remanejamento for desaconselhável ou inexequível.
- Art. 143 (AN303_Art143): venda exige avaliação prévia e licitação.
- Art. 144 (AN303_Art144): doação, permuta e venda para órgão público seguem elegibilidade por classe e tipo de destinatário.
- Arts. 148 a 152 (AN303_Art148 a AN303_Art152): inutilização e abandono exigem justificativas, motivos estruturados e documentação própria.
- Arts. 153 a 157 (AN303_Art153 a AN303_Art157): baixa patrimonial exige causa formal, manifestação da SCI, ato do Diretor-Geral e registro expresso no bem.

## Escopo desta entrega

- Não há integração automática com GEAFIN, SEI, SIAFI ou n8n para o fluxo de baixa.
- O sistema registra referências formais, anexos e placeholders documentais para posterior instrução do processo.
