/* Monopoly Deal Timer – deutscher Countdown + Gong
   - Default 30s
   - Letzte 10s: Sprachausgabe auf Deutsch
   - PWA: Install-Button via beforeinstallprompt
*/

(() => {
  const elInput = document.getElementById('secondsInput');
  const elDisplay = document.getElementById('display');
  const elStart = document.getElementById('startButton');
  const elInstall = document.getElementById('installButton');

  let timerId = null;
  let remaining = 30;
  let lastSpoken = null;
  let deferredPrompt = null;

  // Lade Default aus localStorage (falls vorhanden), sonst 30
  const saved = parseInt(localStorage.getItem('mdt_seconds'), 10);
  if (!Number.isNaN(saved) && saved > 0) {
    elInput.value = String(saved);
    elDisplay.textContent = String(saved);
  } else {
    elInput.value = '30';
    elDisplay.textContent = '30';
  }

  // UI: beim Ändern Sekunden sofort anzeigen & speichern
  elInput.addEventListener('change', () => {
    const v = toSeconds(elInput.value);
    elInput.value = String(v);
    elDisplay.textContent = String(v);
    localStorage.setItem('mdt_seconds', String(v));
  });

  // Start/Reset
  elStart.addEventListener('click', () => {
    startFrom(elInput.value);
  });

  function startFrom(value){
    clear();
    remaining = toSeconds(value);
    lastSpoken = null;
    localStorage.setItem('mdt_seconds', String(remaining));
    updateDisplay();
    tick(); // sofort anzeigen/sprechen falls nötig
    timerId = setInterval(tick, 1000);
  }

  function tick(){
    // Anzeige zuerst (z. B. 30 -> 29 nach 1s)
    updateDisplay();

    // Sprachausgabe für letzte 10 Sekunden (10..1)
    if (remaining <= 10 && remaining > 0 && lastSpoken !== remaining) {
      speakNumberDE(remaining);
      lastSpoken = remaining;
    }

    if (remaining <= 0) {
      clear();
      playGong();
      try { navigator.vibrate && navigator.vibrate([120,80,120]); } catch {}
      return;
    }

    remaining -= 1;
  }

  function updateDisplay(){
    elDisplay.textContent = String(Math.max(0, remaining));
  }

  function clear(){
    if (timerId) { clearInterval(timerId); timerId = null; }
    // Eventuelle TTS stoppen
    try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch {}
  }

  function toSeconds(v){
    const n = parseInt(v, 10);
    return Number.isFinite(n) && n > 0 ? n : 30;
  }

  // ====== Sprachausgabe (Deutsch) ======
  function speakNumberDE(n){
    if (!('speechSynthesis' in window)) return; // kein TTS verfügbar
    const utter = new SpeechSynthesisUtterance(String(n)); // "10", "9", ...
    // CH-Deutsch bevorzugen, sonst DE/AT, dann Fallback
    const prefer = ['de-CH','de-CH','de-DE','de-AT'];
    const voices = speechSynthesis.getVoices();
    const found = voices.find(v => prefer.includes(v.lang));
    if (found) utter.voice = found;
    utter.lang = found?.lang || 'de-DE';
    utter.rate = 1; // normale Geschwindigkeit
    try { speechSynthesis.speak(utter); } catch {}
  }

  // ====== Gong (WebAudio) ======
  function playGong(){
    try{
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const now = ctx.currentTime;

      // Grundton + Obertöne (kleiner "gongiger" Effekt)
      const tones = [
        {freq: 220, gain: 0.6, decay: 1.2},
        {freq: 440, gain: 0.25, decay: 1.0},
        {freq: 660, gain: 0.18, decay: 0.9},
      ];
      tones.forEach(t => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = t.freq;
        gain.gain.setValueAtTime(t.gain, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + t.decay);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + t.decay + 0.05);
      });
    }catch(e){}
  }

  // ====== Installations-Flow (Android/Chromium) ======
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    elInstall.hidden = false;
  });
  elInstall.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    elInstall.disabled = true;
    try{
      await deferredPrompt.prompt();
      await deferredPrompt.userChoice;
    } finally {
      deferredPrompt = null;
      elInstall.hidden = true;
      elInstall.disabled = false;
    }
  });

})();
