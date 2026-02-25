# PROJECT_RULES.md

## Cabecalho do Documento

| Campo | Valor |
|---|---|
| Modulo | Governanca do Projeto |
| Proposito | Constituicao tecnica, legal e de documentacao do Sistema de Gestao Patrimonial da 2a CJM |
| Versao | v1.2.0 |
| Data | 2026-02-25 |
| Status | Ativo |
| Fonte de Verdade | Este arquivo (`PROJECT_RULES.md`) |

## 1. Objetivo do Projeto

Construir e evoluir um sistema de gestao patrimonial para a 2a Circunscricao Judiciaria Militar (2a CJM), com execucao deterministica, alta auditabilidade e aderencia legal ao ATN 303/2008.

Diretrizes obrigatorias:
- Nao usar IA para decidir regras de negocio em runtime.
- Toda regra legal deve ser implementada de forma verificavel e rastreavel.
- Divergencias entre implementacao e documentacao devem ser tratadas atualizando a documentacao no mesmo ciclo de entrega.

## 2. Stack Tecnologica Permitida

Escopo tecnologico permitido para este projeto:
- Infraestrutura: VPS Hostinger, Ubuntu 24.04, CloudPanel e Docker.
- Banco de Dados: Supabase Cloud (PostgreSQL) via conexao externa segura.
- Backend: Node.js + Express em container Docker Compose, porta interna `3001`.
- Frontend: React (Vite + Tailwind), publicado como site estatico no Nginx.
- Frontend UI: TailwindCSS deve ser o sistema primario de estilo; CSS global complementar deve ser pequeno, justificado e sem substituir utilitarios Tailwind.
- Automacao: n8n para geracao de PDF, relatorios, upload em Drive e integracoes operacionais por webhook/API.
- Integracao legada: importacao de CSV do GEAFIN com codificacao Latin1 e tratamento robusto de variacoes de encoding.

Fora do escopo:
- Qualquer stack nao listada acima sem revisao formal deste documento.
- Uso de IA para executar regras transacionais ou de compliance.

## 3. Contrato Publico de Governanca e Runtime

O sistema possui API de runtime ativa. Este documento define contratos publicos obrigatorios de governanca e de evolucao:
- Interface documental obrigatoria de secoes do `PROJECT_RULES.md`.
- Convencao obrigatoria de citacao legal no formato `Art. X (AN303_ArtX)`.
- Contrato obrigatorio de estrutura de pastas e nomenclatura.
- Mudancas de runtime (endpoints, payloads, fluxos) devem manter rastreabilidade no Wiki/Manual e em documentacao tecnica.

## 4. Regras de Ouro do ATN 303/2008 (Inviolaveis)

### Regra 1: Congelamento de Movimentacao no Inventario
- Base legal: `Art. 183 (AN303_Art183)`.
- Regra de negocio: durante inventario em andamento, fica vedada movimentacao de bens da unidade inventariada.
- Implicacao tecnica minima: bloquear alteracao de posse/carga durante evento de inventario `EM_ANDAMENTO`.

### Regra 2: Regularizacao de Divergencias sem Troca Automatica de Dono
- Base legal: `Art. 185 (AN303_Art185)`.
- Regra de negocio: divergencias identificadas no inventario devem ser regularizadas em fluxo proprio, sem transferencia automatica de titularidade no ato da contagem.
- Implicacao tecnica minima: registrar divergencia e exigir etapa posterior formal de regularizacao.

### Regra 3: Responsabilidade por Carga e Saida Fisica Controlada
- Base legal: `Art. 124 (AN303_Art124)` e `Art. 127 (AN303_Art127)`.
- Regra de negocio: responsabilidade por bens deve estar formalizada; retirada fisica de bem depende de autorizacao competente.
- Implicacao tecnica minima: diferenciar transferencia definitiva de cautela temporaria e exigir registro formal de autorizacao.

### Regra 3.1: Evidencia para Itens Nao Identificados
- Base legal: `Art. 175 (AN303_Art175)`.
- Regra de negocio: bens encontrados sem placa de identificacao (tombamento) devem ter sua presenca formalizada visual e descritivamente.
- Implicacao tecnica minima: exigir foto, descricao detalhada e localizacao nas telas e fluxos de divergencia/regularizacao.

### Regra 4: Classificacao Obrigatoria de Inserviveis
- Base legal: `Art. 141, Caput (AN303_Art141_Cap)`, `Art. 141, I (AN303_Art141_I)`, `Art. 141, II (AN303_Art141_II)`, `Art. 141, III (AN303_Art141_III)`, `Art. 141, IV (AN303_Art141_IV)`.
- Regra de negocio: bens inserviveis devem ser classificados obrigatoriamente como Ocioso, Recuperavel, Antieconomico ou Irrecuperavel.
- Implicacao tecnica minima: fluxo guiado (wizard/questionario) com classificacao obrigatoria e criterio auditavel.

