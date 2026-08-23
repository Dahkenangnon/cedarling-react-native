package expo.modules.cedarling

import java.io.ByteArrayInputStream
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

class CedarlingArchiveTest {
  @Test
  fun acceptsFileContentAssetAndAbsolutePaths() {
    assertTrue(ArchiveLocation.parse("file:///tmp/policy.cjar") is ArchiveLocation.FilePath)
    assertTrue(ArchiveLocation.parse("content://example/policy") is ArchiveLocation.ContentUri)
    assertEquals(
      ArchiveLocation.AssetPath("fixtures/policy.cjar"),
      ArchiveLocation.parse("asset:///fixtures/policy.cjar")
    )
    assertTrue(ArchiveLocation.parse("/tmp/policy.cjar") is ArchiveLocation.FilePath)
  }

  @Test
  fun rejectsRemoteAndRelativeUris() {
    for (
      uri in listOf(
        "https://example.test/policy.cjar",
        "policy.cjar",
        "asset:///../policy.cjar",
        "asset://authority/policy.cjar",
        "asset:///policy.cjar?version=1",
        "asset:///policy.cjar#fragment"
      )
    ) {
      val error = assertThrows(CedarlingSdkException::class.java) {
        ArchiveLocation.parse(uri)
      }
      assertEquals(CedarlingErrorCode.INVALID_INPUT, error.code)
    }
  }

  @Test
  fun readsAtLimitAndRejectsOneByteOver() {
    val atLimit = ByteArray(MAX_ARCHIVE_BYTES) { 7 }
    assertArrayEquals(atLimit, CedarlingArchive.readBounded(ByteArrayInputStream(atLimit)))

    val error = assertThrows(CedarlingSdkException::class.java) {
      CedarlingArchive.readBounded(ByteArrayInputStream(ByteArray(MAX_ARCHIVE_BYTES + 1)))
    }
    assertEquals(CedarlingErrorCode.ARCHIVE_TOO_LARGE, error.code)
  }
}
