// /app.js
// Einfacher Countdown: Eingabe in Sekunden, grosser Start-Button setzt & startet neu.

(() => {
  const input = document.getElementById('secondsInput');   // Sekunden-Eingabe
  const display = document.getElementById('timer');         // mm:ss Anzeige
  const statusEl = document.getElementById('status');       // Statuszeile
  const startBtn = document.getElementById('startBtn');     // grosser Start-Button

  let tick = null;      // setInterval Handle
  let endAt = 0;        // Zeitpunkt (ms) wann der Timer endet

  // Letzte Auswahl laden
  const saved = Number(localStorage.getItem('md.seconds')) || Number(input.value) || 30;
  input.value = Math.max(1, Math.min(3600, saved));
  renderStatic(Number(input.value));

  // Utility: mm:ss formatieren
  function fmt(msLeft){
    const total = Math.max(0, Math.ceil(msLeft/1000));
    const m = Math.floor(total/60);
    const s = total % 60;
    return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  }

  // Anzeige ohne Lauf aktualisieren (z. B. beim Ändern der Eingabe)
  function renderStatic(sec){
    display.textContent = fmt(sec*1000);
    statusEl.textContent = 'Bereit';
  }

  // Haupt-Update-Schleife (100 ms), Zeitdrift-fest über endAt
  function loop(){
    const left = endAt - Date.now();
    display.textContent = fmt(left);
    if (left <= 0){
      stopLoop();
      display.textContent = fmt(0);
      statusEl.textContent = 'Fertig!';
      // Haptik als Feedback (wo unterstützt)
      try { navigator.vibrate && navigator.vibrate([200,100,200]); } catch(e){}
    }
  }

  function stopLoop(){
    if (tick){ clearInterval(tick); tick = null; }
  }

  // Start = immer neu setzen & direkt loslaufen
  function start(){
    const sec = Math.max(1, Math.min(3600, Number(input.value) || 0));
    input.value = sec;                             // Eingabe normalisieren
    localStorage.setItem('md.seconds', String(sec));
    endAt = Date.now() + sec*1000;
    statusEl.textContent = 'Läuft…';
    loop();
    stopLoop();
    tick = setInterval(loop, 100);                 // 10 Hz für flüssige Anzeige
  }

  // Enter in der Eingabe startet sofort
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') start();
  });

  // Beim Ändern der Sekunden nur Anzeige aktualisieren
  input.addEventListener('change', () => {
    const sec = Math.max(1, Math.min(3600, Number(input.value) || 0));
    renderStatic(sec);
    localStorage.setItem('md.seconds', String(sec));
  });

  // Grosser roter Button
  startBtn.addEventListener('click', start);

  // (Optional) Service Worker registrieren, falls vorhanden
  if ('serviceWorker' in navigator){
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
})();