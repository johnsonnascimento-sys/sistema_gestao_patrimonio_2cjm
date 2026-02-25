<#
Modulo: scripts
Arquivo: scripts/reverter_alteracao.ps1
Funcao no sistema: executar rollback seguro por commit ou por ID do log geral (Windows/PowerShell).
#>

[CmdletBinding()]
param(
    [string]$Commit = "",
    [string]$LogId = "",
    [string]$LogFile = "docs/LOG_GERAL_ALTERACOES.md",
    [switch]$InPlace
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($Commit) -and [string]::IsNullOrWhiteSpace($LogId)) {
    throw "Informe --Commit <hash> ou --LogId <ID>."
}
if (-not [string]::IsNullOrWhiteSpace($Commit) -and -not [string]::IsNullOrWhiteSpace($LogId)) {
    throw "Use apenas um modo: --Commit ou --LogId."
}

git rev-parse --git-dir *> $null
if ($LASTEXITCODE -ne 0) {
    throw "Execute dentro de um repositorio git."
}

git diff --quiet
if ($LASTEXITCODE -ne 0) {
    throw "Working tree suja. Commit/stash antes de reverter."
}
git diff --cached --quiet
if ($LASTEXITCODE -ne 0) {
    throw "Index sujo. Commit/stash antes de reverter."
}

if ([string]::IsNullOrWhiteSpace($Commit)) {
    if (-not (Test-Path $LogFile)) {
        throw "Log nao encontrado: $LogFile"
    }
    $line = Get-Content $LogFile | Where-Object { $_ -match "^\|\s*$([Regex]::Escape($LogId))\s*\|" } | Select-Object -First 1
    if (-not $line) {
        throw "ID nao encontrado no log: $LogId"
    }
    $parts = $line.Split("|") | ForEach-Object { $_.Trim() }
    if ($parts.Count -lt 8) {
        throw "Linha de log invalida para o ID: $LogId"
    }
    $Commit = ($parts[6] -replace '`', '').Trim()
}

if ([string]::IsNullOrWhiteSpace($Commit) -or $Commit -eq "-") {
    throw "Commit invalido para rollback."
}

git cat-file -e "$Commit^{commit}" *> $null
if ($LASTEXITCODE -ne 0) {
    throw "Commit nao encontrado no repositorio local: $Commit"
}

$currentBranch = (git rev-parse --abbrev-ref HEAD).Trim()
if (-not $InPlace) {
    $rollbackBranch = "rollback/$Commit-$((Get-Date).ToUniversalTime().ToString('yyyyMMddHHmmss'))"
    git switch -c $rollbackBranch
    if ($LASTEXITCODE -ne 0) {
        throw "Falha ao criar branch de rollback: $rollbackBranch"
    }
    Write-Host "[rollback] branch criada: $rollbackBranch (origem: $currentBranch)"
}

git revert --no-edit $Commit
if ($LASTEXITCODE -ne 0) {
    throw "Falha ao reverter commit: $Commit"
}

$branchNow = (git rev-parse --abbrev-ref HEAD).Trim()
Write-Host "[rollback] commit revertido com sucesso: $Commit"
Write-Host "[rollback] proximo passo sugerido: git push origin $branchNow"
