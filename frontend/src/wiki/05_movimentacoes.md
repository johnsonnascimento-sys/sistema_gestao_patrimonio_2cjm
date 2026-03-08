<!--
Modulo: wiki
Arquivo: frontend/src/wiki/05_movimentacoes.md
Funcao no sistema: explicar cautela vs transferencia e como manter evidencia auditavel.
-->

# Movimentações: cautela x transferência

## Atualização 2026-03-08 - hierarquia operacional da tela

A tela **Movimentações** foi reorganizada para reduzir carga cognitiva na primeira dobra:

- o topo agora destaca o **tipo ativo**, o **nível de permissão** e o **estado da fila**;
- o fluxo principal foi explicitado em três passos visuais:
  1. escolher o tipo e montar a fila;
  2. preencher os campos obrigatórios do modo ativo;
  3. executar a movimentação;
- cards de apoio passaram a resumir os requisitos do modo ativo, a permissão efetiva do operador e o estado rápido da fila;
- o objetivo da mudança é acelerar a operação diária sem alterar payload, regra de compliance ou contratos do backend.

## Onde executar no sistema

Na UI, use a aba **Movimentações**.

Essa aba chama o endpoint `POST /movimentar` e aplica as regras do backend (incluindo bloqueio do Art. 183).

## Por que isso é importante

O ATN 303 distingue claramente:

- **Transferência**: muda a **carga** (unidade dona).
- **Cautela**: o bem sai fisicamente (conserto/home office/etc), mas a **carga não muda**.

Essa distinção evita:

- Perder a responsabilidade do bem.
- Transferir sem documento durante inventário (o banco bloqueia).

## Transferência (muda carga)

Quando usar:

- O bem vai passar a ser responsabilidade de outra unidade (mudança definitiva).

Efeito no sistema:

- Atualiza `bens.unidade_dona_id`.
- Gera registro em `historico_transferencias` (auditoria).

Regras legais:

- Transferência muda carga: Art. 124 (AN303_Art124).
- Exige formalização/termo: Art. 127 (AN303_Art127).

### Bloqueio durante inventário

Se existir inventário `EM_ANDAMENTO`, o banco impede a transferência:

`// Regra legal: bloqueio de movimentação em inventário - Art. 183 (AN303_Art183)`

## Cautela (não muda carga)

Quando usar:

- Manutenção/conserto.
- Empréstimo controlado.
- Trabalho externo (quando aplicável).

Efeito no sistema:

- Mantem `unidade_dona_id` intacto.
- Registra detentor temporario e datas (saida/retorno), com data prevista opcional.
- Em `CAUTELA_SAIDA`, exige informar **endereço destino** ou marcar **Externo**.
- Em `CAUTELA_SAIDA`, o responsavel patrimonial do bem passa automaticamente a ser o detentor temporario selecionado.
- Em `CAUTELA_RETORNO`, o sistema pergunta se deve manter o mesmo responsavel patrimonial (se não, limpa o responsavel do bem).

Detentor temporário (UX):

- O campo aceita busca por `matrícula`, `nome` ou `perfilId UUID`.
- Para aparecer na busca, a pessoa precisa estar cadastrada em `Administração do Painel -> Perfis e Acessos`.
- Enquanto digita (ex.: `Joh` ou `9156`), a UI sugere perfis para seleção.
- Ao selecionar, o sistema envia o `detentorTemporarioPerfilId` correto no payload.

Local da cautela (obrigatório na saída):

- Campo `endereço destino da cautela`: use quando o item permanece no prédio (ex.: gabinete/endereço).
- Opção `Externo`: use quando o item saiu do prédio com o detentor.
- O backend rejeita `CAUTELA_SAIDA` sem uma dessas informações.

## Recomendações práticas (operação)

- Se a dúvida for "o bem vai sair do prédio mas continua sendo da unidade": é cautela.
- Se a dúvida for "o bem vai mudar de responsável/patrimônio da unidade": é transferência.
- Nunca use transferência para "ajustar inventário" durante contagem. No inventário, registre divergência e regularize depois.

## Evidência documental (PDF/Drive)

Para auditoria, toda movimentação relevante deve ter evidência:

- Termo (PDF) gerado no n8n e salvo no Google Drive.
- Registro dos metadados do documento no sistema (link/ID/hash), sem armazenar o PDF no banco.

