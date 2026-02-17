<!--
Modulo: wiki
Arquivo: frontend/src/wiki/09_relatorios_auditoria.md
Funcao no sistema: orientar como extrair evidencias e entender trilhas (historicos, espelho GEAFIN, forasteiros).
-->

# Relatórios e auditoria

## Objetivo

Este sistema foi desenhado para "aguentar auditoria". Isso significa:

- Ser possível provar o que foi importado (GEAFIN).
- Ser possível provar quando e por que um bem mudou de carga.
- Ser possível listar divergências de inventário (intrusos) sem alterar carga no ato.

## 1) Auditoria de importação GEAFIN

Evidencias:

- Registro do arquivo (nome, hash, bytes, data/hora, total de linhas, status).
- Linhas espelho (conteudo do CSV como chegou).
- Contadores (ok/falha persistencia/falha normalizacao).

Uso tipico:

- "As 3833 linhas do CSV foram processadas?": verificar `status=CONCLUIDO` e `percent=100`.

## 2) Auditoria de mudança de carga (transferências)

Quando uma transferencia acontece (mudanca de `unidade_dona_id`), o banco registra em historico dedicado.

Evidencias:

- Bem (tombamento)
- Unidade antiga e nova
- Data/hora
- Origem (IMPORTACAO/APP/SISTEMA)
- Usuario (quando aplicavel)

## 3) Forasteiros / Intrusos (inventário)

Um "forasteiro" é um intruso registrado no inventário:

- tipo_ocorrencia = ENCONTRADO_EM_LOCAL_DIVERGENTE
- regularizacao_pendente = true

Relatorio tipico:

- Lista de bens com unidade dona diferente da unidade encontrada no inventario.

Observacao:

- O sistema prioriza derivar isso de `contagens` (inventário), não de coluna "unidade_local_atual" no bem.

## 4) Onde ver "mais detalhes"

Na UI:

- Consulta de bens -> Detalhes

No banco:

- Historico de transferencias
- Movimentacoes
- Eventos/contagens do inventario

## 5) Boas práticas para auditoria

- Guarde sempre o CSV original importado (fora do repositorio).
- Registre quem executa operacoes criticas (perfil).
- Não use "transferência" para consertar inventário durante congelamento: registre divergência e regularize depois.
