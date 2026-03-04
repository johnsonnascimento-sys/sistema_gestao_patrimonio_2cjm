<!--
MÃ³dulo: wiki
Arquivo: frontend/src/wiki/22_inventario_administracao.md
FunÃ§Ã£o no sistema: orientar a operaÃ§Ã£o no menu InventÃ¡rio - AdministraÃ§Ã£o.
-->

# InventÃ¡rio - AdministraÃ§Ã£o

## Objetivo da tela

A tela **InventÃ¡rio - AdministraÃ§Ã£o** concentra quatro tarefas:

1. controlar inventÃ¡rio em andamento (encerrar, cancelar, reabrir);
2. abrir novo inventÃ¡rio em formulÃ¡rio Ãºnico;
3. monitorar divergÃªncias interunidades em tempo real;
4. acompanhar histÃ³rico e relatÃ³rio consolidado.

## Estrutura da pÃ¡gina

### 1) Controle do InventÃ¡rio

- mostra se existe inventÃ¡rio ativo;
- permite selecionar o inventÃ¡rio em andamento;
- exibe resumo operacional: cÃ³digo, escopo, modo e unidade;
- aÃ§Ãµes crÃ­ticas:
  - `Encerrar inventÃ¡rio`
  - `Cancelar inventÃ¡rio`
- essas aÃ§Ãµes usam confirmaÃ§Ã£o forte em modal (sem `window.confirm`).

### 2) Novo inventÃ¡rio (formulÃ¡rio Ãºnico)

Substitui a duplicidade antiga de "abrir evento" + "novo micro-inventÃ¡rio".

Presets rÃ¡pidos:

- `InventÃ¡rio geral`
- `Ciclo semanal 1Âª Aud`
- `Ciclo semanal 2Âª Aud`
- `Ciclo semanal Foro`
- `Ciclo semanal Almox`
- `Por endereço`

Comportamento por escopo:

- `GERAL`:
  - oculta `Tipo de ciclo`;
  - oculta `Unidade inventariada`;
  - CTA: `Abrir inventÃ¡rio geral`.
- `UNIDADE`:
  - mostra `Tipo de ciclo`;
  - mostra `Unidade inventariada`;
  - CTA: `Abrir micro-inventÃ¡rio`.
- `LOCAIS`:
  - mostra `Tipo de ciclo`;
  - mostra `Unidade inventariada`;
  - mostra seleÃ§Ã£o de endereços;
  - CTA: `Abrir micro-inventÃ¡rio`.

### 3) SugestÃµes de ciclo

- clique na sugestÃ£o preenche automaticamente o formulÃ¡rio com:
  - `escopoTipo=LOCAIS`
  - `tipoCiclo=SEMANAL`
  - unidade e endereço sugeridas.

### 4) Lateral operacional

- progresso do inventÃ¡rio;
- monitoramento por endereço e rodada (A, B, DESEMPATE);
- painel `DivergÃªncias interunidades (tempo real)`;
- histÃ³rico resumido.

## ConcomitÃ¢ncia de inventÃ¡rios por unidade

Regra operacional exibida na UI:

- inventÃ¡rios `UNIDADE` e `LOCAIS` podem rodar em paralelo entre unidades;
- inventÃ¡rio `GERAL` Ã© exclusivo.

Exemplos:

- Unidade 2 e Unidade 3 podem inventariar ao mesmo tempo.
- NÃ£o pode haver dois inventÃ¡rios ativos da mesma unidade.
- Se existir inventÃ¡rio `GERAL` ativo, nenhum inventÃ¡rio por unidade ou local deve abrir.

## DivergÃªncias interunidades (tempo real)

Painel de monitoramento cruzado:

- visÃ£o `Da minha unidade encontradas fora`;
- visÃ£o `Outras unidades encontradas na minha`;
- KPIs operacionais de `Pendentes`, `Regularizadas`, `Em andamento` e `Encerrado`;
- filtros:
  - status do inventÃ¡rio (`TODOS`, `EM_ANDAMENTO`, `ENCERRADO`);
  - unidade relacionada;
  - cÃ³digo do inventÃ¡rio;
  - endereço;
- aÃ§Ã£o rÃ¡pida `Limpar filtros`;
- tabela com badges visuais para status do inventÃ¡rio, tipo de divergÃªncia e situaÃ§Ã£o de regularizaÃ§Ã£o.

Importante:

- este painel Ã© de leitura;
- a regularizaÃ§Ã£o continua no fluxo pÃ³s-inventÃ¡rio (Art. 185).

## Modos de contagem

### `PADRAO`

- sem isolamento de rodada;
- fluxo de inventÃ¡rio tradicional.

### `CEGO`

- exige 1 operador (`OPERADOR_UNICO`);
- operador nÃ£o vÃª esperado nem diferenÃ§a;
- admin monitora progresso sem quebrar a cegueira.

### `DUPLO_CEGO`

- exige 2 operadores (`OPERADOR_A` e `OPERADOR_B`);
- cada operador grava apenas sua rodada;
- divergÃªncias A/B geram pendÃªncia de desempate;
- desempate Ã© feito por perfil autorizado.

## ConfirmaÃ§Ã£o forte (aÃ§Ãµes crÃ­ticas)

Ao encerrar ou cancelar:

- modal mostra inventÃ¡rio alvo e impacto da aÃ§Ã£o;
- campo de observaÃ§Ã£o opcional;
- somente apÃ³s confirmaÃ§Ã£o explÃ­cita a aÃ§Ã£o Ã© enviada.

## Compliance preservado

- Art. 183 (AN303_Art183): inventÃ¡rio ativo bloqueia mudanÃ§a de carga.
- Art. 185 (AN303_Art185): divergÃªncia nÃ£o transfere carga automaticamente.
- Art. 175 (AN303_Art175): itens sem identificaÃ§Ã£o exigem evidÃªncia visual.

## Painel de Acuracidade

O card "Acuracidade de Inventario" usa `GET /inventario/indicadores-acuracidade` e exibe:

- acuracidade exata por item (`conformes / totalContagens`)
- acuracidade por tolerancia de endereço (`erroRelendereço <= toleranciaPct`)
- taxa de divergencia
- taxa de pendencia de regularizacao
- MTTR de regularizacao (dias)
- cobertura de contagem (`sum(qtdInventariados) / max(sum(qtdEsperados),1)`)

Semaforo operacional:

- Acuracidade Exata: verde `>=98`, amarelo `95-97.99`, vermelho `<95`
- Acuracidade Tolerancia: verde `>=95`, amarelo `90-94.99`, vermelho `<90`
- Pendencia de Regularizacao: verde `<=5`, amarelo `5.01-10`, vermelho `>10`
- MTTR: verde `<=5 dias`, amarelo `6-10`, vermelho `>10`
- Cobertura: verde `>=99`, amarelo `95-98.99`, vermelho `<95`

## Regra operacional para cancelar evento

`CANCELADO` e status de descarte operacional (erro de abertura/configuracao/teste) e nao substitui fechamento do ciclo.

Consequencia:

- evento `CANCELADO` nao permite regularizacao pos-inventario (`POST /inventario/regularizacoes` exige `ENCERRADO`).

Guard rails da UI:

- modal de acao critica explica que cancelamento descarta o evento para regularizacao;
- para cancelar, o operador deve digitar exatamente `CANCELAR_INVENTARIO`.

