<!--
Módulo: wiki
Arquivo: frontend/src/wiki/22_inventario_administracao.md
Função no sistema: orientar a operação no menu Inventário - Administração.
-->

# Inventário - Administração

## Objetivo da tela

A tela **Inventário - Administração** concentra quatro tarefas:

1. controlar inventário em andamento (encerrar, cancelar, reabrir);
2. abrir novo inventário em formulário único;
3. monitorar divergências interunidades em tempo real;
4. acompanhar histórico e relatório consolidado.

## Estrutura da página

### 1) Controle do Inventário

- mostra se existe inventário ativo;
- permite selecionar o inventário em andamento;
- exibe resumo operacional: código, escopo, modo e unidade;
- ações críticas:
  - `Encerrar inventário`
  - `Cancelar inventário`
- essas ações usam confirmação forte em modal (sem `window.confirm`).

### 2) Novo inventário (formulário único)

Substitui a duplicidade antiga de "abrir evento" + "novo micro-inventário".

Presets rápidos:

- `Inventário geral`
- `Ciclo semanal 1ª Aud`
- `Ciclo semanal 2ª Aud`
- `Ciclo semanal Foro`
- `Ciclo semanal Almox`
- `Por sala`

Comportamento por escopo:

- `GERAL`:
  - oculta `Tipo de ciclo`;
  - oculta `Unidade inventariada`;
  - CTA: `Abrir inventário geral`.
- `UNIDADE`:
  - mostra `Tipo de ciclo`;
  - mostra `Unidade inventariada`;
  - CTA: `Abrir micro-inventário`.
- `LOCAIS`:
  - mostra `Tipo de ciclo`;
  - mostra `Unidade inventariada`;
  - mostra seleção de salas;
  - CTA: `Abrir micro-inventário`.

### 3) Sugestões de ciclo

- clique na sugestão preenche automaticamente o formulário com:
  - `escopoTipo=LOCAIS`
  - `tipoCiclo=SEMANAL`
  - unidade e sala sugeridas.

### 4) Lateral operacional

- progresso do inventário;
- monitoramento por sala e rodada (A, B, DESEMPATE);
- painel `Divergências interunidades (tempo real)`;
- histórico resumido.

## Concomitância de inventários por unidade

Regra operacional exibida na UI:

- inventários `UNIDADE` e `LOCAIS` podem rodar em paralelo entre unidades;
- inventário `GERAL` é exclusivo.

Exemplos:

- Unidade 2 e Unidade 3 podem inventariar ao mesmo tempo.
- Não pode haver dois inventários ativos da mesma unidade.
- Se existir inventário `GERAL` ativo, nenhum inventário por unidade ou local deve abrir.

## Divergências interunidades (tempo real)

Painel de monitoramento cruzado:

- visão `Da minha unidade encontradas fora`;
- visão `Outras unidades encontradas na minha`;
- KPIs operacionais de `Pendentes`, `Regularizadas`, `Em andamento` e `Encerrado`;
- filtros:
  - status do inventário (`TODOS`, `EM_ANDAMENTO`, `ENCERRADO`);
  - unidade relacionada;
  - código do inventário;
  - sala;
- ação rápida `Limpar filtros`;
- tabela com badges visuais para status do inventário, tipo de divergência e situação de regularização.

Importante:

- este painel é de leitura;
- a regularização continua no fluxo pós-inventário (Art. 185).

## Modos de contagem

### `PADRAO`

- sem isolamento de rodada;
- fluxo de inventário tradicional.

### `CEGO`

- exige 1 operador (`OPERADOR_UNICO`);
- operador não vê esperado nem diferença;
- admin monitora progresso sem quebrar a cegueira.

### `DUPLO_CEGO`

- exige 2 operadores (`OPERADOR_A` e `OPERADOR_B`);
- cada operador grava apenas sua rodada;
- divergências A/B geram pendência de desempate;
- desempate é feito por perfil autorizado.

## Confirmação forte (ações críticas)

Ao encerrar ou cancelar:

- modal mostra inventário alvo e impacto da ação;
- campo de observação opcional;
- somente após confirmação explícita a ação é enviada.

## Compliance preservado

- Art. 183 (AN303_Art183): inventário ativo bloqueia mudança de carga.
- Art. 185 (AN303_Art185): divergência não transfere carga automaticamente.
- Art. 175 (AN303_Art175): itens sem identificação exigem evidência visual.

## Painel de Acuracidade

O card "Acuracidade de Inventario" usa `GET /inventario/indicadores-acuracidade` e exibe:

- acuracidade exata por item (`conformes / totalContagens`)
- acuracidade por tolerancia de sala (`erroRelSala <= toleranciaPct`)
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
