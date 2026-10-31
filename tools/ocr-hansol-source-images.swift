import Foundation
import Vision
import ImageIO
import CryptoKit

// Private comparison cache only; no recognized question text is published.
let args = Array(CommandLine.arguments.dropFirst())
guard args.count == 2 else { fputs("manifest.json output-directory\n", stderr); exit(2) }
let inputs = try JSONSerialization.jsonObject(with: Data(contentsOf: URL(fileURLWithPath: args[0]))) as! [[String: String]]
let output = URL(fileURLWithPath: args[1])
try FileManager.default.createDirectory(at: output, withIntermediateDirectories: true)
for (index, row) in inputs.enumerated() {
  try autoreleasepool {
    let path = row["path"]!, id = row["id"]!
    let digest = SHA256.hash(data: try Data(contentsOf: URL(fileURLWithPath: path))).map { String(format: "%02x", $0) }.joined()
    let destination = output.appendingPathComponent(id.replacingOccurrences(of: ":", with: "--") + ".json")
    if let data = try? Data(contentsOf: destination),
       let old = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
       old["sha256"] as? String == digest, old["id"] as? String == id { return }
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.recognitionLanguages = ["ko-KR", "en-US"]
    request.usesLanguageCorrection = false
    try VNImageRequestHandler(url: URL(fileURLWithPath: path)).perform([request])
    let rows: [[String: Any]] = (request.results ?? []).compactMap { observation in
      guard let text = observation.topCandidates(1).first else { return nil }
      let b = observation.boundingBox
      return ["text": text.string, "box": [b.minX, 1-b.maxY, b.maxX, 1-b.minY], "score": text.confidence]
    }
    let result: [String: Any] = ["id": id, "path": path, "sha256": digest, "rows": rows, "purpose": "private-comparison-only"]
    try JSONSerialization.data(withJSONObject: result, options: [.sortedKeys]).write(to: destination, options: .atomic)
  }
  if index % 25 == 0 || index + 1 == inputs.count { print("Source OCR \(index+1)/\(inputs.count)"); fflush(stdout) }
}
