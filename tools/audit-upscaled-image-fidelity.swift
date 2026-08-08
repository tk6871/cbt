#!/usr/bin/env swift

import CoreGraphics
import CoreText
import Foundation
import ImageIO

struct AuditReport: Decodable {
    let manualReview: [ReviewItem]
}

struct ReviewItem: Decodable {
    let location: String
    let images: [String]?
    let originals: [OriginalImage]?
}

struct OriginalImage: Decodable {
    let type: String
    let revision: String?
    let image: String
}

struct MetricRow: Encodable {
    let location: String
    let current: String
    let original: String
    let originalType: String
    let originalRevision: String?
    let originalWidth: Int
    let originalHeight: Int
    let currentWidth: Int
    let currentHeight: Int
    let scaleX: Double
    let scaleY: Double
    let aspectDelta: Double
    let colorMAE: Double
    let luminanceCorrelation: Double
    let edgeCorrelation: Double
    let suspicious: Bool
}

struct FidelityReport: Encodable {
    let generatedAt: String
    let sampleSize: Int
    let totalPairs: Int
    let exactTwoXDimensions: Int
    let suspiciousPairs: Int
    let rows: [MetricRow]
}

struct Raster {
    let width: Int
    let height: Int
    let bytes: [UInt8]
}

func argument(_ name: String) -> String? {
    guard let index = CommandLine.arguments.firstIndex(of: name),
          CommandLine.arguments.indices.contains(index + 1) else { return nil }
    return CommandLine.arguments[index + 1]
}

func loadImage(_ url: URL) throws -> CGImage {
    guard let source = CGImageSourceCreateWithURL(url as CFURL, nil),
          let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else {
        throw NSError(domain: "CBTImageAudit", code: 1, userInfo: [NSLocalizedDescriptionKey: "이미지를 열 수 없습니다: \(url.path)"])
    }
    return image
}

func rasterize(_ image: CGImage, size: Int) throws -> Raster {
    var bytes = [UInt8](repeating: 0, count: size * size * 4)
    let colorSpace = CGColorSpaceCreateDeviceRGB()
    let bitmapInfo = CGImageAlphaInfo.premultipliedLast.rawValue | CGBitmapInfo.byteOrder32Big.rawValue
    let created = bytes.withUnsafeMutableBytes { buffer -> Bool in
        guard let base = buffer.baseAddress,
              let context = CGContext(
                data: base,
                width: size,
                height: size,
                bitsPerComponent: 8,
                bytesPerRow: size * 4,
                space: colorSpace,
                bitmapInfo: bitmapInfo
              ) else { return false }
        context.interpolationQuality = .high
        context.setFillColor(CGColor(gray: 1, alpha: 1))
        context.fill(CGRect(x: 0, y: 0, width: size, height: size))
        context.draw(image, in: CGRect(x: 0, y: 0, width: size, height: size))
        return true
    }
    guard created else {
        throw NSError(domain: "CBTImageAudit", code: 2, userInfo: [NSLocalizedDescriptionKey: "이미지 래스터 변환 실패"])
    }
    return Raster(width: size, height: size, bytes: bytes)
}

func correlation(_ left: [Double], _ right: [Double]) -> Double {
    guard left.count == right.count, !left.isEmpty else { return 0 }
    let leftMean = left.reduce(0, +) / Double(left.count)
    let rightMean = right.reduce(0, +) / Double(right.count)
    var numerator = 0.0
    var leftVariance = 0.0
    var rightVariance = 0.0
    for index in left.indices {
        let leftDelta = left[index] - leftMean
        let rightDelta = right[index] - rightMean
        numerator += leftDelta * rightDelta
        leftVariance += leftDelta * leftDelta
        rightVariance += rightDelta * rightDelta
    }
    let denominator = sqrt(leftVariance * rightVariance)
    return denominator > 0 ? numerator / denominator : 1
}

