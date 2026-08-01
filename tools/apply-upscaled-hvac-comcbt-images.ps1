param(
    [switch]$Apply
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
Add-Type -AssemblyName System.Drawing

$projectRoot = Split-Path -Parent $PSScriptRoot
$sourceRoot = Join-Path $projectRoot 'assets\hvac\assets\comcbt'
$stageRoot = Join-Path $projectRoot 'work\hvac-comcbt-upscaled'
$dataPath = Join-Path $projectRoot 'data\hvac.js'

function Get-ImageDimensions {
    param([Parameter(Mandatory)][string]$Path)
    $image = [System.Drawing.Image]::FromFile($Path)
    try {
        [PSCustomObject]@{ Width = $image.Width; Height = $image.Height }
    }
    finally {
        $image.Dispose()
    }
}

$sourceFiles = @(Get-ChildItem -LiteralPath $sourceRoot -Recurse -File -Filter *.gif | Sort-Object FullName)
if ($sourceFiles.Count -ne 1348) {
    throw "Expected 1,348 source GIF files, found $($sourceFiles.Count)."
}

$validation = foreach ($sourceFile in $sourceFiles) {
    $round = $sourceFile.Directory.Parent.Name
    $stageFile = Join-Path (Join-Path $stageRoot $round) "$($sourceFile.BaseName).png"
    if (-not (Test-Path -LiteralPath $stageFile)) {
        throw "Missing staged file: $round/$($sourceFile.BaseName).png"
    }
    $sourceSize = Get-ImageDimensions -Path $sourceFile.FullName
    $stageSize = Get-ImageDimensions -Path $stageFile
    if ($stageSize.Width -ne ($sourceSize.Width * 2) -or $stageSize.Height -ne ($sourceSize.Height * 2)) {
        throw "Invalid staged dimensions: $round/$($sourceFile.BaseName).png"
    }
    [PSCustomObject]@{
        Round = $round
        StagePath = $stageFile
        DestinationPath = Join-Path $sourceFile.DirectoryName "$($sourceFile.BaseName).png"
        OldReference = "assets/hvac/assets/comcbt/$round/images/$($sourceFile.Name)"
        NewReference = "assets/hvac/assets/comcbt/$round/images/$($sourceFile.BaseName).png"
    }
}

Write-Output "VALIDATED - $($validation.Count) HVAC embedded images"
if (-not $Apply) {
    Write-Output 'Validation only. Use -Apply after reviewing the staged files.'
    exit 0
}

foreach ($item in $validation) {
    Copy-Item -LiteralPath $item.StagePath -Destination $item.DestinationPath -Force
}

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$dataText = [System.IO.File]::ReadAllText($dataPath, $utf8NoBom)
$replacementCount = 0
foreach ($item in $validation) {
    if ($dataText.Contains($item.OldReference)) {
        $dataText = $dataText.Replace($item.OldReference, $item.NewReference)
        $replacementCount += 1
    }
}
if ($replacementCount -ne 1348) {
    throw "Expected 1,348 data reference replacements, found $replacementCount."
}
[System.IO.File]::WriteAllText($dataPath, $dataText, $utf8NoBom)

Write-Output "APPLIED - 1,348 PNG files and $replacementCount data references"
