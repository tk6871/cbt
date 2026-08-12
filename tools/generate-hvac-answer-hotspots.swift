#!/usr/bin/env swift

import Foundation
import Vision

struct Detection: Codable {
    let text: String
    let x: Double
    let y: Double
    let width: Double
    let height: Double
}

struct Hotspot: Codable {
    let choice: Int
    let x: Double
    let y: Double
    let width: Double
    let height: Double
}

func rounded(_ value: Double) -> Double {
    (value * 100).rounded() / 100
}

func recognize(_ path: String) throws -> [Detection] {
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.recognitionLanguages = ["ko-KR", "en-US"]
    request.usesLanguageCorrection = false
    let url = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
        .appendingPathComponent(path)
        .standardizedFileURL
    try VNImageRequestHandler(url: url).perform([request])

    let symbols = ["①", "②", "③", "④", "⑤"]
    return (request.results ?? []).flatMap { observation -> [Detection] in
        guard let candidate = observation.topCandidates(1).first else { return [] }
        return symbols.flatMap { symbol -> [Detection] in
            var detections: [Detection] = []
            var searchRange = candidate.string.startIndex..<candidate.string.endIndex
            while let range = candidate.string.range(of: symbol, range: searchRange) {
                let characterObservation: VNRectangleObservation?
                do {
                    characterObservation = try candidate.boundingBox(for: range)
                } catch {
                    characterObservation = nil
                }
                let box = characterObservation?.boundingBox ?? observation.boundingBox
                detections.append(Detection(
                    text: symbol,
                    x: box.minX * 100,
                    y: (1 - box.maxY) * 100,
                    width: box.width * 100,
                    height: box.height * 100
                ))
                searchRange = range.upperBound..<candidate.string.endIndex
            }
            return detections
        }
    }
}