func luminance(_ raster: Raster) -> [Double] {
    stride(from: 0, to: raster.bytes.count, by: 4).map { index in
        let red = Double(raster.bytes[index]) / 255
        let green = Double(raster.bytes[index + 1]) / 255
        let blue = Double(raster.bytes[index + 2]) / 255
        return red * 0.2126 + green * 0.7152 + blue * 0.0722
    }
}

func edges(_ values: [Double], width: Int, height: Int) -> [Double] {
    var result = [Double](repeating: 0, count: values.count)
    guard width > 1, height > 1 else { return result }
    for y in 0..<(height - 1) {
        for x in 0..<(width - 1) {
            let index = y * width + x
            let horizontal = values[index + 1] - values[index]
            let vertical = values[index + width] - values[index]
            result[index] = sqrt(horizontal * horizontal + vertical * vertical)
        }
    }
    return result
}

func colorMAE(_ left: Raster, _ right: Raster) -> Double {
    var total = 0.0
    var count = 0
    for index in stride(from: 0, to: left.bytes.count, by: 4) {
        total += abs(Double(left.bytes[index]) - Double(right.bytes[index])) / 255
        total += abs(Double(left.bytes[index + 1]) - Double(right.bytes[index + 1])) / 255
        total += abs(Double(left.bytes[index + 2]) - Double(right.bytes[index + 2])) / 255
        count += 3
    }
    return count > 0 ? total / Double(count) : 0
}

func aspectFit(_ image: CGImage, in box: CGRect) -> CGRect {
    let scale = min(box.width / CGFloat(image.width), box.height / CGFloat(image.height))
    let width = CGFloat(image.width) * scale
    let height = CGFloat(image.height) * scale
    return CGRect(x: box.midX - width / 2, y: box.midY - height / 2, width: width, height: height)
}

func drawText(_ text: String, in context: CGContext, x: CGFloat, y: CGFloat, size: CGFloat, bold: Bool = false) {
    let fontName = bold ? "Helvetica-Bold" : "Helvetica"
    let attributes: [NSAttributedString.Key: Any] = [
        NSAttributedString.Key(kCTFontAttributeName as String): CTFontCreateWithName(fontName as CFString, size, nil),
        NSAttributedString.Key(kCTForegroundColorAttributeName as String): CGColor(gray: 0.12, alpha: 1),
    ]
    let line = CTLineCreateWithAttributedString(NSAttributedString(string: text, attributes: attributes))
    context.textPosition = CGPoint(x: x, y: y)
    CTLineDraw(line, context)
}

func writePNG(_ image: CGImage, to url: URL) throws {
    guard let destination = CGImageDestinationCreateWithURL(url as CFURL, "public.png" as CFString, 1, nil) else {
        throw NSError(domain: "CBTImageAudit", code: 4, userInfo: [NSLocalizedDescriptionKey: "PNG 출력 생성 실패"])
    }
    CGImageDestinationAddImage(destination, image, nil)
    guard CGImageDestinationFinalize(destination) else {
        throw NSError(domain: "CBTImageAudit", code: 5, userInfo: [NSLocalizedDescriptionKey: "PNG 저장 실패"])
    }
}

