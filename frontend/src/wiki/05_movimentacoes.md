<!--
Modulo: wiki
Arquivo: frontend/src/wiki/05_movimenta?es.md
Funcao no sistema: explicar cautela vs transferencia e como manter evidencia auditavel.
-->

# Movimentações: cautela x transferência

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
- Em `CAUTELA_SAIDA`, exige informar **Sala destino** ou marcar **Externo**.
- Em `CAUTELA_SAIDA`, o responsavel patrimonial do bem passa automaticamente a ser o detentor temporario selecionado.
- Em `CAUTELA_RETORNO`, o sistema pergunta se deve manter o mesmo responsavel patrimonial (se n?o, limpa o responsavel do bem).

Detentor temporário (UX):

- O campo aceita busca por `matr?cula`, `nome` ou `perfilId UUID`.
- Para aparecer na busca, a pessoa precisa estar cadastrada em `Administra?o do Painel -> Perfis e Acessos`.
- Enquanto digita (ex.: `Joh` ou `9156`), a UI sugere perfis para seleção.
- Ao selecionar, o sistema envia o `detentorTemporarioPerfilId` correto no payload.

Local da cautela (obrigatório na saída):

- Campo `Sala destino da cautela`: use quando o item permanece no prédio (ex.: gabinete/sala).
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

- Tabela `documentos` (metadados do Drive), vinculada a `movimenta?es` e/ou `contagens`.

Comportamento do sistema:

- Ao executar `/movimentar`, o backend cria automaticamente um registro de `documentos` como **placeholder** (pendente).
- Depois, o n8n gera o PDF, salva no Drive e completa o placeholder via `PATCH /documentos/{id}`.

Regras legais:

- Art. 124 (AN303_Art124) e Art. 127 (AN303_Art127).

## Cadastro de bens por sala (regulariza?o em lote)

A funcionalidade fica no submenu **Opera?es Patrimoniais -> Cadastrar Bens por Sala**,
sem transferencia de carga.

Fluxo:

1. Selecione a unidade/sala de destino.
2. Bipe os tombos (teclado/scanner/camera com modo simples ou continuo).
3. Se a leitura vier com 4 digitos, o sistema abre o modal **Identificar Etiqueta** para escolher:
   - Etiqueta Antiga (Azul), ou
   - Etiqueta Nova (Erro).
4. Apos escolher o tipo, o sistema resolve para tombamento de 10 digitos e adiciona na fila.
5. Revise a fila e clique **Salvar lote na sala**.

Feedback de leitura por camera:

- Modo simples: o card com tombamento + nome resumo aparece por ~2 segundos.
- Modo continuo: o card permanece visivel ate a proxima leitura (substitui o item anterior).

Comportamento de divergencia:

- Se um bem for de outra unidade, o sistema alerta e pergunta se voce deseja manter o item na sala escolhida.
- Itens divergentes n?o confirmados ficam na fila e n?o sao salvos ate marca?o explicita.

Persistencia aplicada:

- Atualiza `bens.local_id` e `bens.local_fisico` para a sala selecionada.
- Nao altera `bens.unidade_dona_id` (n?o e transferencia de carga).

Permissao:

- Opera?o restrita ao perfil ADMIN.

## Atualiza?o 2026-02-26 - Gest?o de locais na Administra?o do Painel

A gestao de Locais (CRUD e vincula?o em lote de `bens.local_id`) fica em:

- **Administra?o do Painel -> Locais (salas) cadastrados**

Motivo:

- manter governanca de cadastros estruturais no modulo administrativo
- preservar Opera?es Patrimoniais focada em execu?o operacional
## Leitura continua com scanner fisico (cadastro por sala)

No campo de bipagem de tombamento da tela **Cadastrar bens por sala**:

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
