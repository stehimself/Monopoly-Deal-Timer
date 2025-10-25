// app.js
/* Einfacher Monopoly Deal Timer mit Sprachansage (letzte 10s) und Gong via WebAudio. */
(() => {
  const secondsInput = document.getElementById('secondsInput');
  const display = document.getElementById('display');
  const startButton = document.getElementById('startButton');
  const installBtn = document.getElementById('installBtn');

  let running = false;
  let targetMs = 0;
  let tickHandle = null;
  let lastWholeSec = null;
  let spokenSet = new Set();
  let beforeInstallPromptEvent = null;

  // Prefill von letztem Wert
  const last = parseInt(localStorage.getItem('mdt_seconds') || '45', 10);
  if (!Number.isNaN(last) && last > 0) {
    secondsInput.value = String(last);
    renderTime(last);
  } else {
    renderTime(45);
  }

  secondsInput.addEventListener('change', () => {
    const s = clampSeconds(parseInt(secondsInput.value, 10));
    secondsInput.value = String(s);
    localStorage.setItem('mdt_seconds', String(s));
    if (!running) renderTime(s);
  });

  startButton.addEventListener('click', () => {
    if (!running) {
      // Start
      const s = clampSeconds(parseInt(secondsInput.value, 10));
      secondsInput.value = String(s);
      localStorage.setItem('mdt_seconds', String(s));

      startCountdown(s);
      startButton.textContent = 'Reset';
      startButton.setAttribute('aria-pressed', 'true');
    } else {
      // Reset
      stopCountdown();
      const s = clampSeconds(parseInt(secondsInput.value, 10));
      renderTime(s);
      startButton.textContent = 'Start';
      startButton.removeAttribute('aria-pressed');
    }
  });

  // Installations-Flow (A2HS)
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    beforeInstallPromptEvent = e;
    installBtn.hidden = false;
  });

  installBtn.addEventListener('click', async () => {
    if (!beforeInstallPromptEvent) return;
    installBtn.disabled = true;
    try {
      await beforeInstallPromptEvent.prompt();
      await beforeInstallPromptEvent.userChoice;
    } catch {}
    installBtn.hidden = true;
    beforeInstallPromptEvent = null;
    installBtn.disabled = false;
  });

  function clampSeconds(n) {
    if (Number.isNaN(n)) return 45;
    return Math.min(3600, Math.max(1, n));
  }

  function renderTime(totalSeconds) {
    const mm = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const ss = Math.floor(totalSeconds % 60).toString().padStart(2, '0');
    display.textContent = `${mm}:${ss}`;
  }

  function startCountdown(seconds) {
    running = true;
    spokenSet.clear();
    lastWholeSec = null;
    targetMs = Date.now() + seconds * 1000;

    // Ein erster Render
    renderRemaining();

    // Genauigkeit verbessern: 100ms Ticks + Floor auf ganze Sekunde
    tickHandle = setInterval(renderRemaining, 100);
  }

  function stopCountdown() {
    running = false;
    if (tickHandle) clearInterval(tickHandle);
    tickHandle = null;
    spokenSet.clear();
    lastWholeSec = null;
  }

  function renderRemaining() {
    const now = Date.now();
    let remain = Math.max(0, Math.ceil((targetMs - now) / 1000)); // ceil damit 9.9s → 10
    if (remain !== lastWholeSec) {
      lastWholeSec = remain;
      renderTime(remain);

      // letzte 10 Sekunden sprechen
      if (remain > 0 && remain <= 10) {
        if (!spokenSet.has(remain)) {
          speakNumber(remain);
          spokenSet.add(remain);
        }
      }
    }

    if (now >= targetMs) {
      stopCountdown();
      renderTime(0);
      playGong(); // Gong abspielen
      startButton.textContent = 'Start';
      startButton.removeAttribute('aria-pressed');
    }
  }

  function speakNumber(n) {
    try {
      if (!('speechSynthesis' in window)) return;
      const u = new SpeechSynthesisUtterance(String(n));
      // Bevorzugte Stimme: de-CH → de-DE → default
      const pickVoice = () => {
        const list = window.speechSynthesis.getVoices();
        let v =
          list.find(v => /de-CH/i.test(v.lang)) ||
          list.find(v => /de-DE/i.test(v.lang)) ||
          list[0];
        return v || null;
      };

      const v = pickVoice();
      if (v) u.voice = v;
      u.lang = (v && v.lang) || 'de-CH';
      u.rate = 1.0; // normal
      u.pitch = 1.0;
      window.speechSynthesis.cancel(); // alte Ansagen stoppen
      window.speechSynthesis.speak(u);
    } catch {}
  }

  // Einfacher Gong via WebAudio (klingt gut genug & keine Asset-Datei nötig)
  function playGong() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const now = ctx.currentTime;

      // Grundton + Obertöne
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'sine';
      // Frequenzen leicht verstimmt für "Gong"-Charakter
      osc1.frequency.setValueAtTime(440, now);
      osc2.frequency.setValueAtTime(660, now);

      // Lautstärke-Hüllkurve (perkussiv)
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.6, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.8);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 2.0);
      osc2.stop(now + 2.0);
    } catch {}
  }
})();