func createContactSheets(rows: [MetricRow], repo: URL, historyRoot: URL, outputDirectory: URL) throws {
    try FileManager.default.createDirectory(at: outputDirectory, withIntermediateDirectories: true)
    let pageWidth = 1600
    let pageHeight = 2000
    let pairsPerPage = 4
    let rowHeight = CGFloat(470)
    let imageHeight = CGFloat(390)
    let margin = CGFloat(36)
    let columnGap = CGFloat(24)
    let columnWidth = (CGFloat(pageWidth) - margin * 2 - columnGap) / 2
    let pageCount = Int(ceil(Double(rows.count) / Double(pairsPerPage)))
    for pageIndex in 0..<pageCount {
        let rangeStart = pageIndex * pairsPerPage
        let rangeEnd = min(rows.count, rangeStart + pairsPerPage)
        var bytes = [UInt8](repeating: 255, count: pageWidth * pageHeight * 4)
        let rendered = try bytes.withUnsafeMutableBytes { buffer -> CGImage in
            guard let base = buffer.baseAddress,
                  let context = CGContext(
                    data: base,
                    width: pageWidth,
                    height: pageHeight,
                    bitsPerComponent: 8,
                    bytesPerRow: pageWidth * 4,
                    space: CGColorSpaceCreateDeviceRGB(),
                    bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue | CGBitmapInfo.byteOrder32Big.rawValue
                  ) else {
                throw NSError(domain: "CBTImageAudit", code: 6, userInfo: [NSLocalizedDescriptionKey: "비교표 생성 실패"])
            }
            context.setFillColor(CGColor(gray: 1, alpha: 1))
            context.fill(CGRect(x: 0, y: 0, width: pageWidth, height: pageHeight))
            drawText("CBT 원본 / 업스케일 이상치 비교 \(pageIndex + 1)/\(pageCount)", in: context, x: margin, y: CGFloat(pageHeight - 40), size: 24, bold: true)
            for (offset, rowIndex) in (rangeStart..<rangeEnd).enumerated() {
                let row = rows[rowIndex]
                let top = CGFloat(pageHeight - 90) - CGFloat(offset) * rowHeight
                let currentURL = repo.appendingPathComponent(row.current)
                let originalURL = row.originalType == "git-history"
                    ? historyRoot.appendingPathComponent(row.original)
                    : repo.appendingPathComponent(row.original)
                let currentImage = try loadImage(currentURL)
                let originalImage = try loadImage(originalURL)
                drawText(row.location, in: context, x: margin, y: top, size: 19, bold: true)
                drawText("원본 \(row.originalWidth)×\(row.originalHeight)", in: context, x: margin, y: top - 25, size: 15)
                drawText("업스케일 \(row.currentWidth)×\(row.currentHeight) · 밝기 \(String(format: "%.3f", row.luminanceCorrelation)) · 윤곽 \(String(format: "%.3f", row.edgeCorrelation))", in: context, x: margin + columnWidth + columnGap, y: top - 25, size: 15)
                let originalBox = CGRect(x: margin, y: top - imageHeight - 55, width: columnWidth, height: imageHeight)
                let currentBox = CGRect(x: margin + columnWidth + columnGap, y: top - imageHeight - 55, width: columnWidth, height: imageHeight)
                context.setStrokeColor(CGColor(gray: 0.75, alpha: 1))
                context.stroke(originalBox)
                context.stroke(currentBox)
                context.interpolationQuality = .none
                context.draw(originalImage, in: aspectFit(originalImage, in: originalBox.insetBy(dx: 8, dy: 8)))
                context.interpolationQuality = .high
                context.draw(currentImage, in: aspectFit(currentImage, in: currentBox.insetBy(dx: 8, dy: 8)))
            }
            guard let output = context.makeImage() else {
                throw NSError(domain: "CBTImageAudit", code: 7, userInfo: [NSLocalizedDescriptionKey: "비교표 이미지 생성 실패"])
            }
            return output
        }
        try writePNG(rendered, to: outputDirectory.appendingPathComponent(String(format: "page-%02d.png", pageIndex + 1)))
    }
}

guard let repoPath = argument("--repo"),
      let inputPath = argument("--report"),
      let historyRootPath = argument("--history-root"),
      let outputPath = argument("--output") else {
    fputs("사용법: audit-upscaled-image-fidelity.swift --repo <저장소> --report <JSON> --history-root <Git 원본 폴더> --output <JSON>\n", stderr)
    exit(2)
}

