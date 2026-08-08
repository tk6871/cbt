#!/usr/bin/env swift

import CoreImage
import CoreImage.CIFilterBuiltins
import Foundation
import ImageIO
import UniformTypeIdentifiers

let arguments = Array(CommandLine.arguments.dropFirst())
guard arguments.count == 3, let scale = Double(arguments[2]), scale > 0,
      let input = CIImage(contentsOf: URL(fileURLWithPath: arguments[0])) else {
    fputs("사용법: resize-image-bicubic.swift <입력> <출력> <배율>\n", stderr)
    exit(2)
}

let filter = CIFilter.bicubicScaleTransform()
filter.inputImage = input
filter.scale = Float(scale)
filter.aspectRatio = 1
filter.parameterB = 0
filter.parameterC = 0.75
guard let output = filter.outputImage else { exit(4) }

let context = CIContext(options: [.useSoftwareRenderer: false])
let targetExtent = CGRect(
    x: 0,
    y: 0,
    width: (input.extent.width * scale).rounded(),
    height: (input.extent.height * scale).rounded()
)
guard let image = context.createCGImage(output.cropped(to: targetExtent), from: targetExtent) else { exit(5) }
let outputURL = URL(fileURLWithPath: arguments[1])
let type = ["jpg", "jpeg"].contains(outputURL.pathExtension.lowercased()) ? UTType.jpeg : UTType.png
guard let destination = CGImageDestinationCreateWithURL(outputURL as CFURL, type.identifier as CFString, 1, nil) else { exit(6) }
let options: [CFString: Any] = type == .jpeg ? [kCGImageDestinationLossyCompressionQuality: 0.95] : [:]
CGImageDestinationAddImage(destination, image, options as CFDictionary)
guard CGImageDestinationFinalize(destination) else { exit(7) }
print("\(image.width)x\(image.height): \(arguments[1])")
