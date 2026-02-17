<!--
Modulo: wiki
Arquivo: frontend/src/wiki/10_solucao_problemas.md
Funcao no sistema: troubleshooting focado no usuario e no admin (sem expor segredos).
-->

# Solução de problemas (FAQ)

## "Failed to fetch" / "Erro interno no servidor"

O que significa:

- O frontend não conseguiu falar com o backend via `/api`.

Checklist rapido:

1. Abra **Operações API** e clique em **Testar /health**.
2. Se falhar, o problema e conectividade/proxy/backend.

Possiveis causas:

- Backend fora do ar.
- Proxy Nginx sem `location /api/`.
- Timeout do proxy em operacao longa.

## "504 Gateway Time-out" ao importar GEAFIN

O que significa:

- O proxy Nginx encerrou a conexao antes do backend terminar.

Solução:

- Aumentar timeouts de proxy (host Nginx e/ou Nginx do container).
- Garantir `proxy_request_buffering off` para upload.

## "Formato do tombamento inválido"

O tombamento GEAFIN esperado é:

- exatamente 10 dígitos numéricos (ex.: `1290001788`).

Se você digitou algo como `TMB-00772`, isso não é o mesmo padrão. Procure o tombamento no documento/etiqueta correta.

## Barra de progresso some ao dar refresh

O progresso depende do ultimo registro de importacao no banco.

Se sumir:

- Verifique se existe uma importacao em andamento ou concluida no endpoint de progresso (admin).
- Se a pagina estiver usando cache, force recarregar (Ctrl+F5).

## "Un" ao lado do botão Importar

Isso é um fragmento visual do layout atual (botão/rótulo) e não representa uma unidade.

Se aparecer sem funcao:

- Pode ser removido/renomeado em melhoria de UX.

## Inventário: "Bem de Terceiro" (não entendi)

Veja a pagina:

- Intrusos e bens de terceiros

Resumo:

- Bem de terceiro e item externo ao patrimonio, registrado segregado para controle.
