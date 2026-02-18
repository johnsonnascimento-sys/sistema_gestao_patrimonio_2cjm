# Automations

## Cabecalho

- Modulo: `automations`
- Funcao: especificar fluxos n8n de suporte operacional (geracao de termos e upload).

## Arquivos

- `n8n_gerador_termos_spec.json`: contrato de fluxo para gerar HTML institucional, converter para PDF e salvar no Google Drive.
- `n8n_gerador_termos.json`: workflow importavel (modelo) para gerar termo (HTML) via webhook e salvar no Drive. Para PDF, substitua/adicione o node de conversao HTML->PDF conforme sua stack no n8n.
- `n8n_gerador_termos_pdf.json`: workflow importavel para gerar **PDF via API** (`POST /api/pdf/termos`) e enviar ao Drive.
- `n8n_relatorio_forasteiros.json`: workflow importavel para gerar relatorio de divergencias (forasteiros) e salvar no Drive (Art. 185 - AN303_Art185).
- `n8n_relatorio_forasteiros_pdf.json`: workflow importavel para gerar **PDF via API** (`GET /api/pdf/forasteiros`) e enviar ao Drive.
- `n8n_drive_upload_fotos_webhook.json`: workflow importavel para receber fotos via **webhook** (base64), fazer upload no Google Drive e devolver `driveUrl` (usado pelo backend em `POST /api/drive/fotos/upload`).

## Pre-requisitos (workflows PDF via API)

- Autenticacao ativa no backend (JWT).
- Variaveis de ambiente no n8n:
  - `PATRIMONIO_ADMIN_MATRICULA`
  - `PATRIMONIO_ADMIN_SENHA`
- Credencial Google Drive configurada no n8n.

## Pre-requisitos (upload de fotos via webhook)

- Importar `n8n_drive_upload_fotos_webhook.json` no n8n.
- Configurar credencial do Google Drive no node "Google Drive - Upload".
- Copiar a URL **Production** do Webhook e configurar no backend (VPS) como:
  - `N8N_DRIVE_PHOTOS_WEBHOOK_URL=<url_do_webhook>`
- Opcional:
  - `DRIVE_PHOTOS_FOLDER_ID=<id_da_pasta_no_drive>`