let repo = URL(fileURLWithPath: repoPath, isDirectory: true)
let historyRoot = URL(fileURLWithPath: historyRootPath, isDirectory: true)
let input = try JSONDecoder().decode(AuditReport.self, from: Data(contentsOf: URL(fileURLWithPath: inputPath)))
let sampleSize = 64
var rows: [MetricRow] = []

for review in input.manualReview {
    let images = review.images ?? []
    let originals = review.originals ?? []
    guard images.count == originals.count else {
        throw NSError(domain: "CBTImageAudit", code: 3, userInfo: [NSLocalizedDescriptionKey: "이미지 쌍 수가 다릅니다: \(review.location)"])
    }
    for (currentPath, original) in zip(images, originals) {
        let currentURL = repo.appendingPathComponent(currentPath)
        let originalURL = original.type == "git-history"
            ? historyRoot.appendingPathComponent(original.image)
            : repo.appendingPathComponent(original.image)
        let currentImage = try loadImage(currentURL)
        let originalImage = try loadImage(originalURL)
        let currentRaster = try rasterize(currentImage, size: sampleSize)
        let originalRaster = try rasterize(originalImage, size: sampleSize)
        let currentLuminance = luminance(currentRaster)
        let originalLuminance = luminance(originalRaster)
        let currentEdges = edges(currentLuminance, width: sampleSize, height: sampleSize)
        let originalEdges = edges(originalLuminance, width: sampleSize, height: sampleSize)
        let scaleX = Double(currentImage.width) / Double(originalImage.width)
        let scaleY = Double(currentImage.height) / Double(originalImage.height)
        let currentAspect = Double(currentImage.width) / Double(currentImage.height)
        let originalAspect = Double(originalImage.width) / Double(originalImage.height)
        let aspectDelta = abs(log(currentAspect / originalAspect))
        let colorDifference = colorMAE(currentRaster, originalRaster)
        let luminanceMatch = correlation(currentLuminance, originalLuminance)
        let edgeMatch = correlation(currentEdges, originalEdges)
        let suspicious = aspectDelta > 0.001
            || abs(scaleX - scaleY) > 0.01
            || luminanceMatch < 0.90
            || edgeMatch < 0.72
            || colorDifference > 0.14
        rows.append(MetricRow(
            location: review.location,
            current: currentPath,
            original: original.image,
            originalType: original.type,
            originalRevision: original.revision,
            originalWidth: originalImage.width,
            originalHeight: originalImage.height,
            currentWidth: currentImage.width,
            currentHeight: currentImage.height,
            scaleX: scaleX,
            scaleY: scaleY,
            aspectDelta: aspectDelta,
            colorMAE: colorDifference,
            luminanceCorrelation: luminanceMatch,
            edgeCorrelation: edgeMatch,
            suspicious: suspicious
        ))
    }
}

let exactTwoX = rows.filter { abs($0.scaleX - 2) < 0.001 && abs($0.scaleY - 2) < 0.001 }.count
let suspiciousCount = rows.filter(\.suspicious).count
let formatter = ISO8601DateFormatter()
let report = FidelityReport(
    generatedAt: formatter.string(from: Date()),
    sampleSize: sampleSize,
    totalPairs: rows.count,
    exactTwoXDimensions: exactTwoX,
    suspiciousPairs: suspiciousCount,
    rows: rows
)
let encoder = JSONEncoder()
encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
try encoder.encode(report).write(to: URL(fileURLWithPath: outputPath), options: .atomic)
if let contactSheetPath = argument("--contact-sheet-dir") {
    try createContactSheets(
        rows: rows.filter(\.suspicious),
        repo: repo,
        historyRoot: historyRoot,
        outputDirectory: URL(fileURLWithPath: contactSheetPath, isDirectory: true)
    )
}
print("원본/업스케일 이미지 쌍 \(rows.count)개 검사 완료 · 정확한 2배 크기 \(exactTwoX)개 · 육안 확인 후보 \(suspiciousCount)개")
