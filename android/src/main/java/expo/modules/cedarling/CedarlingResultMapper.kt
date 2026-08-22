package expo.modules.cedarling

import uniffi.cedarling_uniffi.AuthorizeResult
import uniffi.cedarling_uniffi.Decision
import uniffi.cedarling_uniffi.Diagnostics
import uniffi.cedarling_uniffi.MultiIssuerAuthorizeResult

internal object CedarlingResultMapper {
  fun map(result: AuthorizeResult): Map<String, Any> =
    map(result.decision, result.response.decision, result.requestId, result.response.diagnostics)

  fun map(result: MultiIssuerAuthorizeResult): Map<String, Any> =
    map(result.decision, result.response.decision, result.requestId, result.response.diagnostics)

  internal fun map(
    allowed: Boolean,
    decision: Decision,
    requestId: String,
    diagnostics: Diagnostics
  ): Map<String, Any> {
    val enumAllows = decision == Decision.ALLOW
    if (allowed != enumAllows) {
      throw CedarlingSdkException(
        CedarlingErrorCode.NATIVE_RESULT_INCONSISTENT,
        "native Boolean and Cedar decision disagree"
      )
    }
    if (requestId.isBlank()) {
      throw CedarlingSdkException(
        CedarlingErrorCode.NATIVE_RESULT_INCONSISTENT,
        "native result has an empty request ID"
      )
    }
    return mapOf(
      "allowed" to allowed,
      "decision" to decision.name,
      "requestId" to requestId,
      "diagnostics" to mapOf(
        "reasons" to diagnostics.reasons,
        "errors" to diagnostics.errors
      )
    )
  }
}
