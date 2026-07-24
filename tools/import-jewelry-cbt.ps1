param(
    [switch]$Force
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$workDir = Join-Path $root 'work\jewelry-import'
$pagesDir = Join-Path $workDir 'pages'
$assetsDir = Join-Path $root 'assets\jewelry'
$manifestPath = Join-Path $workDir 'manifest.json'
$assetsPath = Join-Path $workDir 'assets.json'
$reportPath = Join-Path $workDir 'report.json'
$outputPath = Join-Path $root 'data\jewelry.js'
$parserPath = Join-Path $workDir '_embedded_parser.py'
$utf8 = New-Object System.Text.UTF8Encoding($false)
$headers = @{
    'User-Agent' = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36'
    'Referer' = 'https://www.comcbt.com/'
}

$categories = @(
    [ordered]@{
        key = 'gem-appraiser'
        name = '보석감정사(기능사)'
        shortName = '보석감정사'
        categoryUrl = 'https://www.comcbt.com/xe/gf'
        fallbackIds = @(9209, 9239, 9240, 9241, 9242, 9257, 9258, 9259, 9260, 9261, 9262, 9263, 9264, 9265, 9266, 9267, 9278, 9279, 9280, 9281, 9282, 9283, 9284, 9285, 9286, 9287, 9288, 9289, 9290, 9291)
    }
    [ordered]@{
        key = 'precious-industrial'
        name = '귀금속가공산업기사'
        shortName = '귀금속산업'
        categoryUrl = 'https://www.comcbt.com/xe/cav'
        fallbackIds = @(13523, 16091, 6416772)
    }
    [ordered]@{
        key = 'precious-craftsman'
        name = '귀금속가공기능사'
        shortName = '귀금속기능'
        categoryUrl = 'https://www.comcbt.com/xe/hq'
        fallbackIds = @(10950, 10951, 10952, 10961, 10962, 11014)
    }
    [ordered]@{
        key = 'gem-processing'
        name = '보석가공기능사'
        shortName = '보석가공'
        categoryUrl = 'https://www.comcbt.com/xe/cdz'
        fallbackIds = @()
    }
)

function Invoke-CbtRequest {
    param([Parameter(Mandatory = $true)][string]$Uri)

    $lastError = $null
    for ($attempt = 1; $attempt -le 3; $attempt++) {
        try {
            $response = Invoke-WebRequest -Uri $Uri -Headers $headers -UseBasicParsing -TimeoutSec 50
            if ($response.StatusCode -ne 200 -or $response.Content.Length -lt 500) {
                throw "unexpected response: status=$($response.StatusCode), length=$($response.Content.Length)"
            }
            return $response
        }
        catch {
            $lastError = $_
            Start-Sleep -Milliseconds (600 * $attempt)
        }
    }
    throw "failed to download $Uri : $lastError"
}

function ConvertTo-PlainText {
    param([string]$Html)
    $withoutTags = [regex]::Replace($Html, '<[^>]+>', ' ')
    return [System.Net.WebUtility]::HtmlDecode($withoutTags) -replace '\s+', ' '
}

function Resolve-WebUrl {
    param([string]$BaseUrl, [string]$Href)
    try { return ([Uri]::new([Uri]$BaseUrl, [System.Net.WebUtility]::HtmlDecode($Href))).AbsoluteUri }
    catch { return $null }
}

function Get-CompleteArticleUrls {
    param($Category)

    $urls = [System.Collections.Generic.HashSet[string]]::new()
    for ($page = 1; $page -le 4; $page++) {
        $midMatch = [regex]::Match($Category.categoryUrl, '/xe/([a-z]+)$', 'IgnoreCase')
        if ($page -eq 1) {
            $pageUrl = $Category.categoryUrl
        }
        elseif ($midMatch.Success) {
            $pageUrl = "https://www.comcbt.com/xe/index.php?mid=$($midMatch.Groups[1].Value)&page=$page"
        }
        else {
            $separator = if ($Category.categoryUrl.Contains('?')) { '&' } else { '?' }
            $pageUrl = "$($Category.categoryUrl)${separator}page=$page"
        }
        Write-Host "  목록 확인: $pageUrl"
        try {
            $html = (Invoke-CbtRequest -Uri $pageUrl).Content
        }
        catch {
            Write-Warning $_
            continue
        }

        foreach ($match in [regex]::Matches($html, '<a\b[^>]*href\s*=\s*["'']([^"'']+)["''][^>]*>([\s\S]*?)</a>', 'IgnoreCase')) {
            $label = (ConvertTo-PlainText -Html $match.Groups[2].Value).Trim()
            if ($label -notlike "*$($Category.name.Replace('(기능사)', ''))*" -or $label -notmatch '필기\s*기출문제') { continue }
            if ($label -match '복원중') { continue }
            $url = Resolve-WebUrl -BaseUrl $pageUrl -Href $match.Groups[1].Value
            if ($url -and $url -match '/xe/(?:webhaesul/|[a-z]+/)\d+') { [void]$urls.Add($url) }
        }
        Start-Sleep -Milliseconds 180
    }
    return @($urls)
}

function Get-WebHaesulArticleUrls {
    param($Category)

    $urls = [System.Collections.Generic.HashSet[string]]::new()
    $keyword = [Uri]::EscapeDataString($Category.name.Replace('(기능사)', ''))
    for ($page = 1; $page -le 6; $page++) {
        $pageUrl = "https://www.comcbt.com/xe/index.php?mid=webhaesul&search_target=title&search_keyword=$keyword&page=$page"
        Write-Host "  해설 검색: $pageUrl"
        try {
            $html = (Invoke-CbtRequest -Uri $pageUrl).Content
        }
        catch {
            Write-Warning $_
            continue
        }
        foreach ($match in [regex]::Matches($html, '<a\b[^>]*href\s*=\s*["'']([^"'']+)["''][^>]*>([\s\S]*?)</a>', 'IgnoreCase')) {
            $label = (ConvertTo-PlainText -Html $match.Groups[2].Value).Trim()
            if ($label -notlike "*$($Category.name.Replace('(기능사)', ''))*" -or $label -notmatch '필기\s*기출문제') { continue }
            if ($label -match '복원중') { continue }
            $url = Resolve-WebUrl -BaseUrl $pageUrl -Href $match.Groups[1].Value
            if ($url -and $url -match '/xe/webhaesul/\d+') { [void]$urls.Add($url) }
        }
        Start-Sleep -Milliseconds 180
    }
    return @($urls)
}

function Get-ExamIdsFromArticle {
    param([string]$ArticleUrl)

    $ids = [System.Collections.Generic.HashSet[long]]::new()
    try {
        $html = (Invoke-CbtRequest -Uri $ArticleUrl).Content
    }
    catch {
        Write-Warning $_
        return @()
    }
    foreach ($pattern in @('/cbt/exam/(\d+)/?', '/cbt/problem/(\d+)/', '\((\d{4,8})\)')) {
        foreach ($match in [regex]::Matches($html, $pattern, 'IgnoreCase')) {
            $value = [long]$match.Groups[1].Value
            if ($value -ge 1000) { [void]$ids.Add($value) }
        }
    }
    return @($ids)
}

New-Item -ItemType Directory -Path $pagesDir -Force | Out-Null
New-Item -ItemType Directory -Path $assetsDir -Force | Out-Null

$manifestItems = [System.Collections.Generic.List[object]]::new()
$seen = [System.Collections.Generic.HashSet[string]]::new()

foreach ($category in $categories) {
    Write-Output "[$($category.name)] 완성 회차 검색"
    $examIds = [System.Collections.Generic.HashSet[long]]::new()
    foreach ($id in $category.fallbackIds) { [void]$examIds.Add([long]$id) }
    $articleUrls = [System.Collections.Generic.HashSet[string]]::new()
    foreach ($url in Get-CompleteArticleUrls -Category $category) { [void]$articleUrls.Add($url) }
    foreach ($url in Get-WebHaesulArticleUrls -Category $category) { [void]$articleUrls.Add($url) }
    foreach ($articleUrl in $articleUrls) {
        Write-Output "  회차 문서 확인: $articleUrl"
        foreach ($id in Get-ExamIdsFromArticle -ArticleUrl $articleUrl) { [void]$examIds.Add([long]$id) }
        Start-Sleep -Milliseconds 180
    }

    foreach ($examId in @($examIds | Sort-Object)) {
        $identity = "$($category.key):$examId"
        if (-not $seen.Add($identity)) { continue }
        $examUrl = "https://www.comcbt.com/cbt/exam/$examId/"
        $target = Join-Path $pagesDir "$($category.key)__$examId.html"
        try {
            if ($Force -or -not (Test-Path -LiteralPath $target) -or (Get-Item -LiteralPath $target).Length -lt 10000) {
                Write-Output "  시험지 다운로드: $examId"
                $content = (Invoke-CbtRequest -Uri $examUrl).Content
                [System.IO.File]::WriteAllText($target, $content, $utf8)
                Start-Sleep -Milliseconds 180
            }
            $manifestItems.Add([ordered]@{
                key = $category.key
                name = $category.name
                shortName = $category.shortName
                examId = $examId
                url = $examUrl
                file = [System.IO.Path]::GetFileName($target)
                categoryUrl = $category.categoryUrl
            })
        }
        catch {
            Write-Warning "시험지 $examId 다운로드 실패: $_"
        }
    }
}

[System.IO.File]::WriteAllText(
    $manifestPath,
    ($manifestItems | ConvertTo-Json -Depth 6),
    $utf8
)

$python = @'
from __future__ import annotations

import html as html_std
import json
import re
import sys
from collections import defaultdict
from pathlib import Path
from urllib.parse import urljoin, urlsplit

from lxml import etree, html

root = Path(sys.argv[1])
work = root / "work" / "jewelry-import"
manifest_path = work / "manifest.json"
assets_path = work / "assets.json"
report_path = work / "report.json"
output_path = root / "data" / "jewelry.js"
pages = work / "pages"

fallback_subjects = {
    "gem-appraiser": ["보석학일반", "다이아몬드감정법", "보석감별법", "보석가공기법"],
    "precious-industrial": ["장신구디자인론", "보석재료 및 가공기법", "귀금속재료 및 가공기법", "귀금속가공실무"],
    "precious-craftsman": ["귀금속재료", "귀금속가공", "작업안전"],
    "gem-processing": ["보석재료", "보석가공", "보석가공장비 및 안전"],
}


def clean_text(value: str) -> str:
    value = value.replace("\xa0", " ").replace("\u200b", "").replace("\r", "")
    value = re.sub(r"[ \t]+", " ", value)
    value = re.sub(r" *\n *", "\n", value)
    value = re.sub(r"\n{3,}", "\n\n", value)
    return value.strip()


def node_text(node: etree._Element) -> str:
    return clean_text("\n".join(part for part in node.itertext()))


def safe_inline_html(node: etree._Element) -> str:
    parts: list[str] = []

    def walk(current: etree._Element) -> None:
        if current.text:
            parts.append(html_std.escape(current.text))
        for child in current:
            tag = child.tag.lower() if isinstance(child.tag, str) else ""
            if tag == "br":
                parts.append("<br>")
            elif tag in {"sup", "sub"}:
                parts.append(f"<{tag}>")
                walk(child)
                parts.append(f"</{tag}>")
            elif tag != "img":
                walk(child)
            if child.tail:
                parts.append(html_std.escape(child.tail))

    walk(node)
    return re.sub(r"(?:<br>\s*){3,}", "<br><br>", "".join(parts)).strip()


def image_urls(node: etree._Element) -> list[str]:
    urls: list[str] = []
    for image in node.xpath(".//img[@src]"):
        url = urljoin("https://www.comcbt.com", (image.get("src") or "").strip())
        path = urlsplit(url).path.lower()
        if not url or not re.search(r"\.(?:gif|png|jpe?g|webp)$", path):
            continue
        if any(part in path for part in ("/icons/", "/layouts/", "/common/")):
            continue
        if url not in urls:
            urls.append(url)
    return urls


def local_image(key: str, exam_id: int, url: str) -> str:
    name = Path(urlsplit(url).path).name or "image"
    safe_name = re.sub(r"[^A-Za-z0-9._-]", "_", name)
    return f"assets/jewelry/{key}/{exam_id}/{safe_name}"


def explanation_values(outer: etree._Element) -> tuple[str, str]:
    candidates = []
    for node in outer.xpath('.//font[@color="blue"]'):
        text = node_text(node)
        if "문제 해설" in text or "해설" in text:
            candidates.append(node)
    if not candidates:
        return "", ""
    node = candidates[-1]
    text = re.sub(r"^<?\s*문제\s*해설\s*>?\s*", "", node_text(node)).strip()
    markup = re.sub(
        r"^(?:&lt;|<)?\s*문제\s*해설\s*(?:&gt;|>)?\s*(?:<br>)?",
        "",
        safe_inline_html(node),
        flags=re.I,
    ).strip()
    return text, markup


def parse_question(grid: etree._Element, item: dict, expected: int) -> tuple[dict, list[dict]]:
    exam_id = int(item["examId"])
    outer_cells = grid.xpath("./table[1]//tr[1]/td[1]")
    if not outer_cells:
        raise ValueError(f"question {expected}: outer cell missing")
    outer = outer_cells[0]
    tables = outer.xpath("./table")
    if len(tables) < 5:
        raise ValueError(f"question {expected}: expected prompt and four choices, found {len(tables)}")

    prompt_cells = tables[0].xpath(".//tr[1]/td")
    if len(prompt_cells) < 2:
        raise ValueError(f"question {expected}: prompt cells missing")
    number_match = re.search(r"\d+", node_text(prompt_cells[0]))
    number = int(number_match.group(0)) if number_match else -1
    if number != expected:
        raise ValueError(f"question order mismatch: expected {expected}, found {number}")

    prompt = prompt_cells[1]
    prompt_urls = image_urls(prompt)
    choices = []
    asset_records = []
    for choice_number, table in enumerate(tables[1:5], start=1):
        cells = table.xpath(".//tr[1]/td")
        if len(cells) < 2:
            raise ValueError(f"question {expected}: choice {choice_number} missing")
        marker = re.search(r"[1-4]", node_text(cells[0]))
        if not marker or int(marker.group(0)) != choice_number:
            raise ValueError(f"question {expected}: choice order mismatch")
        urls = image_urls(cells[1])
        choices.append({
            "text": node_text(cells[1]),
            "html": safe_inline_html(cells[1]),
            "images": [local_image(item["key"], exam_id, url) for url in urls],
        })
        asset_records.extend(
            {"url": url, "local": local_image(item["key"], exam_id, url)}
            for url in urls
        )

    answer_nodes = outer.xpath(f'.//div[@id="jungdabcolor{expected}"]')
    if not answer_nodes:
        answer_nodes = outer.xpath('.//div[starts-with(@id,"jungdabcolor")]')
    if not answer_nodes:
        raise ValueError(f"question {expected}: answer missing")
    answer_match = re.search(r"[1-4]", node_text(answer_nodes[0]))
    if not answer_match:
        raise ValueError(f"question {expected}: invalid answer")

    rate = None
    for green in outer.xpath('.//font[@color="green"]'):
        match = re.search(r"정답률\s*:\s*(\d+)%", node_text(green))
        if match:
            rate = int(match.group(1))
            break

    explanation, explanation_markup = explanation_values(outer)
    asset_records.extend(
        {"url": url, "local": local_image(item["key"], exam_id, url)}
        for url in prompt_urls
    )
    return {
        "number": number,
        "text": node_text(prompt),
        "html": safe_inline_html(prompt),
        "images": [local_image(item["key"], exam_id, url) for url in prompt_urls],
        "choices": choices,
        "answer": int(answer_match.group(0)),
        "answerRate": rate,
        "hint": "",
        "explanation": explanation,
        "explanationHtml": explanation_markup,
        "source": f"https://www.comcbt.com/cbt/problem/{exam_id}/{number}/",
    }, asset_records


def parse_round(item: dict) -> tuple[dict, list[dict]]:
    exam_id = int(item["examId"])
    page = pages / item["file"]
    document = html.fromstring(page.read_bytes())
    title = clean_text(document.xpath("string(//title)"))
    if item["name"].replace("(기능사)", "") not in title:
        raise ValueError(f"qualification title mismatch: {title}")
    if "복원중" in title:
        raise ValueError("restoration-in-progress round")

    date_match = re.search(r"(20\d{2})년\s*(\d{2})월\s*(\d{2})일", title)
    if not date_match:
        raise ValueError(f"date missing in title: {title}")
    date = "".join(date_match.groups())
    session_match = re.search(r"\((\d+)회\)", title)
    session = f"{session_match.group(1)}회" if session_match else ""

    subjects = []
    for bold in document.xpath("//p[@align='center']//b"):
        match = re.match(r"(\d+)과목\s*:\s*(.+)", node_text(bold))
        if match:
            subjects.append(clean_text(match.group(2)))
    subjects = list(dict.fromkeys(subjects))

    grids = document.xpath(
        '//div[contains(concat(" ", normalize-space(@class), " "), " grid-box ")]'
    )
    if len(grids) not in {60, 80, 100}:
        raise ValueError(f"incomplete or unexpected question count: {len(grids)}")
    questions = []
    assets = []
    for expected, grid in enumerate(grids, start=1):
        question, records = parse_question(grid, item, expected)
        questions.append(question)
        assets.extend(records)

    if not subjects:
        subjects = fallback_subjects[item["key"]].copy()
    if len(subjects) > len(questions):
        raise ValueError(f"invalid subjects: {subjects}")

    clean_title = re.sub(r"\s*-\s*최강.*$", "", title)
    return {
        "id": f"jewelry-{item['key']}-{date}-{exam_id}",
        "examId": exam_id,
        "qualificationKey": item["key"],
        "qualification": item["name"],
        "shortQualification": item["shortName"],
        "kind": "jewelry-related",
        "date": date,
        "sortKey": date,
        "year": int(date[:4]),
        "session": session,
        "title": clean_title,
        "subjects": subjects,
        "questions": questions,
        "examMinutes": round(len(questions) * 1.5),
        "source": item["url"],
        "categorySource": item["categoryUrl"],
    }, assets


manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
if isinstance(manifest, dict):
    manifest = [manifest]

rounds_by_key = defaultdict(list)
category_meta = {}
assets = []
failures = []
for item in manifest:
    category_meta[item["key"]] = item
    try:
        parsed, records = parse_round(item)
        if any(round_item["id"] == parsed["id"] for round_item in rounds_by_key[item["key"]]):
            continue
        rounds_by_key[item["key"]].append(parsed)
        assets.extend(records)
    except Exception as exc:
        failures.append({
            "key": item["key"],
            "examId": item["examId"],
            "reason": str(exc),
        })

datasets = []
for key in ("gem-appraiser", "precious-industrial", "precious-craftsman", "gem-processing"):
    meta = category_meta.get(key)
    if not meta:
        continue
    rounds = sorted(rounds_by_key[key], key=lambda value: value["sortKey"], reverse=True)
    datasets.append({
        "key": key,
        "name": meta["name"],
        "shortName": meta["shortName"],
        "space": "jewelry",
        "source": meta["categoryUrl"],
        "rounds": rounds,
    })

unique_assets = {record["local"]: record for record in assets}
payload = "window.CBT_DATA_JEWELRY=" + json.dumps(
    datasets, ensure_ascii=False, separators=(",", ":")
) + ";\n"
output_path.write_text(payload, encoding="utf-8")
assets_path.write_text(
    json.dumps(list(unique_assets.values()), ensure_ascii=False, indent=2),
    encoding="utf-8",
)
report = {
    "datasets": len(datasets),
    "rounds": sum(len(item["rounds"]) for item in datasets),
    "questions": sum(len(round_item["questions"]) for item in datasets for round_item in item["rounds"]),
    "images": len(unique_assets),
    "byQualification": {
        item["name"]: {
            "rounds": len(item["rounds"]),
            "questions": sum(len(round_item["questions"]) for round_item in item["rounds"]),
        }
        for item in datasets
    },
    "failures": failures,
}
report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps(report, ensure_ascii=False))
'@

