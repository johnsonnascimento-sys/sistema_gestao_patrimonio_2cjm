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
- Regra: durante inventario `EM_ANDAMENTO`, e vedada movimenta?o de bens (mudanca de carga) no escopo ativo.
- Implementa?o: bloqueio no banco para altera?o de `bens.unidade_dona_id` durante evento ativo com escopo:
  - `GERAL` (global)
  - `UNIDADE` (unidade especifica)
  - `LOCAIS` (lista de endereços)

## Regra 2: Intrusos (local divergente) nÃ£o mudam dono automaticamente

- Base legal: Art. 185 (AN303_Art185)
- Regra: bens encontrados em local divergente nÃ£o mudam de unidade dona durante inventÃ¡rio.
- Implementa?o: registrar ocorrencia `ENCONTRADO_EM_LOCAL_DIVERGENTE` + `regulariza?o_pendente=true`.

## Regra 3: Cautela vs transferencia

- Base legal: Art. 124 (AN303_Art124) e Art. 127 (AN303_Art127)
- Regra: transferÃªncia muda carga; cautela mantÃ©m carga e controla detentor temporÃ¡rio.
- Implementa?o: endpoints e registros distintos; transferencia gera historico de carga.

## Regra 4: ClassificaÃ§Ã£o de inservÃ­veis com fluxo guiado

- Base legal:
  - Art. 141, Caput (AN303_Art141_Cap)
  - Art. 141, I (AN303_Art141_I)
  - Art. 141, II (AN303_Art141_II)
  - Art. 141, III (AN303_Art141_III)
  - Art. 141, IV (AN303_Art141_IV)
- Regra: classificaÃ§Ã£o deve ser guiada e auditÃ¡vel.
- Implementa?o: wizard com perguntas e justificativa.

## Regra 5: Controle segregado de bens de terceiros

- Base legal: Art. 99 (AN303_Art99), Art. 110, VI (AN303_Art110_VI), Art. 175, IX (AN303_Art175_IX)
- Regra: bens externos nÃ£o devem ser incorporados automaticamente como patrimÃ´nio.
- Implementa?o: registro segregado de ocorrencias de bem de terceiro.

## Regra 6: Registro de bens sem identificaÃ§Ã£o (plaqueta ausente/danificada)

- Base legal: Art. 175, IX (AN303_Art175_IX)
- Regra: bens encontrados sem identificaÃ§Ã£o durante inventÃ¡rio devem ser registrados com fotografia e descriÃ§Ã£o detalhada e mantidos no local encontrado atÃ© regularizaÃ§Ã£o.
- Implementa?o: endpoint `POST /inventario/bens-n?o-identificados`; cria entrada em `bens` com `proprietario_externo='SEM_IDENTIFICACAO'` e contagem com `tipo_ocorrencia='BEM_NAO_IDENTIFICADO'` + `regulariza?o_pendente=true`.

## Nota operacional: alerta impositivo de divergÃªncia

Quando um item bipeado pertence a outra unidade, o sistema exibe um **modal bloqueante** que impede ao operador de prosseguir sem confirmar que o bem **nÃ£o serÃ¡ removido da endereço**. Esse comportamento Ã© obrigatÃ³rio e derivado do Art. 185 (AN303_Art185).

