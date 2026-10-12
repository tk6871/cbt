import Foundation
import PDFKit
import Vision
import CoreGraphics
import CryptoKit

// Local search index only. Never use OCR text to replace published questions.
let args = Array(CommandLine.arguments.dropFirst())
guard args.count >= 4, let first = Int(args[2]), let last = Int(args[3]), first >= 1, last >= first,
      let pdf = PDFDocument(url: URL(fileURLWithPath: args[0])) else {
    fputs("Usage: ocr-energy-book-pages PDF OUTPUT FIRST LAST\n", stderr); exit(2)
}
let output = URL(fileURLWithPath: args[1])
try FileManager.default.createDirectory(at: output, withIntermediateDirectories: true)
// A resumed run must never silently reuse pages from another PDF.
let sourceHandle = try FileHandle(forReadingFrom: URL(fileURLWithPath: args[0]))
var sourceHasher = SHA256()
while let chunk = try sourceHandle.read(upToCount: 16 * 1024 * 1024), !chunk.isEmpty { sourceHasher.update(data: chunk) }
try sourceHandle.close()
let sourceHash = sourceHasher.finalize().map { String(format: "%02x", $0) }.joined()
let manifestURL = output.appendingPathComponent("_source.json")
if FileManager.default.fileExists(atPath: manifestURL.path) {
    let previous = try JSONSerialization.jsonObject(with: Data(contentsOf: manifestURL)) as? [String: Any]
    guard previous?["sha256"] as? String == sourceHash, previous?["pages"] as? Int == pdf.pageCount else {
        fputs("Source PDF changed. Use a separate empty output directory.\n", stderr); exit(3)
    }
} else {
    guard !(try FileManager.default.contentsOfDirectory(atPath: output.path)).contains(where: { $0.hasPrefix("page-") }) else {
        fputs("Existing OCR cache lacks source proof. Use a separate empty output directory.\n", stderr); exit(3)
    }
    let manifest = try JSONSerialization.data(withJSONObject: ["sha256": sourceHash, "pages": pdf.pageCount], options: [.sortedKeys])
    try manifest.write(to: manifestURL, options: .atomic)
}
for number in first...min(last, pdf.pageCount) {
    let destination = output.appendingPathComponent("page-\(number).json")
    if FileManager.default.fileExists(atPath: destination.path) { continue }
    try autoreleasepool {
        guard let page = pdf.page(at: number - 1) else { throw NSError(domain: "PDF page", code: number) }
        let bounds = page.bounds(for: .mediaBox)
        let scale = 2200 / max(bounds.width, bounds.height)
        let width = Int(ceil(bounds.width * scale)), height = Int(ceil(bounds.height * scale))
        guard let context = CGContext(data: nil, width: width, height: height, bitsPerComponent: 8,
            bytesPerRow: width * 4, space: CGColorSpaceCreateDeviceRGB(),
            bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue) else { throw NSError(domain: "PDF context", code: number) }
        context.setFillColor(CGColor(gray: 1, alpha: 1)); context.fill(CGRect(x: 0, y: 0, width: width, height: height))
        context.scaleBy(x: scale, y: scale)
        context.translateBy(x: -bounds.minX, y: -bounds.minY)
        page.draw(with: .mediaBox, to: context)
        guard let image = context.makeImage() else { throw NSError(domain: "PDF image", code: number) }
        let request = VNRecognizeTextRequest()
        request.recognitionLevel = .accurate
        request.recognitionLanguages = ["ko-KR", "en-US"]
        request.usesLanguageCorrection = false
        try VNImageRequestHandler(cgImage: image).perform([request])
        let rows: [[String: Any]] = (request.results ?? []).compactMap { observation in
            guard let candidate = observation.topCandidates(1).first else { return nil }
            let b = observation.boundingBox
            return ["text": candidate.string, "box": [b.minX, b.minY, b.width, b.height], "score": candidate.confidence]
        }
        let data = try JSONSerialization.data(withJSONObject: ["page": number, "size": [width, height], "rows": rows], options: [.sortedKeys])
        try data.write(to: destination, options: .atomic)
        print("OCR \(number)/\(pdf.pageCount): \(rows.count) rows"); fflush(stdout)
    }
}
