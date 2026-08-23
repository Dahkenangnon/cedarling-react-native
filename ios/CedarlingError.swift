import Foundation

internal enum CedarlingErrorCode: String {
  case alreadyDisposed = "E_ALREADY_DISPOSED"
  case notInitialized = "E_NOT_INITIALIZED"
  case invalidInput = "E_INVALID_INPUT"
  case invalidJson = "E_INVALID_JSON"
  case archiveIo = "E_ARCHIVE_IO"
  case archiveTooLarge = "E_ARCHIVE_TOO_LARGE"
  case initialization = "E_INITIALIZATION"
  case authorization = "E_AUTHORIZATION"
  case logging = "E_LOGGING"
  case dataContext = "E_DATA_CONTEXT"
  case nativeResultInconsistent = "E_NATIVE_RESULT_INCONSISTENT"
  case native = "E_NATIVE"
}

internal struct CedarlingModuleError: Error, Equatable {
  let code: CedarlingErrorCode
  let message: String

  init(_ code: CedarlingErrorCode, _ message: String) {
    self.code = code
    self.message = message
  }
}
