<!--
Modulo: wiki
Arquivo: frontend/src/wiki/06_inventario_sala_a_sala.md
Funcao no sistema: orientar o fluxo de Inventario - Contagem (operacao por endereco).
-->

# Inventário - Contagem

## Onde acessar no menu

No grupo **Operações Patrimoniais**:

- `Inventário - Contagem`: tela operacional de leitura e registro.
- `Inventário - Administração`: tela de gestão de inventários e ciclos.
- `Cadastrar Bens por endereço`: regularização em lote de localização, sem transferir carga.

## Hierarquia operacional da tela

A tela foi reorganizada para priorizar velocidade de leitura e reduzir disputa visual entre preparo do contexto, bipagem e exceções.

Ordem atual dos blocos:

1. cabeçalho operacional compacto;
2. badges de modo e status;
3. banner de contagem cega, quando aplicável;
4. card `Contexto da contagem`;
5. painel `Leitura principal`;
6. card lateral `Visão rápida do endereço`;
7. `Divergências no endereço`;
8. cards recolhíveis de divergência, exceção e consulta;
9. painel recolhível `Bens esperados do endereço`.

Objetivo operacional:

- deixar o scanner como foco primário;
- manter evento, unidade e local visíveis sem poluir o topo;
- empurrar exceções para baixo do fluxo principal;
- preservar a ocultação fail-closed dos dados esperados em contagem cega.

## Sustentacao da UI operacional

Nesta fase do plano, os elementos visuais compartilhados do topo e dos cards operacionais
(`badges`, `SectionCard`, `InfoLine`, `DisclosureCard` e banner de contagem cega) foram
consolidados em um modulo dedicado para preparar a proxima fase de decomposicao do componente
monolitico principal.

Objetivo tecnico:

- reduzir acoplamento no `InventoryRoomPanel`;
- diminuir risco de regressao em ajustes de UX futuros;
- preparar a decomposicao do topo, scanner e blocos auxiliares em ciclos menores.

Evolucao desta fase:

- o card `Contexto da contagem` saiu do JSX principal e passou a ser renderizado por `InventoryCountContextCard`;
- o card lateral `Visao rapida do endereco` saiu do JSX principal e passou a ser renderizado por `InventoryAddressOverviewCard`;
- o painel `Leitura principal` saiu do JSX principal e passou a ser renderizado por `InventoryPrimaryReadPanel`;
- o painel `Divergencias no endereco` saiu da composicao principal e passou a ter componente dedicado `InventoryDivergencesPanel`;
- os blocos de excecao operacional (`Bem de terceiro`, `Bem sem identificacao` e `Terceiros registrados`) sairam do JSX principal e passaram a ser renderizados por `InventoryExceptionPanels`;
- o painel `Bens esperados do endereco` saiu do JSX principal e passou a ser renderizado por `InventoryExpectedAssetsPanel`;
- a extracao foi feita sem alterar scanner, fila offline, regras de contagem cega ou contratos de formulario.

## Abertura contextualizada pela Administração

A tela `Inventário - Contagem` pode ser aberta a partir de `Inventário - Administração`, no painel `Bens não contados`.

Quando o operador usa `Abrir contagem do endereço`, o sistema já entra com:

- evento de inventário pré-selecionado;
- unidade encontrada correspondente ao endereço;
- local cadastrado (`local_id`) já preenchido;
- campo textual do endereço (`salaEncontrada`) alinhado ao local escolhido.

Esse preset é aplicado uma única vez por navegação. Depois disso, se o operador trocar unidade ou endereço manualmente, a interface respeita a escolha atual.

Além do preset técnico, a tela agora mostra um banner curto de contexto quando for aberta por atalho operacional.

Objetivo do banner:

- lembrar de onde o operador veio;
- confirmar que evento, unidade e endereço foram carregados automaticamente;
- reduzir perda de contexto ao alternar entre administração, contagem e consulta.

## Contexto da contagem

O card `Contexto da contagem` consolida:

- evento aplicado;
- rodada, quando o modo não for `PADRAO`;
- unidade encontrada;
- local cadastrado;
- endereço operacional sincronizado.

