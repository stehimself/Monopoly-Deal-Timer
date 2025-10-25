// /app.js
// Basierend auf deiner bisherigen HTML-Datei, in eine externe JS-Datei verschoben,
// damit der Service Worker sauber cachen kann. (Originallogik uebernommen)  

// ===================== Zustand =====================
let running = false;          // laeuft der Timer?
let paused = false;           // ist der Timer pausiert?
let rafId = null;             // requestAnimationFrame ID
let endTime = 0;              // Zielzeitpunkt in ms
let lastWhole = null;         // Letzter gesprochener ganzzahliger Wert
let warmedUpTTS = false;      // TTS vorgewarmt?
let deVoice = null;           // ausgewaehlte deutsche Stimme

const timerEl = document.getElementById('timer');   // Anzeige: Sekunden
const statusEl = document.getElementById('status'); // Anzeige: Status

// Aktuell gewaehlte Sekunden auslesen
function getSelectedSeconds(){
  const active = document.querySelector('.opt[aria-checked="true"]');
  return Number(active?.dataset.seconds || 45);
}

// Deutsche Stimme waehlen
function pickGermanVoice(){
  const voices = speechSynthesis.getVoices();
  deVoice = voices.find(v => /de(-|_)?(CH|DE|AT)/i.test(v.lang)) || voices.find(v=>/de/i.test(v.lang)) || null;
}

// TTS vorwaermen (Workaround gegen Verzoegerung)
function warmupTTS(){
  if (warmedUpTTS) return;
  pickGermanVoice();
  const u = new SpeechSynthesisUtterance('.');
  u.volume = 0;
  if (deVoice) u.voice = deVoice;
  speechSynthesis.speak(u);
  warmedUpTTS = true;
}

// Zahl ansagen
function speakNow(text){
  try { speechSynthesis.cancel(); } catch(e){}
  const u = new SpeechSynthesisUtterance(String(text));
  if (deVoice) u.voice = deVoice;
  u.lang = (deVoice?.lang) || 'de-DE';
  u.rate = 1.0;
  u.pitch = 1.0;
  u.volume = 1.0;
  speechSynthesis.speak(u);
}

// Kleiner Dreiklang-Gong als Abschluss
let audioCtx;
function playTriGong(){
  return new Promise(resolve => {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const hit = (frequency, delayMs) => {
      const t0 = audioCtx.currentTime + (delayMs/1000);
      const osc = audioCtx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(frequency, t0);
      const gain = audioCtx.createGain();
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.6, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.2);

      const osc2 = audioCtx.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(frequency*2.01, t0);
      const gain2 = audioCtx.createGain();
      gain2.gain.setValueAtTime(0.0001, t0);
      gain2.gain.exponentialRampToValueAtTime(0.15, t0 + 0.02);
      gain2.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.0);

      osc.connect(gain).connect(audioCtx.destination);
      osc2.connect(gain2).connect(audioCtx.destination);
      osc.start(t0); osc.stop(t0 + 1.3);
      osc2.start(t0); osc2.stop(t0 + 1.1);
    };
    hit(660,   0);
    hit(784, 250);
    hit(988, 500);
    setTimeout(resolve, 1600);
  });
}

// Countdown starten
function startCountdown(sec){
  warmupTTS();                        // TTS frueh starten, damit synchron
  running = true; paused = false; lastWhole = null;
  endTime = performance.now() + sec * 1000;
  statusEl.textContent = 'Laeuft';
  timerEl.textContent = sec;

  const loop = () => {
    if (!running || paused) return;
    const now = performance.now();
    const remainingMs = Math.max(0, endTime - now);
    const remainingWhole = Math.ceil(remainingMs / 1000);

    // Jede Sekunde aktualisieren & ansagen (10..1)
    if (remainingWhole !== lastWhole){
      timerEl.textContent = remainingWhole;             // Anzeige sekundenaktuell
      if (remainingWhole <= 10 && remainingWhole > 0){
        speakNow(remainingWhole);                       // synchron zur Anzeige
      }
      lastWhole = remainingWhole;
    }

    // Ende erreicht -> Gong und naechster Durchlauf mit gleicher Dauer
    if (remainingMs <= 0){
      running = false;
      timerEl.textContent = '0';
      statusEl.textContent = 'Gong…';
      playTriGong().then(() => {
        if (!paused){
          startCountdown(getSelectedSeconds());         // gleiche Auswahl erneut
        }
      });
      return;
    }
    rafId = requestAnimationFrame(loop);
  };
  cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(loop);
}

// Auswahl-Buttons (30/45/60)
for (const btn of document.querySelectorAll('.opt')){
  btn.addEventListener('click', () => {
    for (const b of document.querySelectorAll('.opt')) b.setAttribute('aria-checked','false');
    btn.setAttribute('aria-checked','true');
    if (!running){
      timerEl.textContent = Number(btn.dataset.seconds);
      statusEl.textContent = 'Bereit';
    }
  });
}

// Start/Pause/Reset/Stop
document.getElementById('startBtn').addEventListener('click', () => {
  startCountdown(getSelectedSeconds());
});

document.getElementById('pauseBtn').addEventListener('click', () => {
  if (!running && !paused) return;
  if (!paused){
    paused = true; statusEl.textContent = 'Pausiert';
    cancelAnimationFrame(rafId);
    try{ speechSynthesis.cancel(); }catch(e){}
  } else {
    const remain = Math.max(0, Number(timerEl.textContent)||0);
    startCountdown(remain);
  }
});

document.getElementById('resetBtn').addEventListener('click', () => {
  running = false; paused = false; cancelAnimationFrame(rafId);
  try{ speechSynthesis.cancel(); }catch(e){}
  timerEl.textContent = getSelectedSeconds();
  statusEl.textContent = 'Bereit';
});

document.getElementById('stopBtn').addEventListener('click', () => {
  running = false; paused = false; cancelAnimationFrame(rafId);
  try{ speechSynthesis.cancel(); }catch(e){}
  statusEl.textContent = 'Gestoppt';
});

// Stimmenliste kann spaet geladen werden
if (typeof speechSynthesis !== 'undefined'){
  speechSynthesis.onvoiceschanged = pickGermanVoice;
}

// ===================== Service Worker registrieren =====================
// Registriert den Service Worker, damit die App offline faehig ist.
// Nutzt relativen Pfad, funktioniert auch in Unterordnern.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .catch(err => console.error('SW Registrierung fehlgeschlagen:', err));
  });
}