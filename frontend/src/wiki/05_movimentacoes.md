<!--
Modulo: wiki
Arquivo: frontend/src/wiki/05_movimenta?es.md
Funcao no sistema: explicar cautela vs transferencia e como manter evidencia auditavel.
-->

# MovimentaÃ§Ãµes: cautela x transferÃªncia

## Onde executar no sistema

Na UI, use a aba **MovimentaÃ§Ãµes**.

Essa aba chama o endpoint `POST /movimentar` e aplica as regras do backend (incluindo bloqueio do Art. 183).

## Por que isso Ã© importante

O ATN 303 distingue claramente:

- **TransferÃªncia**: muda a **carga** (unidade dona).
- **Cautela**: o bem sai fisicamente (conserto/home office/etc), mas a **carga nÃ£o muda**.

Essa distinÃ§Ã£o evita:

- Perder a responsabilidade do bem.
- Transferir sem documento durante inventÃ¡rio (o banco bloqueia).

## TransferÃªncia (muda carga)

Quando usar:

- O bem vai passar a ser responsabilidade de outra unidade (mudanÃ§a definitiva).

Efeito no sistema:

- Atualiza `bens.unidade_dona_id`.
- Gera registro em `historico_transferencias` (auditoria).

Regras legais:

- TransferÃªncia muda carga: Art. 124 (AN303_Art124).
- Exige formalizaÃ§Ã£o/termo: Art. 127 (AN303_Art127).

### Bloqueio durante inventÃ¡rio

Se existir inventÃ¡rio `EM_ANDAMENTO`, o banco impede a transferÃªncia:

`// Regra legal: bloqueio de movimentaÃ§Ã£o em inventÃ¡rio - Art. 183 (AN303_Art183)`

## Cautela (nÃ£o muda carga)

Quando usar:

- ManutenÃ§Ã£o/conserto.
- EmprÃ©stimo controlado.
- Trabalho externo (quando aplicÃ¡vel).

Efeito no sistema:

- Mantem `unidade_dona_id` intacto.
- Registra detentor temporario e datas (saida/retorno), com data prevista opcional.
- Em `CAUTELA_SAIDA`, exige informar **endereço destino** ou marcar **Externo**.
- Em `CAUTELA_SAIDA`, o responsavel patrimonial do bem passa automaticamente a ser o detentor temporario selecionado.
- Em `CAUTELA_RETORNO`, o sistema pergunta se deve manter o mesmo responsavel patrimonial (se n?o, limpa o responsavel do bem).

Detentor temporÃ¡rio (UX):

- O campo aceita busca por `matr?cula`, `nome` ou `perfilId UUID`.
- Para aparecer na busca, a pessoa precisa estar cadastrada em `Administra?o do Painel -> Perfis e Acessos`.
- Enquanto digita (ex.: `Joh` ou `9156`), a UI sugere perfis para seleÃ§Ã£o.
- Ao selecionar, o sistema envia o `detentorTemporarioPerfilId` correto no payload.

Local da cautela (obrigatÃ³rio na saÃ­da):

- Campo `endereço destino da cautela`: use quando o item permanece no prÃ©dio (ex.: gabinete/endereço).
- OpÃ§Ã£o `Externo`: use quando o item saiu do prÃ©dio com o detentor.
- O backend rejeita `CAUTELA_SAIDA` sem uma dessas informaÃ§Ãµes.

## RecomendaÃ§Ãµes prÃ¡ticas (operaÃ§Ã£o)

- Se a dÃºvida for "o bem vai sair do prÃ©dio mas continua sendo da unidade": Ã© cautela.
- Se a dÃºvida for "o bem vai mudar de responsÃ¡vel/patrimÃ´nio da unidade": Ã© transferÃªncia.
- Nunca use transferÃªncia para "ajustar inventÃ¡rio" durante contagem. No inventÃ¡rio, registre divergÃªncia e regularize depois.

## EvidÃªncia documental (PDF/Drive)

Para auditoria, toda movimentaÃ§Ã£o relevante deve ter evidÃªncia:

- Termo (PDF) gerado no n8n e salvo no Google Drive.
- Registro dos metadados do documento no sistema (link/ID/hash), sem armazenar o PDF no banco.

No sistema, isso Ã© registrado em:

- Tabela `documentos` (metadados do Drive), vinculada a `movimenta?es` e/ou `contagens`.

Comportamento do sistema:

- Ao executar `/movimentar`, o backend cria automaticamente um registro de `documentos` como **placeholder** (pendente).
- Depois, o n8n gera o PDF, salva no Drive e completa o placeholder via `PATCH /documentos/{id}`.

Regras legais:

- Art. 124 (AN303_Art124) e Art. 127 (AN303_Art127).

## Cadastro de bens por endereço (regulariza?o em lote)

A funcionalidade fica no submenu **Opera?es Patrimoniais -> Cadastrar Bens por endereço**,
sem transferencia de carga.

