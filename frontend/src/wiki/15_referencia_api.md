<!--
Modulo: wiki
Arquivo: frontend/src/wiki/15_referencia_api.md
Funcao no sistema: referência resumida dos principais contratos HTTP do sistema.
-->

# Referência de API

## Padrões gerais

- Autenticação: JWT quando `AUTH_ENABLED=true`.
- Respostas: JSON com `requestId` quando aplicável.
- Validação: `422`.
- Falta de permissão: `403`.
- Perfis com permissão apenas `request` recebem fluxo de aprovação, não execução direta.

## Material Inservível

### GET `/inserviveis/avaliacoes`

Uso:

- listar histórico de avaliações de inservível.

Filtros comuns:

- `bemId`
- `tipoInservivel`
- `limit`
- `offset`

### POST `/inserviveis/avaliacoes`

Uso:

- registrar avaliação guiada do bem.

Body mínimo:

```json
{
  "bemId": "uuid",
  "descricaoInformada": "Notebook com bateria degradada",
  "criterios": {
    "condicaoUso": "NAO_APROVEITADO",
    "remanejamentoViavel": false,
    "valorMercadoEstimado": 1200,
    "custoRecuperacaoEstimado": 400
  },
  "justificativa": "Item em boas condições, sem uso pela unidade."
}
```

Resposta:

- a avaliação retorna `tipoInservivel`, `criterios` e `justificativa`;
- se o perfil só possuir `action.inservivel.marcar.request`, a operação vira solicitação de aprovação.

## Marcações de inservível

### GET `/inserviveis/marcacoes`

Uso:

- listar a fila operacional de candidatos à destinação.

Filtros:

- `tipoInservivel`
- `destinacaoSugerida`
- `statusFluxo`
- `unidadeId`
- `localId`
- `q`
- `limit`
- `offset`

### POST `/inserviveis/marcacoes`

Uso:

- criar ou atualizar a marcação atual do bem.

Body típico:

```json
{
  "bemId": "uuid",
  "avaliacaoInservivelId": "uuid",
  "tipoInservivel": "ANTIECONOMICO",
  "destinacaoSugerida": "DOACAO",
  "statusFluxo": "AGUARDANDO_DESTINACAO",
  "observacoes": "Aguardar manifestação da unidade."
}
```

### PATCH `/inserviveis/marcacoes/:id`

Uso:

- atualizar `statusFluxo`, `destinacaoSugerida` e `observacoes`.

## Baixa patrimonial

### GET `/baixas-patrimoniais`

Uso:

- listar rascunhos e processos concluídos.

Filtros:

- `modalidadeBaixa`
- `statusProcesso`
- `q`
- `limit`
- `offset`

### GET `/baixas-patrimoniais/:id`

Uso:

- detalhar processo, itens, documentos e dados da modalidade.

### POST `/baixas-patrimoniais`

Uso:

- abrir rascunho de baixa a partir da fila ou por fluxo direto de `DESAPARECIMENTO`.

Body típico:

```json
{
  "processoReferencia": "SEI-2026/000123",
  "modalidadeBaixa": "DOACAO",
  "marcacaoIds": ["uuid-1", "uuid-2"],
  "dadosModalidade": {
    "tipoDestinatario": "MUNICIPIO_CARENTE"
  },
  "observacoes": "Rascunho inicial do lote."
}
```

### PATCH `/baixas-patrimoniais/:id`

Uso:

- atualizar referências formais, observações e dados específicos da modalidade.

Campos relevantes:

- `manifestacaoSciReferencia`
- `manifestacaoSciEm`
- `atoDiretorGeralReferencia`
- `atoDiretorGeralEm`
- `presidenciaCienteEm`
- `encaminhadoFinancasEm`
- `notaLancamentoReferencia`
- `dadosModalidade`

### POST `/baixas-patrimoniais/:id/concluir`

Uso:

- validar regras legais e efetivar a baixa.

Validações por modalidade:

- `VENDA`: exige avaliação prévia e licitação.
- `DOACAO`: valida destinatário conforme a classe do bem.
- `PERMUTA`: restringe destinatário à Administração Pública.
- `INUTILIZACAO`: exige motivos estruturados.
- `ABANDONO`: exige justificativa específica.
- `DESAPARECIMENTO`: não exige avaliação de inservível.

Efeito:

- cria placeholders documentais;
- atualiza bens para `BAIXADO`;
- grava causa e data da baixa.

### POST `/baixas-patrimoniais/:id/cancelar`

Uso:

- cancelar rascunho sem aplicar baixa nos bens.

## Bens

### GET `/bens/:id`

Agora também retorna:

- `motivoBaixaPatrimonial`
- `baixadoEm`
- `marcacaoAtual`
- `baixaPatrimonialResumo`

Esses campos permitem visualizar a situação do bem sem abrir a workspace inteira.

## Documentos

### GET `/documentos`

Filtros adicionais:

- `avaliacaoInservivelId`
- `baixaPatrimonialId`

### POST `/documentos`

Uso:

- registrar anexos, referências de Drive ou placeholders de processo.

Tipos relevantes para Material Inservível / Baixa:

- `PARECER_SCI`
- `ATO_DIRETOR_GERAL`
- `TERMO_ALIENACAO`
- `TERMO_CESSAO`
- `TERMO_DOACAO`
- `TERMO_PERMUTA`
- `TERMO_INUTILIZACAO`
- `JUSTIFICATIVA_ABANDONO`
- `NOTA_LANCAMENTO_SIAFI`

## Aprovações

Perfis sem permissão de `execute` continuam usando o mesmo fluxo administrativo:

- `GET /aprovacoes/solicitacoes`
- `POST /aprovacoes/solicitacoes/:id/aprovar`
- `POST /aprovacoes/solicitacoes/:id/reprovar`
