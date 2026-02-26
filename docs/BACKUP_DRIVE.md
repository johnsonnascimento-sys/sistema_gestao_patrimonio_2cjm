# Backup no Google Drive (Banco + Imagens)

## Cabecalho

- Modulo: `docs`
- Funcao: padronizar backup/restore operacional com baixo consumo de banda e foco em recuperacao de incidentes (ex.: erro na importacao GEAFIN).

## Objetivo

Manter backup de:

1. Banco de dados (dump SQL compactado).
2. Imagens locais (`/opt/cjm-patrimonio/shared/data/fotos`).

Destino:

- Google Drive (remote `cjm_gdrive:`), pasta `db-backups`.

## Scripts oficiais

1. `scripts/backup_to_drive.sh`
2. `scripts/pre_geafin_snapshot.sh`
3. `scripts/restore_db_backup.sh`

## Fluxo recomendado (importacao GEAFIN)

1. Antes de importar o CSV GEAFIN, executar:

```bash
cd /opt/cjm-patrimonio/current
./scripts/pre_geafin_snapshot.sh --tag pre-geafin --keep-days 14
```

2. Executar a importacao GEAFIN normalmente pela UI (Admin > Operacoes API).
3. Se houver incidente relevante, usar restore do dump correspondente.

## Backup manual

Backup completo:

```bash
cd /opt/cjm-patrimonio/current
./scripts/backup_to_drive.sh --scope all --tag manual --keep-days 14
```

Somente banco:

```bash
./scripts/backup_to_drive.sh --scope db --tag diario --keep-days 14
```

Somente imagens:

```bash
./scripts/backup_to_drive.sh --scope media --tag fotos --keep-days 14
```

## Agendamento (cron)

Exemplo diario as `02:30 UTC`:

```bash
crontab -e
```

Adicionar:

```cron
30 2 * * * cd /opt/cjm-patrimonio/current && ./scripts/backup_to_drive.sh --scope all --tag cron-diario --keep-days 14 >> /var/log/cjm_backup_drive.log 2>&1
```

## Restore do banco

### A partir de backup remoto

```bash
cd /opt/cjm-patrimonio/current
./scripts/restore_db_backup.sh --remote-file db_YYYYMMDDTHHMMSSZ_pre-geafin.sql.gz --yes-i-know
```

### A partir de arquivo local

```bash
./scripts/restore_db_backup.sh --local-file /tmp/db_backup.sql.gz --yes-i-know
```

Observacoes:

1. O restore e destrutivo no banco alvo.
2. O script gera um backup `pre-restore` antes de aplicar.

## Estrutura de armazenamento

Local:

- `/opt/cjm-patrimonio/backups/db`
- `/opt/cjm-patrimonio/backups/media`

Remoto (Drive):

- `cjm_gdrive:db-backups/database`
- `cjm_gdrive:db-backups/media`

## Retencao

Padrao: `14 dias` (local + remoto).

Pode ser ajustado por parametro:

```bash
./scripts/backup_to_drive.sh --scope all --keep-days 7
```

## Checklist de validacao

1. `rclone listremotes` contem `cjm_gdrive:`.
2. `rclone ls cjm_gdrive:db-backups/database` lista arquivos de dump.
3. `rclone ls cjm_gdrive:db-backups/media` lista arquivos de imagens.
4. Log de backup sem erro em `/var/log/cjm_backup_drive.log`.

## Operacao visual no sistema

Tambem disponivel na UI em **Administracao do Painel > Backup e Restore (Drive)**:

1. Snapshot pre-GEAFIN por botao (senha ADMIN).
2. Backup manual por botao (senha ADMIN).
3. Restore por botao com dupla confirmacao (`RESTORE`) + senha ADMIN.
4. Lista de backups remotos (database/media) e historico de operacoes.
