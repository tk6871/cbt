param(
    [string]$Round,
    [ValidateRange(80, 100)]
    [int]$JpegQuality = 94,
    [ValidateRange(32, 512)]
    [int]$TileSize = 64
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
Add-Type -AssemblyName System.Drawing

$projectRoot = Split-Path -Parent $PSScriptRoot
$sourceRoot = Join-Path $projectRoot 'assets\hvac\assets\questions'
$stageRoot = Join-Path $projectRoot 'work\hvac-restored-upscaled'
$tempRoot = Join-Path $projectRoot 'work\hvac-restored-upscale-temp'
$engineRoot = Join-Path $projectRoot 'tools\realesrgan\realesrgan-ncnn-vulkan-20220424-windows'
$engine = Join-Path $engineRoot 'realesrgan-ncnn-vulkan.exe'
$roundPattern = '^20(21|22|23|24|25|26)_[1-3]$'

function Assert-ChildPath {
    param(
        [Parameter(Mandatory)]
        [string]$Parent,
        [Parameter(Mandatory)]
        [string]$Child
    )

    $parentFull = [IO.Path]::GetFullPath($Parent).TrimEnd('\') + '\'
    $childFull = [IO.Path]::GetFullPath($Child)
    if (-not $childFull.StartsWith($parentFull, [StringComparison]::OrdinalIgnoreCase)) {
        throw "대상 경로가 허용된 작업 폴더를 벗어났습니다: $childFull"
    }
}

function Get-ImageDimensions {
    param([Parameter(Mandatory)][string]$Path)

    $image = [System.Drawing.Image]::FromFile($Path)
    try {
        return [PSCustomObject]@{
            Width = $image.Width
            Height = $image.Height
        }
    }
    finally {
        $image.Dispose()
    }
}

function Save-DownscaledJpeg {
    param(
        [Parameter(Mandatory)]
        [string]$InputPath,
        [Parameter(Mandatory)]
        [string]$OutputPath,
        [Parameter(Mandatory)]
        [int]$Width,
        [Parameter(Mandatory)]
        [int]$Height,
        [Parameter(Mandatory)]
        [int]$Quality
    )

    $source = [System.Drawing.Bitmap]::FromFile($InputPath)
    try {
        $output = New-Object System.Drawing.Bitmap $Width, $Height, ([System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
        try {
            $output.SetResolution($source.HorizontalResolution, $source.VerticalResolution)
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

            $codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
                Where-Object { $_.MimeType -eq 'image/jpeg' }
            $encoderParameters = New-Object System.Drawing.Imaging.EncoderParameters 1
            try {
                $encoderParameters.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter(
                    [System.Drawing.Imaging.Encoder]::Quality,
                    [long]$Quality
                )
                $output.Save($OutputPath, $codec, $encoderParameters)
            }
            finally {
                $encoderParameters.Dispose()
            }
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
    throw "Real-ESRGAN 실행 파일을 찾을 수 없습니다: $engine"
}

$roundDirectories = Get-ChildItem -LiteralPath $sourceRoot -Directory |
    Where-Object { $_.Name -match $roundPattern } |
    Sort-Object Name

if ($Round) {
    if ($Round -notmatch $roundPattern) {
        throw "지원하지 않는 복원 회차입니다: $Round"
    }
    $roundDirectories = @($roundDirectories | Where-Object Name -eq $Round)
    if (-not $roundDirectories.Count) {
        throw "회차 폴더를 찾을 수 없습니다: $Round"
    }
}

New-Item -ItemType Directory -Force -Path $stageRoot, $tempRoot | Out-Null

$batchMutex = New-Object System.Threading.Mutex($false, 'Local\CBT-HVAC-Restored-Upscale')
if (-not $batchMutex.WaitOne(0)) {
    $batchMutex.Dispose()
    throw '다른 공조냉동 복원문제 업스케일링 작업이 이미 실행 중입니다.'
}

try {
foreach ($roundDirectory in $roundDirectories) {
    $roundName = $roundDirectory.Name
    $sourceFiles = @(Get-ChildItem -LiteralPath $roundDirectory.FullName -File |
        Where-Object Extension -in '.jpg', '.jpeg', '.png' |
        Sort-Object { [int]$_.BaseName })
    if (-not $sourceFiles.Count) {
        Write-Warning "$roundName 회차에 이미지가 없습니다."
        continue
    }

    $stageRound = Join-Path $stageRoot $roundName
    $tempRound = Join-Path $tempRoot $roundName
    Assert-ChildPath -Parent $stageRoot -Child $stageRound
    Assert-ChildPath -Parent $tempRoot -Child $tempRound
    New-Item -ItemType Directory -Force -Path $stageRound | Out-Null

    $stageComplete = $true
    foreach ($sourceFile in $sourceFiles) {
        $stageFile = Join-Path $stageRound $sourceFile.Name
        if (-not (Test-Path -LiteralPath $stageFile)) {
            $stageComplete = $false
            break
        }
        $sourceSize = Get-ImageDimensions -Path $sourceFile.FullName
        $stageSize = Get-ImageDimensions -Path $stageFile
        if ($stageSize.Width -ne ($sourceSize.Width * 2) -or $stageSize.Height -ne ($sourceSize.Height * 2)) {
            $stageComplete = $false
            break
        }
    }

    if ($stageComplete) {
        Write-Output "SKIP $roundName - $($sourceFiles.Count) staged images already passed validation."
        continue
    }

    New-Item -ItemType Directory -Force -Path $tempRound | Out-Null

    Write-Output "MODEL $roundName - $($sourceFiles.Count)개를 한 장씩 4배 복원 시작"
    $processedIndex = 0
    $manifest = foreach ($sourceFile in $sourceFiles) {
        $processedIndex += 1
        $fourTimesFile = Join-Path $tempRound "$($sourceFile.BaseName).png"
        $sourceSize = Get-ImageDimensions -Path $sourceFile.FullName
        $stageFile = Join-Path $stageRound $sourceFile.Name

        if (Test-Path -LiteralPath $stageFile) {
            $existingStageSize = Get-ImageDimensions -Path $stageFile
            if ($existingStageSize.Width -eq ($sourceSize.Width * 2) -and $existingStageSize.Height -eq ($sourceSize.Height * 2)) {
                Write-Host "KEEP $roundName [$processedIndex/$($sourceFiles.Count)] $($sourceFile.Name)"
                [PSCustomObject]@{
                    Round = $roundName
                    File = $sourceFile.Name
                    SourceWidth = $sourceSize.Width
                    SourceHeight = $sourceSize.Height
                    OutputWidth = $existingStageSize.Width
                    OutputHeight = $existingStageSize.Height
                    SourceBytes = $sourceFile.Length
                    OutputBytes = (Get-Item -LiteralPath $stageFile).Length
                    Model = 'realesrgan-x4plus-anime'
                    Pipeline = '4x-model-to-2x-bicubic'
                    JpegQuality = $JpegQuality
                }
                continue
            }
        }

        $validFourTimesFile = $false
        if (Test-Path -LiteralPath $fourTimesFile) {
            $fourTimesSize = Get-ImageDimensions -Path $fourTimesFile
            $validFourTimesFile = (
                $fourTimesSize.Width -eq ($sourceSize.Width * 4) -and
                $fourTimesSize.Height -eq ($sourceSize.Height * 4)
            )
        }

        if (-not $validFourTimesFile) {
            Write-Host "UPSCALE $roundName [$processedIndex/$($sourceFiles.Count)] $($sourceFile.Name)"
            Push-Location $engineRoot
            try {
                $previousErrorActionPreference = $ErrorActionPreference
                $ErrorActionPreference = 'Continue'
                try {
                    $modelOutput = @(& $engine `
                        -i $sourceFile.FullName `
                        -o $fourTimesFile `
                        -n 'realesrgan-x4plus-anime' `
                        -s 4 `
                        -t $TileSize `
                        -f png 2>&1)
                    $modelExitCode = $LASTEXITCODE
                }
                finally {
                    $ErrorActionPreference = $previousErrorActionPreference
                }
                if ($modelExitCode -ne 0 -and $TileSize -gt 32) {
                    Write-Warning "$($sourceFile.Name) 타일 $TileSize 처리 실패, 32px로 다시 시도합니다."
                    $previousErrorActionPreference = $ErrorActionPreference
                    $ErrorActionPreference = 'Continue'
                    try {
                        $modelOutput = @(& $engine `
                            -i $sourceFile.FullName `
                            -o $fourTimesFile `
                            -n 'realesrgan-x4plus-anime' `
                            -s 4 `
                            -t 32 `
                            -f png 2>&1)
                        $modelExitCode = $LASTEXITCODE
                    }
                    finally {
                        $ErrorActionPreference = $previousErrorActionPreference
                    }
                }
                if ($modelExitCode -ne 0) {
                    $modelTail = ($modelOutput | Select-Object -Last 8) -join [Environment]::NewLine
                    throw "Real-ESRGAN 처리 실패: $roundName/$($sourceFile.Name) / 종료 코드 $modelExitCode`n$modelTail"
                }
            }
            finally {
                Pop-Location
            }
        }

        if (-not (Test-Path -LiteralPath $fourTimesFile)) {
            throw "4배 결과가 누락됐습니다: $fourTimesFile"
        }
        $fourTimesSize = Get-ImageDimensions -Path $fourTimesFile
        if ($fourTimesSize.Width -ne ($sourceSize.Width * 4) -or $fourTimesSize.Height -ne ($sourceSize.Height * 4)) {
            throw "4배 크기 검증 실패: $roundName/$($sourceFile.Name)"
        }

        Save-DownscaledJpeg `
            -InputPath $fourTimesFile `
            -OutputPath $stageFile `
            -Width ($sourceSize.Width * 2) `
            -Height ($sourceSize.Height * 2) `
            -Quality $JpegQuality

        $stageSize = Get-ImageDimensions -Path $stageFile
        if ($stageSize.Width -ne ($sourceSize.Width * 2) -or $stageSize.Height -ne ($sourceSize.Height * 2)) {
            throw "2배 크기 검증 실패: $roundName/$($sourceFile.Name)"
        }

        Remove-Item -LiteralPath $fourTimesFile -Force

        [PSCustomObject]@{
            Round = $roundName
            File = $sourceFile.Name
            SourceWidth = $sourceSize.Width
            SourceHeight = $sourceSize.Height
            OutputWidth = $stageSize.Width
            OutputHeight = $stageSize.Height
            SourceBytes = $sourceFile.Length
            OutputBytes = (Get-Item -LiteralPath $stageFile).Length
            Model = 'realesrgan-x4plus-anime'
            Pipeline = '4x-model-to-2x-bicubic'
            JpegQuality = $JpegQuality
        }
    }

    $manifestPath = Join-Path $stageRound '_manifest.csv'
    $manifest | Export-Csv -LiteralPath $manifestPath -NoTypeInformation -Encoding UTF8

    $resolvedTemp = (Resolve-Path -LiteralPath $tempRound).Path
    Assert-ChildPath -Parent $tempRoot -Child $resolvedTemp
    Remove-Item -LiteralPath $resolvedTemp -Recurse -Force

    $sourceBytes = ($manifest | Measure-Object SourceBytes -Sum).Sum
    $outputBytes = ($manifest | Measure-Object OutputBytes -Sum).Sum
    Write-Output "DONE $roundName - $($manifest.Count)개 / 원본 $sourceBytes bytes / 결과 $outputBytes bytes"
}

Write-Output "COMPLETE - 스테이징 경로: $stageRoot"
}
finally {
    $batchMutex.ReleaseMutex()
    $batchMutex.Dispose()
}
