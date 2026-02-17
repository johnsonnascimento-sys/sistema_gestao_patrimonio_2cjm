<!--
Modulo: wiki
Arquivo: frontend/src/wiki/09_relatorios_auditoria.md
Funcao no sistema: orientar como extrair evidencias e entender trilhas (historicos, espelho GEAFIN, forasteiros).
-->

# Relatorios e auditoria

## Objetivo

Este sistema foi desenhado para "aguentar auditoria". Isso significa:

- Ser possivel provar o que foi importado (GEAFIN).
- Ser possivel provar quando e por que um bem mudou de carga.
- Ser possivel listar divergencias de inventario (intrusos) sem alterar carga no ato.

## 1) Auditoria de importacao GEAFIN

Evidencias:

- Registro do arquivo (nome, hash, bytes, data/hora, total de linhas, status).
- Linhas espelho (conteudo do CSV como chegou).
- Contadores (ok/falha persistencia/falha normalizacao).

Uso tipico:

- "As 3833 linhas do CSV foram processadas?": verificar `status=CONCLUIDO` e `percent=100`.

## 2) Auditoria de mudanca de carga (transferencias)

Quando uma transferencia acontece (mudanca de `unidade_dona_id`), o banco registra em historico dedicado.

Evidencias:

- Bem (tombamento)
- Unidade antiga e nova
- Data/hora
- Origem (IMPORTACAO/APP/SISTEMA)
- Usuario (quando aplicavel)

## 3) Forasteiros / Intrusos (inventario)

Um "forasteiro" e um intruso registrado no inventario:

- tipo_ocorrencia = ENCONTRADO_EM_LOCAL_DIVERGENTE
- regularizacao_pendente = true

Relatorio tipico:

- Lista de bens com unidade dona diferente da unidade encontrada no inventario.

Observacao:

- O sistema prioriza derivar isso de `contagens` (inventario), nao de coluna "unidade_local_atual" no bem.

## 4) Onde ver "mais detalhes"

Na UI:

- Consulta de bens -> Detalhes

No banco:

- Historico de transferencias
- Movimentacoes
- Eventos/contagens do inventario

## 5) Boas praticas para auditoria

- Guarde sempre o CSV original importado (fora do repositorio).
- Registre quem executa operacoes criticas (perfil).
- Nao use "transferencia" para consertar inventario durante congelamento: registre divergencia e regularize depois.

