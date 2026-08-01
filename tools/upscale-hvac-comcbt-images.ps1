param(
    [string]$Round,
    [ValidateRange(32, 512)]
    [int]$TileSize = 64
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
Add-Type -AssemblyName System.Drawing

$projectRoot = Split-Path -Parent $PSScriptRoot
$sourceRoot = Join-Path $projectRoot 'assets\hvac\assets\comcbt'
$stageRoot = Join-Path $projectRoot 'work\hvac-comcbt-upscaled'
$tempRoot = Join-Path $projectRoot 'work\hvac-comcbt-upscale-temp'
$engineRoot = Join-Path $projectRoot 'tools\realesrgan\realesrgan-ncnn-vulkan-20220424-windows'
$engine = Join-Path $engineRoot 'realesrgan-ncnn-vulkan.exe'

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

function Save-Png {
    param(
        [Parameter(Mandatory)][string]$InputPath,
        [Parameter(Mandatory)][string]$OutputPath
    )
    $source = [System.Drawing.Bitmap]::FromFile($InputPath)
    try {
        $output = New-Object System.Drawing.Bitmap $source.Width, $source.Height, ([System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
        try {
            $graphics = [System.Drawing.Graphics]::FromImage($output)
            try {
                $graphics.Clear([System.Drawing.Color]::White)
                $graphics.DrawImageUnscaled($source, 0, 0)
            }
            finally {
                $graphics.Dispose()
            }
            $output.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
        }
        finally {
            $output.Dispose()
        }
    }
    finally {
        $source.Dispose()
    }
}

function Save-DownscaledPng {
    param(
        [Parameter(Mandatory)][string]$InputPath,
        [Parameter(Mandatory)][string]$OutputPath,
        [Parameter(Mandatory)][int]$Width,
        [Parameter(Mandatory)][int]$Height
    )
    $source = [System.Drawing.Bitmap]::FromFile($InputPath)
    try {
        $output = New-Object System.Drawing.Bitmap $Width, $Height, ([System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
        try {
            $graphics = [System.Drawing.Graphics]::FromImage($output)
            try {
                $graphics.Clear([System.Drawing.Color]::White)
                $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
                $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
                $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
                $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
                $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
                $graphics.DrawImage(
                    $source,
                    (New-Object System.Drawing.Rectangle 0, 0, $Width, $Height),
                    (New-Object System.Drawing.Rectangle 0, 0, $source.Width, $source.Height),
                    [System.Drawing.GraphicsUnit]::Pixel
                )
            }
            finally {
                $graphics.Dispose()
            }
            $output.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
        }
        finally {
            $output.Dispose()
        }
    }
    finally {
        $source.Dispose()
    }
}

if (-not (Test-Path -LiteralPath $engine)) {
    throw "Real-ESRGAN executable is missing: $engine"
}

$roundDirectories = @(Get-ChildItem -LiteralPath $sourceRoot -Directory | Sort-Object Name)
if ($Round) {
    $roundDirectories = @($roundDirectories | Where-Object Name -eq $Round)
    if ($roundDirectories.Count -ne 1) {
        throw "Unknown HVAC round: $Round"
    }
}

New-Item -ItemType Directory -Force -Path $stageRoot, $tempRoot | Out-Null
$mutex = New-Object System.Threading.Mutex($false, 'Local\CBT-HVAC-Comcbt-Upscale')
if (-not $mutex.WaitOne(0)) {
    $mutex.Dispose()
    throw 'Another HVAC embedded-image upscale process is already running.'
}

try {
    foreach ($roundDirectory in $roundDirectories) {
        $sourceFiles = @(Get-ChildItem -LiteralPath $roundDirectory.FullName -Recurse -File -Filter *.gif | Sort-Object FullName)
        if (-not $sourceFiles.Count) { continue }

        $stageRound = Join-Path $stageRoot $roundDirectory.Name
        $tempRound = Join-Path $tempRoot $roundDirectory.Name
        $tempInput = Join-Path $tempRound 'input'
        $tempFourTimes = Join-Path $tempRound '4x'
        New-Item -ItemType Directory -Force -Path $stageRound, $tempInput, $tempFourTimes | Out-Null

        $pending = @()
        foreach ($sourceFile in $sourceFiles) {
            $sourceSize = Get-ImageDimensions -Path $sourceFile.FullName
            $outputName = "$($sourceFile.BaseName).png"
            $stageFile = Join-Path $stageRound $outputName
            if (Test-Path -LiteralPath $stageFile) {
                $stageSize = Get-ImageDimensions -Path $stageFile
                if ($stageSize.Width -eq ($sourceSize.Width * 2) -and $stageSize.Height -eq ($sourceSize.Height * 2)) {
                    continue
                }
            }

            $inputFile = Join-Path $tempInput $outputName
            Save-Png -InputPath $sourceFile.FullName -OutputPath $inputFile
            $pending += [PSCustomObject]@{
                Source = $sourceFile
                SourceWidth = $sourceSize.Width
                SourceHeight = $sourceSize.Height
                Input = $inputFile
                FourTimes = Join-Path $tempFourTimes $outputName
                Stage = $stageFile
            }
        }

        if ($pending.Count) {
            Write-Output "UPSCALE $($roundDirectory.Name) - $($pending.Count) embedded images"
            $pendingIndex = 0
            foreach ($item in $pending) {
                $pendingIndex += 1
                Write-Host "UPSCALE $($roundDirectory.Name) [$pendingIndex/$($pending.Count)] $($item.Source.Name)"
                Push-Location $engineRoot
                try {
                    $previousErrorActionPreference = $ErrorActionPreference
                    $ErrorActionPreference = 'Continue'
                    try {
                        $modelOutput = @(& $engine `
                            -i $item.Input `
                            -o $item.FourTimes `
                            -n 'realesrgan-x4plus-anime' `
                            -s 4 `
                            -t $TileSize `
                            -f png 2>&1)
                        $modelExitCode = $LASTEXITCODE
                    }
                    finally {
                        $ErrorActionPreference = $previousErrorActionPreference
                    }
                    if ($modelExitCode -ne 0) {
                        $tail = ($modelOutput | Select-Object -Last 8) -join [Environment]::NewLine
                        throw "Real-ESRGAN failed for $($roundDirectory.Name)/$($item.Source.Name), exit $modelExitCode`n$tail"
                    }
                }
                finally {
                    Pop-Location
                }
            }

            foreach ($item in $pending) {
                if (-not (Test-Path -LiteralPath $item.FourTimes)) {
                    throw "Missing 4x result: $($item.FourTimes)"
                }
                $fourTimesSize = Get-ImageDimensions -Path $item.FourTimes
                if ($fourTimesSize.Width -ne ($item.SourceWidth * 4) -or $fourTimesSize.Height -ne ($item.SourceHeight * 4)) {
                    throw "Invalid 4x size: $($item.Source.Name)"
                }
                Save-DownscaledPng `
                    -InputPath $item.FourTimes `
                    -OutputPath $item.Stage `
                    -Width ($item.SourceWidth * 2) `
                    -Height ($item.SourceHeight * 2)
            }
        }

        $manifest = foreach ($sourceFile in $sourceFiles) {
            $sourceSize = Get-ImageDimensions -Path $sourceFile.FullName
            $stageFile = Join-Path $stageRound "$($sourceFile.BaseName).png"
            if (-not (Test-Path -LiteralPath $stageFile)) {
                throw "Missing staged image: $stageFile"
            }
            $stageSize = Get-ImageDimensions -Path $stageFile
            if ($stageSize.Width -ne ($sourceSize.Width * 2) -or $stageSize.Height -ne ($sourceSize.Height * 2)) {
                throw "Invalid staged size: $($sourceFile.Name)"
            }
            [PSCustomObject]@{
                Round = $roundDirectory.Name
                SourceFile = $sourceFile.Name
                OutputFile = "$($sourceFile.BaseName).png"
                SourceWidth = $sourceSize.Width
                SourceHeight = $sourceSize.Height
                OutputWidth = $stageSize.Width
                OutputHeight = $stageSize.Height
                SourceBytes = $sourceFile.Length
                OutputBytes = (Get-Item -LiteralPath $stageFile).Length
                Model = 'realesrgan-x4plus-anime'
                Pipeline = 'gif-to-png-4x-model-to-2x-bicubic'
            }
        }
        $manifest | Export-Csv -LiteralPath (Join-Path $stageRound '_manifest.csv') -NoTypeInformation -Encoding UTF8
        if (Test-Path -LiteralPath $tempRound) {
            Remove-Item -LiteralPath $tempRound -Recurse -Force
        }
        Write-Output "DONE $($roundDirectory.Name) - $($manifest.Count) images"
    }
}
finally {
    $mutex.ReleaseMutex()
    $mutex.Dispose()
}
