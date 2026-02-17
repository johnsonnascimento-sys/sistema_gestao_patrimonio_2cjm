<!--
Modulo: wiki
Arquivo: frontend/src/wiki/04_importacao_geafin.md
Funcao no sistema: manual detalhado da importacao GEAFIN (CSV Latin1) e como auditar o espelho.
-->

# Importacao GEAFIN (CSV)

## O que esta importacao faz

Quando voce importa o CSV do GEAFIN (relatorio), o sistema faz duas coisas:

1. **Camada espelho (auditoria 1:1)**:
   - Salva todas as linhas importadas em tabelas de importacao (espelho do CSV).
   - Isso permite provar que "o que entrou" e exatamente o que estava no arquivo.

2. **Camada operacional (normalizada)**:
   - Atualiza `catalogo_bens` e `bens` para uso diario (SKU vs item).
   - Evita duplicacao de descricao por item, quando possivel.

## Onde importar

No site, abra:

- Aba **Operacoes API**
- Secao **Importacao GEAFIN (CSV Latin1)**

Passos:

1. Clique em **Escolher arquivo**.
2. Selecione o CSV exportado do GEAFIN.
3. Clique em **Importar**.

## Progresso (barra)

Durante a importacao, a UI mostra:

- Nome do arquivo
- Status (EM_ANDAMENTO / CONCLUIDO / ERRO)
- Percentual (%)
- Contadores (ok, falhas de persistencia, falhas de normalizacao)

### Se ficar em 0% por muito tempo

Isso normalmente significa "fase de preparacao":

- upload do arquivo
- leitura/parse do CSV
- registro do arquivo no banco

Por isso, o sistema pode mostrar um indicador "indeterminado" ate as primeiras linhas serem processadas.

## O que pode dar errado (e o que fazer)

### 1) 504 Gateway Timeout

Sintoma:

- O browser mostra 504 ou "Failed to fetch" durante upload/importacao.

Causa comum:

- Timeout do proxy Nginx.

Solucao:

- Ajustar `proxy_read_timeout`/`proxy_send_timeout` no Nginx (host e/ou container) e recarregar.

### 2) ERRO no status da importacao

Quando o status vira `ERRO`, o sistema guarda um resumo (`erro_resumo`). Voce deve:

1. Abrir logs do backend (Docker).
2. Ver o `requestId` do POST `/importar-geafin`.
3. Confirmar qual coluna/linha causou falha.

## Como auditar (camada espelho)

O espelho existe para auditoria. Ele permite responder:

- Qual arquivo foi importado?
- Quantas linhas?
- Quando?
- Com quais separadores?
- Houve falhas por linha?

O sistema guarda metadados do arquivo (hash, bytes, total de linhas) e as linhas em tabela dedicada.

Importante:

- O espelho nao substitui a camada operacional.
- Ele existe para rastreabilidade e comparacao.

## Boas praticas

- Importe sempre um arquivo por vez (aguarde `CONCLUIDO`).
- Guarde o CSV original em arquivo interno (fora do repositorio) para auditoria externa.
- Se importar novamente o mesmo arquivo, o sistema deve reconhecer duplicidade via hash e ainda assim registrar um novo evento (dependendo do modo configurado).

