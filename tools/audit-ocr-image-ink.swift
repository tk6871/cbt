import Foundation
import CoreGraphics
import ImageIO

// A conservative pixel check, not a diagram classifier: unrecognized dark
// marks outside OCR line boxes mean the original must remain the primary view.
let args = Array(CommandLine.arguments.dropFirst())
guard args.count == 3 else { fputs("manifest.json ocr-directory output-directory\n", stderr); exit(2) }
let inputs = try JSONSerialization.jsonObject(with: Data(contentsOf: URL(fileURLWithPath: args[0]))) as! [[String: String]]
let ocr = URL(fileURLWithPath: args[1]), output = URL(fileURLWithPath: args[2])
try FileManager.default.createDirectory(at: output, withIntermediateDirectories: true)
var processed = 0
for row in inputs { try autoreleasepool {
    let id = row["id"]!, file = id + ".json"
    guard let data = try? Data(contentsOf: ocr.appendingPathComponent(file)),
          let raw = try JSONSerialization.jsonObject(with: data) as? [String:Any],
          let rows = raw["rows"] as? [[String:Any]], let hash = raw["sha256"] as? String,
          let source = CGImageSourceCreateWithURL(URL(fileURLWithPath: row["path"]!) as CFURL, nil),
          let image = CGImageSourceCreateThumbnailAtIndex(source, 0, [kCGImageSourceCreateThumbnailFromImageAlways:true,kCGImageSourceThumbnailMaxPixelSize:420] as CFDictionary) else { return }
    let w = image.width, h = image.height
    guard let ctx = CGContext(data:nil,width:w,height:h,bitsPerComponent:8,bytesPerRow:w,space:CGColorSpaceCreateDeviceGray(),bitmapInfo:CGImageAlphaInfo.none.rawValue),
          let pixels = ctx.data?.assumingMemoryBound(to: UInt8.self) else { return }
    ctx.setFillColor(gray:1,alpha:1)
    ctx.fill(CGRect(x:0,y:0,width:w,height:h))
    ctx.draw(image,in:CGRect(x:0,y:0,width:w,height:h))
    var mask = [Bool](repeating:false,count:w*h)
    for entry in rows {
        guard let b = entry["box"] as? [Double], b.count == 4 else { continue }
        let pad = max(2,Int(Double(h)*max(0,b[3]-b[1])*0.22))
        let x0 = max(0,Int(b[0]*Double(w))-pad), x1 = min(w,Int(ceil(b[2]*Double(w)))+pad)
        let y0 = max(0,Int(b[1]*Double(h))-pad), y1 = min(h,Int(ceil(b[3]*Double(h)))+pad)
        if x0 < x1 && y0 < y1 { for y in y0..<y1 { for x in x0..<x1 { mask[y*w+x] = true } } }
    }
    var ink = 0, outside = 0, maxLine = 0
    for y in 0..<h {
        var line = 0
        for x in 0..<w where pixels[y*w+x] < 155 {
            ink += 1
            if !mask[y*w+x] { outside += 1; line += 1 }
        }
        maxLine = max(maxLine,line)
    }
    let audit: [String:Any] = ["sha256":hash,"ink":ink,"outside":outside,"maxLine":maxLine,"width":w]
    try JSONSerialization.data(withJSONObject:audit,options:[.sortedKeys]).write(to:output.appendingPathComponent(file),options:.atomic)
    processed += 1
}}
print("Pixel audit \(processed)/\(inputs.count)")
