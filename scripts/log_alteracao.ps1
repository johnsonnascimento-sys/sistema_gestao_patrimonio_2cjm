<#
Modulo: scripts
Arquivo: scripts/log_alteracao.ps1
Funcao no sistema: registrar entrada padronizada no log geral de alteracoes (Windows/PowerShell).
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$Tipo,

    [Parameter(Mandatory = $true)]
    [string]$Detalhe,

    [string]$LogFile = "docs/LOG_GERAL_ALTERACOES.md",
    [string]$EntryId = "",
    [string]$AlterUser = "",
    [string]$AlterEmail = "",
    [string]$CommitOverride = "",
    [switch]$FinalMode
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Sanitize-Markdown([string]$Value) {
    if ([string]::IsNullOrWhiteSpace($Value)) { return "-" }
    return ($Value -replace "\|", "/" -replace "`r?`n", " ").Trim()
}

if ([string]::IsNullOrWhiteSpace($EntryId)) {
    $EntryId = (Get-Date).ToUniversalTime().ToString("yyyyMMdd-HHmmss")
}

$timestampUtc = (Get-Date).ToUniversalTime().ToString("yyyy-MM-dd HH:mm:ss 'UTC'")

if ([string]::IsNullOrWhiteSpace($AlterUser)) {
    $AlterUser = (git config user.name 2>$null)
    if ([string]::IsNullOrWhiteSpace($AlterUser)) { $AlterUser = $env:USERNAME }
}
if ([string]::IsNullOrWhiteSpace($AlterEmail)) {
    $AlterEmail = (git config user.email 2>$null)
    if ([string]::IsNullOrWhiteSpace($AlterEmail)) { $AlterEmail = "-" }
}

$branch = (git rev-parse --abbrev-ref HEAD 2>$null)
if ([string]::IsNullOrWhiteSpace($branch)) { $branch = "-" }

$commit = if (-not [string]::IsNullOrWhiteSpace($CommitOverride)) {
    $CommitOverride
} else {
    (git rev-parse --short HEAD 2>$null)
}
if ([string]::IsNullOrWhiteSpace($commit)) { $commit = "-" }

if ($FinalMode -and ($commit -eq "-" -or $commit -eq "PENDENTE_COMMIT" -or $commit -eq "<commit_gerado_para_esta_entrega>")) {
    throw "FINAL_MODE exige commit real no log."
}

$reversao = if ($commit -eq "-") { "-" } else { "git revert $commit" }

$line = "| $EntryId | $timestampUtc | $(Sanitize-Markdown $AlterUser) <$(Sanitize-Markdown $AlterEmail)> | $(Sanitize-Markdown $Tipo) | ``$(Sanitize-Markdown $branch)`` | ``$(Sanitize-Markdown $commit)`` | $(Sanitize-Markdown $Detalhe) | ``$reversao`` |"

if (-not (Test-Path $LogFile)) {
    $dir = Split-Path -Parent $LogFile
    if ($dir -and -not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
    @(
        "# Log Geral de Alteracoes",
        "",
        "| ID | DataHoraUTC | Usuario | Tipo | Branch | Commit | Detalhe | ReversaoSugerida |",
        "|---|---|---|---|---|---|---|---|"
    ) | Set-Content -Path $LogFile -Encoding UTF8
}

Add-Content -Path $LogFile -Value $line -Encoding UTF8

Write-Host "[log] entrada adicionada em $LogFile"
Write-Host "[log] id=$EntryId commit=$commit"
