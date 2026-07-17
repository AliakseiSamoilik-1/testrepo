package com.vibrotimer

import android.app.*
import android.content.Intent
import android.os.*
import androidx.core.app.NotificationCompat
import androidx.localbroadcastmanager.content.LocalBroadcastManager

class VibrationService : Service() {

    companion object {
        const val ACTION_START_CUSTOM  = "com.vibrotimer.START_CUSTOM"
        const val ACTION_START_TRAINER = "com.vibrotimer.START_TRAINER"
        const val ACTION_STOP          = "com.vibrotimer.STOP"
        const val EXTRA_DURATION = "duration"
        const val EXTRA_INTERVAL = "interval"
        const val EXTRA_P1_MINS  = "p1mins"
        const val EXTRA_P1_BPM   = "p1bpm"
        const val EXTRA_P2_MINS  = "p2mins"
        const val EXTRA_P2_BPM   = "p2bpm"

        const val BROADCAST_STATE = "com.vibrotimer.STATE"
        const val EXTRA_RUNNING   = "running"
        const val EXTRA_MODE      = "mode"
        const val EXTRA_PHASE     = "phase"
        const val EXTRA_REMAINING = "remaining"
        const val EXTRA_CYCLE     = "cycle"
        const val EXTRA_P1_BPM_OUT = "p1bpmOut"
        const val EXTRA_P2_BPM_OUT = "p2bpmOut"

        const val VIB_MS     = 150L
        const val CHANNEL_ID = "vibro"
        const val NOTIF_ID   = 1
    }

    private val vibrator: Vibrator by lazy {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S)
            (getSystemService(VIBRATOR_MANAGER_SERVICE) as VibratorManager).defaultVibrator
        else
            @Suppress("DEPRECATION") getSystemService(VIBRATOR_SERVICE) as Vibrator
    }

    private var mode = "custom"
    private var sessionStart = 0L
    private var customDuration = 500L
    private var customInterval = 2000L
    private var lastPhase = 0

    // Trainer params (set on start, fixed for the session)
    private var phase1Ms = 3 * 60 * 1000L
    private var phase2Ms = 2 * 60 * 1000L
    private var cycleMs  = phase1Ms + phase2Ms
    private var beat1    = 800L
    private var beat2    = 909L
    private var p1Bpm    = 75
    private var p2Bpm    = 66

    private val handler = Handler(Looper.getMainLooper())
    private val tickRunnable = object : Runnable {
        override fun run() { tick(); handler.postDelayed(this, 500) }
    }

    override fun onCreate() {
        super.onCreate()
        createChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START_CUSTOM -> {
                customDuration = intent.getLongExtra(EXTRA_DURATION, 500L)
                customInterval = intent.getLongExtra(EXTRA_INTERVAL, 2000L)
                mode = "custom"; sessionStart = 0L
                startFg("Custom vibration running")
                vibrateCustom()
                restartTick()
            }
            ACTION_START_TRAINER -> {
                val p1Mins = intent.getIntExtra(EXTRA_P1_MINS, 3).coerceAtLeast(1)
                val p2Mins = intent.getIntExtra(EXTRA_P2_MINS, 2).coerceAtLeast(1)
                p1Bpm   = intent.getIntExtra(EXTRA_P1_BPM, 75).coerceAtLeast(1)
                p2Bpm   = intent.getIntExtra(EXTRA_P2_BPM, 66).coerceAtLeast(1)
                phase1Ms = p1Mins * 60_000L
                phase2Ms = p2Mins * 60_000L
                cycleMs  = phase1Ms + phase2Ms
                beat1    = (60_000.0 / p1Bpm).toLong()
                beat2    = (60_000.0 / p2Bpm).toLong()
                mode = "trainer"; sessionStart = System.currentTimeMillis(); lastPhase = 0
                startFg("Trainer · Phase 1 · ${p1Bpm}/min")
                restartTick()
            }
            ACTION_STOP -> {
                handler.removeCallbacks(tickRunnable)
                vibrator.cancel()
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
                broadcast(running = false)
            }
        }
        return START_NOT_STICKY
    }

    private fun restartTick() {
        handler.removeCallbacks(tickRunnable)
        handler.post(tickRunnable)
    }

    private fun tick() {
        when (mode) {
            "custom" -> broadcast(running = true, mode = "custom")
            "trainer" -> {
                if (sessionStart == 0L) return
                val elapsed    = System.currentTimeMillis() - sessionStart
                val posInCycle = elapsed % cycleMs
                val phase      = if (posInCycle < phase1Ms) 1 else 2
                val remaining  = if (phase == 1) phase1Ms - posInCycle else cycleMs - posInCycle
                val cycle      = (elapsed / cycleMs + 1).toInt()

                if (phase != lastPhase) {
                    lastPhase = phase
                    vibratePhase(phase)
                    val bpm = if (phase == 1) p1Bpm else p2Bpm
                    updateNotification("Trainer · Phase $phase · ${bpm}/min")
                }

                broadcast(running = true, mode = "trainer", phase = phase, remaining = remaining, cycle = cycle)
            }
        }
    }

    private fun vibrateCustom() {
        val pause = (customInterval - customDuration).coerceAtLeast(50L)
        vibrate(longArrayOf(0L, customDuration, pause))
    }

    private fun vibratePhase(phase: Int) {
        val beat = if (phase == 1) beat1 else beat2
        vibrate(longArrayOf(0L, VIB_MS, (beat - VIB_MS).coerceAtLeast(50L)))
    }

    private fun vibrate(pattern: LongArray) {
        vibrator.vibrate(VibrationEffect.createWaveform(pattern, 0))
    }

    private fun broadcast(
        running: Boolean, mode: String = this.mode,
        phase: Int = 1, remaining: Long = 0L, cycle: Int = 1
    ) {
        LocalBroadcastManager.getInstance(this).sendBroadcast(
            Intent(BROADCAST_STATE).apply {
                putExtra(EXTRA_RUNNING, running)
                putExtra(EXTRA_MODE, mode)
                putExtra(EXTRA_PHASE, phase)
                putExtra(EXTRA_REMAINING, remaining)
                putExtra(EXTRA_CYCLE, cycle)
                putExtra(EXTRA_P1_BPM_OUT, p1Bpm)
                putExtra(EXTRA_P2_BPM_OUT, p2Bpm)
            }
        )
    }

    private fun createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val ch = NotificationChannel(CHANNEL_ID, "Vibro Timer", NotificationManager.IMPORTANCE_LOW)
            getSystemService(NotificationManager::class.java).createNotificationChannel(ch)
        }
    }

    private fun buildNotification(text: String): Notification =
        NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Vibro Timer")
            .setContentText(text)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()

    private fun startFg(text: String) = startForeground(NOTIF_ID, buildNotification(text))

    private fun updateNotification(text: String) {
        getSystemService(NotificationManager::class.java).notify(NOTIF_ID, buildNotification(text))
    }

    override fun onBind(intent: Intent?) = null

    override fun onDestroy() {
        handler.removeCallbacks(tickRunnable)
        vibrator.cancel()
        super.onDestroy()
    }
}
