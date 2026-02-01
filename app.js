// Year
document.getElementById("year").textContent = new Date().getFullYear();

// Toast
function showToast(text){
  const t = document.getElementById("toast");
  document.getElementById("toastText").textContent = text;
  t.style.display = "block";
  clearTimeout(window.__to);
  window.__to = setTimeout(()=> t.style.display = "none", 2400);
}

// HERO SLIDER
(function(){
  const box = document.getElementById("slideBox");
  const dotsWrap = document.getElementById("sliderDots");
  if(!box) return;

  const imgs = Array.from(box.querySelectorAll("img"));
  let idx = 0;
  let timer = null;

  function setActive(i){
    idx = i;
    imgs.forEach((im,k)=> im.classList.toggle("active", k===idx));
    if(dotsWrap){
      Array.from(dotsWrap.children).forEach((d,k)=> d.classList.toggle("active", k===idx));
    }
  }
  function next(){ setActive((idx + 1) % imgs.length); }
  function start(){ stop(); timer = setInterval(next, 2800); }
  function stop(){ if(timer) clearInterval(timer); timer = null; }

  if(dotsWrap){
    dotsWrap.innerHTML = "";
    imgs.forEach((_,k)=>{
      const d = document.createElement("button");
      d.type = "button";
      d.className = "dot" + (k===0 ? " active" : "");
      d.addEventListener("click", ()=>{ setActive(k); start(); });
      dotsWrap.appendChild(d);
    });
  }

  box.addEventListener("mouseenter", stop);
  box.addEventListener("mouseleave", start);

  let x0 = null;
  box.addEventListener("touchstart", (e)=>{ x0 = e.touches[0].clientX; }, {passive:true});
  box.addEventListener("touchend", (e)=>{
    if(x0 === null) return;
    const x1 = e.changedTouches[0].clientX;
    const dx = x1 - x0;
    if(Math.abs(dx) > 40){
      if(dx < 0) setActive((idx+1)%imgs.length);
      else setActive((idx-1+imgs.length)%imgs.length);
      start();
    }
    x0 = null;
  }, {passive:true});

  start();
})();

// MEMORY GAME
(function(){
  const grid = document.getElementById("memGrid");
  if(!grid) return;

  const elTime = document.getElementById("memTime");
  const elBest = document.getElementById("memBest");
  const selLevel = document.getElementById("memLevel");
  const btnStart = document.getElementById("memStart");
  const btnSound = document.getElementById("memSound");
  const btnClear = document.getElementById("memClear");

  const LEVELS = {
    easy:   { cols: 3, rows: 4, pairs: 6 },
    medium: { cols: 4, rows: 4, pairs: 8 },
    hard:   { cols: 5, rows: 4, pairs: 10 },
  };

  const EMOJIS = ["🍎","🍌","🍇","🍓","🍍","🥝","🍒","🥥","🍉","🍑","🍋","🍊","🍪","🍩","🍫","🍿","🐱","🐶","🦊","🐼","🐸","🐵","🦁","🐯"];

  let first = null;
  let lock = false;
  let doneCount = 0;

  let startAt = 0;
  let timer = null;

  let soundOn = true;
  let audioCtx = null;

  function bestKey(level){ return `mem_best_${level}_v1`; }

  function setGridCols(level){
    const { cols } = LEVELS[level];
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
      if(type === "win") freq = 880;

      o.type = "sine";
      o.frequency.setValueAtTime(freq, now);

      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.12, now + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

      o.connect(g); g.connect(audioCtx.destination);
      o.start(now); o.stop(now + 0.2);
    }catch(e){}
  }

  function setBest(level){
    const v = localStorage.getItem(bestKey(level));
    elBest.textContent = v ? v : "—";
  }

  function clearBest(level){
    localStorage.removeItem(bestKey(level));
    setBest(level);
  }

  function startTimer(){
    clearInterval(timer);
    elTime.textContent = "0";
    startAt = Date.now();
    timer = setInterval(()=>{
      elTime.textContent = String(Math.floor((Date.now()-startAt)/1000));
    }, 250);
  }

  function stopTimer(){
    clearInterval(timer);
    timer = null;
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

  function newGame(){
    const level = selLevel.value;
    const { pairs } = LEVELS[level];

    first = null;
    lock = false;
    doneCount = 0;

    setGridCols(level);
    setBest(level);

    const pool = shuffle(EMOJIS).slice(0, pairs);
    const deck = shuffle([...pool, ...pool]);

    grid.innerHTML = "";
    deck.forEach(icon => grid.appendChild(buildCard(icon)));

    startTimer();
  }

  function onFlip(card){
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
          stopTimer();
          beep("win");

          const level = selLevel.value;
          const time = Math.floor((Date.now()-startAt)/1000);
          const best = localStorage.getItem(bestKey(level));

          if(!best || time < Number(best)){
            localStorage.setItem(bestKey(level), String(time));
            setBest(level);
            showToast("Yangi rekord! 🔥");
          } else {
            showToast("Yutdingiz! ✅");
          }
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
    stopTimer();
    elTime.textContent = "0";
    setBest(selLevel.value);
    newGame();
  });

  btnSound?.addEventListener("click", ()=>{
    soundOn = !soundOn;
    btnSound.textContent = soundOn ? "🔊 Ovoz: Bor" : "🔇 Ovoz: Yo'q";
    showToast(soundOn ? "Ovoz yoqildi ✅" : "Ovoz o‘chirildi ✅");
    if(soundOn) beep("flip");
  });

  btnClear?.addEventListener("click", ()=>{
    clearBest(selLevel.value);
    showToast("Rekord tozalandi ✅");
  });

  setBest(selLevel.value);
  newGame();
})();
