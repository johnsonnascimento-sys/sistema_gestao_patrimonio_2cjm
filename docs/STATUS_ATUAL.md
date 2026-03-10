# Status Atual do Projeto (Runtime Ativo)

## Cabecalho

| Campo | Valor |
|---|---|
| Modulo | `docs` |
| Arquivo | `docs/STATUS_ATUAL.md` |
| Funcao no sistema | registro canonico do estado implementado do sistema, gaps e alinhamento de governanca |
| Data | 2026-03-10 |
| Versao | v1.5 |
| Fonte de verdade | `PROJECT_RULES.md` |

## 1. Resumo executivo

- Sistema de Gestão Patrimonial da 2ª CJM com runtime ativo em backend e frontend.
- Compliance operacional consolidado para inventário, movimentações, bens de terceiros, material inservível e baixa patrimonial.
- Área administrativa do inventário agora publicada em submenus dedicados, com menor acoplamento visual e mesma base legal.
- Execução determinística, auditável e com documentação Wiki-First atualizada no mesmo ciclo.

## 2. Mudança principal desta entrega

A área **Inventário - Administração** deixou de operar como página única e passou a ser distribuída em quatro submenus:

- `Inventário - Administração`
- `Inventário - Monitoramento`
- `Inventário - Acuracidade`
- `Inventário - Regularização`

Compatibilidade preservada:

- permissão `menu.inventario_admin.view`
- regras de negócio do backend
- fluxos de abertura, monitoramento, reabertura e regularização

## 3. Banco de dados

Sem mudança estrutural de banco nesta entrega.

Migrações relevantes já presentes no repositório:

- `010_inserviveis_wizard_persistencia.sql`
- `013_documentos_avaliacoes_inserviveis.sql`
- `022_rbac_roles_permissions.sql`
- `023_material_inservivel_baixa.sql`

## 4. Backend

Arquivo principal:

- `backend/server.js`

Estado desta entrega:

- sem novos endpoints ou contratos de payload;
- backend preservado para o inventário administrativo;
- regras de Material Inservível / Baixa permanecem ativas e documentadas.

## 5. Frontend

Arquivos principais da reorganização do inventário administrativo:

- `frontend/src/App.jsx`
- `frontend/src/components/InventoryAdminPanel.jsx`
- `frontend/src/components/inventory/InventoryAdminSections.js`
- `frontend/src/components/inventory/InventoryAdminSectionTabs.jsx`
- `frontend/src/components/inventory/InventoryAdminHeader.jsx`

Estrutura publicada:

- `Inventário - Administração`: evento ativo, abertura de ciclos e ações críticas
- `Inventário - Monitoramento`: bens não contados, monitoramento em tempo real e divergências interunidades
- `Inventário - Acuracidade`: histórico resumido e indicadores gerenciais
- `Inventário - Regularização`: fluxo pós-inventário para divergências

## 6. Testes e validações já cobertos

Frontend:

- build de produção com os novos submenus;
- teste automatizado da navegação local entre as quatro subtelas;
- preservação dos atalhos entre inventário, contagem e consulta de bens.

Gates do ciclo:

- `npm --prefix frontend test`
- `npm --prefix frontend run build`
- `python scripts/check_wiki_encoding.py`
- `node scripts/validate_governance.js`

## 7. Situação de compliance

Implementado:

- Arts. 141 a 157
- Art. 175
- Art. 183
- Art. 185
- Arts. 124 e 127

Observação:

- a entrega atual reorganiza navegação e hierarquia visual do inventário administrativo, sem alterar a base normativa já implementada.

## 8. Próximos passos recomendados

1. Expandir testes automatizados de navegação para validar handoff entre os quatro submenus e `Inventário - Contagem`.
2. Revisar a documentação de perfis por submenu caso a área administrativa passe a ter segregação de permissões no futuro.
3. Continuar a redução incremental do acoplamento do `InventoryAdminPanel`, preservando os contratos atuais da UI.