Fluxo:

1. Selecione a unidade/endereço de destino.
2. Bipe os tombos (teclado/scanner/camera com modo simples ou continuo).
3. Se a leitura vier com 4 digitos, o sistema abre o modal **Identificar Etiqueta** para escolher:
   - Etiqueta Antiga (Azul), ou
   - Etiqueta Nova (Erro).
4. Apos escolher o tipo, o sistema resolve para tombamento de 10 digitos e adiciona na fila.
5. Revise a fila e clique **Salvar lote na endereço**.

Feedback de leitura por camera:

- Modo simples: o card com tombamento + nome resumo aparece por ~2 segundos.
- Modo continuo: o card permanece visivel ate a proxima leitura (substitui o item anterior).

Comportamento de divergencia:

- Se um bem for de outra unidade, o sistema alerta e pergunta se voce deseja manter o item na endereço escolhida.
- Itens divergentes n?o confirmados ficam na fila e n?o sao salvos ate marca?o explicita.

Persistencia aplicada:

- Atualiza `bens.local_id` e `bens.local_fisico` para a endereço selecionada.
- Nao altera `bens.unidade_dona_id` (n?o e transferencia de carga).

Permissao:

- Opera?o restrita ao perfil ADMIN.

## Atualiza?o 2026-02-26 - Gest?o de locais na Administra?o do Painel

A gestao de Locais (CRUD e vincula?o em lote de `bens.local_id`) fica em:

- **Administra?o do Painel -> Locais (endereços) cadastrados**

Motivo:

- manter governanca de cadastros estruturais no modulo administrativo
- preservar Opera?es Patrimoniais focada em execu?o operacional
## Leitura continua com scanner fisico (cadastro por endereço)

No campo de bipagem de tombamento da tela **Cadastrar bens por endereço**:

- Leitor fisico em modo teclado pode operar em sequencia continua.
- O termino da leitura com Enter, Tab **ou** Ctrl+J adiciona o item na fila automaticamente.
- Apos adicionar/validar o item, o foco retorna para o campo para a proxima leitura.

- Observa?o: alguns leitores wireless enviam Ctrl+J; o sistema bloqueia o atalho de Downloads do navegador durante a leitura.


## Aprova?o administrativa de a?es sensiveis (RBAC)

A altera?o de localiza?o/edicao operacional pode seguir dois caminhos:

- Execucao direta: quando o perfil possui permissao `*.execute`.
- Solicita?o: quando possui apenas `*.request`; a API retorna `202 PENDENTE_APROVACAO`.

Campos de solicita?o:

- `justificativaSolicitante` no payload da a?o.

Mensagens esperadas na UI:

- "Acao enviada para aprova?o administrativa."
- "Voce n?o tem permissao para executar esta a?o."

Fluxo de decisao:

- Menu: `Administra?o do Painel -> Aprova?es Pendentes`.
- Admin decide com senha (aprovar/reprovar).

## Regra de permiss?o para `/movimentar` (incidente 2026-03-04)

Para proteger transfer?ncia e cautela, o endpoint `POST /movimentar` passou a exigir permiss?es ACL de execu??o:

- `TRANSFERENCIA`: exige `action.bem.alterar_responsavel.execute`.
- `CAUTELA_SAIDA`: exige `action.bem.alterar_status.execute` e `action.bem.alterar_responsavel.execute`.
- `CAUTELA_RETORNO`: exige `action.bem.alterar_status.execute` (e tamb?m `action.bem.alterar_responsavel.execute` quando limpar respons?vel).

Comportamento:

- sem permiss?o `execute` e sem `request`: retorna `403 SEM_PERMISSAO`;
- com `request` e sem `execute`: retorna `403 APROVACAO_OBRIGATORIA`.

Observa??o operacional:

- neste endpoint, a abertura autom?tica de solicita??o pendente n?o est? habilitada na vers?o atual; a execu??o deve ser feita por perfil autorizado.

## IntegraÃ§Ã£o com RegularizaÃ§Ã£o pÃ³s-inventÃ¡rio (transferÃªncia formal)

Quando a divergÃªncia foi encaminhada pela tela de RegularizaÃ§Ã£o, a execuÃ§Ã£o deve ocorrer aqui:

- no tipo `TRANSFERENCIA`;
- botÃ£o `Importar pendÃªncias da RegularizaÃ§Ã£o`.

Comportamento:

- a fila importa itens com `origemRegularizacaoContagemId`;
- ao executar com sucesso, o sistema conclui a regularizaÃ§Ã£o automaticamente;
- se ficar pendente de aprovaÃ§Ã£o, o fluxo fica em `AGUARDANDO_APROVACAO`;
- se houver erro, o fluxo fica em `ERRO`.

Resultado operacional:

- a divergÃªncia sÃ³ sai da regularizaÃ§Ã£o depois da transferÃªncia formal concluÃ­da.

