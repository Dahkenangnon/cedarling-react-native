package expo.modules.cedarling

import com.google.gson.JsonElement
import com.google.gson.JsonParseException
import com.google.gson.GsonBuilder
import com.google.gson.Strictness
import uniffi.cedarling_uniffi.TokenInput

internal object CedarlingJson {
  private val gson = GsonBuilder().setStrictness(Strictness.STRICT).create()
  fun requireBootstrap(value: String): String {
    requireObject(value, "bootstrap")
    return value
  }

  fun requireContext(value: String): String {
    requireObject(value, "context")
    return value
  }

  fun requireEntity(value: String, label: String): String {
    val root = requireObject(value, label)
    val mapping = root.getAsJsonObject("cedar_entity_mapping")
      ?: invalidInput("$label.cedar_entity_mapping must be an object")
    requireNonemptyString(mapping.get("entity_type"), "$label.cedar_entity_mapping.entity_type")
    requireNonemptyString(mapping.get("id"), "$label.cedar_entity_mapping.id")
    return value
  }

  fun requireAction(value: String): String =
    value.trim().takeIf(String::isNotEmpty)
      ?: invalidInput("action must be a nonempty string")

  fun parseTokens(value: String): List<TokenInput> {
    val root = parse(value, "tokens")
    if (!root.isJsonArray || root.asJsonArray.size() == 0) {
      invalidInput("tokens must be a nonempty array")
    }
    return root.asJsonArray.mapIndexed { index, item ->
      if (!item.isJsonObject) {
        invalidInput("tokens[$index] must be an object")
      }
      val token = item.asJsonObject
      TokenInput(
        mapping = requireNonemptyString(token.get("mapping"), "tokens[$index].mapping"),
        payload = requireNonemptyString(token.get("payload"), "tokens[$index].payload")
      )
    }
  }

  private fun requireObject(value: String, label: String) =
    parse(value, label).let { element ->
      if (!element.isJsonObject) {
        invalidJson("$label must be a JSON object")
      }
      element.asJsonObject
    }

  private fun parse(value: String, label: String): JsonElement {
    if (value.isBlank()) {
      invalidJson("$label must not be empty")
    }
    return try {
      gson.fromJson(value, JsonElement::class.java)
    } catch (error: JsonParseException) {
      throw CedarlingSdkException(
        CedarlingErrorCode.INVALID_JSON,
        "$label is not valid JSON",
        error
      )
    } catch (error: IllegalStateException) {
      throw CedarlingSdkException(
        CedarlingErrorCode.INVALID_JSON,
        "$label is not valid JSON",
        error
      )
    }
  }

  private fun requireNonemptyString(value: JsonElement?, label: String): String {
    if (value == null || !value.isJsonPrimitive || !value.asJsonPrimitive.isString) {
      invalidInput("$label must be a nonempty string")
    }
    return value.asString.trim().takeIf(String::isNotEmpty)
      ?: invalidInput("$label must be a nonempty string")
  }

  private fun invalidJson(message: String): Nothing =
    throw CedarlingSdkException(CedarlingErrorCode.INVALID_JSON, message)

  private fun invalidInput(message: String): Nothing =
    throw CedarlingSdkException(CedarlingErrorCode.INVALID_INPUT, message)
}
