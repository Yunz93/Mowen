# ohMyPi one-click installer for Windows.
# Downloads the latest GitHub Release setup exe and runs it.
#
# Usage (PowerShell):
#   irm https://github.com/Yunz93/ohMyPi/releases/latest/download/install-windows.ps1 | iex
#   .\scripts\install-windows.ps1
#   .\scripts\install-windows.ps1 -Nightly
#   .\scripts\install-windows.ps1 -Version v0.1.0

param(
  [string] $Repo = $(if ($env:OHMYPI_REPO) { $env:OHMYPI_REPO } else { "Yunz93/ohMyPi" }),
  [string] $Version = $(if ($env:OHMYPI_VERSION) { $env:OHMYPI_VERSION } else { "latest" }),
  [switch] $Nightly
)

$ErrorActionPreference = "Stop"
$AppName = "ohMyPi"

if ($Nightly) {
  $Version = "nightly"
}

$arch = "x64"
if ($env:PROCESSOR_ARCHITECTURE -eq "ARM64" -or $env:PROCESSOR_ARCHITEW6432 -eq "ARM64") {
  $arch = "arm64"
}

if ($Version -eq "latest") {
  $base = "https://github.com/$Repo/releases/latest/download"
} else {
  if ($Version -notmatch '^v' -and $Version -ne "nightly") {
    $Version = "v$Version"
  }
  $base = "https://github.com/$Repo/releases/download/$Version"
}

$names = @(
  "ohMyPi-win-$arch-setup.exe",
  "ohMyPi-win-x64-setup.exe",
  "MyPi-win-$arch-setup.exe",
  "MyPi-win-x64-setup.exe"
)

$tmp = Join-Path $env:TEMP "ohmypi-install"
New-Item -ItemType Directory -Force -Path $tmp | Out-Null
$installer = $null

foreach ($name in $names) {
  $url = "$base/$name"
  $out = Join-Path $tmp $name
  Write-Host "-> Downloading $url"
  try {
    Invoke-WebRequest -Uri $url -OutFile $out -UseBasicParsing
    if (Test-Path $out) {
      $installer = $out
      break
    }
  } catch {
    Write-Host "   missed $name"
  }
}

if (-not $installer) {
  throw "Could not download a $AppName installer from $base. Create a GitHub Release first, or pack locally with pnpm desktop:pack:win."
}

Unblock-File -Path $installer -ErrorAction SilentlyContinue
Write-Host "-> Starting installer $installer"
Start-Process -FilePath $installer -Wait
Write-Host "OK  $AppName setup finished. Open ohMyPi from the Start menu and follow the on-screen guide."
