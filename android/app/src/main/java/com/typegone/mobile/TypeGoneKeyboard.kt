package com.typegone.mobile

import android.content.Context
import android.inputmethodservice.InputMethodService
import android.inputmethodservice.Keyboard
import android.inputmethodservice.KeyboardView
import android.media.MediaRecorder
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.view.View
import android.view.inputmethod.InputConnection
import android.widget.Button
import android.widget.PopupMenu
import android.widget.TextView
import android.content.SharedPreferences
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.IOException

@Suppress("DEPRECATION")
class TypeGoneKeyboard : InputMethodService(), KeyboardView.OnKeyboardActionListener {

    // ─── Views ───────────────────────────────────────────────────────
    private var keyboardView: TypeGoneKeyboardView? = null
    private var statusText: TextView? = null
    private var recordButton: TextView? = null
    private var shortcutButton: TextView? = null

    // ─── Language System ─────────────────────────────────────────────
    data class LangInfo(val code: String, val label: String, val nativeLabel: String, val xmlRes: Int)
    private val ALL_LANGUAGES = listOf(
        LangInfo("en", "English",    "English",    R.xml.qwerty),
        LangInfo("fa", "Persian",    "فارسی",     R.xml.persian),
        LangInfo("ar", "Arabic",     "العربية",    R.xml.arabic),
        LangInfo("es", "Spanish",    "Español",    R.xml.spanish),
        LangInfo("fr", "French",     "Français",   R.xml.french),
        LangInfo("de", "German",     "Deutsch",    R.xml.german),
        LangInfo("ru", "Russian",    "Русский",    R.xml.russian),
        LangInfo("pt", "Portuguese", "Português",  R.xml.portuguese),
    )
    private var activeLanguages = mutableListOf("en")
    private var currentLangIndex = 0

    // ─── Keyboard Layouts ────────────────────────────────────────────
    private var letterKeyboard: Keyboard? = null   // current language
    private var symbols1Keyboard: Keyboard? = null
    private var symbols2Keyboard: Keyboard? = null
    private var currentKeyboard: Keyboard? = null

    // ─── Key Codes ───────────────────────────────────────────────────
    private val CODE_DELETE  = -5
    private val CODE_DONE    = -4   // Enter/Return
    private val CODE_SHIFT   = -1
    private val CODE_TO_SYM1 = -11  // "123" key
    private val CODE_TO_SYM2 = -12  // "#+=" key
    private val CODE_TO_ABC  = -13  // "ABC" key
    private val CODE_GLOBE   = -14  // Language switcher
    private val CODE_SPACE   = 32

    // ─── Shift State Machine ─────────────────────────────────────────
    // OFF → single tap → ONCE (next char upper, then back to OFF)
    // ONCE → another tap within 400ms → LOCKED (caps lock)
    // LOCKED → tap → OFF
    private enum class ShiftState { OFF, ONCE, LOCKED }
    private var shiftState = ShiftState.OFF
    private var lastShiftTapTime = 0L

    // ─── Double-Space → Period ───────────────────────────────────────
    private var lastSpaceTime = 0L

    // ─── Accelerating Backspace ──────────────────────────────────────
    private val deleteHandler = Handler(Looper.getMainLooper())
    private var deleteCount = 0
    private var isDeleteHeld = false

    // ─── Voice Recording ─────────────────────────────────────────────
    private var selectedModeLabel = "Tidy Speech"
    private var selectedModePrompt = "Clean up the following spoken text. Remove filler words, fix grammar, and make it clear and concise while preserving the original meaning. Only output the cleaned text."
    private var mediaRecorder: MediaRecorder? = null
    private var audioFile: File? = null
    private var isRecording = false
    private val client = OkHttpClient()
    private val EDGE_URL = "https://pnlwglsglwebcobjynrg.supabase.co/functions/v1/process-recording"
    private val SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBubHdnbHNnbHdlYmNvYmp5bnJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc0NTQ4NDIsImV4cCI6MjA4MzAzMDg0Mn0.9jJtvA6WxNVPzt5q3qaj5z0TQSGsaUS4mabDektQ8pQ"