func makeHotspots(_ detections: [Detection]) -> [Hotspot] {
    let symbols = ["①", "②", "③", "④"]
    var markerDetections: [Detection] = []
    for detection in detections.filter({ symbols.contains($0.text) }).sorted(by: { $0.y > $1.y }) {
        if !markerDetections.contains(where: { abs($0.x - detection.x) < 7 && abs($0.y - detection.y) < 2.2 }) {
            markerDetections.append(detection)
        }
    }
    markerDetections = Array(markerDetections.prefix(4))

    // Restored sheets occasionally print a duplicated or wrong circled number.
    // The answers still follow the visual order: top-to-bottom in one column,
    // or 1·3 on the left and 2·4 on the right. Assign by position whenever four
    // markers are visible instead of trusting the printed glyph.
    var choices: [(choice: Int, detection: Detection)]
    if markerDetections.count == 4 {
        let markerMinX = markerDetections.map(\.x).min() ?? 0
        let markerMaxX = markerDetections.map(\.x).max() ?? 0
        if markerMaxX - markerMinX > 24 {
            let xBoundary = (markerMinX + markerMaxX) / 2
            let left = markerDetections.filter { $0.x < xBoundary }.sorted { $0.y < $1.y }
            let right = markerDetections.filter { $0.x >= xBoundary }.sorted { $0.y < $1.y }
            if left.count == 2, right.count == 2 {
                choices = [(1, left[0]), (2, right[0]), (3, left[1]), (4, right[1])]
            } else {
                choices = markerDetections.sorted { $0.y < $1.y }.enumerated().map { ($0 + 1, $1) }
            }
        } else {
            choices = markerDetections.sorted { $0.y < $1.y }.enumerated().map { ($0 + 1, $1) }
        }
    } else {
        choices = symbols.enumerated().compactMap { index, symbol in
            guard let detection = detections.filter({ $0.text == symbol }).max(by: { $0.y < $1.y }) else { return nil }
            return (index + 1, detection)
        }
    }

    if choices.count == 3 {
        let missingChoice = (1...4).first { choice in !choices.contains(where: { $0.choice == choice }) } ?? 0
        let minX = choices.map(\.detection.x).min() ?? 0
        let maxX = choices.map(\.detection.x).max() ?? 0
        let averageHeight = choices.map(\.detection.height).reduce(0, +) / Double(choices.count)
        if maxX - minX > 24 {
            let top = choices.filter { $0.choice <= 2 }.map { $0.detection.y + $0.detection.height / 2 }
            let bottom = choices.filter { $0.choice >= 3 }.map { $0.detection.y + $0.detection.height / 2 }
            if !top.isEmpty, !bottom.isEmpty {
                let centerY = missingChoice <= 2
                    ? top.reduce(0, +) / Double(top.count)
                    : bottom.reduce(0, +) / Double(bottom.count)
                let x = missingChoice == 1 || missingChoice == 3 ? minX : maxX
                choices.append((missingChoice, Detection(text: "순서 추정", x: x, y: centerY - averageHeight / 2, width: 1, height: averageHeight)))
            }
        } else {
            let points = choices.map { (x: Double($0.choice - 1), y: $0.detection.y + $0.detection.height / 2) }
            let meanX = points.map(\.x).reduce(0, +) / Double(points.count)
            let meanY = points.map(\.y).reduce(0, +) / Double(points.count)
            let numerator = points.reduce(0) { $0 + ($1.x - meanX) * ($1.y - meanY) }
            let denominator = points.reduce(0) { $0 + pow($1.x - meanX, 2) }
            let spacing = denominator > 0 ? numerator / denominator : 0
            if spacing >= 4, spacing <= 28 {
                let startCenter = meanY - spacing * meanX
                let centerY = startCenter + spacing * Double(missingChoice - 1)
                choices.append((missingChoice, Detection(text: "순서 추정", x: minX, y: centerY - averageHeight / 2, width: 1, height: averageHeight)))
            }
        }
    }
    guard choices.count == 4 else { return [] }

    // A fifth circled number below the detected ①~④ sequence usually means the
    // image contains labelled diagram points rather than four selectable answers.
    // In that case the regular answer buttons are safer than false image clicks.
    if let fourth = choices.first(where: { $0.choice == 4 }) {
        let markerColumns = choices.map(\.detection.x)
        let hasAlignedFifth = detections.filter({ $0.text == "⑤" }).contains { fifth in
            let belowFourth = fifth.y + fifth.height / 2 >= fourth.detection.y + fourth.detection.height / 2 - 1
            let alignedWithMarker = markerColumns.contains { abs($0 - fifth.x) < 7 }
            return belowFourth && alignedWithMarker
        }
        if hasAlignedFifth { return [] }
    }

    let minX = choices.map(\.detection.x).min() ?? 0
    let maxX = choices.map(\.detection.x).max() ?? 0
    let twoColumns = maxX - minX > 24
    // The right-hand answer begins at maxX. Using the midpoint between the two
    // circled numbers cuts long left-hand formulas in half. Keep the left cell
    // open until just before the right-hand choice marker instead.
    let columnBoundary = twoColumns ? maxX - 2.5 : 100
    let groups: [[(choice: Int, detection: Detection)]]
    if twoColumns {
        groups = [
            choices.filter { $0.choice == 1 || $0.choice == 3 },
            choices.filter { $0.choice == 2 || $0.choice == 4 },
        ]
        guard groups.allSatisfy({ $0.count == 2 }) else { return [] }
    } else {
        groups = [choices]
    }

    var result: [Hotspot] = []
    for (columnIndex, group) in groups.enumerated() {
        let sorted = group.sorted { $0.detection.y < $1.detection.y }
        let xStart = twoColumns ? (columnIndex == 0 ? max(0, minX - 2.5) : columnBoundary) : max(0, minX - 2.5)
        let xEnd = twoColumns ? (columnIndex == 0 ? columnBoundary : 98.5) : 98.5
        let markerGaps = zip(sorted, sorted.dropFirst()).map { current, next in
            next.detection.y - current.detection.y
        }
        let averageMarkerGap = markerGaps.isEmpty
            ? (sorted.first?.detection.height ?? 5) + 3
            : markerGaps.reduce(0, +) / Double(markerGaps.count)
        for (index, item) in sorted.enumerated() {
            // Each choice begins at its circled number. Using the midpoint
            // between two markers can cut the final line of a long answer in
            // half, so end the previous cell immediately before the next
            // marker instead.
            let top = max(0, item.detection.y - 1.5)
            let bottom = index == sorted.count - 1
                ? min(98.5, top + averageMarkerGap)
                : max(top + item.detection.height, sorted[index + 1].detection.y - 1.5)
            result.append(Hotspot(
                choice: item.choice,
                x: rounded(xStart),
                y: rounded(top),
                width: rounded(xEnd - xStart),
                height: rounded(bottom - top)
            ))
        }
    }
    return result.sorted { $0.choice < $1.choice }
}

