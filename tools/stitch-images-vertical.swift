#!/usr/bin/env swift

import AppKit
import Foundation

let arguments = Array(CommandLine.arguments.dropFirst())
guard arguments.count >= 3 else {
    fputs("사용법: stitch-images-vertical.swift <위 이미지> <아래 이미지> [추가 이미지...] <출력 PNG>\n", stderr)
    exit(2)
}

let outputPath = arguments.last!
let inputPaths = arguments.dropLast()
let images = inputPaths.compactMap { NSImage(contentsOfFile: $0) }
guard images.count == inputPaths.count else {
    fputs("입력 이미지를 읽지 못했습니다.\n", stderr)
    exit(3)
}

let gap = 20
let width = images.map { Int($0.size.width) }.max() ?? 1
let height = images.reduce(0) { $0 + Int($1.size.height) } + gap * (images.count - 1)
guard let bitmap = NSBitmapImageRep(
    bitmapDataPlanes: nil,
    pixelsWide: width,
    pixelsHigh: height,
    bitsPerSample: 8,
    samplesPerPixel: 4,
    hasAlpha: true,
    isPlanar: false,
    colorSpaceName: .deviceRGB,
    bytesPerRow: 0,
    bitsPerPixel: 0
), let context = NSGraphicsContext(bitmapImageRep: bitmap) else { exit(4) }

NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = context
NSColor.white.setFill()
NSRect(x: 0, y: 0, width: CGFloat(width), height: CGFloat(height)).fill()
var y = height
for image in images {
    y -= Int(image.size.height)
    image.draw(
        in: NSRect(x: 0, y: CGFloat(y), width: image.size.width, height: image.size.height),
        from: .zero,
        operation: .copy,
        fraction: 1
    )
    y -= gap
}
NSGraphicsContext.restoreGraphicsState()

guard let data = bitmap.representation(using: .png, properties: [:]) else { exit(5) }
try data.write(to: URL(fileURLWithPath: outputPath))
print("\(width)x\(height): \(outputPath)")
