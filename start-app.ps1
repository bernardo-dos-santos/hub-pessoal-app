$ErrorActionPreference = "Stop"

$workspace = Split-Path -Parent $MyInvocation.MyCommand.Path
$localNode = Get-Command node -ErrorAction SilentlyContinue

if ($localNode) {
  & $localNode.Source (Join-Path $workspace "legacy\finance-mvp\server.js")
} else {
  throw "Node.js nao encontrado. Instale o Node.js e rode de novo."
}
