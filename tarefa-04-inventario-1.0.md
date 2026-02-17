# Tarefa 04 - Inventario 1.0 (evento + sala + agrupamento SKU + offline)

## Objetivo
Fechar o modo inventario com UX completa e deterministica:

- Abrir evento.
- Baixar catalogo da sala.
- Contar/scannear offline.
- Sincronizar.
- Ver "Encontrados/Faltantes" por SKU.
- Listar divergencias por sala.
- Encerrar evento sem perder dados.

## Tarefas
- [ ] UI: persistir contexto (evento/sala/unidade) em refresh -> Verificar: ao dar refresh, a tela mantem sala/unidade/evento.
- [ ] UI: divergencias por sala -> Verificar: painel "Divergencias na sala" lista itens divergentes (SERVIDOR e PENDENTE).
- [ ] UI: guardrail ao encerrar -> Verificar: se houver pendencias offline, a tela alerta e oferece sincronizar.
- [ ] Wiki: atualizar manual de inventario com os comportamentos -> Verificar: `frontend/src/wiki/06_inventario_sala_a_sala.md` contem os passos e avisos.

## Feito Quando
- [ ] Operador consegue operar sala com internet ruim (fila offline visivel).
- [ ] Divergencias aparecem por sala e nao disparam transferencia durante EM_ANDAMENTO (Art. 185).
- [ ] Encerramento do evento alerta pendencias antes de fechar.

