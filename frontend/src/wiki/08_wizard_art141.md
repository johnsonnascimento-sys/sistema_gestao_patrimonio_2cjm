<!--
Modulo: wiki
Arquivo: frontend/src/wiki/08_wizard_art141.md
Funcao no sistema: manual operacional da workspace Material Inservível / Baixa.
-->

# Material Inservível / Baixa

## Onde acessar no menu

- `Operações -> Material Inservível / Baixa`

## Base legal coberta nesta tela

- Arts. 141 a 152: material inservível e destinação
- Arts. 153 a 157: baixa patrimonial

## Objetivo da página

Esta workspace substitui a antiga tela "Wizard Art. 141" e passa a concentrar dois fluxos complementares:

1. **Triagem de inservível**: marca bens que podem ser classificados como `OCIOSO`, `RECUPERÁVEL`, `ANTIECONÔMICO` ou `IRRECUPERÁVEL`.
2. **Baixa patrimonial**: formaliza a destinação e efetiva a retirada do bem do acervo operacional.

## Estrutura da workspace

### 1) Resumo executivo

Exibe contadores de apoio:

- Marcados para triagem
- Aguardando destinação
- Processos em rascunho
- Baixas concluídas no período

### 2) Triagem / Marcação

Permite localizar bens por:

- tombamento
- descrição
- unidade
- local

Ao selecionar um bem, a tela mostra contexto, histórico anterior e evidências já registradas.

### 3) Fila de candidatos

Lista as marcações atuais com filtros por:

- tipo de inservível
- destinação sugerida
- status do fluxo
- unidade
- local
- texto livre

### 4) Processos de baixa

Mostra rascunhos e processos concluídos, além do atalho para o fluxo próprio de `DESAPARECIMENTO`.

## Como funciona a triagem

O stepper embutido é determinístico. O usuário não escolhe livremente a classe final; a classificação resulta das respostas registradas.

Etapas:

1. identificação do bem
2. condição de uso
3. análise econômica
4. viabilidade de remanejamento no Tribunal
5. recomendação de destinação
6. justificativa e evidências

## Regras de classificação

### Ocioso

Use quando o bem está em perfeitas condições de uso, mas não está sendo aproveitado.

Base legal:

- Art. 141, I (AN303_Art141_I)

### Recuperável

Use quando a recuperação é possível e o custo estimado é de até 50% do valor de mercado.

Campos obrigatórios:

- `valorMercadoEstimado`
- `custoRecuperacaoEstimado`

O sistema calcula a razão automaticamente e bloqueia classificação acima de 50%.

Base legal:

- Art. 141, II (AN303_Art141_II)

### Antieconômico

Use quando a manutenção é onerosa ou o rendimento é precário por uso prolongado, desgaste prematuro ou obsolescência.

Base legal:

- Art. 141, III (AN303_Art141_III)

### Irrecuperável

Use quando o bem perdeu características essenciais ou a recuperação é economicamente inviável.

Campo obrigatório:

- justificativa explícita de perda de características ou inviabilidade econômica

Base legal:

- Art. 141, IV (AN303_Art141_IV)

## Resultado da triagem

Ao salvar a avaliação, o sistema:

- registra uma nova linha no histórico de avaliações;
- cria ou atualiza a marcação atual do bem na fila;
- mantém rastreio de quem avaliou, quando avaliou e qual destinação foi sugerida.

## Destinação e baixa patrimonial

O processo de baixa pode ser aberto a partir da fila ou diretamente, no caso de `DESAPARECIMENTO`.

Modalidades disponíveis:

- `VENDA`
- `CESSÃO`
- `DOAÇÃO`
- `PERMUTA`
- `INUTILIZAÇÃO`
- `ABANDONO`
- `DESAPARECIMENTO`

## Validações legais por modalidade

### Venda

Exige:

- `avaliacaoPreviaReferencia`
- `licitacaoReferencia`

Base legal:

- Art. 143 (AN303_Art143)

### Doação

Exige:

- `tipoDestinatario`

O sistema valida se o destinatário é compatível com a classe do bem.

Base legal:

- Art. 144 (AN303_Art144)

### Permuta

Só é aceita entre órgãos ou entidades da Administração Pública.

Base legal:

- Art. 144, IV (AN303_Art144_IV)

### Inutilização e abandono

Para item `IRRECUPERÁVEL`, exigem:

- justificativa de inviabilidade de alienação ou doação;
- ciência da Presidência;
- registro de partes economicamente aproveitáveis.

No caso de inutilização, também é obrigatório selecionar pelo menos um motivo estruturado:

- `AMEACA_VITAL`
- `PREJUIZO_ECOLOGICO`
- `CONTAMINACAO`
- `INFESTACAO`
- `TOXICIDADE`
- `RISCO_FRAUDE`
- `OUTRO`

Bases legais:

- Art. 148 (AN303_Art148)
- Art. 149 (AN303_Art149)
- Art. 150 (AN303_Art150)
- Art. 151 (AN303_Art151)
- Art. 152 (AN303_Art152)

## Documentos vinculados ao processo

O sistema cria placeholders documentais para instrução formal, conforme a modalidade:

- `PARECER_SCI`
- `ATO_DIRETOR_GERAL`
- `TERMO_ALIENACAO`
- `TERMO_CESSAO`
- `TERMO_DOACAO`
- `TERMO_PERMUTA`
- `TERMO_INUTILIZACAO`
- `JUSTIFICATIVA_ABANDONO`
- `NOTA_LANCAMENTO_SIAFI`

Importante:

- a aplicação registra metadados e referências;
- não há geração automática de PDF nesta entrega.

## Conclusão da baixa

Ao concluir o processo, o sistema:

- valida permissões de execução;
- exige `manifestacaoSciReferencia`, `manifestacaoSciEm`, `atoDiretorGeralReferencia` e `atoDiretorGeralEm`;
- grava causa formal da baixa;
- atualiza o bem para `status = BAIXADO`;
- grava `motivoBaixaPatrimonial` e `baixadoEm`;
- mantém o resumo da baixa disponível em `GET /bens/:id`.

Base legal:

- Arts. 153 a 157 (AN303_Art153 a AN303_Art157)

## Fluxo específico de desaparecimento

`DESAPARECIMENTO` não depende da fila de inservíveis. O processo pode ser aberto diretamente na área de Processos de baixa.

## Limite desta entrega

GEAFIN, SEI, SIAFI e n8n não são acionados automaticamente. A tela registra somente:

- referências formais;
- anexos e URLs;
- placeholders documentais;
- trilha auditável para instrução posterior.
