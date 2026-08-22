package expo.modules.cedarling

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class CedarlingJsonTest {
  @Test
  fun acceptsValidObjectsAndTokens() {
    assertEquals("{}", CedarlingJson.requireBootstrap("{}"))
    assertEquals("{}", CedarlingJson.requireContext("{}"))
    assertEquals(
      """{"cedar_entity_mapping":{"entity_type":"Example::User","id":"alice"}}""",
      CedarlingJson.requireEntity(
        """{"cedar_entity_mapping":{"entity_type":"Example::User","id":"alice"}}""",
        "principal"
      )
    )
    val tokens = CedarlingJson.parseTokens("""[{"mapping":"Jans::Access_Token","payload":"jwt"}]""")
    assertEquals("Jans::Access_Token", tokens.single().mapping)
    assertEquals("jwt", tokens.single().payload)
  }

  @Test
  fun rejectsMalformedJsonWithStableCode() {
    val error = assertThrows(CedarlingSdkException::class.java) {
      CedarlingJson.requireContext("{")
    }
    assertEquals(CedarlingErrorCode.INVALID_JSON, error.code)
    for (malformed in listOf("{\"score\":NaN}", "{unquoted:1}")) {
      val strictError = assertThrows(CedarlingSdkException::class.java) {
        CedarlingJson.requireContext(malformed)
      }
      assertEquals(CedarlingErrorCode.INVALID_JSON, strictError.code)
    }
  }

  @Test
  fun rejectsMissingEntityMappingAndEmptyTokens() {
    val entityError = assertThrows(CedarlingSdkException::class.java) {
      CedarlingJson.requireEntity("{}", "resource")
    }
    assertEquals(CedarlingErrorCode.INVALID_INPUT, entityError.code)

    val tokenError = assertThrows(CedarlingSdkException::class.java) {
      CedarlingJson.parseTokens("[]")
    }
    assertEquals(CedarlingErrorCode.INVALID_INPUT, tokenError.code)
  }
}