### Regra 5: Controle Segregado de Bens de Terceiros
- Base legal: `Art. 99 (AN303_Art99)`, `Art. 110, VI (AN303_Art110_VI)`, `Art. 175, IX (AN303_Art175_IX)`.
- Regra de negocio: bens de terceiros em uso no predio devem ter controle especifico, sem tombamento indevido como patrimonio STM.
- Implicacao tecnica minima: manter trilha separada de bens de terceiros e impedir incorporacao automatica ao patrimonio proprio.

## 5. Estrutura de Pastas Obrigatoria

```text
/backend
/frontend
/database
/automations
/docs
/scripts
```

Responsabilidades:
- `/backend`: API Node.js/Express, middlewares, validacoes, regras transacionais e endpoints de runtime.
- `/frontend`: aplicacao React, telas de operacao, PWA e fluxos de compliance.
- `/database`: DDL, DML controlado, funcoes, triggers e seeds auditaveis.
- `/automations`: especificacoes e artefatos de fluxo n8n (JSON e docs de operacao).
- `/docs`: documentacao funcional, tecnica, compliance e operacao.
- `/scripts`: scripts utilitarios de suporte (importacao, validacao e auditoria).

## 6. Padroes de Nomenclatura

| Elemento | Padrao | Exemplo |
|---|---|---|
| Tabelas/colunas SQL | `snake_case` | `eventos_inventario`, `unidade_dona_id` |
| Componentes React | `PascalCase` | `WizardClassificacaoModal` |
| Funcoes/variaveis JS | `camelCase` | `registrarMovimentacao` |
| Constantes | `UPPER_SNAKE_CASE` | `STATUS_EM_CAUTELA` |
| Endpoints REST | recursos em minusculo; usar `kebab-case` em segmentos compostos; legado permitido se documentado | `/importar-geafin`, `/inventario/bens-terceiros`, `/auth/me` |
| Arquivos Markdown de regra | `UPPER_SNAKE_CASE` ou nome fechado acordado | `PROJECT_RULES.md` |

## 7. Padroes de Documentacao Obrigatorios

### 7.1 Cabecalho em arquivos autorais
Todo arquivo novo autoral deve iniciar com cabecalho explicando funcao e modulo.

Excecoes:
- arquivos auto-gerados (`generated`, `dist`, `build`);
- artefatos de terceiros e arquivos estritamente externos/importados.

Exemplo (JS/TS):
```js
/**
 * Modulo: Movimentacoes
 * Arquivo: service de aplicacao para cautela e transferencia.
 * Funcao no sistema: aplicar regras de compliance do ATN 303.
 */
```

Exemplo (SQL):
```sql
-- Modulo: Inventario
-- Arquivo: trigger de bloqueio de movimentacao.
-- Funcao no sistema: aplicar congelamento legal durante inventario.
```

### 7.2 JSDoc em funcoes complexas
Funcoes complexas devem documentar parametros, retorno e erros esperados.

Template minimo:
```ts
/**
 * Executa movimentacao de bem com validacao de compliance.
 * @param input Dados normalizados da solicitacao.
 * @returns Resultado com status da operacao e protocolo de auditoria.
 * @throws Error Quando regra legal impedir a operacao.
 */
```

### 7.3 Citacao legal obrigatoria em codigo
Toda regra de negocio derivada de norma deve citar artigo e ID normalizado.

Exemplo obrigatorio:
```js
// Regra legal: bloqueio de movimentacao em inventario - Art. 183 (AN303_Art183)
```

## 8. Politica de Segredos e Compliance Operacional

Regras obrigatorias:
- Proibido versionar credenciais, tokens, senhas, chaves privadas ou connection strings reais.
- Segredos devem existir somente em `.env` local nao versionado ou secret manager equivalente.
- Documentacao deve usar placeholders (ex.: `SUPABASE_DB_PASSWORD=<preencher_no_ambiente>`).
- Exposicao acidental de segredo exige rotacao imediata e registro de incidente.
- Revisoes de PR devem reprovar qualquer dado sensivel em codigo, log, script ou markdown.

## 9. Governanca de Mudancas e Gate de Qualidade

Regras de mudanca:
- Qualquer alteracao de regra legal exige atualizacao explicita deste arquivo.
- Qualquer alteracao de stack fora do permitido exige revisao formal deste arquivo.
- Mudancas de runtime (endpoint, contrato de payload/resposta, autorizacao, fluxo operacional) exigem atualizacao do Wiki/Manual e da documentacao tecnica relacionada no mesmo PR/commit.
- Mudancas visuais devem preservar contratos de interface usados por JavaScript (`id`, `name`, classes referenciadas, `data-*` e atributos de formulario com impacto funcional).
- Refatoracao visual deve ser incremental por fase, com checkpoint de regressao funcional ao final de cada fase.
- Redesign guiado por imagem de referencia exige checklist de paridade visual e evidencia (antes/depois) no mesmo ciclo documental.
- PR sem aderencia ao `PROJECT_RULES.md` deve ser reprovado.

