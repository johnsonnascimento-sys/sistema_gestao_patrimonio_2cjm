<!--
Modulo: wiki
Arquivo: frontend/src/wiki/22_inventario_administracao.md
Funcao no sistema: orientar a operação dos submenus de Inventário - Administração.
-->

# Inventário no Menu Principal

## Objetivo da área

A navegação principal agora publica um menu agrupador **Inventário** dentro de `Operação diária`, preservando os `tab ids` existentes e as permissões de menu já usadas pelo runtime.

Submenus publicados no agrupador:

1. `Administração`
2. `Contagem`
3. `Acuracidade`
4. `Regularização`

Essa divisão reduz poluição visual e separa melhor:

- gestão do ciclo;
- acompanhamento operacional;
- leitura gerencial;
- regularização pós-inventário.

## Navegação

### Sidebar

No menu lateral, a área aparece como um grupo expansível `Inventário`, com quatro subtelas:

- `Administração`
- `Contagem`
- `Acuracidade`
- `Regularização`

### Navegação interna

Ao abrir qualquer uma dessas telas, a própria página exibe uma barra local de submenus.

Objetivo:

- permitir troca rápida entre as subtelas sem depender só da sidebar;
- manter contexto visual de que todas pertencem ao mesmo fluxo administrativo.

## 1) Administração

Foco:

- abrir novo ciclo;
- acompanhar o evento ativo;
- encerrar, cancelar ou reabrir inventários;
- manter o formulário de setup separado do restante da operação.

Blocos principais:

- cabeçalho operacional com badges de estado;
- navegação local entre os submenus;
- card `Evento ativo / Novo inventário`;
- bloco de coordenação do ciclo com resumo administrativo;
- `Área secundária` com setup e sugestões de ciclo quando houver evento ativo.

Fluxos preservados:

- abertura de inventário geral, por unidade ou por endereços;
- presets rápidos;
- modos `PADRAO`, `CEGO` e `DUPLO_CEGO`;
- ações críticas com confirmação forte;
- bloqueio operacional do Art. 183 (AN303_Art183).

## 2) Contagem

Foco:

- executar a contagem sala a sala;
- operar scanner/câmera;
- registrar exceções e divergências do endereço.

Atalhos preservados:

- `Abrir contagem do endereço` continua enviando o operador para `Inventário -> Contagem` com o preset correto;
- o bloqueio de navegação em modo cego continua fail-closed;
- a regularização formal continua fora da contagem.

## 3) Acuracidade

Foco:

- revisão histórica dos ciclos;
- leitura analítica do inventário;
- reabertura e edição de eventos encerrados;
- análise de cobertura, pendência e tendência.

Blocos principais:

- `Histórico resumido`;
- `Acuracidade de inventário`.

Nesta subtela, ambos passam a ser tratados como leitura principal do contexto analítico, sem competir com o monitoramento operacional.

## 4) Regularização

Foco:

- tratar divergências pós-inventário em fluxo próprio;
- manter a transferência formal fora da contagem;
- aplicar a regra do Art. 185 (AN303_Art185).

Bloco principal:

- `Regularização pós-inventário (Divergências)`.

Comportamento preservado:

- seleção em lote;
- manter carga;
- atualizar endereço quando permitido;
- encaminhar transferência formal;
- bloqueio da regularização para eventos não encerrados.

## Regras legais e operacionais preservadas

- Art. 183 (AN303_Art183): inventário ativo continua bloqueando movimentação de carga no escopo inventariado.
- Art. 185 (AN303_Art185): divergência não transfere carga automaticamente durante a contagem.
- Art. 175 (AN303_Art175): itens sem identificação continuam exigindo evidência visual no fluxo de inventário.
- Arts. 124 e 127 (AN303_Art124 e AN303_Art127): retirada física e transferência formal continuam segregadas.

## O que mudou para o operador

Antes:

- a navegação de inventário misturava páginas soltas e subtelas administrativas.

Agora:

- cada subtela tem foco próprio;
- o conteúdo ficou mais enxuto por contexto;
- a permissão e o comportamento do backend permanecem os mesmos;
- a mudança é de navegação e hierarquia visual, não de regra legal.

## Resumo rápido de uso

1. Use `Inventário -> Administração` para abrir e governar o ciclo.
2. Use `Inventário -> Contagem` para executar a leitura operacional por endereço.
3. Use `Inventário -> Acuracidade` para revisar histórico e indicadores.
4. Use `Inventário -> Regularização` para tratar pendências pós-inventário.