No sistema, isso é registrado em:

- Tabela `documentos` (metadados do Drive), vinculada a `movimentações` e/ou `contagens`.

Comportamento do sistema:

- Ao executar `/movimentar`, o backend cria automaticamente um registro de `documentos` como **placeholder** (pendente).
- Depois, o n8n gera o PDF, salva no Drive e completa o placeholder via `PATCH /documentos/{id}`.

Regras legais:

- Art. 124 (AN303_Art124) e Art. 127 (AN303_Art127).

## Cadastro de bens por endereço (regularização em lote)

A funcionalidade fica no submenu **Operações Patrimoniais -> Cadastrar Bens por endereço**,
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
- Itens divergentes não confirmados ficam na fila e não sao salvos ate marcação explicita.

Persistencia aplicada:

- Atualiza `bens.local_id` e `bens.local_fisico` para a endereço selecionada.
- Nao altera `bens.unidade_dona_id` (não e transferencia de carga).

Permissao:

- Operação restrita ao perfil ADMIN.

## Atualização 2026-02-26 - Gestão de locais na Administração do Painel

A gestao de Locais (CRUD e vinculação em lote de `bens.local_id`) fica em:

- **Administração do Painel -> Locais (endereços) cadastrados**

Motivo:

- manter governanca de cadastros estruturais no modulo administrativo
- preservar Operações Patrimoniais focada em execução operacional
## Leitura continua com scanner fisico (cadastro por endereço)

No campo de bipagem de tombamento da tela **Cadastrar bens por endereço**:

- Leitor fisico em modo teclado pode operar em sequencia continua.
- O termino da leitura com Enter, Tab **ou** Ctrl+J adiciona o item na fila automaticamente.
- Apos adicionar/validar o item, o foco retorna para o campo para a proxima leitura.

- Observação: alguns leitores wireless enviam Ctrl+J; o sistema bloqueia o atalho de Downloads do navegador durante a leitura.


## Aprovação administrativa de ações sensiveis (RBAC)

A alteração de localização/edição operacional pode seguir dois caminhos:

- Execucao direta: quando o perfil possui permissao `*.execute`.
- Solicitação: quando possui apenas `*.request`; a API retorna `202 PENDENTE_APROVACAO`.

Campos de solicitação:

- `justificativaSolicitante` no payload da ação.

Mensagens esperadas na UI:

- "Acao enviada para aprovação administrativa."
- "Voce não tem permissao para executar esta ação."

Fluxo de decisao:

- Menu: `Administração do Painel -> Aprovações Pendentes`.
- Admin decide com senha (aprovar/reprovar).

## Regra de permissão para `/movimentar` (incidente 2026-03-04)

Para proteger transferência e cautela, o endpoint `POST /movimentar` passou a exigir permissões ACL de execução:

- `TRANSFERENCIA`: exige `action.bem.alterar_responsavel.execute`.
- `CAUTELA_SAIDA`: exige `action.bem.alterar_status.execute` e `action.bem.alterar_responsavel.execute`.
- `CAUTELA_RETORNO`: exige `action.bem.alterar_status.execute` (e também `action.bem.alterar_responsavel.execute` quando limpar responsável).

Comportamento:

- sem permissão `execute` e sem `request`: retorna `403 SEM_PERMISSAO`;
- com `request` e sem `execute`: retorna `403 APROVACAO_OBRIGATORIA`.

Observação operacional:

- neste endpoint, a abertura automática de solicitação pendente não está habilitada na versão atual; a execução deve ser feita por perfil autorizado.

## Integração com Regularização pós-inventário (transferência formal)

Quando a divergência foi encaminhada pela tela de Regularização, a execução deve ocorrer aqui:

- no tipo `TRANSFERENCIA`;
- botão `Importar pendências da Regularização`.

Comportamento:

- a fila importa itens com `origemRegularizacaoContagemId`;
- ao executar com sucesso, o sistema conclui a regularização automaticamente;
- se ficar pendente de aprovação, o fluxo fica em `AGUARDANDO_APROVACAO`;
- se houver erro, o fluxo fica em `ERRO`.

Resultado operacional:

- a divergência só sai da regularização depois da transferência formal concluída.