## 10. Regra Wiki-First (Manual Operacional Obrigatorio)

O projeto deve manter um manual/wiki self-hosted publicado junto do sistema (aba "Wiki / Manual").

Regras obrigatorias:
- Qualquer mudanca em UX, fluxos operacionais, endpoints, contratos de resposta, regras de negocio ou compliance exige atualizacao do Wiki no mesmo PR/commit.
- O Wiki nao pode conter segredos (senhas, tokens, connection strings). Use placeholders.
- Em divergencia entre o sistema e o Wiki, o sistema deve ser considerado em nao-conformidade ate a documentacao ser atualizada.

## 11. Criterios de Aceite da Governanca (Estado Atual)

- Existe `PROJECT_RULES.md` na raiz do repositorio como fonte unica de governanca.
- Existem no minimo 5 Regras de Ouro com base legal e implicacao tecnica minima (incluindo sub-regras quando aplicavel, como a 3.1).
- A estrutura de pastas obrigatoria esta definida com responsabilidades claras.
- Os padroes de nomenclatura cobrem SQL, React, JS, constantes e endpoints.
- Os padroes de documentacao cobrem cabecalho de arquivo, JSDoc e citacao legal.
- A politica de segredos proibe credenciais no repositorio e define rotacao.
- O gate Wiki-First e a governanca de mudancas de runtime estao explicitos.
- Existe diretriz explicita para refatoracao visual sem impacto funcional (Secao 12), incluindo paridade visual por referencia, processo por fases e gate de regressao.

## 12. Diretriz de Refatoracao Visual Frontend (Sem Impacto Funcional)

### 12.1 Objetivo
Permitir modernizacao visual da aplicacao frontend preservando 100% do comportamento existente, com paridade de hierarquia e composicao em relacao a referencia visual aprovada.

### 12.2 Escopo permitido
- Ajustes de layout, hierarquia visual, espacamento, tipografia, cores, cards, tabelas e formularios.
- Reorganizacao estrutural de JSX com wrappers/containers adicionais.
- Inclusao de classes utilitarias Tailwind e pequenos estilos complementares quando estritamente necessario.

### 12.3 Escopo proibido
- Alterar logica de backend, contratos de API, schema de banco, autenticacao, regras de negocio ou compliance.
- Alterar rotas funcionais da aplicacao.
- Introduzir bibliotecas de UI fora da stack permitida sem revisao formal deste documento.

### 12.4 Preservacao de contratos de UI
- Nao remover ou renomear atributos usados por comportamento funcional (`id`, `name`, `data-*`, classes referenciadas por JS, atributos com impacto operacional como `accept` e `capture`).
- Nao remover campos de formulario obrigatorios para payloads existentes.
- Nao quebrar fluxo de scanner, upload de arquivo, sincronizacao offline e navegacao ja implementada.

### 12.5 Diretriz de paridade visual por referencia
- Redesign deve seguir estilo visual claro, institucional e de baixa poluicao visual.
- Priorizar superficies claras, bordas sutis, sombra leve e acento roxo/lilas discreto.
- Proibir resultados com predominancia dark, gradientes pesados, glassmorphism, neon ou excesso de animacao.
- Em caso de conflito entre referencia visual e governanca funcional/compliance, prevalece este `PROJECT_RULES.md`.

### 12.6 Blueprint minimo de layout (quando aplicavel)
- Sidebar fixa a esquerda (largura aproximada 220-240px), com item ativo destacado.
- Topbar simples no conteudo principal (altura aproximada 68-72px).
- Conteudo principal com ritmo de espacamento 24-32px.
- Dashboard com composicao de cards e tabela em grade organizada, mantendo densidade legivel.

### 12.7 Processo obrigatorio para redesign
- Etapa A: mapear telas/componentes/seletores e identificar riscos funcionais.
- Etapa B: apresentar plano em fases (layout, design system, refinamento) com riscos e mitigacoes.
- Etapa C: implementar incrementalmente, iniciando por Fase 1 e validando regressao antes de prosseguir.

### 12.8 Gate de aceite por fase
- Comportamento funcional inalterado.
- Zero regressao em fluxos criticos.
- Responsividade preservada (desktop e mobile).
- Sem erro de runtime no frontend.
- Consistencia visual da fase entregue.
- Paridade visual com referencia validada por checklist.
- Atualizacao de documentacao obrigatoria conforme regra Wiki-First.

### 12.9 Evidencias minimas de validacao
- Lista de arquivos alterados/criados.
- Lista de contratos de UI preservados.
- Resultado de smoke tests manuais dos fluxos criticos.
- Capturas antes/depois e checklist de paridade visual.
- Registro das atualizacoes de documentacao feitas no mesmo ciclo.