Comportamentos preservados:

- `selectedEventoIdFinal` continua sendo a referência final do evento em uso;
- `selectedLocalId` continua sincronizando `salaEncontrada`;
- trocar unidade manualmente continua limpando local incompatível;
- presets com `localId` continuam derivando o contexto operacional sem alterar o contrato externo.

## Painel de leitura principal

O bloco `Leitura principal` é o centro da operação.

Elementos mantidos:

- campo de scanner com foco contínuo;
- leitura por teclado físico;
- leitura por câmera em modo simples;
- leitura por câmera em modo contínuo;
- resolução de etiqueta de 4 dígitos;
- feedback de leitura recente;
- lista de últimos registros.

Resumo visual novo:

- o campo do tombamento fica em maior destaque;
- o operador vê o endereço ativo, o status de registro e o modo de câmera sem rolar;
- a fila offline do endereço aparece no topo do bloco;
- quando `canRegister === false`, o motivo operacional aparece junto da leitura.

## Divergências e exceções

Após o painel principal, a tela exibe:

1. `Divergências no endereço`;
2. `Bem sem identificação`;
3. `Bem de terceiro`;
4. `Terceiros registrados neste endereço`;
5. `Bens esperados do endereço`.

Essa ordem foi escolhida porque:

- divergência é consequência direta da leitura;
- bem sem identificação é a ação crítica de divergência;
- bem de terceiro é exceção operacional;
- a consulta de terceiros e a lista de esperados são apoio, não fluxo primário.

### Hierarquia visual dos cards

Os cards dessa faixa foram refinados para leitura mais rápida:

- `Divergências no endereço (Art. 185)` virou o card-mãe da seção, com badge de pendências e texto operacional curto;
- `Bem sem identificação` usa destaque visual de divergência e abre por padrão;
- `Bem de terceiro` usa destaque de exceção, mas permanece recolhido por padrão;
- `Terceiros registrados` virou card de consulta com resumo de contexto (`Sem contexto`, `Offline`, `Carregando` ou quantidade de itens);
- `Bens esperados do endereço` continua disponível fora do modo cego, mas com peso visual menor e resumo por badges.

### Abertura padrão

Por padrão:

- `Bem sem identificação` inicia aberto;
- `Bem de terceiro` inicia fechado;
- `Terceiros registrados` inicia fechado;
- `Bens esperados do endereço` inicia fechado.

Isso reduz ruído visual e deixa a ação crítica mais visível logo após o scanner.

Regras mantidas:

- bem de terceiro continua segregado do patrimônio STM;
- bem sem identificação continua exigindo foto, descrição e localização;
- divergência continua registrando ocorrência própria, sem transferir carga automaticamente.

Base legal:

- regularização sem troca automática de dono: `Art. 185 (AN303_Art185)`;
- evidência para item não identificado: `Art. 175 (AN303_Art175)`;
- segregação de bem de terceiro: `Art. 99 (AN303_Art99)`, `Art. 110, VI (AN303_Art110_VI)` e `Art. 175, IX (AN303_Art175_IX)`.

## Bens esperados do endereço

Fora do modo cego, o painel recolhível de bens esperados continua disponível, mas com menor peso visual.

Resumo exibido no cabeçalho:

- total esperados;
- total conferidos;
- total faltantes.

O cabeçalho também pode indicar carregamento em andamento, mantendo o conteúdo como painel de apoio e não como ação principal.

Os chips `Esperados`, `Conferidos` e `Faltantes` funcionam como filtros da própria lista:

- `Esperados`: exibe todos os itens vinculados ao endereço;
- `Conferidos`: reduz a lista aos bens já encontrados;
- `Faltantes`: reduz a lista aos bens ainda não conferidos.

O filtro atua somente na visualização da lista agrupada e não altera os dados da contagem.

Cada item segue com o status visual:

- `ENCONTRADO`;
- `LOCAL_DIVERGENTE`;
- `FALTANTE`.

Importante:

- o painel continua dependente de `shouldHideExpectedData`;
- em modo cego, a ocultação continua fail-closed;
- o vínculo esperado continua baseado em `bens.local_id`, não no texto livre do GEAFIN.

