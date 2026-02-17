<!--
Modulo: wiki
Arquivo: frontend/src/wiki/13_compliance_atn303.md
Funcao no sistema: resumo operacional das regras ATN 303/2008 que o sistema implementa.
-->

# Compliance ATN 303/2008 (resumo operacional)

Este sistema implementa regras de compliance como comportamento verificavel. As referencias legais seguem o padrao:

- `Art. X (AN303_ArtX)`

## Regra 1: Congelamento no inventario

- Base legal: Art. 183 (AN303_Art183)
- Regra: durante inventario `EM_ANDAMENTO`, e vedada movimentacao de bens (mudanca de carga).
- Implementacao: bloqueio no banco para alteracao de `bens.unidade_dona_id` durante evento ativo.

## Regra 2: Intrusos (local divergente) não mudam dono automaticamente

- Base legal: Art. 185 (AN303_Art185)
- Regra: bens encontrados em local divergente não mudam de unidade dona durante inventário.
- Implementacao: registrar ocorrencia `ENCONTRADO_EM_LOCAL_DIVERGENTE` + `regularizacao_pendente=true`.

## Regra 3: Cautela vs transferencia

- Base legal: Art. 124 (AN303_Art124) e Art. 127 (AN303_Art127)
- Regra: transferência muda carga; cautela mantém carga e controla detentor temporário.
- Implementacao: endpoints e registros distintos; transferencia gera historico de carga.

## Regra 4: Classificação de inservíveis com fluxo guiado

- Base legal:
  - Art. 141, Caput (AN303_Art141_Cap)
  - Art. 141, I (AN303_Art141_I)
  - Art. 141, II (AN303_Art141_II)
  - Art. 141, III (AN303_Art141_III)
  - Art. 141, IV (AN303_Art141_IV)
- Regra: classificação deve ser guiada e auditável.
- Implementacao: wizard com perguntas e justificativa.

## Regra 5: Controle segregado de bens de terceiros

- Base legal: Art. 99 (AN303_Art99), Art. 110, VI (AN303_Art110_VI), Art. 175, IX (AN303_Art175_IX)
- Regra: bens externos não devem ser incorporados automaticamente como patrimônio.
- Implementacao: registro segregado de ocorrencias de bem de terceiro.
