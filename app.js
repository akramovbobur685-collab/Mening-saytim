

// ===============================
// Bobur Akramov — app.js (clean)
// Modal + Memory Game (name + countdown + leaderboard)
// ===============================

document.addEventListener("DOMContentLoaded", () => {
  // -------- Year --------
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  // -------- Toast --------
  function showToast(text) {
    const t = document.getElementById("toast");
    const tt = document.getElementById("toastText");
    if (!t || !tt) return alert(text);
    tt.textContent = text;
    t.style.display = "block";
    clearTimeout(window.__to);
    window.__to = setTimeout(() => (t.style.display = "none"), 2400);
  }
  window.showToast = showToast; // kerak bo'lsa boshqa joydan chaqiriladi

  // ===============================
  // 1) MEMORY MODAL OPEN/CLOSE
  // ===============================
  const memBtn = document.getElementById("memToggle");
  const memModal = document.getElementById("memModal");
  const memOverlay = document.getElementById("memOverlay");
  const memClose = document.getElementById("memClose");

  if (!memBtn || !memModal) {
    console.log("memToggle yoki memModal topilmadi");
    return;
  }

  function openModal() {
    memModal.hidden = false;
    document.body.classList.add("modal-open");
    setTimeout(() => document.getElementById("memName")?.focus(), 50);

    // modal ochilganda o'yin init bo'lsin (1 marta)
    initMemoryGameOnce();
  }

  function closeModal() {
    memModal.hidden = true;
    document.body.classList.remove("modal-open");
  }

  memBtn.addEventListener("click", openModal);
  memOverlay?.addEventListener("click", closeModal);
  memClose?.addEventListener("click", closeModal);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !memModal.hidden) closeModal();
  });

  // ===============================
  // 2) MEMORY GAME (INIT ONCE)
  // ===============================
  let memInited = false;
  function initMemoryGameOnce() {
    if (memInited) return;
    memInited = true;
    initMemoryGame();
  }

  function initMemoryGame() {
    const grid = document.getElementById("memGrid");
    if (!grid) return;

    const elTime = document.getElementById("memTime");
    const elBest = document.getElementById("memBest");
    const selLevel = document.getElementById("memLevel");
    const btnStart = document.getElementById("memStart");
    const btnSound = document.getElementById("memSound");
    const btnClear = document.getElementById("memClear");
    const inpName = document.getElementById("memName");
    const elLB = document.getElementById("memLeaderboard");
    const elLevelLabel = document.getElementById("memLevelLabel");

    const LEVELS = {
      easy:   { cols: 3, pairs: 6,  limitSec: 120, label: "Oson (3×4)"  },
      medium: { cols: 4, pairs: 8,  limitSec: 240, label: "O‘rta (4×4)" },
      hard:   { cols: 5, pairs: 10, limitSec: 300, label: "Qiyin (5×4)" },
    };

    const EMOJIS = ["🍎","🍌","🍇","🍓","🍍","🥝","🍒","🥥","🍉","🍑","🍋","🍊","🍪","🍩","🍫","🍿","🐱","🐶","🦊","🐼","🐸","🐵","🦁","🐯"];

    // Storage keys
    const BEST_KEY = (level) => `mem_best_${level}_time_v4`;
    const LB_KEY = "mem_leaderboard_v4";

    // State
    let first = null;
    let lock = false;
    let doneCount = 0;

    let timer = null;
    let remaining = 0;
    let gameActive = false;

    let soundOn = true;
    let audioCtx = null;

    // Helpers
    const fmt = (sec) => {
      const m = Math.floor(sec / 60);
      const s = sec % 60;
      return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    };

    const shuffle = (arr) => {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const r = Math.floor(Math.random() * (i + 1));
        [a[i], a[r]] = [a[r], a[i]];
      }
      return a;
    };

    function setGridCols(level) {
      const cols = LEVELS[level].cols;
      grid.classList.remove("cols-3", "cols-4", "cols-5");
      grid.classList.add(`cols-${cols}`);
    }

    function setLevelLabel(level) {
      if (elLevelLabel) elLevelLabel.textContent = LEVELS[level].label;
    }

    function setBest(level) {
      if (!elBest) return;
      const v = localStorage.getItem(BEST_KEY(level));
      elBest.textContent = v ? fmt(Number(v)) : "—";
    }

    function saveBestIfNeeded(level, usedSec) {
      const prev = localStorage.getItem(BEST_KEY(level));
      if (!prev || usedSec < Number(prev)) {
        localStorage.setItem(BEST_KEY(level), String(usedSec));
        setBest(level);
        showToast("Yangi rekord! 🔥");
      }
    }

    function readLB() {
      try {
        const raw = localStorage.getItem(LB_KEY);
        return raw ? JSON.parse(raw) : [];
      } catch {
        return [];
      }
    }

    function writeLB(list) {
      localStorage.setItem(LB_KEY, JSON.stringify(list));
    }

    function updateLeaderboard(level) {
      if (!elLB) return;
      const list = readLB().filter((x) => x.level === level);
      list.sort((a, b) => a.timeSec - b.timeSec);
      const top = list.slice(0, 10);

      elLB.innerHTML = "";
      if (top.length === 0) {
        elLB.innerHTML = `<li>Hali natija yo‘q. Birinchi bo‘lib o‘ynang ✅</li>`;
        return;
      }

      top.forEach((x, i) => {
        const li = document.createElement("li");
        li.innerHTML = `<b>${i + 1}) ${x.name}</b> — ${fmt(x.timeSec)} <span class="tiny">(${x.date})</span>`;
        elLB.appendChild(li);
      });
    }

    function beep(type) {
      if (!soundOn) return;
      try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === "suspended") audioCtx.resume();

        const o = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        const now = audioCtx.currentTime;

        let freq = 520;
        if (type === "match") freq = 740;
        if (type === "wrong") freq = 220;
        if (type === "win") freq = 880;

        o.type = "sine";
        o.frequency.setValueAtTime(freq, now);

        g.gain.setValueAtTime(0.0001, now);
        g.gain.exponentialRampToValueAtTime(0.12, now + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

        o.connect(g);
        g.connect(audioCtx.destination);
        o.start(now);
        o.stop(now + 0.2);
      } catch {}
    }

    function stopCountdown() {
      clearInterval(timer);
      timer = null;
    }

    function startCountdown(limitSec) {
      stopCountdown();
      remaining = limitSec;
      if (elTime) elTime.textContent = fmt(remaining);

      timer = setInterval(() => {
        if (!gameActive) return;
        remaining--;
        if (elTime) elTime.textContent = fmt(Math.max(0, remaining));

        if (remaining <= 0) {
          gameActive = false;
          stopCountdown();
          lock = true;
          showToast("⛔ Vaqt tugadi! Qayta boshlang.");
        }
      }, 1000);
    }

    function requireName() {
      const name = (inpName?.value || "").trim();
      if (!name) {
        showToast("Ismingizni kiriting 🙂");
        inpName?.focus();
        return null;
      }
      return name;
    }

    function buildCard(icon) {
      const card = document.createElement("div");
      card.className = "memCard";
      card.dataset.icon = icon;
      card.setAttribute("aria-disabled", "false");
      card.innerHTML = `
        <div class="memInner">
          <div class="memFace memFront"></div>
          <div class="memFace memBack"><div class="memEmoji">${icon}</div></div>
        </div>
      `;
      card.addEventListener("click", () => onFlip(card));
      return card;
    }

    function newGame() {
      const name = requireName();
      if (!name) return;

      const level = selLevel?.value || "medium";
      const { pairs, limitSec } = LEVELS[level];

      first = null;
      lock = false;
      doneCount = 0;
      gameActive = true;

      setGridCols(level);
      setLevelLabel(level);
      setBest(level);
      updateLeaderboard(level);

      const pool = shuffle(EMOJIS).slice(0, pairs);
      const deck = shuffle([...pool, ...pool]);

      grid.innerHTML = "";
      deck.forEach((icon) => grid.appendChild(buildCard(icon)));

      startCountdown(limitSec);
      showToast("Boshladik! 🔥");
    }

    function endWin() {
      const level = selLevel?.value || "medium";
      const name = (inpName?.value || "").trim();

      gameActive = false;
      stopCountdown();
      beep("win");

      const limit = LEVELS[level].limitSec;
      const used = Math.max(0, limit - remaining);

      saveBestIfNeeded(level, used);

      const list = readLB();
      const d = new Date();
      const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      list.push({ name, level, timeSec: used, date });
      writeLB(list);

      updateLeaderboard(level);
      showToast(`Yutdingiz! ✅ Natija: ${fmt(used)}`);
    }

    function onFlip(card) {
      if (!gameActive) return;
      if (lock) return;
      if (card.classList.contains("done") || card.classList.contains("open")) return;

      card.classList.add("open");
      beep("flip");

      if (!first) {
        first = card;
        return;
      }

      const a = first.dataset.icon;
      const b = card.dataset.icon;

      if (a === b) {
        lock = true;

        first.classList.add("done", "match");
        card.classList.add("done", "match");
        first.setAttribute("aria-disabled", "true");
        card.setAttribute("aria-disabled", "true");

        doneCount += 2;
        beep("match");

        setTimeout(() => {
          first.classList.remove("match");
          card.classList.remove("match");
          first = null;
          lock = false;

          if (doneCount === grid.children.length) endWin();
        }, 220);
      } else {
        lock = true;
        beep("wrong");

        first.classList.add("wrong");
        card.classList.add("wrong");

        setTimeout(() => {
          first.classList.remove("wrong", "open");
          card.classList.remove("wrong", "open");
          first = null;
          lock = false;
        }, 650);
      }
    }

    // Events
    btnStart?.addEventListener("click", newGame);

    selLevel?.addEventListener("change", () => {
      const level = selLevel.value;
      setGridCols(level);
      setLevelLabel(level);
      setBest(level);
      updateLeaderboard(level);
      if (elTime) elTime.textContent = fmt(LEVELS[level].limitSec);
    });

    btnSound?.addEventListener("click", () => {
      soundOn = !soundOn;
      btnSound.textContent = soundOn ? "🔊 Ovoz: Bor" : "🔇 Ovoz: Yo‘q";
      showToast(soundOn ? "Ovoz yoqildi ✅" : "Ovoz o‘chirildi ✅");
      if (soundOn) beep("flip");
    });

    btnClear?.addEventListener("click", () => {
      const level = selLevel?.value || "medium";

      // best clear
      localStorage.removeItem(BEST_KEY(level));

      // leaderboard clear only for level
      const list = readLB().filter((x) => x.level !== level);
      writeLB(list);

      setBest(level);
      updateLeaderboard(level);
      showToast("Natijalar tozalandi ✅");
    });

    // Initial UI
    const startLevel = selLevel?.value || "medium";
    setGridCols(startLevel);
    setLevelLabel(startLevel);
    setBest(startLevel);
    updateLeaderboard(startLevel);
    if (elTime) elTime.textContent = fmt(LEVELS[startLevel].limitSec);
  }
});

