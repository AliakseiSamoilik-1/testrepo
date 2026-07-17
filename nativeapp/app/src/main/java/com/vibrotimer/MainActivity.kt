package com.vibrotimer

import android.Manifest
import android.content.*
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.view.View
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.localbroadcastmanager.content.LocalBroadcastManager

class MainActivity : AppCompatActivity() {

    // Custom tab
    private lateinit var etDuration: EditText
    private lateinit var etBpm: EditText
    private lateinit var btnCustomToggle: Button
    private lateinit var tvCustomStatus: TextView

    // Trainer tab — config inputs
    private lateinit var etP1Mins: EditText
    private lateinit var etP1Bpm: EditText
    private lateinit var etP2Mins: EditText
    private lateinit var etP2Bpm: EditText
    private val trainerInputs get() = listOf(etP1Mins, etP1Bpm, etP2Mins, etP2Bpm)

    // Trainer tab — display
    private lateinit var tvPhaseName: TextView
    private lateinit var tvPhaseTimer: TextView
    private lateinit var tvCycleNum: TextView
    private lateinit var progressBar: ProgressBar
    private lateinit var btnTrainerToggle: Button
    private lateinit var tvTrainerStatus: TextView

    // Tab layouts
    private lateinit var layoutCustom: View
    private lateinit var layoutTrainer: View
    private lateinit var btnTabCustom: Button
    private lateinit var btnTabTrainer: Button

    private var isRunning = false
    private var currentMode = "custom"

    // Phase durations stored for progress calculation
    private var phase1Ms = 3 * 60 * 1000L
    private var phase2Ms = 2 * 60 * 1000L

    private val stateReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            val running   = intent.getBooleanExtra(VibrationService.EXTRA_RUNNING, false)
            val mode      = intent.getStringExtra(VibrationService.EXTRA_MODE) ?: "custom"
            val phase     = intent.getIntExtra(VibrationService.EXTRA_PHASE, 1)
            val remaining = intent.getLongExtra(VibrationService.EXTRA_REMAINING, 0L)
            val cycle     = intent.getIntExtra(VibrationService.EXTRA_CYCLE, 1)
            val p1Bpm     = intent.getIntExtra(VibrationService.EXTRA_P1_BPM_OUT, 75)
            val p2Bpm     = intent.getIntExtra(VibrationService.EXTRA_P2_BPM_OUT, 66)

            isRunning = running
            currentMode = mode

            when {
                mode == "custom" -> updateCustomUI(running)
                mode == "trainer" && running -> updateTrainerRunning(phase, remaining, cycle, p1Bpm, p2Bpm)
                else -> {
                    updateCustomUI(false)
                    updateTrainerStopped()
                }
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        bindViews()
        setupTabs()
        setupCustomTab()
        setupTrainerTab()
        requestNotifPermission()
    }

    override fun onResume() {
        super.onResume()
        LocalBroadcastManager.getInstance(this)
            .registerReceiver(stateReceiver, IntentFilter(VibrationService.BROADCAST_STATE))
    }

    override fun onPause() {
        super.onPause()
        LocalBroadcastManager.getInstance(this).unregisterReceiver(stateReceiver)
    }

    private fun bindViews() {
        etDuration = findViewById(R.id.etDuration)
        etBpm      = findViewById(R.id.etBpm)
        btnCustomToggle = findViewById(R.id.btnCustomToggle)
        tvCustomStatus  = findViewById(R.id.tvCustomStatus)

        etP1Mins = findViewById(R.id.etP1Mins)
        etP1Bpm  = findViewById(R.id.etP1Bpm)
        etP2Mins = findViewById(R.id.etP2Mins)
        etP2Bpm  = findViewById(R.id.etP2Bpm)

        tvPhaseName      = findViewById(R.id.tvPhaseName)
        tvPhaseTimer     = findViewById(R.id.tvPhaseTimer)
        tvCycleNum       = findViewById(R.id.tvCycleNum)
        progressBar      = findViewById(R.id.progressBar)
        btnTrainerToggle = findViewById(R.id.btnTrainerToggle)
        tvTrainerStatus  = findViewById(R.id.tvTrainerStatus)

        layoutCustom  = findViewById(R.id.layoutCustom)
        layoutTrainer = findViewById(R.id.layoutTrainer)
        btnTabCustom  = findViewById(R.id.btnTabCustom)
        btnTabTrainer = findViewById(R.id.btnTabTrainer)
    }

    private fun setupTabs() {
        btnTabCustom.setOnClickListener  { switchTab("custom") }
        btnTabTrainer.setOnClickListener { switchTab("trainer") }
        switchTab("custom")
    }

    private fun switchTab(tab: String) {
        layoutCustom.visibility  = if (tab == "custom")  View.VISIBLE else View.GONE
        layoutTrainer.visibility = if (tab == "trainer") View.VISIBLE else View.GONE
        btnTabCustom.alpha  = if (tab == "custom")  1f else 0.45f
        btnTabTrainer.alpha = if (tab == "trainer") 1f else 0.45f
    }

