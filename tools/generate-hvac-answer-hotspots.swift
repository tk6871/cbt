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

    return (request.results ?? []).compactMap { observation in
        guard let text = observation.topCandidates(1).first?.string else { return nil }
        let box = observation.boundingBox
        return Detection(
            text: text,
            x: box.minX * 100,
            y: (1 - box.maxY) * 100,
            width: box.width * 100,
            height: box.height * 100
        )
    }
}

func makeHotspots(_ detections: [Detection]) -> [Hotspot] {
    let symbols = ["①", "②", "③", "④"]
    var choices: [(choice: Int, detection: Detection)] = symbols.enumerated().compactMap { index, symbol in
        guard let detection = detections.filter({ $0.text.contains(symbol) }).max(by: { $0.y < $1.y }) else { return nil }
        return (index + 1, detection)
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

    let minX = choices.map(\.detection.x).min() ?? 0
    let maxX = choices.map(\.detection.x).max() ?? 0
    let twoColumns = maxX - minX > 24
    let columnBoundary = twoColumns ? (minX + maxX) / 2 + 4 : 100
    let groups: [[(choice: Int, detection: Detection)]]
    if twoColumns {
        groups = [
            choices.filter { $0.detection.x < columnBoundary },
            choices.filter { $0.detection.x >= columnBoundary },
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
        let centers = sorted.map { $0.detection.y + $0.detection.height / 2 }
        for (index, item) in sorted.enumerated() {
            let top = index == 0
                ? max(0, item.detection.y - 2.2)
                : (centers[index - 1] + centers[index]) / 2
            let bottom = index == sorted.count - 1
                ? min(100, item.detection.y + item.detection.height + 2.2)
                : (centers[index] + centers[index + 1]) / 2
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
if arguments.first == "--generate", arguments.count == 3 {
    try generate(root: arguments[1], output: arguments[2])
    exit(0)
}

guard !arguments.isEmpty else {
    fputs("사용법:\n  generate-hvac-answer-hotspots.swift <이미지...>\n  generate-hvac-answer-hotspots.swift --generate <이미지 루트> <출력 TS>\n", stderr)
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
