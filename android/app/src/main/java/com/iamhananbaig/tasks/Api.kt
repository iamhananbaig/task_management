package com.iamhananbaig.tasks

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import org.json.JSONTokener
import java.io.File
import java.io.IOException
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.SocketTimeoutException
import java.net.URL
import java.net.URLEncoder
import javax.net.ssl.SSLException

/** [status] is the HTTP status, or 0 when the server could not be reached. */
class ApiException(val status: Int, message: String) : Exception(message)

/** Minimal JSON client for /api/v1 (same API as the web app). Returns a JSONObject or JSONArray. */
class Api(private val session: Session) {

    suspend fun get(path: String, query: Map<String, Any?> = emptyMap()): JSONObject = request("GET", path + queryString(query), null) as JSONObject

    suspend fun post(path: String, body: JSONObject = JSONObject()): JSONObject = request("POST", path, body) as JSONObject

    suspend fun put(path: String, body: JSONObject): JSONObject = request("PUT", path, body) as JSONObject

    suspend fun delete(path: String): JSONObject = request("DELETE", path, null) as JSONObject

    /** multipart/form-data upload of one file as the field "file". */
    suspend fun upload(path: String, fileName: String, mimeType: String, open: () -> InputStream): JSONObject = withContext(Dispatchers.IO) {
        val boundary = "----tasks${System.currentTimeMillis()}"
        connect("POST", path) { conn ->
            conn.doOutput = true
            conn.readTimeout = 120_000
            conn.setChunkedStreamingMode(64 * 1024)
            conn.setRequestProperty("Content-Type", "multipart/form-data; boundary=$boundary")
            conn.outputStream.use { out ->
                val safeName = fileName.replace("\"", "")
                out.write("--$boundary\r\nContent-Disposition: form-data; name=\"file\"; filename=\"$safeName\"\r\nContent-Type: $mimeType\r\n\r\n".toByteArray())
                open().use { it.copyTo(out, 64 * 1024) }
                out.write("\r\n--$boundary--\r\n".toByteArray())
            }
        } as JSONObject
    }

    /** Downloads [path] (with the sign-in token) into [destination]. */
    suspend fun download(path: String, destination: File): File = withContext(Dispatchers.IO) {
        val conn = open("GET", path)
        try {
            val code = conn.responseCode
            if (code !in 200..299) {
                val text = conn.errorStream?.bufferedReader()?.use { it.readText() }.orEmpty()
                throw ApiException(code, errorMessage(code, text))
            }
            destination.parentFile?.mkdirs()
            conn.inputStream.use { input -> destination.outputStream().use { input.copyTo(it) } }
            destination
        } catch (e: IOException) {
            throw networkError(e)
        } finally {
            conn.disconnect()
        }
    }

    private suspend fun request(method: String, path: String, body: JSONObject?): Any = withContext(Dispatchers.IO) {
        connect(method, path) { conn ->
            if (body != null) {
                conn.doOutput = true
                conn.setRequestProperty("Content-Type", "application/json; charset=utf-8")
                conn.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
            }
        }
    }

    private fun open(method: String, path: String): HttpURLConnection {
        val conn = try {
            URL(session.apiBase + path).openConnection() as HttpURLConnection
        } catch (e: Exception) {
            throw ApiException(0, "Invalid server address")
        }
        conn.requestMethod = method
        conn.connectTimeout = 10_000
        conn.readTimeout = 30_000
        conn.useCaches = false
        conn.setRequestProperty("Accept", "application/json")
        session.token?.let { conn.setRequestProperty("Authorization", "Bearer $it") }
        return conn
    }

    private fun connect(method: String, path: String, write: (HttpURLConnection) -> Unit): Any {
        val conn = open(method, path)
        try {
            write(conn)
            val code = conn.responseCode
            val stream = if (code in 200..299) conn.inputStream else conn.errorStream
            val text = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }.orEmpty()
            if (code !in 200..299) throw ApiException(code, errorMessage(code, text))
            return if (text.isBlank()) JSONObject() else JSONTokener(text).nextValue().let { if (it is JSONObject) it else JSONObject().put("data", it) }
        } catch (e: IOException) {
            throw networkError(e)
        } finally {
            conn.disconnect()
        }
    }

    private fun networkError(e: IOException) = when (e) {
        is SSLException -> ApiException(0, "Secure connection failed: ${e.message}")
        is SocketTimeoutException -> ApiException(0, "The server took too long to answer. Try again.")
        else -> ApiException(0, "Can't reach the server. Check Wi-Fi / internet.")
    }

    private fun queryString(query: Map<String, Any?>): String {
        val parts = query.flatMap { (key, value) ->
            when (value) {
                null, "" -> emptyList()
                is Iterable<*> -> value.map { "${enc(key)}[]=${enc(it.toString())}" }
                is Boolean -> listOf("${enc(key)}=${if (value) 1 else 0}")
                else -> listOf("${enc(key)}=${enc(value.toString())}")
            }
        }
        return if (parts.isEmpty()) "" else "?" + parts.joinToString("&")
    }

    private fun enc(value: String) = URLEncoder.encode(value, "UTF-8")

    private fun errorMessage(code: Int, body: String): String {
        val json = runCatching { JSONObject(body) }.getOrNull()
        // Validation errors: show the first field message, it is the most specific.
        json?.optJSONObject("errors")?.let { errors ->
            val keys = errors.keys()
            if (keys.hasNext()) errors.optJSONArray(keys.next())?.optString(0)?.takeIf { it.isNotBlank() }?.let { return it }
        }
        json?.optString("message")?.takeIf { it.isNotBlank() }?.let { return it }
        return when (code) {
            401 -> "Signed out. Please sign in again."
            403 -> "You don't have permission for this."
            404 -> "Not found. Check the server address."
            429 -> "Too many attempts. Wait a minute and try again."
            in 500..599 -> "Server error ($code). Try again."
            else -> "Request failed ($code)"
        }
    }
}
