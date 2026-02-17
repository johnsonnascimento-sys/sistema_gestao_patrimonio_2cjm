<!--
Modulo: wiki
Arquivo: frontend/src/wiki/06_inventario_sala_a_sala.md
Funcao no sistema: manual do inventario com UX agrupada por catalogo (SKU) e fluxo deterministico.
-->

# Inventario sala a sala (modo agrupado por catalogo)

## Objetivo do modo inventario

O modo inventario existe para conferencia fisica "sala a sala" com rastreabilidade e respeito ao ATN 303:

- Registrar o que foi encontrado em cada ambiente.
- Identificar divergencias sem "consertar no grito".
- Produzir base para regularizacao posterior (termos/documentos).

## Regra-chave (congelamento)

Durante inventario `EM_ANDAMENTO`, **transferencias** ficam bloqueadas pelo banco.

- Regra legal: Art. 183 (AN303_Art183)

Na pratica:

- Voce ainda pode registrar contagens e divergencias.
- Voce nao pode mudar a carga do bem (unidade dona) enquanto o inventario esta em andamento.

## Filosofia visual: agrupamento por catalogo (SKU)

### Problema que o agrupamento resolve

Uma sala pode ter 50 cadeiras. Se o sistema listar 50 linhas, o operador perde tempo e se confunde.

### Solucao

Mostrar um resumo por catalogo:

- "Cadeira executiva marrom (Total: 20)"
- Status: "18 encontrados | 2 faltantes"
- Botao para expandir e ver tombamentos individuais (checklist)

Isso garante:

- velocidade (olho humano reconhece grupos rapidamente)
- menos rolagem
- menos erro humano

## Fluxo operacional (passo a passo)

### 1) Selecionar sala/ambiente

No inventario, selecione:

- Sala/ambiente (texto livre ou lista, conforme a tela atual)
- Unidade inventariada/encontrada (1..4)

Observacao:

- A unidade "encontrada" e a unidade do ambiente sendo inventariado naquele momento.

### 2) Baixar lista da sala (quando suportado)

O sistema pode baixar a lista de bens daquele ambiente para facilitar:

- agrupar por catalogo
- exibir total esperado

### 3) Scanner (input de tombamento)

Use o campo de scanner para bipar ou digitar o tombamento (10 digitos).

Comportamentos:

- Se o bem existe e pertence a mesma unidade do ambiente: marca como encontrado (contagem conforme).
- Se o bem existe mas pertence a outra unidade: alerta de intruso e registra divergencia (sem transferir).
- Se o bem nao existe (tombamento nao cadastrado): registra ocorrencia para investigacao (dependendo do modo).

## Intruso no inventario (Art. 185)

Se um bem de outra unidade esta na sala:

- Nao transfira carga durante inventario.
- Registre a divergencia e deixe pendente para regularizacao.

Regra legal:

- Art. 185 (AN303_Art185)

## Offline-first (quando habilitado)

Em ambiente com internet instavel:

- O sistema pode guardar bipes em cache local (IndexedDB).
- Quando a internet voltar, ele sincroniza as contagens.

Importante:

- O operador deve sempre ver a fila pendente (quantidade).
- A sincronizacao deve ser deterministica (sem "reconciliacao inteligente").

## O que o operador deve verificar no fim da sala

Antes de sair da sala:

- Se o total encontrado bate com o esperado (por catalogo).
- Se existem divergencias registradas (intrusos).
- Se existem itens pendentes de sync (modo offline).

## Encerramento do inventario

Encerrar inventario e um ato formal (quando a tela/fluxo estiver completo):

- Ele libera novamente transferencias (fim do congelamento).
- Ele consolida pendencias para regularizacao.

Nunca encerre se ainda houver contagens pendentes de sincronizacao.

