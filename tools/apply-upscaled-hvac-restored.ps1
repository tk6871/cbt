param(
    [switch]$Apply
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
Add-Type -AssemblyName System.Drawing

$projectRoot = Split-Path -Parent $PSScriptRoot
$sourceRoot = Join-Path $projectRoot 'assets\hvac\assets\questions'
$stageRoot = Join-Path $projectRoot 'work\hvac-restored-upscaled'
$roundPattern = '^20(21|22|23|24|25|26)_[1-3]$'

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

$sourceRounds = @(Get-ChildItem -LiteralPath $sourceRoot -Directory |
    Where-Object Name -match $roundPattern |
    Sort-Object Name)

if ($sourceRounds.Count -ne 17) {
    throw "Expected 17 restored HVAC rounds, found $($sourceRounds.Count)."
}

$validation = foreach ($sourceRound in $sourceRounds) {
    $stageRound = Join-Path $stageRoot $sourceRound.Name
    if (-not (Test-Path -LiteralPath $stageRound)) {
        throw "Missing staged round: $($sourceRound.Name)"
    }

    $sourceFiles = @(Get-ChildItem -LiteralPath $sourceRound.FullName -File |
        Where-Object Extension -in '.jpg', '.jpeg', '.png' |
        Sort-Object { [int]$_.BaseName })
    if ($sourceFiles.Count -ne 60) {
        throw "$($sourceRound.Name) source count mismatch: $($sourceFiles.Count)."
    }

    foreach ($sourceFile in $sourceFiles) {
        $stageFile = Join-Path $stageRound $sourceFile.Name
        if (-not (Test-Path -LiteralPath $stageFile)) {
            throw "Missing staged image: $($sourceRound.Name)/$($sourceFile.Name)"
        }

        $sourceSize = Get-ImageDimensions -Path $sourceFile.FullName
        $stageSize = Get-ImageDimensions -Path $stageFile
        if (
            $stageSize.Width -ne ($sourceSize.Width * 2) -or
            $stageSize.Height -ne ($sourceSize.Height * 2)
        ) {
            throw "Invalid staged image dimensions: $($sourceRound.Name)/$($sourceFile.Name)"
        }

        [PSCustomObject]@{
            Round = $sourceRound.Name
            File = $sourceFile.Name
            SourcePath = $sourceFile.FullName
            StagePath = $stageFile
            SourceWidth = $sourceSize.Width
            SourceHeight = $sourceSize.Height
            OutputWidth = $stageSize.Width
            OutputHeight = $stageSize.Height
            OutputBytes = (Get-Item -LiteralPath $stageFile).Length
        }
    }
}

if ($validation.Count -ne 1020) {
    throw "Expected 1,020 validated images, found $($validation.Count)."
}

$totalBytes = ($validation | Measure-Object OutputBytes -Sum).Sum
Write-Output "VALIDATED - 17 rounds / 1,020 images / $totalBytes bytes"

if (-not $Apply) {
    Write-Output 'Validation only. Use -Apply after reviewing the staged files.'
    exit 0
}

foreach ($item in $validation) {
    Copy-Item -LiteralPath $item.StagePath -Destination $item.SourcePath -Force
}

foreach ($item in $validation) {
    $resultSize = Get-ImageDimensions -Path $item.SourcePath
    if ($resultSize.Width -ne $item.OutputWidth -or $resultSize.Height -ne $item.OutputHeight) {
        throw "Applied image validation failed: $($item.Round)/$($item.File)"
    }
}

Write-Output "APPLIED - $($validation.Count) restored HVAC images"
