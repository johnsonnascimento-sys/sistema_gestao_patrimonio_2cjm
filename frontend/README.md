# Frontend 2a CJM

## Cabecalho

- Modulo: `frontend`
- Funcao: interface React PWA para inventario, classificacao de danos e consulta de normas.

## Scripts

- `npm install`
- `npm run dev`
- `npm run build`

## Configuracao

- Copiar `frontend/.env.example` para `.env` e ajustar `VITE_API_BASE_URL`.
- Exemplo: `VITE_API_BASE_URL=http://localhost:3001`

## Rotas de Interface

- `Consulta de Bens`: lista/consulta paginada de bens reais via `/stats` e `/bens`.
- `Modo Inventario`: tela sala a sala com botao "Bem de Terceiro".
- `Wizard Art. 141`: modal de classificacao obrigatoria.
- `Gestao de Normas`: links estaticos de referencia.
- `Operacoes API`: healthcheck, importacao GEAFIN e formulario de `/movimentar`.
  - Inclui criacao de `perfis` para testes locais (necessario para autorizar/executar movimentacoes).

## Regra de Tombamento GEAFIN

- Usar tombamento no formato numerico com 10 digitos.
- Exemplo: `1290001788`.
