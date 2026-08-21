/**
 * Digital Clock & 60-Minute Slot Progress Controller
 * وحدة القياس والتقويم - الساعة الرقمية ومؤشر الـ 60 دقيقة
 */

class MAEUClock {
  constructor(options = {}) {
    this.isSimulated = false;
    this.simulatedTime = null; // Date object when simulated
    this.onTick = options.onTick || null;
    this.onHourChange = options.onHourChange || null;
    this.lastCheckedHour = null;
    this.soundEnabled = true;

    // Elements
    this.timeEl = document.getElementById('clock-time');
    this.ampmEl = document.getElementById('clock-ampm');
    this.secEl = document.getElementById('clock-sec');
    this.dateArEl = document.getElementById('clock-date-ar');
    this.dateGregEl = document.getElementById('clock-date-greg');
    this.gaugeFillEl = document.getElementById('gauge-bar-fill');
    this.gaugePercentEl = document.getElementById('gauge-percent');
    this.gaugeElapsedEl = document.getElementById('gauge-elapsed');
    this.gaugeRemainingEl = document.getElementById('gauge-remaining');

    this.arabicDays = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    this.arabicMonths = [
      'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
      'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
    ];

    this.initAudio();
    this.start();
  }

  initAudio() {
    // Gentle Web Audio API synthesizer for offline chime alerts
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.audioCtx = new AudioContext();
      }
    } catch (e) {
      console.log('Web Audio not supported:', e);
    }
  }

  playChime(type = 'slot_start') {
    if (!this.soundEnabled) return;
    const nowTime = Date.now();
    if (this._lastChimeTime && nowTime - this._lastChimeTime < 500) {
      return; // Cooldown: prevent firing more than once per half second
    }
    this._lastChimeTime = nowTime;

    if (!this.audioCtx) {
      this.initAudio();
    }
    if (!this.audioCtx) return;

    try {
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      const now = this.audioCtx.currentTime;
      if (type === 'slot_start') {
        // High crisp double harmonic chime
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, now); // D5
        osc.frequency.setValueAtTime(880.00, now + 0.12); // A5
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.75);
        osc.start(now);
        osc.stop(now + 0.75);
      } else if (type === 'warning') {
        // Gentle single reminder beep
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440.00, now);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        osc.start(now);
        osc.stop(now + 0.5);
      }
    } catch (e) {
      console.warn('Audio play error:', e);
    }
  }

  start() {
    this.update();
    this.timer = setInterval(() => this.update(), 1000);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
  }

  getCurrentTime() {
    if (this.isSimulated && this.simulatedTime) {
      return new Date(this.simulatedTime);
    }
    return new Date();
  }

  setSimulatedTime(dateObj) {
    this.isSimulated = true;
    this.simulatedTime = new Date(dateObj);
    this.update();
  }

  resetToLiveTime() {
    this.isSimulated = false;
    this.simulatedTime = null;
    this.update();
  }

  update() {
    const now = this.getCurrentTime();

    // 1. Digital Clock Formatting (Hours and Minutes only - no seconds)
    let rawHours = now.getHours();
    const minutes = now.getMinutes();
    const ampm = rawHours >= 12 ? 'م' : 'ص';
    const displayHours = rawHours % 12 || 12;

    const strHours = String(displayHours).padStart(2, '0');
    const strMinutes = String(minutes).padStart(2, '0');

    if (this.timeEl) {
      this.timeEl.innerHTML = `${strHours}<span class="clock-colon">:</span>${strMinutes}`;
    }
    if (this.ampmEl) this.ampmEl.textContent = ampm;

    // 2. Date Formatting
    const dayName = this.arabicDays[now.getDay()];
    const dayNumber = now.getDate();
    const monthName = this.arabicMonths[now.getMonth()];
    const year = now.getFullYear();

    if (this.dateArEl) {
      this.dateArEl.innerHTML = `<span class="clock-day-name">${dayName}</span>، ${dayNumber} ${monthName} ${year}`;
    }

    const isoDate = `${year}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`;
    if (this.dateGregEl) {
      this.dateGregEl.textContent = isoDate;
    }

    // 3. 60-Minute Slot Progress calculation (in minutes)
    const elapsedMinutes = minutes;
    const progressPercent = Math.min(100, Math.max(0, (elapsedMinutes / 60) * 100));
    const remainingMinutes = 60 - elapsedMinutes === 60 ? 60 : 60 - elapsedMinutes;

    if (this.gaugeFillEl) {
      this.gaugeFillEl.style.width = `${progressPercent.toFixed(1)}%`;
    }
    if (this.gaugePercentEl) {
      this.gaugePercentEl.textContent = `${Math.round(progressPercent)}%`;
    }
    if (this.gaugeElapsedEl) {
      this.gaugeElapsedEl.innerHTML = `<i data-lucide="clock-arrow-up"></i> مضى: ${elapsedMinutes} دقيقة`;
    }
    if (this.gaugeRemainingEl) {
      this.gaugeRemainingEl.innerHTML = `<i data-lucide="timer"></i> متبقي: ${remainingMinutes} دقيقة`;
    }

    // 4. Hour change trigger & warnings (ONLY in live natural time mode)
    const currentHour = now.getHours();
    if (!this.isSimulated && this.lastCheckedHour !== null && this.lastCheckedHour !== currentHour) {
      this.playChime('slot_start');
      if (this.onHourChange) {
        this.onHourChange(now);
      }
    }
    this.lastCheckedHour = currentHour;

    if (!this.isSimulated && elapsedMinutes === 55 && now.getSeconds() === 0) {
      this.playChime('warning');
    }

    if (this.onTick) {
      this.onTick(now, {
        hours: rawHours,
        minutes: minutes,
        isoDate: isoDate,
        dayName: dayName,
        progressPercent: progressPercent,
        remainingMinutes: remainingMinutes
      });
    }
  }
}

window.MAEUClock = MAEUClock;
