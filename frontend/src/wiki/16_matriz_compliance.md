<!--
Modulo: wiki
Arquivo: frontend/src/wiki/16_matriz_compliance.md
Funcao no sistema: matriz de compliance mapeando artigo, regra, implementação e evidência.
-->

# Matriz de compliance (ATN 303/2008)

## Objetivo

Esta matriz responde:

- quais artigos têm comportamento verificável no sistema;
- onde cada regra está implementada;
- qual evidência operacional pode ser auditada.

## Cobertura executiva por capítulo

| Capítulo | Artigos | Status atual | Observação |
|---|---:|---|---|
| Material permanente: classificação e tombamento | 71–77 | Parcial | cadastro e vínculo com catálogo consolidados |
| Patrimônio: distribuição e responsabilidade | 107–121 | Parcial | controle patrimonial ativo; termos formais ainda dependem de documentação externa |
| Patrimônio: movimentação e uso | 122–140 | Implementado | transferência, cautela e trilha de auditoria |
| Patrimônio: desfazimento e inservíveis | 141–152 | Implementado | classificação guiada, fila de destinação e regras por modalidade |
| Patrimônio: baixa patrimonial | 153–157 | Implementado | processo de baixa, causa formal, data e atualização do bem |
| Patrimônio: apuração de fatos | 158–168 | Pendente | sindicância e apuração formal ainda fora do escopo |
| Patrimônio: auditoria anual | 169–187 | Parcial | inventário e regularização operam; relatórios podem evoluir |

## Matriz detalhada

| Artigo | Regra do sistema | Implementação atual | Evidência |
|---|---|---|---|
| Art. 141 (AN303_Art141_*) | classificação obrigatória em `OCIOSO`, `RECUPERÁVEL`, `ANTIECONÔMICO` ou `IRRECUPERÁVEL` | `InservivelAssessmentWizard`, `avaliacoes_inserviveis`, serviço `deriveTipoInservivel` | histórico de avaliações e critério salvo |
| Art. 142 (AN303_Art142) | só avançar para destinação quando permanência/remanejamento for desaconselhável ou inexequível | validação do stepper e da criação de marcação | marcação atual com `statusFluxo` e `destinacaoSugerida` |
| Art. 143 (AN303_Art143) | `VENDA` exige avaliação prévia e licitação | `validateConclusaoBaixaRules` e rota `POST /baixas-patrimoniais/:id/concluir` | processo bloqueado se referências não forem informadas |
| Art. 144 (AN303_Art144) | doação, permuta e venda para órgão público respeitam elegibilidade do destinatário | validação de `tipoDestinatario` por classe do bem | payload do processo e resposta de validação |
| Art. 148 (AN303_Art148) | inutilização/abandono de irrecuperável exigem inviabilidade de alienação/doação e ciência da Presidência | campos obrigatórios em `dadosModalidade` e `presidenciaCienteEm` | processo, justificativa e documentos vinculados |
| Art. 149 (AN303_Art149) | inutilização exige motivo e, quando necessário, setor especializado | motivos estruturados em `dadosModalidade.motivosInutilizacao` | validação de conclusão e documentos do processo |
| Art. 150 (AN303_Art150) | materiais especiais seguem legislação específica | campo de justificativa e documentação externa complementar | processo de baixa com observações |
| Art. 151 (AN303_Art151) | motivos típicos de inutilização são explicitados e auditáveis | enum lógico de motivos (`CONTAMINACAO`, `TOXICIDADE`, etc.) | `dadosModalidade` salvo em JSONB |
| Art. 152 (AN303_Art152) | inutilização e abandono geram documentação própria | placeholders `TERMO_INUTILIZACAO` e `JUSTIFICATIVA_ABANDONO` | registros em `documentos` |
| Art. 153 (AN303_Art153) | baixa patrimonial retira o bem do registro com causa formal | `baixas_patrimoniais`, `bens.motivo_baixa_patrimonial`, `bens.baixado_em` | `GET /bens/:id` e processo detalhado |
| Art. 154 (AN303_Art154) | baixa pode ocorrer por venda, cessão, doação, permuta, inutilização, abandono e desaparecimento | enum `modalidade_baixa_patrimonial` e fluxo de `DESAPARECIMENTO` | processo e itens vinculados |
| Art. 155 (AN303_Art155) | baixa depende de manifestação formal da SCI e ato do Diretor-Geral | campos obrigatórios no processo + permissões `action.baixa.*` | trilha do processo e aprovação administrativa |
| Art. 156 (AN303_Art156) | documentação da baixa deve seguir para a Diretoria de Finanças | campo `encaminhadoFinancasEm` | dados do processo |
| Art. 157 (AN303_Art157) | Auditorias e Foros precisam remeter cópias e NL do SIAFI quando aplicável | checklist visual por unidade 1/2/3 e obrigatoriedade de `notaLancamentoReferencia` em `DOACAO`/`PERMUTA` | processo e placeholder `NOTA_LANCAMENTO_SIAFI` |

## Evidências operacionais disponíveis

- histórico de avaliações de inservível;
- fila atual de marcações;
- processo de baixa com itens e dados de modalidade;
- placeholders documentais vinculados;
- resumo da marcação e da última baixa em `GET /bens/:id`;
- logs e solicitações de aprovação quando o perfil não possui permissão de execução direta.

## Riscos residuais e limites

- não há integração automática com GEAFIN, SEI, SIAFI ou n8n;
- a instrução documental continua dependendo de anexação manual ou automação externa;
- os Arts. 158 a 168 seguem pendentes para um fluxo formal de apuração.
