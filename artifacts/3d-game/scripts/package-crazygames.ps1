param(
  [string]$Output = "bullet-barrage-crazygames.zip"
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$dist = Join-Path $root "dist\public"
$zip = Join-Path $root $Output
$single = Join-Path $root "crazygames-single-file"

if (!(Test-Path $dist)) {
  throw "Build output not found at $dist. Run npm run build first."
}

if (Test-Path $zip) {
  Remove-Item -LiteralPath $zip -Force
}

$index = Join-Path $dist "index.html"

if (!(Test-Path $index)) {
  throw "index.html not found at $index."
}

if (Test-Path $single) {
  Remove-Item -LiteralPath $single -Recurse -Force
}

New-Item -ItemType Directory -Path $single | Out-Null

$html = Get-Content -LiteralPath $index -Raw
$assetsDir = Join-Path $dist "assets"
$cssFile = Get-ChildItem -LiteralPath $assetsDir -Filter "*.css" | Select-Object -First 1
$jsFile = Get-ChildItem -LiteralPath $assetsDir -Filter "*.js" | Where-Object { $_.Name -like "game-*.js" } | Select-Object -First 1

if ($null -eq $cssFile) {
  throw "CSS asset not found in $assetsDir."
}

if ($null -eq $jsFile) {
  throw "Game JS asset not found in $assetsDir."
}

$css = Get-Content -LiteralPath $cssFile.FullName -Raw
$js = Get-Content -LiteralPath $jsFile.FullName -Raw
$safeJs = $js.Replace("</script", "<\/script")
$safeCss = $css.Replace("</style", "<\/style")

$html = [regex]::Replace($html, '\s*<link rel="modulepreload"[^>]*>\s*', "`n")
$html = [regex]::Replace(
  $html,
  '\s*<link rel="stylesheet"[^>]*>\s*',
  { param($match) "`n    <style>`n$safeCss`n    </style>`n" }
)
$html = [regex]::Replace(
  $html,
  '\s*<script type="module"[^>]*src="[^"]*"[^>]*></script>\s*',
  { param($match) "`n    <script type=`"module`">`n$safeJs`n    </script>`n" }
)

$singleIndex = Join-Path $single "index.html"
Set-Content -LiteralPath $singleIndex -Value $html -Encoding UTF8

Compress-Archive -LiteralPath $singleIndex -DestinationPath $zip -CompressionLevel Optimal
Write-Host "Created $zip"
Write-Host "Upload this ZIP, or upload only crazygames-single-file\index.html if CrazyGames asks for individual files."
