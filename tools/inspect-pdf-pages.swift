#!/usr/bin/env swift

import AppKit
import Foundation
import PDFKit

let arguments = Array(CommandLine.arguments.dropFirst())
guard let path = arguments.first,
      let document = PDFDocument(url: URL(fileURLWithPath: path)) else {
    fputs("사용법: inspect-pdf-pages.swift <PDF> [페이지번호 출력PNG]\n", stderr)
    exit(2)
}

if arguments.count == 3, let pageNumber = Int(arguments[1]),
   pageNumber >= 1, pageNumber <= document.pageCount,
   let page = document.page(at: pageNumber - 1) {
    let bounds = page.bounds(for: .mediaBox)
    let scale: CGFloat = 2
    let image = NSImage(size: NSSize(width: bounds.width * scale, height: bounds.height * scale))
    image.lockFocus()
    NSColor.white.setFill()
    NSRect(origin: .zero, size: image.size).fill()
    guard let context = NSGraphicsContext.current?.cgContext else { exit(3) }
    context.scaleBy(x: scale, y: scale)
    page.draw(with: .mediaBox, to: context)
    image.unlockFocus()
    guard let data = image.tiffRepresentation,
          let bitmap = NSBitmapImageRep(data: data),
          let png = bitmap.representation(using: .png, properties: [:]) else { exit(4) }
    try png.write(to: URL(fileURLWithPath: arguments[2]))
    print("페이지 \(pageNumber) 렌더링: \(arguments[2])")
    exit(0)
}

print("pages=\(document.pageCount)")
for index in 0..<document.pageCount {
    let text = (document.page(at: index)?.string ?? "").replacingOccurrences(of: "\n", with: " ")
    print("PAGE \(index + 1): \(text.prefix(240))")
}