    private fun setupCustomTab() {
        btnCustomToggle.setOnClickListener {
            if (isRunning && currentMode == "custom") {
                sendAction(VibrationService.ACTION_STOP)
            } else {
                val d = etDuration.text.toString().toLongOrNull()?.coerceAtLeast(50L) ?: 500L
                val bpm = etBpm.text.toString().toLongOrNull()?.coerceAtLeast(1L) ?: 30L
                val i = (60_000L / bpm).coerceAtLeast(d + 50L)
                startForegroundService(Intent(this, VibrationService::class.java).apply {
                    action = VibrationService.ACTION_START_CUSTOM
                    putExtra(VibrationService.EXTRA_DURATION, d)
                    putExtra(VibrationService.EXTRA_INTERVAL, i)
                })
            }
        }

        findViewById<Button>(R.id.btnTest).setOnClickListener {
            val d = etDuration.text.toString().toLongOrNull()?.coerceAtLeast(50L) ?: 500L
            startForegroundService(Intent(this, VibrationService::class.java).apply {
                action = VibrationService.ACTION_START_CUSTOM
                putExtra(VibrationService.EXTRA_DURATION, d)
                putExtra(VibrationService.EXTRA_INTERVAL, d + 100L)
            })
            layoutCustom.postDelayed({ if (!isRunning) sendAction(VibrationService.ACTION_STOP) }, d + 200)
        }
    }

    private fun setupTrainerTab() {
        updateTrainerStatusText()
        listOf(etP1Mins, etP1Bpm, etP2Mins, etP2Bpm).forEach { et ->
            et.setOnFocusChangeListener { _, _ -> updateTrainerStatusText() }
        }

        btnTrainerToggle.setOnClickListener {
            if (isRunning && currentMode == "trainer") {
                sendAction(VibrationService.ACTION_STOP)
            } else {
                val p1Mins = etP1Mins.text.toString().toIntOrNull()?.coerceAtLeast(1) ?: 3
                val p1Bpm  = etP1Bpm.text.toString().toIntOrNull()?.coerceAtLeast(1)  ?: 75
                val p2Mins = etP2Mins.text.toString().toIntOrNull()?.coerceAtLeast(1) ?: 2
                val p2Bpm  = etP2Bpm.text.toString().toIntOrNull()?.coerceAtLeast(1)  ?: 66
                phase1Ms = p1Mins * 60_000L
                phase2Ms = p2Mins * 60_000L
                trainerInputs.forEach { it.isEnabled = false }
                startForegroundService(Intent(this, VibrationService::class.java).apply {
                    action = VibrationService.ACTION_START_TRAINER
                    putExtra(VibrationService.EXTRA_P1_MINS, p1Mins)
                    putExtra(VibrationService.EXTRA_P1_BPM,  p1Bpm)
                    putExtra(VibrationService.EXTRA_P2_MINS, p2Mins)
                    putExtra(VibrationService.EXTRA_P2_BPM,  p2Bpm)
                })
            }
        }
    }

    private fun updateTrainerStatusText() {
        val m1 = etP1Mins.text.toString().toIntOrNull() ?: 3
        val b1 = etP1Bpm.text.toString().toIntOrNull()  ?: 75
        val m2 = etP2Mins.text.toString().toIntOrNull() ?: 2
        val b2 = etP2Bpm.text.toString().toIntOrNull()  ?: 66
        tvTrainerStatus.text = "Stopped · $m1 min @$b1/min → $m2 min @$b2/min"
    }

    private fun updateCustomUI(running: Boolean) {
        btnCustomToggle.text = if (running) "Stop" else "Start"
        setToggleColor(btnCustomToggle, running)
        tvCustomStatus.text = if (running) "Running…" else "Stopped"
    }

    private fun updateTrainerRunning(phase: Int, remaining: Long, cycle: Int, p1Bpm: Int, p2Bpm: Int) {
        btnTrainerToggle.text = "Stop"
        setToggleColor(btnTrainerToggle, true)
        tvTrainerStatus.text = "Running…"

        val bpm   = if (phase == 1) p1Bpm else p2Bpm
        val mins  = remaining / 60000
        val secs  = (remaining % 60000) / 1000
        val total = if (phase == 1) phase1Ms else phase2Ms

        tvPhaseName.text  = "Phase $phase · $bpm/min"
        tvPhaseTimer.text = "%d:%02d".format(mins, secs)
        tvCycleNum.text   = "Cycle $cycle"
        progressBar.progress = ((total - remaining) * 100 / total).toInt().coerceIn(0, 100)
    }

    private fun updateTrainerStopped() {
        btnTrainerToggle.text = "Start"
        setToggleColor(btnTrainerToggle, false)
        trainerInputs.forEach { it.isEnabled = true }
        updateTrainerStatusText()
        tvPhaseName.text  = "—"
        tvPhaseTimer.text = "—:——"
        tvCycleNum.text   = ""
        progressBar.progress = 0
    }

    private fun setToggleColor(btn: Button, running: Boolean) {
        btn.backgroundTintList = ContextCompat.getColorStateList(
            this, if (running) android.R.color.holo_red_dark else android.R.color.holo_green_dark
        )
    }

    private fun sendAction(action: String) {
        startService(Intent(this, VibrationService::class.java).apply { this.action = action })
    }

    private fun requestNotifPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.POST_NOTIFICATIONS), 0)
        }
    }
}