func imagePaths(in root: String) -> [String] {
    guard let enumerator = FileManager.default.enumerator(atPath: root) else { return [] }
    return enumerator.compactMap { entry -> String? in
        guard let name = entry as? String,
              ["jpg", "jpeg", "png"].contains((name as NSString).pathExtension.lowercased()) else { return nil }
        return "\(root)/\(name)"
    }.sorted()
}

func generate(root: String, output: String) throws {
    let paths = imagePaths(in: root)
    let lock = NSLock()
    var completed = 0
    var result: [String: [Hotspot]] = [:]
    DispatchQueue.concurrentPerform(iterations: paths.count) { index in
        let path = paths[index]
        let hotspots = (try? recognize(path)).map(makeHotspots) ?? []
        lock.lock()
        if hotspots.count == 4 { result[path] = hotspots }
        completed += 1
        if completed % 25 == 0 || completed == paths.count {
            fputs("진행: \(completed)/\(paths.count), 직접 선택 가능: \(result.count)\n", stderr)
        }
        lock.unlock()
    }

    let encoder = JSONEncoder()
    encoder.outputFormatting = [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes]
    let json = String(decoding: try encoder.encode(result), as: UTF8.self)
    let source = "// Mac Vision OCR로 생성한 공조 복원문제 답안 좌표입니다.\n" +
        "// ①·②·③·④가 모두 확인된 이미지만 포함합니다.\n" +
        "export const hvacAnswerHotspots: Record<string, Array<{ choice: number; x: number; y: number; width: number; height: number }>> = \(json);\n"
    try source.write(toFile: output, atomically: true, encoding: .utf8)
    fputs("완료: \(paths.count)장 중 \(result.count)장 (\(String(format: "%.1f", Double(result.count) / Double(max(paths.count, 1)) * 100))%)\n", stderr)
}

let arguments = Array(CommandLine.arguments.dropFirst())
if arguments.first == "--detect", arguments.count == 2 {
    let encoder = JSONEncoder()
    encoder.outputFormatting = [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes]
    FileHandle.standardOutput.write(try encoder.encode(recognize(arguments[1])))
    FileHandle.standardOutput.write(Data("\n".utf8))
    exit(0)
}
if arguments.first == "--generate", arguments.count == 3 {
    try generate(root: arguments[1], output: arguments[2])
    exit(0)
}

guard !arguments.isEmpty else {
    fputs("사용법:\n  generate-hvac-answer-hotspots.swift <이미지...>\n  generate-hvac-answer-hotspots.swift --detect <이미지>\n  generate-hvac-answer-hotspots.swift --generate <이미지 루트> <출력 TS>\n", stderr)
    exit(2)
}

let encoder = JSONEncoder()
encoder.outputFormatting = [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes]
var preview: [String: [Hotspot]] = [:]
for path in arguments {
    preview[path] = (try? recognize(path)).map(makeHotspots) ?? []
}
FileHandle.standardOutput.write(try encoder.encode(preview))
FileHandle.standardOutput.write(Data("\n".utf8))
