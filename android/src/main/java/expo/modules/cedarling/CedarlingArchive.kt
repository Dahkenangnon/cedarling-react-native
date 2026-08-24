package expo.modules.cedarling

import android.content.Context
import android.net.Uri
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileInputStream
import java.io.IOException
import java.io.InputStream
import java.net.URI
import java.net.URISyntaxException

internal const val MAX_ARCHIVE_BYTES = 10 * 1024 * 1024

internal sealed interface ArchiveLocation {
  data class FilePath(val file: File) : ArchiveLocation
  data class ContentUri(val uri: String) : ArchiveLocation
  data class AssetPath(val path: String) : ArchiveLocation

  companion object {
    fun parse(raw: String): ArchiveLocation {
      if (raw.isBlank()) {
        invalidArchiveUri("archive URI must be a nonempty string")
      }
      val parsed = try {
        URI(raw)
      } catch (error: URISyntaxException) {
        throw CedarlingSdkException(
          CedarlingErrorCode.INVALID_INPUT,
          "archive URI is invalid",
          error
        )
      }
      return when (parsed.scheme?.lowercase()) {
        null -> {
          val file = File(raw)
          if (!file.isAbsolute) {
            invalidArchiveUri("archive path must be absolute")
          }
          FilePath(file)
        }
        "file" -> {
          if (!parsed.authority.isNullOrEmpty()) {
            invalidArchiveUri("file archive URI must not contain an authority")
          }
          try {
            FilePath(File(parsed))
          } catch (error: IllegalArgumentException) {
            throw CedarlingSdkException(
              CedarlingErrorCode.INVALID_INPUT,
              "file archive URI is invalid",
              error
            )
          }
        }
        "content" -> ContentUri(raw)
        "asset" -> {
          if (!parsed.authority.isNullOrEmpty() || parsed.query != null || parsed.fragment != null) {
            invalidArchiveUri("asset archive URI is invalid")
          }
          val path = parsed.path?.removePrefix("/").orEmpty()
          if (
            path.isBlank() ||
            path.split('/').any { component ->
              component.isBlank() || component == "." || component == ".."
            }
          ) {
            invalidArchiveUri("asset archive URI path is invalid")
          }
          AssetPath(path)
        }
        else -> invalidArchiveUri("archive URI scheme is not supported")
      }
    }

    private fun invalidArchiveUri(message: String): Nothing =
      throw CedarlingSdkException(CedarlingErrorCode.INVALID_INPUT, message)
  }
}

internal object CedarlingArchive {
  fun read(context: Context, raw: String): ByteArray {
    val location = ArchiveLocation.parse(raw)
    val input = try {
      when (location) {
        is ArchiveLocation.FilePath -> FileInputStream(location.file)
        is ArchiveLocation.ContentUri ->
          context.contentResolver.openInputStream(Uri.parse(location.uri))
            ?: throw IOException("content resolver returned no stream")
        is ArchiveLocation.AssetPath -> context.assets.open(location.path)
      }
    } catch (error: IOException) {
      throw CedarlingSdkException(
        CedarlingErrorCode.ARCHIVE_IO,
        "unable to open policy archive",
        error
      )
    } catch (error: SecurityException) {
      throw CedarlingSdkException(
        CedarlingErrorCode.ARCHIVE_IO,
        "permission denied while opening policy archive",
        error
      )
    }

    return try {
      input.use(::readBounded)
    } catch (error: CedarlingSdkException) {
      throw error
    } catch (error: IOException) {
      throw CedarlingSdkException(
        CedarlingErrorCode.ARCHIVE_IO,
        "unable to read policy archive",
        error
      )
    }
  }

  internal fun readBounded(input: InputStream): ByteArray {
    val output = ByteArrayOutputStream()
    val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
    var total = 0
    while (true) {
      val count = input.read(buffer)
      if (count < 0) break
      total += count
      if (total > MAX_ARCHIVE_BYTES) {
        throw CedarlingSdkException(
          CedarlingErrorCode.ARCHIVE_TOO_LARGE,
          "policy archive exceeds the 10 MiB limit"
        )
      }
      output.write(buffer, 0, count)
    }
    return output.toByteArray()
  }
}
