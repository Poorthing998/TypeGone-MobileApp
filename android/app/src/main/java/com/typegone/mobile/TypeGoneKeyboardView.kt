package com.typegone.mobile

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.inputmethodservice.Keyboard
import android.inputmethodservice.KeyboardView
import android.util.AttributeSet
import android.view.MotionEvent

@Suppress("DEPRECATION")
class TypeGoneKeyboardView : KeyboardView {

    constructor(context: Context, attrs: AttributeSet) : super(context, attrs)
    constructor(context: Context, attrs: AttributeSet, defStyleAttr: Int) : super(context, attrs, defStyleAttr)

    // ─── Hint text paint (alternative char shown on key) ─────────────
    private val hintPaint = Paint().apply {
        isAntiAlias = true
        textAlign = Paint.Align.RIGHT
    }
    private var hintColor = Color.parseColor("#66FFFFFF")

    // ─── Space bar arrows paint ──────────────────────────────────────
    private val arrowPaint = Paint().apply {
        isAntiAlias = true
        textAlign = Paint.Align.CENTER
    }

    // ─── Space bar swipe tracking ────────────────────────────────────
    private var swipeStartX = 0f
    private var isSwiping = false
    private var isSpaceBarTouch = false
    private val swipeThreshold = 80f // pixels

    /** Set to true when multiple languages are active (shows ‹ › arrows) */
    var showLanguageArrows = false

    /** Callback for language swipe: +1 = next, -1 = previous */
    var onLanguageSwipe: ((direction: Int) -> Unit)? = null

    // ═════════════════════════════════════════════════════════════════
    //  HINT TEXT RENDERING
    // ═════════════════════════════════════════════════════════════════

    fun setHintColor(color: Int) {
        hintColor = color
        hintPaint.color = color
        arrowPaint.color = color
        invalidateAllKeys()
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        drawHintText(canvas)
        if (showLanguageArrows) drawSpaceBarArrows(canvas)
    }

    private fun drawHintText(canvas: Canvas) {
        val kbd = keyboard ?: return
        hintPaint.color = hintColor
        hintPaint.textSize = 10f * resources.displayMetrics.scaledDensity // 10sp

        for (key in kbd.keys) {
            val popup = key.popupCharacters
            if (popup != null && popup.isNotEmpty()) {
                val hint = popup[0].toString()
                val x = (key.x + key.width - 6).toFloat()
                val y = (key.y + hintPaint.textSize + 4).toFloat()
                canvas.drawText(hint, x, y, hintPaint)
            }
        }
    }

    private fun drawSpaceBarArrows(canvas: Canvas) {
        val spaceKey = findSpaceKey() ?: return
        arrowPaint.color = hintColor
        arrowPaint.textSize = 14f * resources.displayMetrics.scaledDensity // 14sp

        val centerY = (spaceKey.y + spaceKey.height / 2f + arrowPaint.textSize / 3f)
        // Left arrow
        canvas.drawText("‹", (spaceKey.x + 24).toFloat(), centerY, arrowPaint)
        // Right arrow
        canvas.drawText("›", (spaceKey.x + spaceKey.width - 24).toFloat(), centerY, arrowPaint)
    }

    // ═════════════════════════════════════════════════════════════════
    //  SPACE BAR SWIPE FOR LANGUAGE SWITCHING
    // ═════════════════════════════════════════════════════════════════

    private fun findSpaceKey(): Keyboard.Key? {
        return keyboard?.keys?.find { it.codes.isNotEmpty() && it.codes[0] == 32 }
    }

    private fun isTouchOnSpaceBar(x: Float, y: Float): Boolean {
        val key = findSpaceKey() ?: return false
        return x >= key.x && x <= key.x + key.width &&
               y >= key.y && y <= key.y + key.height
    }

    override fun onTouchEvent(event: MotionEvent): Boolean {
        when (event.action) {
            MotionEvent.ACTION_DOWN -> {
                swipeStartX = event.x
                isSwiping = false
                isSpaceBarTouch = showLanguageArrows && isTouchOnSpaceBar(event.x, event.y)
            }
            MotionEvent.ACTION_MOVE -> {
                if (isSpaceBarTouch && !isSwiping) {
                    val dx = event.x - swipeStartX
                    if (Math.abs(dx) > swipeThreshold) {
                        isSwiping = true
                        // Cancel the ongoing key press in super
                        val cancel = MotionEvent.obtain(event)
                        cancel.action = MotionEvent.ACTION_CANCEL
                        super.onTouchEvent(cancel)
                        cancel.recycle()
                        return true
                    }
                }
                if (isSwiping) return true
            }
            MotionEvent.ACTION_UP -> {
                if (isSwiping) {
                    val dx = event.x - swipeStartX
                    onLanguageSwipe?.invoke(if (dx > 0) 1 else -1)
                    isSwiping = false
                    isSpaceBarTouch = false
                    return true
                }
                isSpaceBarTouch = false
            }
            MotionEvent.ACTION_CANCEL -> {
                isSwiping = false
                isSpaceBarTouch = false
            }
        }
        return super.onTouchEvent(event)
    }

    // ═════════════════════════════════════════════════════════════════
    //  LONG-PRESS: DIRECT COMMIT FOR SINGLE ALTERNATIVES
    // ═════════════════════════════════════════════════════════════════

    override fun onLongPress(popupKey: Keyboard.Key): Boolean {
        val popup = popupKey.popupCharacters
        if (popup != null && popup.length == 1) {
            // Single alternative — commit directly, no popup
            onKeyboardActionListener?.onKey(popup[0].code, intArrayOf(popup[0].code))
            return true
        }
        // Multiple alternatives — show standard popup
        return super.onLongPress(popupKey)
    }
}
