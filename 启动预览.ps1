param([switch]$Rebuild)
$ErrorActionPreference = 'Stop'
$runtimeRoot = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies'
$bundledNode = Join-Path $runtimeRoot 'node\bin\node.exe'
$previousPath = $env:Path
try {
    if (Test-Path -LiteralPath $bundledNode) {
        $nodePath = $bundledNode
    } else {
        $nodePath = (Get-Command node -ErrorAction Stop).Source
    }
    $nodeVersion = & $nodePath --version
    if ([int]($nodeVersion.TrimStart('v').Split('.')[0]) -lt 22) {
        throw '官网需要 Node.js 22 或更高版本。'
    }
    # Some development PCs also have an old Node on PATH; child build commands must use the same runtime.
    $env:Path = (Split-Path -Parent $nodePath) + ';' + $env:Path
    Push-Location -LiteralPath $PSScriptRoot
    try {
        if ($Rebuild -or -not (Test-Path -LiteralPath 'dist\client\ja\index.html')) {
            $bundledPnpm = Join-Path $runtimeRoot 'bin\fallback\pnpm.cmd'
            $packageManager = if (Test-Path -LiteralPath $bundledPnpm) { $bundledPnpm } else { (Get-Command pnpm -ErrorAction Stop).Source }
            if (-not (Test-Path -LiteralPath 'node_modules')) {
                & $packageManager install
                if ($LASTEXITCODE -ne 0) { throw '依赖安装未完成。' }
            }
            & $packageManager run build
            if ($LASTEXITCODE -ne 0) { throw '官网构建未完成。' }
        }
        & $nodePath 'server\serve.mjs'
    } finally { Pop-Location }
} finally { $env:Path = $previousPath }