    // ─── Haptics ─────────────────────────────────────────────────────
    private var vibrator: Vibrator? = null

    // ═════════════════════════════════════════════════════════════════
    //  LIFECYCLE
    // ═════════════════════════════════════════════════════════════════

    private var currentTheme = "dark"
    private var prefsListener: android.content.SharedPreferences.OnSharedPreferenceChangeListener? = null

    override fun onCreate() {
        super.onCreate()
        vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val mgr = getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
            mgr.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
        }

        // Listen for theme changes so keyboard refreshes instantly
        val prefs = getSharedPreferences("typegone_prefs", Context.MODE_PRIVATE)
        currentTheme = prefs.getString("keyboard_theme", "dark") ?: "dark"
        prefsListener = android.content.SharedPreferences.OnSharedPreferenceChangeListener { _, key ->
            if (key == "keyboard_theme") {
                val newTheme = prefs.getString("keyboard_theme", "dark") ?: "dark"
                if (newTheme != currentTheme) {
                    currentTheme = newTheme
                    // Force keyboard to re-create its view with the new theme layout
                    Handler(Looper.getMainLooper()).post {
                        setInputView(onCreateInputView())
                    }
                }
            }
        }
        prefs.registerOnSharedPreferenceChangeListener(prefsListener)
    }

    override fun onDestroy() {
        super.onDestroy()
        val prefs = getSharedPreferences("typegone_prefs", Context.MODE_PRIVATE)
        prefsListener?.let { prefs.unregisterOnSharedPreferenceChangeListener(it) }
    }

    override fun onCreateInputView(): View {
        // Pick layout based on theme — all colors baked into XML, no reflection needed
        val prefs = getSharedPreferences("typegone_prefs", Context.MODE_PRIVATE)
        currentTheme = prefs.getString("keyboard_theme", "dark") ?: "dark"
        val layoutId = if (currentTheme == "light") R.layout.keyboard_view_light else R.layout.keyboard_view
        val view = layoutInflater.inflate(layoutId, null)

        statusText     = view.findViewById(R.id.statusText)
        recordButton   = view.findViewById(R.id.recordButton)
        shortcutButton = view.findViewById(R.id.shortcutButton)
        keyboardView   = view.findViewById(R.id.keyboard_view)

        // Set hint color based on theme
        val hintColor = if (currentTheme == "light") android.graphics.Color.parseColor("#66000000") else android.graphics.Color.parseColor("#66FFFFFF")
        keyboardView?.setHintColor(hintColor)

        // Load active languages from prefs
        loadActiveLanguages()

        // Load keyboard for current language
        val langInfo = ALL_LANGUAGES.find { it.code == activeLanguages[currentLangIndex] } ?: ALL_LANGUAGES[0]
        letterKeyboard  = Keyboard(this, langInfo.xmlRes)
        symbols1Keyboard = Keyboard(this, R.xml.symbols1)
        symbols2Keyboard = Keyboard(this, R.xml.symbols2)

        // Start on letter keyboard
        currentKeyboard = letterKeyboard
        keyboardView?.keyboard = currentKeyboard
        keyboardView?.isPreviewEnabled = false
        keyboardView?.setOnKeyboardActionListener(this)

        // Update space bar to show current language name
        updateSpaceBarLabel(langInfo.nativeLabel)

        // Enable language arrows if multiple languages are active
        keyboardView?.showLanguageArrows = activeLanguages.size > 1

        // Wire up space bar swipe for language switching
        keyboardView?.onLanguageSwipe = { direction ->
            if (direction > 0) cycleLanguageForward() else cycleLanguageBackward()
            hapticMedium()
        }

        // Show current language in status bar
        statusText?.text = "${langInfo.nativeLabel} — Tap MIC to voice-type"

        // MIC toggle
        recordButton?.setOnClickListener {
            if (isRecording) stopRecordingAndUpload() else startRecording()
        }

        // Mode picker
        shortcutButton?.setOnClickListener { showModePicker(it) }

        // Colors are baked into the XML layouts (no Material override)

        return view
    }

    override fun onStartInputView(info: android.view.inputmethod.EditorInfo?, restarting: Boolean) {
        super.onStartInputView(info, restarting)
        // Update enter key label based on IME action
        val action = info?.imeOptions?.and(android.view.inputmethod.EditorInfo.IME_MASK_ACTION) ?: 0
        val enterLabel = when (action) {
            android.view.inputmethod.EditorInfo.IME_ACTION_SEARCH -> "🔍"
            android.view.inputmethod.EditorInfo.IME_ACTION_GO     -> "→"
            android.view.inputmethod.EditorInfo.IME_ACTION_DONE   -> "✓"
            android.view.inputmethod.EditorInfo.IME_ACTION_SEND   -> "➤"
            android.view.inputmethod.EditorInfo.IME_ACTION_NEXT   -> "⏭"
            else -> "⏎"
        }
        // Walk through all keys to find the enter key (code -4) and update its label
        currentKeyboard?.keys?.forEach { key ->
            if (key.codes.isNotEmpty() && key.codes[0] == CODE_DONE) {
                key.label = enterLabel
            }
        }
        keyboardView?.invalidateAllKeys()
    }

    // ═════════════════════════════════════════════════════════════════
    //  KEYBOARD ACTION LISTENER
    // ═════════════════════════════════════════════════════════════════

    override fun onKey(primaryCode: Int, keyCodes: IntArray?) {
        val ic: InputConnection = currentInputConnection ?: return

        when (primaryCode) {
            // ── Shift ─────────────────────────────────────────────
            CODE_SHIFT -> handleShift()

            // ── Backspace ─────────────────────────────────────────
            CODE_DELETE -> {
                // If text is selected, delete the entire selection
                val selected = ic.getSelectedText(0)
                if (selected != null && selected.isNotEmpty()) {
                    ic.commitText("", 1)
                } else {
                    ic.deleteSurroundingText(1, 0)
                }
                hapticLight()
            }

            // ── Enter / Return ────────────────────────────────────
            CODE_DONE -> {
                val ei = currentInputEditorInfo
                val action = ei?.imeOptions?.and(android.view.inputmethod.EditorInfo.IME_MASK_ACTION) ?: 0
                when (action) {
                    android.view.inputmethod.EditorInfo.IME_ACTION_SEARCH,
                    android.view.inputmethod.EditorInfo.IME_ACTION_GO,
                    android.view.inputmethod.EditorInfo.IME_ACTION_DONE,
                    android.view.inputmethod.EditorInfo.IME_ACTION_SEND,
                    android.view.inputmethod.EditorInfo.IME_ACTION_NEXT -> {
                        ic.performEditorAction(action)
                    }
                    else -> {
                        ic.commitText("\n", 1)
                    }
                }
                hapticMedium()
            }

            // ── Layer Switching ───────────────────────────────────
            CODE_TO_SYM1 -> switchKeyboard(symbols1Keyboard)
            CODE_TO_SYM2 -> switchKeyboard(symbols2Keyboard)
            CODE_TO_ABC  -> switchKeyboard(letterKeyboard)


            // ── Space (with double-space → period logic) ─────────
            CODE_SPACE -> {
                val now = System.currentTimeMillis()
                if (now - lastSpaceTime < 400) {
                    // Double-space → replace trailing space with ". "
                    ic.deleteSurroundingText(1, 0)
                    ic.commitText(". ", 1)
                    // Auto-capitalize next character
                    if (shiftState == ShiftState.OFF) {
                        shiftState = ShiftState.ONCE
                        updateShiftVisual()
                    }
                } else {
                    ic.commitText(" ", 1)
                }
                lastSpaceTime = now
                hapticLight()
            }

            // ── Character Keys ────────────────────────────────────
            else -> {
                if (primaryCode > 0) {
                    val ch = if (shiftState != ShiftState.OFF) {
                        primaryCode.toChar().uppercaseChar()
                    } else {
                        primaryCode.toChar()
                    }
                    ic.commitText(ch.toString(), 1)

                    // After ONCE, drop back to OFF
                    if (shiftState == ShiftState.ONCE) {
                        shiftState = ShiftState.OFF
                        updateShiftVisual()
                    }
                    hapticLight()
                }
            }
        }
    }

    // ── Press / Release (for accelerating backspace) ─────────────────

    override fun onPress(primaryCode: Int) {
        if (primaryCode == CODE_DELETE) {
            isDeleteHeld = true
            deleteCount = 0
            startAcceleratingDelete()
        }
    }

    override fun onRelease(primaryCode: Int) {
        if (primaryCode == CODE_DELETE) {
            isDeleteHeld = false
            deleteHandler.removeCallbacksAndMessages(null)
        }
    }

    private fun startAcceleratingDelete() {
        deleteHandler.postDelayed(object : Runnable {
            override fun run() {
                if (!isDeleteHeld) return
                val ic = currentInputConnection ?: return
                deleteCount++
                // If text is selected, clear selection first
                val selected = ic.getSelectedText(0)
                if (selected != null && selected.isNotEmpty()) {
                    ic.commitText("", 1)
                    isDeleteHeld = false  // stop repeating after clearing selection
                    return
                }
                ic.deleteSurroundingText(1, 0)
                hapticLight()
                // Accelerate: starts at 100ms, drops to 30ms
                val delay = when {
                    deleteCount < 5  -> 100L
                    deleteCount < 15 -> 60L
                    deleteCount < 30 -> 40L
                    else             -> 30L
                }
                deleteHandler.postDelayed(this, delay)
            }
        }, 400) // Initial delay before repeat starts
    }

    override fun onText(text: CharSequence?) {
        currentInputConnection?.commitText(text, 1)
    }

    override fun swipeLeft() {}
    override fun swipeRight() {}
    override fun swipeDown() {}
    override fun swipeUp() {}

    // ═════════════════════════════════════════════════════════════════
    //  SHIFT STATE MACHINE
    // ═════════════════════════════════════════════════════════════════

    private fun handleShift() {
        val now = System.currentTimeMillis()
        when (shiftState) {
            ShiftState.OFF -> {
                shiftState = ShiftState.ONCE
                lastShiftTapTime = now
            }
            ShiftState.ONCE -> {
                if (now - lastShiftTapTime < 400) {
                    // Double-tap → caps lock
                    shiftState = ShiftState.LOCKED
                } else {
                    // Slow second tap → turn off
                    shiftState = ShiftState.OFF
                }
            }
            ShiftState.LOCKED -> {
                shiftState = ShiftState.OFF
            }
        }
        updateShiftVisual()
        hapticLight()
    }

    private fun updateShiftVisual() {
        val shifted = shiftState != ShiftState.OFF
        currentKeyboard?.isShifted = shifted
        keyboardView?.invalidateAllKeys()
    }

    // ═════════════════════════════════════════════════════════════════
    //  LAYER SWITCHING
    // ═════════════════════════════════════════════════════════════════

    private fun switchKeyboard(kb: Keyboard?) {
        currentKeyboard = kb ?: letterKeyboard
        keyboardView?.keyboard = currentKeyboard
        // Reset shift when switching to symbols
        if (currentKeyboard != letterKeyboard) {
            shiftState = ShiftState.OFF
            currentKeyboard?.isShifted = false
        }
        keyboardView?.invalidateAllKeys()
        hapticLight()
    }

    // ═════════════════════════════════════════════════════════════════
    //  LANGUAGE SWITCHING
    // ═════════════════════════════════════════════════════════════════

    private fun loadActiveLanguages() {
        try {
            val prefs = getSharedPreferences("typegone_prefs", Context.MODE_PRIVATE)
            val json = prefs.getString("active_languages", null)
            if (json != null) {
                val arr = JSONArray(json)
                activeLanguages.clear()
                for (i in 0 until arr.length()) {
                    activeLanguages.add(arr.getString(i))
                }
            }
            // Always ensure at least English
            if (activeLanguages.isEmpty()) activeLanguages.add("en")
        } catch (_: Exception) {
            activeLanguages = mutableListOf("en")
        }
    }

    private fun cycleLanguageForward() {
        if (activeLanguages.size <= 1) return
        currentLangIndex = (currentLangIndex + 1) % activeLanguages.size
        applyLanguageSwitch()
    }

    private fun cycleLanguageBackward() {
        if (activeLanguages.size <= 1) return
        currentLangIndex = (currentLangIndex - 1 + activeLanguages.size) % activeLanguages.size
        applyLanguageSwitch()
    }

    private fun applyLanguageSwitch() {
        val langCode = activeLanguages[currentLangIndex]
        val langInfo = ALL_LANGUAGES.find { it.code == langCode } ?: ALL_LANGUAGES[0]
        letterKeyboard = Keyboard(this, langInfo.xmlRes)
        currentKeyboard = letterKeyboard
        keyboardView?.keyboard = currentKeyboard
        shiftState = ShiftState.OFF
        updateSpaceBarLabel(langInfo.nativeLabel)
        keyboardView?.invalidateAllKeys()
        statusText?.text = "${langInfo.nativeLabel} — Tap MIC to voice-type"
    }

    private fun updateSpaceBarLabel(langName: String) {
        currentKeyboard?.keys?.forEach { key ->
            if (key.codes.isNotEmpty() && key.codes[0] == CODE_SPACE) {
                key.label = langName
            }
        }
        keyboardView?.invalidateAllKeys()
    }

    // ═════════════════════════════════════════════════════════════════
    //  HAPTIC FEEDBACK
    // ═════════════════════════════════════════════════════════════════

    private fun hapticLight() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator?.vibrate(VibrationEffect.createOneShot(10, 40))
            }
        } catch (_: Exception) {}
    }

    private fun hapticMedium() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator?.vibrate(VibrationEffect.createOneShot(20, 80))
            }
        } catch (_: Exception) {}
    }

    // ═════════════════════════════════════════════════════════════════
    //  MODE PICKER (reads custom modes from SharedPreferences)
    // ═════════════════════════════════════════════════════════════════

    private fun loadModes(): List<Pair<String, String>> {
        val prefs = getSharedPreferences("typegone_prefs", Context.MODE_PRIVATE)
        val raw = prefs.getString("modes", null)
        if (raw != null) {
            try {
                val arr = JSONArray(raw)
                val list = mutableListOf<Pair<String, String>>()
                for (i in 0 until arr.length()) {
                    val obj = arr.getJSONObject(i)
                    list.add(Pair(obj.getString("label"), obj.getString("prompt")))
                }
                if (list.isNotEmpty()) return list
            } catch (_: Exception) {}
        }
        return listOf(
            Pair("Tidy Speech", "Clean up the following spoken text. Remove filler words, fix grammar. Only output the cleaned text."),
            Pair("Write Email", "Convert the following spoken text into a polished professional email. Only output the email."),
            Pair("AI Prompt", "Convert the following spoken text into a well-structured AI prompt. Only output the prompt."),
            Pair("Summarize", "Summarize the following spoken text into concise bullet points. Only output the summary."),
            Pair("Translate to EN", "Translate the following spoken text into fluent English. Only output the translation.")
        )
    }

    private fun showModePicker(anchor: View) {
        val modes = loadModes()
        val popup = PopupMenu(this, anchor)
        modes.forEachIndexed { i, (label, _) -> popup.menu.add(0, i, i, label) }
        popup.setOnMenuItemClickListener { item ->
            val (label, prompt) = modes[item.itemId]
            selectedModeLabel = label
            selectedModePrompt = prompt
            val display = if (label.length > 12) label.take(11) + "…" else label
            shortcutButton?.text = display
            statusText?.text = "Mode: $label"
            true
        }
        popup.show()
    }

    // ═════════════════════════════════════════════════════════════════
    //  VOICE RECORDING
    // ═════════════════════════════════════════════════════════════════

    private fun startRecording() {
        if (isRecording) return
        try {
            audioFile = File(cacheDir, "typegone_audio.m4a")
            mediaRecorder = MediaRecorder().apply {
                setAudioSource(MediaRecorder.AudioSource.VOICE_RECOGNITION)
                setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
                setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
                setAudioSamplingRate(16000)
                setAudioEncodingBitRate(128000)
                setOutputFile(audioFile?.absolutePath)
                prepare()
                start()
            }
            isRecording = true
            statusText?.text = "● RECORDING — Tap STOP"
            recordButton?.text = "⏹ STOP"
            recordButton?.setBackgroundColor(android.graphics.Color.parseColor("#FF005C"))
            recordButton?.setTextColor(android.graphics.Color.WHITE)
            hapticMedium()
        } catch (e: RuntimeException) {
            e.printStackTrace()
            mediaRecorder?.release(); mediaRecorder = null; isRecording = false
            statusText?.text = "Mic busy — close other voice apps"
        } catch (e: Exception) {
            e.printStackTrace()
            mediaRecorder?.release(); mediaRecorder = null; isRecording = false
            statusText?.text = "Mic error — check permission"
        }
    }

    private fun stopRecordingAndUpload() {
        if (!isRecording) return
        try {
            mediaRecorder?.stop()
            mediaRecorder?.release()
            mediaRecorder = null
            isRecording = false
            recordButton?.text = "🎙 MIC"
            // Restore theme-appropriate background
            if (currentTheme == "light") {
                recordButton?.setBackgroundResource(R.drawable.mic_btn_light)
                recordButton?.setTextColor(android.graphics.Color.BLACK)
            } else {
                recordButton?.setBackgroundResource(R.drawable.mic_btn_dark)
                recordButton?.setTextColor(android.graphics.Color.parseColor("#1C1C1E"))
            }
            statusText?.text = "Processing…"
            hapticMedium()
            uploadToEdgeFunction(audioFile)
        } catch (e: Exception) {
            e.printStackTrace()
            isRecording = false; mediaRecorder?.release(); mediaRecorder = null
            statusText?.text = "Recording error"
        }
    }

    // ═════════════════════════════════════════════════════════════════
    //  TOKEN MANAGEMENT (auto-refresh expired tokens)
    // ═════════════════════════════════════════════════════════════════

    private fun getToken(): String {
        val prefs = getSharedPreferences("typegone_prefs", Context.MODE_PRIVATE)
        return prefs.getString("supabase_token", "") ?: ""
    }

    private fun getRefreshToken(): String {
        val prefs = getSharedPreferences("typegone_prefs", Context.MODE_PRIVATE)
        return prefs.getString("supabase_refresh_token", "") ?: ""
    }

    private fun saveToken(accessToken: String, refreshToken: String) {
        getSharedPreferences("typegone_prefs", Context.MODE_PRIVATE)
            .edit()
            .putString("supabase_token", accessToken)
            .putString("supabase_refresh_token", refreshToken)
            .apply()
    }

    /**
     * Refresh the access token using the stored refresh_token.
     * Calls Supabase Auth REST API directly.
     * Returns the new access token, or empty string on failure.
     */
    private fun refreshTokenSync(): String {
        val refreshToken = getRefreshToken()
        if (refreshToken.isEmpty()) return ""

        try {
            val body = JSONObject().apply {
                put("refresh_token", refreshToken)
            }
            val req = Request.Builder()
                .url("https://pnlwglsglwebcobjynrg.supabase.co/auth/v1/token?grant_type=refresh_token")
                .header("apikey", SUPABASE_ANON_KEY)
                .header("Content-Type", "application/json")
                .post(RequestBody.create("application/json".toMediaTypeOrNull(), body.toString()))
                .build()

            val response = client.newCall(req).execute()
            val data = response.body?.string()
            if (response.isSuccessful && data != null) {
                val json = JSONObject(data)
                val newAccess = json.getString("access_token")
                val newRefresh = json.getString("refresh_token")
                saveToken(newAccess, newRefresh)
                return newAccess
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
        return ""
    }

    // ═════════════════════════════════════════════════════════════════
    //  EDGE FUNCTION (with auto-refresh on 401)
    // ═════════════════════════════════════════════════════════════════

    private fun uploadToEdgeFunction(file: File?) {
        if (file == null || !file.exists()) { setStatus("Audio missing"); return }
        var token = getToken()
        if (token.isEmpty()) { setStatus("Sign in to TypeGone app first"); return }

        val audioBytes = file.readBytes()
        val audioBase64 = android.util.Base64.encodeToString(audioBytes, android.util.Base64.NO_WRAP)

        val jsonBody = JSONObject().apply {
            put("audioData", audioBase64)
            put("prompt", selectedModePrompt)
            put("audioFormat", "m4a")
        }

        // Run on background thread (already called from main via callback)
        Thread {
            try {
                var response = callEdgeFunction(token, jsonBody)
                
                // If 401, try refreshing the token and retry once
                if (response.code == 401) {
                    val newToken = refreshTokenSync()
                    if (newToken.isNotEmpty()) {
                        setStatus("Refreshing session…")
                        response.close()
                        response = callEdgeFunction(newToken, jsonBody)
                    } else {
                        setStatus("Session expired — open TypeGone app")
                        response.close()
                        return@Thread
                    }
                }

                val data = response.body?.string()
                if (response.isSuccessful && data != null) {
                    val json = JSONObject(data)
                    if (json.optBoolean("success", false)) {
                        val text = json.getString("processedText")
                        Handler(Looper.getMainLooper()).post {
                            currentInputConnection?.commitText(text, 1)
                            setStatus("Done! Tap MIC again")
                        }
                    } else {
                        showError(json.optString("error", "Processing failed"))
                    }
                } else {
                    showError("Server error ${response.code}")
                }
                response.close()
            } catch (e: Exception) {
                e.printStackTrace()
                showError("Network error")
            }
        }.start()
    }

    private fun callEdgeFunction(token: String, jsonBody: JSONObject): Response {
        val req = Request.Builder()
            .url(EDGE_URL)
            .header("Authorization", "Bearer $token")
            .header("apikey", SUPABASE_ANON_KEY)
            .header("Content-Type", "application/json")
            .post(RequestBody.create("application/json".toMediaTypeOrNull(), jsonBody.toString()))
            .build()
        return client.newCall(req).execute()
    }

    // ═════════════════════════════════════════════════════════════════
    //  STATUS HELPERS
    // ═════════════════════════════════════════════════════════════════

    private fun setStatus(msg: String) {
        Handler(Looper.getMainLooper()).post { statusText?.text = msg }
    }

    private fun showError(msg: String) {
        Handler(Looper.getMainLooper()).post {
            statusText?.text = "Error: $msg"
            Handler(Looper.getMainLooper()).postDelayed({
                statusText?.text = "TypeGone — Tap MIC to speak"
            }, 4000)
        }
    }
}
