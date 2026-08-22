import Foundation

internal let cedarlingMaximumArchiveBytes = 10 * 1024 * 1024

internal enum CedarlingArchive {
  static func read(_ rawLocation: String) throws -> Data {
    let location = rawLocation.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !location.isEmpty else {
      throw CedarlingModuleError(.invalidInput, "archive URI must be a nonempty string")
    }

    let url: URL
    if let components = URLComponents(string: location), let scheme = components.scheme {
      guard scheme.lowercased() == "file" else {
        throw CedarlingModuleError(.invalidInput, "archive URI scheme is not supported")
      }
      guard components.host?.isEmpty != false else {
        throw CedarlingModuleError(.invalidInput, "file archive URI must not contain an authority")
      }
      guard components.query == nil, components.fragment == nil else {
        throw CedarlingModuleError(.invalidInput, "file archive URI is invalid")
      }
      guard let parsed = URL(string: location), parsed.isFileURL else {
        throw CedarlingModuleError(.invalidInput, "file archive URI is invalid")
      }
      url = parsed
    } else {
      guard location.hasPrefix("/") else {
        throw CedarlingModuleError(.invalidInput, "archive path must be absolute")
      }
      url = URL(fileURLWithPath: location)
    }

    guard let stream = InputStream(url: url) else {
      throw CedarlingModuleError(.archiveIo, "unable to open policy archive")
    }

    stream.open()
    defer { stream.close() }

    var archive = Data()
    var buffer = [UInt8](repeating: 0, count: 64 * 1024)
    while true {
      let count = stream.read(&buffer, maxLength: buffer.count)
      if count < 0 {
        throw CedarlingModuleError(.archiveIo, "unable to read policy archive")
      }
      if count == 0 {
        break
      }
      guard archive.count <= cedarlingMaximumArchiveBytes - count else {
        throw CedarlingModuleError(.archiveTooLarge, "policy archive exceeds the 10 MiB limit")
      }
      archive.append(contentsOf: buffer.prefix(count))
    }

    if stream.streamError != nil {
      throw CedarlingModuleError(.archiveIo, "unable to read policy archive")
    }
    return archive
  }
}
