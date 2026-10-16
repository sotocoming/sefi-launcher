param([string]$GameDirectory)
$ErrorActionPreference = 'Stop'
function Assert-MinecraftClosed {
    $games = @(Get-CimInstance Win32_Process -Filter "Name = 'java.exe' OR Name = 'javaw.exe'" -ErrorAction Stop | Where-Object { $_.CommandLine -match 'net.fabricmc.loader.impl.launch.knot.KnotClient|net.minecraft.client.main.Main|org.quiltmc.loader.impl.launch.knot.KnotClient' })
    if ($games.Count) { throw 'Закройте Minecraft перед исправлением. Открытая игра может перезаписать настройки.' }
}
if (-not $GameDirectory) {
    $settingsPath = Join-Path $env:APPDATA 'sefi-launcher/settings.json'
    if (Test-Path -LiteralPath $settingsPath) { $GameDirectory = (Get-Content -LiteralPath $settingsPath -Raw | ConvertFrom-Json).gameDirectory }
    if (-not $GameDirectory) { $GameDirectory = Join-Path $env:APPDATA '.sefi-launcher' }
}
if (-not [IO.Path]::IsPathRooted($GameDirectory)) { throw 'Укажите полный путь к папке игры.' }
$gameRoot = [IO.Path]::GetFullPath($GameDirectory.Trim())
if ($gameRoot -eq [IO.Path]::GetPathRoot($gameRoot)) { $gameRoot = Join-Path $gameRoot 'SEFI Minecraft' }
$optionsPath = Join-Path $gameRoot 'options.txt'
Assert-MinecraftClosed
if (-not (Test-Path -LiteralPath $optionsPath -PathType Leaf)) { throw 'Сначала один раз запустите и закройте Minecraft, затем повторите исправление.' }
$info = Get-Item -LiteralPath $optionsPath
if (($info.Attributes -band [IO.FileAttributes]::ReparsePoint) -or $info.Length -gt 2MB) { throw 'Файл настроек недоступен для безопасного исправления.' }
$lockPath = $optionsPath + '.sefi-controls.lock'
$lockHandle = $null
$tempPath = $null
try {
    try { $lockHandle = [IO.File]::Open($lockPath, [IO.FileMode]::CreateNew, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None) }
    catch { throw 'Не удалось начать исправление. Возможно, оно уже выполняется или нет доступа к папке.' }
    $original = [IO.File]::ReadAllBytes($optionsPath)
    $text = [Text.UTF8Encoding]::new($false, $true).GetString($original)
    if ($text.Contains([char]0)) { throw 'Файл настроек повреждён. Исправление отменено.' }
    $keys = @('key_key.jei.transferRecipeBookmark', 'key_key.jei.maxTransferRecipeBookmark', 'key_key.jei.cheatItemStack', 'key_key.jei.toggleCheatModeConfigButton', 'key_key.jei.toggleHideIngredient')
    $present = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
    $changed = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
    $output = [regex]::Replace($text, '(^|\r?\n)(key_key\.jei\.[^:\r\n]+):([^\r\n]*)', [Text.RegularExpressions.MatchEvaluator]{ param($match)
        $name = $match.Groups[2].Value
        if ($keys -cnotcontains $name) { return $match.Value }
        [void]$present.Add($name)
        if ($match.Groups[3].Value -cnotmatch '^key\.mouse\.left(?::.*)?$') { return $match.Value }
        [void]$changed.Add($name)
        return $match.Groups[1].Value + $name + ':key.keyboard.unknown'
    })
    $missing = @($keys | Where-Object { -not $present.Contains($_) })
    if ($missing.Count) {
        $eol = if ($text.Contains("`r`n")) { "`r`n" } else { "`n" }
        if ($output -and -not $output.EndsWith("`n")) { $output += $eol }
        $output += (($missing | ForEach-Object { [void]$changed.Add($_); $_ + ':key.keyboard.unknown' }) -join $eol) + $eol
    }
    if (-not $changed.Count) { Write-Host 'Исправление уже применено. Конфликтующих назначений на ЛКМ нет.'; return }
    $backupBase = Join-Path $gameRoot 'sefi-backups'
    $backupDir = Join-Path $backupBase 'controls'
    foreach ($folder in @($backupBase, $backupDir)) {
        if (-not (Test-Path -LiteralPath $folder)) { New-Item -ItemType Directory -Path $folder | Out-Null }
        $folderInfo = Get-Item -LiteralPath $folder
        if (-not $folderInfo.PSIsContainer -or ($folderInfo.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Не удалось безопасно сохранить резервную копию.' }
    }
    $backupPath = Join-Path $backupDir ('options-before-click-fix-' + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() + '-' + [guid]::NewGuid().ToString() + '.txt')
    [IO.File]::WriteAllBytes($backupPath, $original)
    Assert-MinecraftClosed
    $current = [IO.File]::ReadAllBytes($optionsPath)
    if ([Convert]::ToBase64String($current) -cne [Convert]::ToBase64String($original)) { throw 'Настройки изменились во время исправления. Повторите после закрытия игры.' }
    $tempPath = $optionsPath + '.' + [guid]::NewGuid().ToString() + '.tmp'
    [IO.File]::WriteAllText($tempPath, $output, [Text.UTF8Encoding]::new($false))
    [IO.File]::Replace($tempPath, $optionsPath, [NullString]::Value)
    $tempPath = $null
    Write-Host ('Готово. Исправлено назначений: ' + $changed.Count + '. Можно запускать Minecraft.')
    Write-Host ('Резервная копия: ' + $backupPath)
} finally {
    if ($lockHandle) { $lockHandle.Dispose(); Remove-Item -LiteralPath $lockPath }
    if ($tempPath -and (Test-Path -LiteralPath $tempPath)) { Remove-Item -LiteralPath $tempPath }
}
