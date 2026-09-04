# Mowen one-click installer for Windows.
# Downloads the latest GitHub Release setup exe and runs it.
#
# Usage (PowerShell):
#   irm https://github.com/Yunz93/Mowen/releases/latest/download/install-windows.ps1 | iex
#   .\scripts\install-windows.ps1
#   .\scripts\install-windows.ps1 -Nightly
#   .\scripts\install-windows.ps1 -Version v0.1.0

param(
  [string] $Repo = $(if ($env:MOWEN_REPO) { $env:MOWEN_REPO } elseif ($env:OHMYPI_REPO) { $env:OHMYPI_REPO } else { "Yunz93/Mowen" }),
  [string] $Version = $(if ($env:MOWEN_VERSION) { $env:MOWEN_VERSION } elseif ($env:OHMYPI_VERSION) { $env:OHMYPI_VERSION } else { "latest" }),
  [switch] $Nightly
)

$ErrorActionPreference = "Stop"
$AppName = "Mowen"

if ($env:MOWEN_UPDATE_PARENT_PID -match '^\d+$') {
  while (Get-Process -Id ([int]$env:MOWEN_UPDATE_PARENT_PID) -ErrorAction SilentlyContinue) {
    Start-Sleep -Milliseconds 200
  }
}

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
  "Mowen-win-$arch-setup.exe",
  "Mowen-win-x64-setup.exe",
  "ohMyPi-win-$arch-setup.exe",
  "ohMyPi-win-x64-setup.exe",
  "MyPi-win-$arch-setup.exe",
  "MyPi-win-x64-setup.exe"
)

$tmp = Join-Path $env:TEMP "mowen-install"
New-Item -ItemType Directory -Force -Path $tmp | Out-Null
$installer = $null
$sumsPath = Join-Path $tmp "SHA256SUMS.txt"
$sums = $null
try {
  Invoke-WebRequest -Uri "$base/SHA256SUMS.txt" -OutFile $sumsPath -UseBasicParsing
  if (Test-Path $sumsPath) {
    $sums = Get-Content -Path $sumsPath
    Write-Host "OK  downloaded SHA256SUMS.txt"
  }
} catch {
  Write-Host "warning: this release has no SHA256SUMS.txt; skipping integrity check."
}

function Assert-ReleaseChecksum([string] $FilePath) {
  if (-not $sums) { return }
  $name = Split-Path -Leaf $FilePath
  $line = $sums | Where-Object { $_ -match "(^|\s)\*?$([regex]::Escape($name))\s*$" } | Select-Object -First 1
  if (-not $line) {
    Write-Host "warning: SHA256SUMS.txt does not list $name; skipping."
    return
  }
  $expected = (($line -split '\s+')[0]).ToLowerInvariant()
  $actual = (Get-FileHash -Algorithm SHA256 -Path $FilePath).Hash.ToLowerInvariant()
  if ($actual -ne $expected) {
    throw "$name checksum mismatch."
  }
  Write-Host "OK  $name checksum verified"
}

foreach ($name in $names) {
  $url = "$base/$name"
  $out = Join-Path $tmp $name
  Write-Host "-> Downloading $url"
  try {
    Invoke-WebRequest -Uri $url -OutFile $out -UseBasicParsing
    if (Test-Path $out) {
      Assert-ReleaseChecksum $out
      $installer = $out
      break
    }
  } catch {
    Write-Host "   missed $name"
    Remove-Item -Force -ErrorAction SilentlyContinue $out
  }
}

if (-not $installer) {
  throw "Could not download a $AppName installer from $base. Create a GitHub Release first, or pack locally with pnpm desktop:pack:win."
}

Unblock-File -Path $installer -ErrorAction SilentlyContinue
Write-Host "-> Starting installer $installer"
Start-Process -FilePath $installer -Wait
Write-Host "OK  $AppName setup finished. Open Mowen from the Start menu and follow the on-screen guide."