[System.IO.File]::WriteAllText($parserPath, $python, $utf8)
try {
    $bundledPython = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
    $pythonPath = if (Test-Path -LiteralPath $bundledPython) { $bundledPython } else { $null }
    if (-not $pythonPath) {
        $bundledPython = Get-ChildItem -Path (Join-Path $env:USERPROFILE '.cache\codex-runtimes') -Recurse -Filter python.exe -ErrorAction SilentlyContinue |
            Where-Object { $_.FullName -match '\\dependencies\\python\\python\.exe$' } |
            Select-Object -First 1 -ExpandProperty FullName
        if ($bundledPython) { $pythonPath = $bundledPython }
    }
    if (-not $pythonPath) {
        $pythonCommand = Get-Command python -ErrorAction SilentlyContinue
        if ($null -ne $pythonCommand -and $pythonCommand.Source -notmatch '\\WindowsApps\\') {
            $pythonPath = $pythonCommand.Source
        }
    }
    if (-not $pythonPath) {
        throw 'Python을 찾지 못했습니다. 기존 CBT 제작 환경의 Python 설치를 확인해 주세요.'
    }
    Write-Output '문항·정답·해설·그림 참조 추출'
    & $pythonPath $parserPath $root
    if ($LASTEXITCODE -ne 0) { throw "parser failed with exit code $LASTEXITCODE" }

    $assetRecords = Get-Content -LiteralPath $assetsPath -Raw -Encoding UTF8 | ConvertFrom-Json
    $assetIndex = 0
    foreach ($asset in $assetRecords) {
        $assetIndex++
        $target = Join-Path $root ($asset.local -replace '/', '\')
        $targetDir = Split-Path -Parent $target
        New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
        if ((-not $Force) -and (Test-Path -LiteralPath $target) -and (Get-Item -LiteralPath $target).Length -gt 50) {
            continue
        }
        Write-Output ("  그림 [{0}/{1}] {2}" -f $assetIndex, $assetRecords.Count, $asset.local)
        $lastError = $null
        for ($attempt = 1; $attempt -le 3; $attempt++) {
            try {
                Invoke-WebRequest -Uri $asset.url -Headers $headers -UseBasicParsing -TimeoutSec 50 -OutFile $target
                if ((Get-Item -LiteralPath $target).Length -lt 50) { throw 'downloaded image is empty' }
                $lastError = $null
                break
            }
            catch {
                $lastError = $_
                Start-Sleep -Milliseconds (600 * $attempt)
            }
        }
        if ($null -ne $lastError) { throw "그림 다운로드 실패 $($asset.url): $lastError" }
        Start-Sleep -Milliseconds 120
    }
}
finally {
    if (Test-Path -LiteralPath $parserPath) { Remove-Item -LiteralPath $parserPath -Force }
}

$report = Get-Content -LiteralPath $reportPath -Raw -Encoding UTF8 | ConvertFrom-Json
Write-Output ''
Write-Output '보석·귀금속 CBT 수집 완료'
Write-Output ("  자격 분류: {0}" -f $report.datasets)
Write-Output ("  정상 회차: {0}" -f $report.rounds)
Write-Output ("  전체 문항: {0}" -f $report.questions)
Write-Output ("  문제 그림: {0}" -f $report.images)
Write-Output ("  제외/실패: {0}" -f $report.failures.Count)
Write-Output ("  데이터: {0}" -f $outputPath)
Write-Output ("  검증 보고서: {0}" -f $reportPath)
