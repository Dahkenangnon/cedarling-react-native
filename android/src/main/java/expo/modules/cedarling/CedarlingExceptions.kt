package expo.modules.cedarling

import expo.modules.kotlin.exception.CodedException

internal class CedarlingSdkException(
  code: String,
  message: String,
  cause: Throwable? = null
) : CodedException(code, message, cause)

internal object CedarlingErrorCode {
  const val ALREADY_DISPOSED = "E_ALREADY_DISPOSED"
  const val NOT_INITIALIZED = "E_NOT_INITIALIZED"
  const val INVALID_INPUT = "E_INVALID_INPUT"
  const val INVALID_JSON = "E_INVALID_JSON"
  const val ARCHIVE_IO = "E_ARCHIVE_IO"
  const val ARCHIVE_TOO_LARGE = "E_ARCHIVE_TOO_LARGE"
  const val INITIALIZATION = "E_INITIALIZATION"
  const val AUTHORIZATION = "E_AUTHORIZATION"
  const val LOGGING = "E_LOGGING"
  const val DATA_CONTEXT = "E_DATA_CONTEXT"
  const val NATIVE_RESULT_INCONSISTENT = "E_NATIVE_RESULT_INCONSISTENT"
  const val NATIVE = "E_NATIVE"
}

internal fun Throwable.messageOrFallback(fallback: String): String =
  message?.takeIf(String::isNotBlank) ?: fallback
