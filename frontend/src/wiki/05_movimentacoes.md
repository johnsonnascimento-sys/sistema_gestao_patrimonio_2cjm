<!--
Modulo: wiki
Arquivo: frontend/src/wiki/05_movimentacoes.md
Funcao no sistema: explicar cautela vs transferencia e como manter evidencia auditavel.
-->

# Movimentações: cautela x transferência

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

- Mantém `unidade_dona_id` intacto.
- Registra detentor temporário e datas (saída/retorno).

## Recomendações práticas (operação)

- Se a dúvida for "o bem vai sair do prédio mas continua sendo da unidade": é cautela.
- Se a dúvida for "o bem vai mudar de responsável/patrimônio da unidade": é transferência.
- Nunca use transferência para "ajustar inventário" durante contagem. No inventário, registre divergência e regularize depois.

## Evidência documental (PDF/Drive)

Para auditoria, toda movimentação relevante deve ter evidência:

- Termo (PDF) gerado no n8n e salvo no Google Drive.
- Registro dos metadados do documento no sistema (link/ID/hash), sem armazenar o PDF no banco.

No sistema, isso é registrado em:

- Tabela `documentos` (metadados do Drive), vinculada a `movimentacoes` e/ou `contagens`.

Comportamento do sistema:

- Ao executar `/movimentar`, o backend cria automaticamente um registro de `documentos` como **placeholder** (pendente).
- Depois, o n8n gera o PDF, salva no Drive e completa o placeholder via `PATCH /documentos/{id}`.

Regras legais:

- Art. 124 (AN303_Art124) e Art. 127 (AN303_Art127).
