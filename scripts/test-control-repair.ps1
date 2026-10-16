$ErrorActionPreference = 'Stop'
$fixtureRoot = Join-Path (Split-Path -Parent (Split-Path -Parent $PSScriptRoot)) 'test-data'
New-Item -ItemType Directory -Force -Path $fixtureRoot | Out-Null
$keys = @('key_key.jei.transferRecipeBookmark','key_key.jei.maxTransferRecipeBookmark','key_key.jei.cheatItemStack','key_key.jei.toggleCheatModeConfigButton','key_key.jei.toggleHideIngredient')
$fixture = "version:3465`r`nkey_key.attack:key.mouse.left`r`n" + (($keys | ForEach-Object { $_ + ":key.mouse.left" }) -join "`r`n") + "`r`nkey_key.jei.showRecipe2:key.mouse.left`r`n"
$case = Join-Path $fixtureRoot ([guid]::NewGuid().ToString())
New-Item -ItemType Directory -Path $case | Out-Null
$file = Join-Path $case 'options.txt'
[IO.File]::WriteAllText($file, $fixture, [Text.UTF8Encoding]::new($false))
function global:Get-CimInstance { param($Filter,$ErrorAction) @([pscustomobject]@{ CommandLine = 'java net.fabricmc.loader.impl.launch.knot.KnotClient' }) }
try { & (Join-Path $PSScriptRoot 'repair-click-bindings.ps1') -GameDirectory $case; throw 'Running-game guard did not reject' }
catch { if ($_.Exception.Message -notmatch 'Закройте Minecraft') { throw } }
if ([IO.File]::ReadAllText($file) -cne $fixture) { throw 'Running game changed options' }
function global:Get-CimInstance { param($Filter,$ErrorAction) @() }
& (Join-Path $PSScriptRoot 'repair-click-bindings.ps1') -GameDirectory $case
$output = [IO.File]::ReadAllText($file)
foreach ($key in $keys) { if (-not $output.Contains($key + ':key.keyboard.unknown')) { throw ('Not repaired: ' + $key) } }
if (-not $output.Contains('key_key.attack:key.mouse.left')) { throw 'Attack binding changed' }
if (-not $output.Contains('key_key.jei.showRecipe2:key.mouse.left')) { throw 'Unrelated JEI binding changed' }
$backups = @(Get-ChildItem -LiteralPath (Join-Path $case 'sefi-backups/controls') -File)
if ($backups.Count -ne 1 -or [IO.File]::ReadAllText($backups[0].FullName) -cne $fixture) { throw 'Backup mismatch' }
& (Join-Path $PSScriptRoot 'repair-click-bindings.ps1') -GameDirectory $case
if (@(Get-ChildItem -LiteralPath (Join-Path $case 'sefi-backups/controls') -File).Count -ne 1) { throw 'Idempotence failed' }
Write-Host 'PASS: PowerShell repair, original backup, unrelated bindings, running-game refusal and repeated use.'