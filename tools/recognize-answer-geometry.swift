import Foundation
import Vision
import ImageIO

// Geometry only. Recognized text is not published as question/answer content.
let input = URL(fileURLWithPath: CommandLine.arguments[1])
let output = URL(fileURLWithPath: CommandLine.arguments[2])
let paths = try JSONSerialization.jsonObject(with: Data(contentsOf: input)) as! [String]
try FileManager.default.createDirectory(at: output, withIntermediateDirectories: true)
for (index, path) in paths.enumerated() {
  let destination = output.appendingPathComponent(URL(fileURLWithPath: path).deletingPathExtension().lastPathComponent + ".json")
  if FileManager.default.fileExists(atPath: destination.path) { continue }
  try autoreleasepool {
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.recognitionLanguages = ["ko-KR", "en-US"]
    request.usesLanguageCorrection = false
    try VNImageRequestHandler(url: URL(fileURLWithPath: path)).perform([request])
    var rows: [[String:Any]] = []
    var markers: [[String:Any]] = []
    func rect(_ b: CGRect) -> [Double] { [b.minX, 1-b.maxY, b.maxX, 1-b.minY] }
    for observation in request.results ?? [] {
      guard let text = observation.topCandidates(1).first else { continue }
      rows.append(["text": text.string, "box": rect(observation.boundingBox), "score":text.confidence])
      for symbol in ["①", "②", "③", "④"] {
        var search = text.string.startIndex..<text.string.endIndex
        while let range = text.string.range(of:symbol,range:search) {
          if let box = try? text.boundingBox(for:range) {
            markers.append(["choice": ["①","②","③","④"].firstIndex(of:symbol)!+1,"box":rect(box.boundingBox),"score":text.confidence])
          }
          search = range.upperBound..<text.string.endIndex
        }
      }
    }
    let data = try JSONSerialization.data(withJSONObject:["path":path,"rows":rows,"markers":markers],options:[.prettyPrinted,.sortedKeys])
    try data.write(to:destination,options:.atomic)
    print("geometry \(index+1)/\(paths.count): \(destination.lastPathComponent)")
    fflush(stdout)
  }
}
