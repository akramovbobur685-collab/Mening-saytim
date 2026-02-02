
// =======================
// Year
// =======================
const yearEl = document.getElementById("year");
if (yearEl) yearEl.textContent = new Date().getFullYear();

// =======================
// Toast
// =======================
function showToast(text){
  const t = document.getElementById("toast");
  const tt = document.getElementById("toastText");
  if(!t || !tt) return; // toast bo'lmasa jim turadi
  tt.textContent = text;
  t.style.display = "block";
  clearTimeout(window.__to);
  window.__to = setTimeout(()=> t.style.display = "none", 2400);
}

// =======================
// MEMORY GAME (TIME LIMIT + NAME + LOCAL LEADERBOARD)
// =======================
(function(){
  const grid = document.getElementById("memGrid");
  if(!grid) return;

  const elTime = document.getElementById("memTime");
  const elBest = document.getElementById("memBest");      // bo'lsa ishlaydi
  const selLevel = document.getElementById("memLevel");
  const btnStart = document.getElementById("memStart");
  const btnSound = document.getElementById("memSound");
  const btnClear = document.getElementById("memClear");
  const inpName = document.getElementById("memName");
  const elLB = document.getElementById("memLeaderboard"); // SENDA SHU ID bo'lsa
  const elLevelLabel = document.getElementById("memLevelLabel"); // bo'lsa ishlaydi

  const LEVELS = {
    easy:   { cols: 3, pairs: 6,  limitSec: 120, label: "Oson (3×4)"  }, // 2 min
    medium: { cols: 4, pairs: 8,  limitSec: 240, label: "O'rta (4×4)" }, // 4 min
    hard:   { cols: 5, pairs: 10, limitSec: 300, label: "Qiyin (5×4)" }, // 5 min
  };

  const EMOJIS = ["🍎","🍌","🍇","🍓","🍍","🥝","🍒","🥥","🍉","🍑","🍋","🍊","🍪","🍩","🍫","🍿","🐱","🐶","🦊","🐼","🐸","🐵","🦁","🐯"];

  // STATE
  let first = null;
  let lock = false;
  let doneCount = 0;

  let soundOn = true;
  let audioCtx = null;

  let timer = null;
  let remaining = 0;
  let gameActive = false;

  // STORAGE KEYS
  const BEST_KEY = (level)=> `mem_best_${level}_time_v2`;
  const LB_KEY   = "mem_leaderboard_v2";

  function toast(msg){
    if(typeof showToast === "function") showToast(msg);
    else alert(msg);
  }

  function fmt(sec){
    const m = Math.floor(sec/60);
    const s = sec%60;
    return String(m).padStart(2,"0")+":"+String(s).padStart(2,"0");
  }

  function setLevelLabel(level){
    if(elLevelLabel) elLevelLabel.textContent = LEVELS[level].label;
  }

  function setGridCols(level){
    const cols = LEVELS[level].cols;
    grid.classList.remove("cols-3","cols-4","cols-5");
    grid.classList.add(`cols-${cols}`);
  }

  function shuffle(arr){
    const a = arr.slice();
    for(let i=a.length-1;i>0;i--){
      const r = Math.floor(Math.random()*(i+1));
      [a[i],a[r]] = [a[r],a[i]];
    }
    return a;
  }

  function beep(type){
    if(!soundOn) return;
    try{
      if(!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if(audioCtx.state === "suspended") audioCtx.resume();

      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      const now = audioCtx.currentTime;

      let freq = 520;
      if(type === "match") freq = 740;
      if(type === "wrong") freq = 220;
      if(type === "win")   freq = 880;

      o.type = "sine";
      o.frequency.setValueAtTime(freq, now);

      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.12, now + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

      o.connect(g); g.connect(audioCtx.destination);
      o.start(now); o.stop(now + 0.2);
    }catch(e){}
  }

  function readLB(){
    try{
      const raw = localStorage.getItem(LB_KEY);
      return raw ? JSON.parse(raw) : [];
    }catch(e){
      return [];
    }
  }

  function writeLB(list){
    localStorage.setItem(LB_KEY, JSON.stringify(list));
  }

  function updateLeaderboard(level){
    if(!elLB) return;
    const list = readLB().filter(x => x.level === level);
    list.sort((a,b)=> a.timeSec - b.timeSec); // kam vaqt = yaxshi
    const top = list.slice(0,10);

    elLB.innerHTML = "";
    if(top.length === 0){
      elLB.innerHTML = `<li>Hali natija yo‘q. Birinchi bo‘lib o‘ynang ✅</li>`;
      return;
    }
    top.forEach((x, i)=>{
      const li = document.createElement("li");
      li.innerHTML = `<b>${i+1}) ${x.name}</b> — ${fmt(x.timeSec)} <span class="tiny">(${x.date})</span>`;
      elLB.appendChild(li);
    });
  }

  function setBest(level){
    if(!elBest) return;
    const v = localStorage.getItem(BEST_KEY(level));
    elBest.textContent = v ? fmt(Number(v)) : "—";
  }

  function saveBestIfNeeded(level, timeSec){
    const prev = localStorage.getItem(BEST_KEY(level));
    if(!prev || timeSec < Number(prev)){
      localStorage.setItem(BEST_KEY(level), String(timeSec));
      setBest(level);
      toast("Yangi rekord! 🔥");
    }
  }

  function stopCountdown(){
    clearInterval(timer);
    timer = null;
  }

  // ✅ Toggle yopilganda tashqaridan to'xtatish uchun:
  window.__memStopTimer = () => {
    gameActive = false;
    stopCountdown();
  };

  function startCountdown(limitSec){
    stopCountdown();
    remaining = limitSec;
    if(elTime) elTime.textContent = fmt(remaining);

    timer = setInterval(()=>{
      if(!gameActive) return;

      remaining--;
      if(elTime) elTime.textContent = fmt(Math.max(0,remaining));

      if(remaining <= 0){
        gameActive = false;
        stopCountdown();
        lock = true;
        toast("⛔ Vaqt tugadi! Qayta boshlang.");
      }
    }, 1000);
  }

  function buildCard(icon){
    const card = document.createElement("div");
    card.className = "memCard";
    card.setAttribute("data-icon", icon);
    card.setAttribute("aria-disabled", "false");

    card.innerHTML = `
      <div class="memInner">
        <div class="memFace memFront"></div>
        <div class="memFace memBack"><div class="memEmoji">${icon}</div></div>
      </div>
    `;
    card.addEventListener("click", ()=> onFlip(card));
    return card;
  }

  function requireName(){
    const name = (inpName?.value || "").trim();
    if(!name){
      toast("Ismingizni kiriting 🙂");
      inpName?.focus();
      return null;
    }
    return name.slice(0,20);
  }

  function newGame(){
    const name = requireName();
    if(!name) return;

    const level = selLevel.value;
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
    deck.forEach(icon => grid.appendChild(buildCard(icon)));

    startCountdown(limitSec);
  }

  function endWin(){
    const level = selLevel.value;
    const name = (inpName?.value || "").trim().slice(0,20);

    gameActive = false;
    stopCountdown();
    beep("win");

    const limit = LEVELS[level].limitSec;
    const used = Math.max(0, limit - remaining); // ishlatgan vaqt

    saveBestIfNeeded(level, used);

    // save leaderboard
    const list = readLB();
    const today = new Date();
    const date = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;

    list.push({ name, level, timeSec: used, date });
    writeLB(list);

    updateLeaderboard(level);
    toast(`Yutdingiz! ✅ Natija: ${fmt(used)}`);
  }

  function onFlip(card){
    if(!gameActive) return;
    if(lock) return;
    if(card.classList.contains("done") || card.classList.contains("open")) return;

    card.classList.add("open");
    beep("flip");

    if(!first){
      first = card;
      return;
    }

    const a = first.getAttribute("data-icon");
    const b = card.getAttribute("data-icon");

    if(a === b){
      lock = true;

      first.classList.add("done","match");
      card.classList.add("done","match");
      first.setAttribute("aria-disabled","true");
      card.setAttribute("aria-disabled","true");

      doneCount += 2;
      beep("match");

      setTimeout(()=>{
        first.classList.remove("match");
        card.classList.remove("match");
        first = null;
        lock = false;

        if(doneCount === grid.children.length){
          endWin();
        }
      }, 220);

    } else {
      lock = true;
      beep("wrong");

      first.classList.add("wrong");
      card.classList.add("wrong");

      setTimeout(()=>{
        first.classList.remove("wrong","open");
        card.classList.remove("wrong","open");
        first = null;
        lock = false;
      }, 650);
    }
  }

  btnStart?.addEventListener("click", newGame);

  selLevel?.addEventListener("change", ()=>{
    const level = selLevel.value;

    // o'yin yurgan bo'lsa, level o'zgartirishda to'xtatib qo'yamiz (qotmasin)
    gameActive = false;
    stopCountdown();
    lock = false;
    first = null;

    setLevelLabel(level);
    setBest(level);
    updateLeaderboard(level);

    if(elTime) elTime.textContent = fmt(LEVELS[level].limitSec);
  });

  btnSound?.addEventListener("click", ()=>{
    soundOn = !soundOn;
    btnSound.textContent = soundOn ? "🔊 Ovoz: Bor" : "🔇 Ovoz: Yo'q";
    toast(soundOn ? "Ovoz yoqildi ✅" : "Ovoz o‘chirildi ✅");
    if(soundOn) beep("flip");
  });

  btnClear?.addEventListener("click", ()=>{
    const level = selLevel.value;

    localStorage.removeItem(BEST_KEY(level));

    // leaderboard'ni faqat shu level bo'yicha tozalaymiz
    const list = readLB().filter(x => x.level !== level);
    writeLB(list);

    setBest(level);
    updateLeaderboard(level);
    toast("Natijalar tozalandi ✅");
  });

  // init
  setLevelLabel(selLevel.value);
  setBest(selLevel.value);
  updateLeaderboard(selLevel.value);
  if(elTime) elTime.textContent = fmt(LEVELS[selLevel.value].limitSec);
})();

// =======================
// Smooth page transition for internal links
// =======================
(function(){
  document.addEventListener("click", (e)=>{
    const a = e.target.closest("a");
    if(!a) return;

    const href = a.getAttribute("href") || "";
    const isInternalPage = href.endsWith(".html") && !href.startsWith("http") && !href.startsWith("//");

    if(!isInternalPage) return;

    e.preventDefault();

    a.style.transform = "scale(0.985)";
    document.body.classList.add("page-fade");

    setTimeout(()=>{ window.location.href = href; }, 180);
  });
})();