## Contagem cega e duplo-cega

### Contagem cega (`CEGO`)

- exige 1 operador com papel `OPERADOR_UNICO`;
- operador não vê o painel de esperado;
- a rodada enviada no sync continua sendo `A`.

### Contagem duplo-cega (`DUPLO_CEGO`)

- exige `OPERADOR_A` e `OPERADOR_B`;
- cada operador grava somente sua rodada;
- divergência A/B continua gerando pendência de desempate;
- fechamento por `DESEMPATE` continua reservado a perfil autorizado.

### Variação visual da UI reduzida

Quando `uiReduzida === true`, a tela passa a destacar:

- banner `Contagem cega em andamento`;
- badges de modo e rodada;
- contexto mínimo necessário para operar;
- scanner, câmera, feedback e últimos registros.

Permanece oculto:

- `InventoryProgress`;
- painel de bens esperados;
- qualquer comparação que exponha estado esperado fora do permitido.

## Leitura por scanner e câmera

O fluxo operacional permanece:

1. selecionar evento, unidade e local;
2. confirmar o endereço operacional;
3. bipar tombamento de 10 dígitos ou etiqueta de 4 dígitos;
4. deixar o foco retornar ao campo para nova leitura;
5. tratar exceções somente quando necessário.

Leituras aceitas:

- `10 dígitos`: registro direto;
- `4 dígitos`: abre modal para identificar a etiqueta;
- câmera simples: encerra após uma leitura;
- câmera contínua: mantém a leitura aberta para bipagem em sequência.

## Inventário simultâneo por unidade

Regras operacionais:

- escopo `GERAL` é exclusivo;
- escopo `UNIDADE` permite no máximo 1 inventário ativo por unidade;
- escopo `LOCAIS` segue a unidade dos locais selecionados.

Exemplos:

- Unidade 1 e Unidade 2 podem inventariar em paralelo;
- Unidade 1 não pode abrir dois inventários simultâneos;
- com inventário `GERAL` ativo, não abre inventário de unidade/local.

## Inventário cíclico

Tipos de ciclo:

- `SEMANAL`
- `MENSAL`
- `ANUAL`
- `ADHOC`

Escopos:

- `GERAL`
- `UNIDADE`
- `LOCAIS`

Sugestões:

- `GET /inventario/sugestoes-ciclo`

Critério:

1. locais há mais tempo sem contagem;
2. maior volume de bens ativos, em caso de empate.

## Matriz de permissão por rodada

| Modo | Papel no evento | Rodadas permitidas |
|---|---|---|
| `PADRAO` | Operador autenticado | `A` |
| `CEGO` | `OPERADOR_UNICO` | `A` |
| `DUPLO_CEGO` | `OPERADOR_A` | `A` |
| `DUPLO_CEGO` | `OPERADOR_B` | `B` |
| `DUPLO_CEGO` | ADMIN ou operador com `permiteDesempate=true` | `DESEMPATE` |

## Erros operacionais comuns

| Código | Causa | Ação recomendada |
|---|---|---|
| `NAO_DESIGNADO` | Usuário não designado no evento | Admin deve designar operador |
| `RODADA_NAO_PERMITIDA` | Rodada incompatível com o papel | Ajustar rodada ou perfil |
| `DESEMPATE_SEM_PERMISSAO` | Usuário sem permissão para desempate | Executar com ADMIN ou autorizado |
| `RODADA_INVALIDA` | Valor fora de `A/B/DESEMPATE` | Corrigir payload ou cliente |

## Estrutura operacional da tela

A tela `Inventário - Contagem` segue a hierarquia abaixo:

- contexto do evento e do endereço;
- painel principal de leitura;
- divergências do endereço;
- exceções operacionais;
- bens esperados como apoio de conferência.

Detalhe técnico relevante:

- os blocos principais da tela foram separados em componentes internos dedicados para reduzir risco de regressão sem alterar scanner, fila offline, modais nem payloads;
- o painel principal continua sendo o scanner e a confirmação de leitura;
- divergências e exceções permanecem em fluxo independente para preservar o Art. 185 (AN303_Art185).
