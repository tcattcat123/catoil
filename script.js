/* ==========================================================================
   VITALIY PETROV — MACINTOSH SYSTEM 7 ENGINE & SOUND SYSTEM
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {

  /* --------------------------------------------------------------------------
     1. Web Audio API Vintage Mac Sound Effects Engine
     -------------------------------------------------------------------------- */
  let soundEnabled = true;
  let audioCtx = null;

  function initAudio() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        audioCtx = new AudioContext();
      }
    }
  }

  function playMacSound(type = 'click') {
    if (!soundEnabled) return;
    try {
      initAudio();
      if (!audioCtx) return;
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
      
      const now = audioCtx.currentTime;

      if (type === 'click') {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(200, now + 0.04);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(now + 0.04);
      } else if (type === 'chime') {
        // Mac Startup Chime chord
        const freqs = [261.63, 329.63, 392.00, 523.25]; // C E G C
        freqs.forEach(f => {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(f, now);
          gain.gain.setValueAtTime(0.08, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.start();
          osc.stop(now + 0.4);
        });
      } else if (type === 'error') {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, now);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(now + 0.15);
      }
    } catch (e) {
      // Sound fallback
    }
  }

  // Bezel Controls
  const btnToggleSound = document.getElementById('btnToggleSound');
  if (btnToggleSound) {
    btnToggleSound.addEventListener('click', () => {
      soundEnabled = !soundEnabled;
      btnToggleSound.textContent = soundEnabled ? '🔊 Sound' : '🔇 Muted';
      if (soundEnabled) playMacSound('chime');
    });
  }

  const btnToggleCrtScreen = document.getElementById('btnToggleCrtScreen');
  if (btnToggleCrtScreen) {
    btnToggleCrtScreen.addEventListener('click', () => {
      document.body.classList.toggle('no-crt');
      playMacSound('click');
    });
  }

  // Play click on all interactive mac elements
  document.querySelectorAll('.mac-btn, .mac-menu-item, .mac-desktop-icon, .go-away-box, .zoom-box, .dropdown-item').forEach(el => {
    el.addEventListener('click', () => playMacSound('click'));
  });

  /* --------------------------------------------------------------------------
     2. Live Mac Clock
     -------------------------------------------------------------------------- */
  const macClock = document.getElementById('macClock');
  function updateMacClock() {
    if (!macClock) return;
    const now = new Date();
    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    macClock.textContent = `${hours}:${minutes} ${ampm}`;
  }
  updateMacClock();
  setInterval(updateMacClock, 1000);

  /* --------------------------------------------------------------------------
     3. Top Menu Dropdowns
     -------------------------------------------------------------------------- */
  const menuItems = document.querySelectorAll('.mac-menu-item');
  menuItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      const isActive = item.classList.contains('active');
      menuItems.forEach(m => m.classList.remove('active'));
      if (!isActive) {
        item.classList.add('active');
      }
    });
  });

  document.addEventListener('click', () => {
    menuItems.forEach(m => m.classList.remove('active'));
  });

  /* --------------------------------------------------------------------------
     4. Tag Filtering (ALL, PRODUCT, GROWTH, ANALYTICS, SMM)
     -------------------------------------------------------------------------- */
  const tagBtns = document.querySelectorAll('.tag-btn');
  const timelineItems = document.querySelectorAll('.timeline-item');

  tagBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tagBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const filter = btn.getAttribute('data-filter');

      timelineItems.forEach(item => {
        const cat = item.getAttribute('data-category') || '';
        if (filter === 'all' || cat.includes(filter)) {
          item.style.display = 'grid';
        } else {
          item.style.display = 'none';
        }
      });
    });
  });

  /* --------------------------------------------------------------------------
     5. Modals & Desktop Icon Actions
     -------------------------------------------------------------------------- */
  const modalContact = document.getElementById('modalContact');
  const modalCalc = document.getElementById('modalCalc');
  const modalTerm = document.getElementById('modalTerm');

  function openModal(modal) {
    if (!modal) return;
    modal.classList.remove('hidden');
    playMacSound('chime');
  }

  function closeModal(modal) {
    if (!modal) return;
    modal.classList.add('hidden');
    playMacSound('click');
  }

  document.querySelectorAll('.modal-close-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const modal = e.target.closest('.modal-window');
      closeModal(modal);
    });
  });

  // Desktop Icons
  document.getElementById('iconResume')?.addEventListener('click', () => window.print());
  document.getElementById('iconCalc')?.addEventListener('click', () => openModal(modalCalc));
  document.getElementById('iconTerminal')?.addEventListener('click', () => openModal(modalTerm));
  document.getElementById('iconTrash')?.addEventListener('click', () => {
    playMacSound('error');
    alert('Trash is empty.');
  });

  // Window Triggers
  document.getElementById('btnContactMac')?.addEventListener('click', () => openModal(modalContact));
  document.getElementById('btnCalcMac')?.addEventListener('click', () => openModal(modalCalc));

  // Menu Dropdown Actions
  document.getElementById('menuAboutMac')?.addEventListener('click', () => alert('Vitaliy Petrov — Product Builder & Growth Lead\nSystem 7 Edition'));
  document.getElementById('menuContactMac')?.addEventListener('click', () => openModal(modalContact));
  document.getElementById('menuCalcMac')?.addEventListener('click', () => openModal(modalCalc));
  document.getElementById('menuTermMac')?.addEventListener('click', () => openModal(modalTerm));
  document.getElementById('menuPrintMac')?.addEventListener('click', () => window.print());

  const goAwayBox = document.getElementById('goAwayBox');
  if (goAwayBox) {
    goAwayBox.addEventListener('click', () => {
      const mainWin = document.getElementById('mainMacWindow');
      if (mainWin) {
        mainWin.style.display = mainWin.style.display === 'none' ? 'flex' : 'none';
      }
    });
  }

  // Contact Form
  const macContactForm = document.getElementById('macContactForm');
  if (macContactForm) {
    macContactForm.addEventListener('submit', (e) => {
      e.preventDefault();
      playMacSound('chime');
      alert('Спасибо! Сообщение отправлено Виталию Петрову.');
      macContactForm.reset();
      closeModal(modalContact);
    });
  }

  /* --------------------------------------------------------------------------
     6. Calculator Logic
     -------------------------------------------------------------------------- */
  const cpcIn = document.getElementById('cpc');
  const crIn = document.getElementById('cr');
  const arpuIn = document.getElementById('arpu');
  const cogsIn = document.getElementById('cogs');

  const macCac = document.getElementById('macCac');
  const macMargin = document.getElementById('macMargin');
  const macProfit = document.getElementById('macProfit');
  const macRoi = document.getElementById('macRoi');

  function calculateMacUnits() {
    if (!cpcIn || !crIn || !arpuIn || !cogsIn) return;
    const cpc = parseFloat(cpcIn.value) || 0;
    const cr = (parseFloat(crIn.value) || 0) / 100;
    const arpu = parseFloat(arpuIn.value) || 0;
    const cogs = parseFloat(cogsIn.value) || 0;

    const cac = cr > 0 ? cpc / cr : 0;
    const margin = arpu - cogs;
    const profit = margin - cac;
    const roi = cac > 0 ? (margin / cac) * 100 : 0;

    macCac.textContent = `${Math.round(cac).toLocaleString('ru-RU')} ₽`;
    macMargin.textContent = `${Math.round(margin).toLocaleString('ru-RU')} ₽`;
    macProfit.textContent = `${profit >= 0 ? '+' : ''}${Math.round(profit).toLocaleString('ru-RU')} ₽`;
    macRoi.textContent = `${roi.toFixed(1)}%`;
  }

  [cpcIn, crIn, arpuIn, cogsIn].forEach(input => {
    if (input) input.addEventListener('input', calculateMacUnits);
  });
  calculateMacUnits();

  /* --------------------------------------------------------------------------
     7. Macintosh Terminal Engine
     -------------------------------------------------------------------------- */
  const macTermInput = document.getElementById('macTermInput');
  const macTermLogs = document.getElementById('macTermLogs');

  function printMacTerm(text, isInput = false) {
    if (!macTermLogs) return;
    const p = document.createElement('p');
    if (isInput) {
      p.innerHTML = `mac:~ $ ${text}`;
    } else {
      p.innerHTML = text;
    }
    macTermLogs.appendChild(p);
    macTermLogs.scrollTop = macTermLogs.scrollHeight;
  }

  if (macTermInput) {
    macTermInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const cmd = macTermInput.value.trim().toLowerCase();
        macTermInput.value = '';
        if (!cmd) return;

        printMacTerm(cmd, true);
        playMacSound('click');

        switch (cmd) {
          case 'help':
            printMacTerm('Команды: <span class="term-cmd">skills</span>, <span class="term-cmd">timeline</span>, <span class="term-cmd">contact</span>, <span class="term-cmd">calc</span>, <span class="term-cmd">clear</span>');
            break;
          case 'skills':
            printMacTerm('Навыки: Product Growth, SMM, Unit-Economics, Lean Startup, SEO.');
            break;
          case 'timeline':
            printMacTerm('2017: AccordDigital | 2018: Агрегатор | 2018-2024: Фриланс биржа | 2020-2024: SMM-инструмент | 2025: Фитнес-трекер');
            break;
          case 'contact':
            printMacTerm('Telegram: @yofox');
            openModal(modalContact);
            break;
          case 'calc':
            openModal(modalCalc);
            break;
          case 'clear':
            macTermLogs.innerHTML = '';
            break;
          default:
            printMacTerm(`Неизвестная команда "${cmd}". Используйте <span class="term-cmd">help</span>`);
            break;
        }
      }
    });
  }

});
