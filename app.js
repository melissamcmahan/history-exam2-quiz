// ===== State =====
const PROGRESS_KEY = "exam2_progress_v1";
const HISTORY_KEY = "exam2_quiz_history_v1";

let progress = loadProgress();     // { term: "known" | "unknown" }
let quizHistory = loadHistory();   // [{date, score, total, category}]

let currentView = "home";
let categoryFilter = "All";

// Study (flashcard) mode state
let studyDeck = [];
let studyIndex = 0;
let studyFlipped = false;
let studyDirection = "term-first"; // or "def-first"

// Quiz mode state
let quizQuestions = [];
let quizIndex = 0;
let quizScore = 0;
let quizAnswered = false;
let quizWrong = [];

// ===== Storage helpers =====
function loadProgress() {
  try { return JSON.parse(localStorage.getItem(PROGRESS_KEY)) || {}; }
  catch (e) { return {}; }
}
function saveProgress() {
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
}
function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; }
  catch (e) { return []; }
}
function saveHistory() {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(quizHistory));
}

// ===== Utilities =====
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function cardsForCategory(cat) {
  return cat === "All" ? CARDS : CARDS.filter(c => c.cat === cat);
}

function allCategories() {
  const seen = [];
  CARDS.forEach(c => { if (!seen.includes(c.cat)) seen.push(c.cat); });
  return seen;
}

function masteryStats() {
  let known = 0, unknown = 0, untouched = 0;
  CARDS.forEach(c => {
    const s = progress[c.term];
    if (s === "known") known++;
    else if (s === "unknown") unknown++;
    else untouched++;
  });
  return { known, unknown, untouched, total: CARDS.length };
}

// ===== Rendering =====
const app = document.getElementById("app");

function render() {
  if (currentView === "home") renderHome();
  else if (currentView === "study") renderStudy();
  else if (currentView === "quiz-setup") renderQuizSetup();
  else if (currentView === "quiz") renderQuiz();
  else if (currentView === "quiz-results") renderQuizResults();
}

function categorySelectHTML(selectedValue, idPrefix) {
  const cats = allCategories();
  let opts = `<option value="All" ${selectedValue==="All"?"selected":""}>All Categories (${CARDS.length} cards)</option>`;
  cats.forEach(c => {
    const count = CARDS.filter(x => x.cat === c).length;
    opts += `<option value="${c}" ${selectedValue===c?"selected":""}>${CATEGORY_LABELS[c] || c} (${count})</option>`;
  });
  return `<select id="${idPrefix}" class="cat-select">${opts}</select>`;
}

function renderHome() {
  const stats = masteryStats();
  const pct = Math.round((stats.known / stats.total) * 100);
  const lastQuiz = quizHistory[quizHistory.length - 1];

  app.innerHTML = `
    <div class="header">
      <h1>📚 Exam 2 Study App</h1>
      <p class="subtitle">WWI → WWII · Chapters 23–27</p>
    </div>

    <div class="stats-card">
      <div class="stats-row">
        <div class="stat"><div class="stat-num">${stats.known}</div><div class="stat-label">Mastered</div></div>
        <div class="stat"><div class="stat-num">${stats.unknown}</div><div class="stat-label">Still Learning</div></div>
        <div class="stat"><div class="stat-num">${stats.untouched}</div><div class="stat-label">Not Studied</div></div>
      </div>
      <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
      <div class="progress-pct">${pct}% mastered (${stats.known}/${stats.total})</div>
      ${lastQuiz ? `<div class="last-quiz">Last quiz: ${lastQuiz.score}/${lastQuiz.total} — ${CATEGORY_LABELS[lastQuiz.category] || lastQuiz.category}</div>` : ""}
    </div>

    <div class="menu">
      <button class="menu-btn primary" id="go-study">
        <span class="menu-icon">🗂️</span>
        <span>
          <strong>Study Flashcards</strong>
          <small>Flip cards, mark what you know</small>
        </span>
      </button>
      <button class="menu-btn primary" id="go-quiz">
        <span class="menu-icon">✅</span>
        <span>
          <strong>Take a Quiz</strong>
          <small>Multiple choice, scored</small>
        </span>
      </button>
      <button class="menu-btn" id="reset-progress">
        <span class="menu-icon">↺</span>
        <span>
          <strong>Reset Progress</strong>
          <small>Clear mastery + quiz history</small>
        </span>
      </button>
    </div>

    <p class="footer-note">${stats.total} total items from the study guide — identifications, key people, and every event/term.</p>
  `;

  document.getElementById("go-study").onclick = () => { currentView = "study-setup"; renderStudySetup(); };
  document.getElementById("go-quiz").onclick = () => { currentView = "quiz-setup"; render(); };
  document.getElementById("reset-progress").onclick = () => {
    if (confirm("Reset all progress and quiz history? This can't be undone.")) {
      progress = {}; quizHistory = [];
      saveProgress(); saveHistory();
      render();
    }
  };
}

// ----- Study setup -----
function renderStudySetup() {
  app.innerHTML = `
    <div class="header"><h1>🗂️ Study Flashcards</h1></div>
    <div class="setup-card">
      <label>Category</label>
      ${categorySelectHTML(categoryFilter, "study-cat")}

      <label>Card order</label>
      <div class="radio-row">
        <label><input type="radio" name="dir" value="term-first" checked> Show term first</label>
        <label><input type="radio" name="dir" value="def-first"> Show definition first (harder)</label>
      </div>

      <div class="radio-row">
        <label><input type="checkbox" id="only-unmastered"> Only show cards I haven't mastered</label>
      </div>

      <button class="menu-btn primary full" id="start-study">Start Studying</button>
      <button class="menu-btn full" id="back-home">← Back</button>
    </div>
  `;
  document.getElementById("back-home").onclick = () => { currentView = "home"; render(); };
  document.getElementById("start-study").onclick = () => {
    categoryFilter = document.getElementById("study-cat").value;
    studyDirection = document.querySelector('input[name="dir"]:checked').value;
    const onlyUnmastered = document.getElementById("only-unmastered").checked;

    let deck = cardsForCategory(categoryFilter);
    if (onlyUnmastered) deck = deck.filter(c => progress[c.term] !== "known");
    if (deck.length === 0) { alert("No cards match that filter — try a different category or uncheck the filter."); return; }

    studyDeck = shuffle(deck);
    studyIndex = 0;
    studyFlipped = false;
    currentView = "study";
    render();
  };
}

// ----- Study mode -----
function renderStudy() {
  const card = studyDeck[studyIndex];
  const frontIsTerm = studyDirection === "term-first";
  const frontText = frontIsTerm ? card.term : card.full;
  const backText = frontIsTerm ? card.full : card.term;
  const status = progress[card.term];

  app.innerHTML = `
    <div class="header slim">
      <button class="icon-btn" id="study-exit">✕</button>
      <div class="deck-progress">${studyIndex + 1} / ${studyDeck.length}</div>
      <span class="cat-chip">${CATEGORY_LABELS[card.cat] || card.cat}</span>
    </div>

    <div class="flash-wrap">
      <div class="flashcard ${studyFlipped ? "flipped" : ""}" id="flashcard">
        <div class="flash-face flash-front">${frontText}</div>
        <div class="flash-face flash-back">${backText}</div>
      </div>
    </div>

    <p class="tap-hint">${studyFlipped ? "" : "Tap the card to reveal the answer"}</p>

    <div class="mastery-row ${studyFlipped ? "" : "hidden"}">
      <button class="mastery-btn unknown ${status==='unknown'?'active':''}" id="mark-unknown">Still Learning</button>
      <button class="mastery-btn known ${status==='known'?'active':''}" id="mark-known">I Know This ✓</button>
    </div>

    <div class="nav-row">
      <button class="menu-btn" id="study-prev" ${studyIndex===0?"disabled":""}>← Prev</button>
      <button class="menu-btn primary" id="study-next">${studyIndex === studyDeck.length - 1 ? "Finish" : "Next →"}</button>
    </div>
  `;

  document.getElementById("study-exit").onclick = () => { currentView = "home"; render(); };
  document.getElementById("flashcard").onclick = () => { studyFlipped = !studyFlipped; render(); };
  document.getElementById("study-prev").onclick = () => { studyIndex = Math.max(0, studyIndex - 1); studyFlipped = false; render(); };
  document.getElementById("study-next").onclick = () => {
    if (studyIndex === studyDeck.length - 1) { currentView = "home"; render(); return; }
    studyIndex++; studyFlipped = false; render();
  };
  const markKnown = document.getElementById("mark-known");
  const markUnknown = document.getElementById("mark-unknown");
  if (markKnown) markKnown.onclick = () => { progress[card.term] = "known"; saveProgress(); render(); };
  if (markUnknown) markUnknown.onclick = () => { progress[card.term] = "unknown"; saveProgress(); render(); };
}

// ----- Quiz setup -----
function renderQuizSetup() {
  app.innerHTML = `
    <div class="header"><h1>✅ Take a Quiz</h1></div>
    <div class="setup-card">
      <label>Category</label>
      ${categorySelectHTML(categoryFilter, "quiz-cat")}

      <label>Number of questions</label>
      <select id="quiz-len" class="cat-select">
        <option value="10">10 questions</option>
        <option value="20" selected>20 questions</option>
        <option value="40">40 questions</option>
        <option value="999">All matching cards</option>
      </select>

      <button class="menu-btn primary full" id="start-quiz">Start Quiz</button>
      <button class="menu-btn full" id="back-home2">← Back</button>
    </div>
  `;
  document.getElementById("back-home2").onclick = () => { currentView = "home"; render(); };
  document.getElementById("start-quiz").onclick = () => {
    categoryFilter = document.getElementById("quiz-cat").value;
    const len = parseInt(document.getElementById("quiz-len").value, 10);
    const pool = cardsForCategory(categoryFilter);
    if (pool.length < 4) { alert("Need at least 4 cards in this category to build multiple choice."); return; }

    const count = Math.min(len, pool.length);
    const chosen = shuffle(pool).slice(0, count);
    quizQuestions = chosen.map(card => buildQuestion(card, pool));
    quizIndex = 0;
    quizScore = 0;
    quizWrong = [];
    quizAnswered = false;
    currentView = "quiz";
    render();
  };
}

function buildQuestion(card, poolOverride) {
  const samePool = CARDS.filter(c => c.cat === card.cat && c.term !== card.term);
  let distractorPool = samePool.length >= 3 ? samePool : CARDS.filter(c => c.term !== card.term);
  const distractors = shuffle(distractorPool).slice(0, 3).map(c => c.term);
  const options = shuffle([card.term, ...distractors]);
  return {
    prompt: card.short,
    correct: card.term,
    full: card.full,
    cat: card.cat,
    options,
  };
}

// ----- Quiz mode -----
function renderQuiz() {
  const q = quizQuestions[quizIndex];

  app.innerHTML = `
    <div class="header slim">
      <button class="icon-btn" id="quiz-exit">✕</button>
      <div class="deck-progress">${quizIndex + 1} / ${quizQuestions.length}</div>
      <span class="cat-chip">Score: ${quizScore}</span>
    </div>

    <div class="quiz-card">
      <p class="quiz-label">${CATEGORY_LABELS[q.cat] || q.cat}</p>
      <p class="quiz-prompt">${q.prompt}</p>
      <p class="quiz-sub">Which term/person/event does this describe?</p>
      <div class="options" id="options"></div>
      <div class="quiz-feedback" id="feedback"></div>
    </div>

    <div class="nav-row">
      <button class="menu-btn primary full" id="quiz-next" style="display:none">${quizIndex === quizQuestions.length - 1 ? "See Results" : "Next Question →"}</button>
    </div>
  `;

  document.getElementById("quiz-exit").onclick = () => {
    if (confirm("Exit quiz? Your progress on this quiz will be lost.")) { currentView = "home"; render(); }
  };

  const optionsDiv = document.getElementById("options");
  q.options.forEach(opt => {
    const btn = document.createElement("button");
    btn.className = "option-btn";
    btn.textContent = opt;
    btn.onclick = () => selectAnswer(opt);
    optionsDiv.appendChild(btn);
  });
}

function selectAnswer(chosen) {
  if (quizAnswered) return;
  quizAnswered = true;
  const q = quizQuestions[quizIndex];
  const correct = chosen === q.correct;
  if (correct) {
    quizScore++;
    progress[q.correct] = "known";
  } else {
    quizWrong.push(q);
    progress[q.correct] = "unknown";
  }
  saveProgress();

  document.querySelectorAll(".option-btn").forEach(btn => {
    btn.disabled = true;
    if (btn.textContent === q.correct) btn.classList.add("correct");
    else if (btn.textContent === chosen) btn.classList.add("incorrect");
  });

  const scoreChip = document.querySelector(".cat-chip");
  if (scoreChip) scoreChip.textContent = `Score: ${quizScore}`;

  document.getElementById("feedback").innerHTML = correct
    ? `<span class="feedback-correct">✓ Correct!</span>`
    : `<span class="feedback-incorrect">✗ Not quite. Correct answer: <strong>${q.correct}</strong></span><p class="feedback-full">${q.full}</p>`;

  const nextBtn = document.getElementById("quiz-next");
  nextBtn.style.display = "block";
  nextBtn.onclick = () => {
    quizAnswered = false;
    if (quizIndex === quizQuestions.length - 1) {
      quizHistory.push({ date: new Date().toISOString(), score: quizScore, total: quizQuestions.length, category: categoryFilter });
      saveHistory();
      currentView = "quiz-results";
    } else {
      quizIndex++;
    }
    render();
  };
}

// ----- Quiz results -----
function renderQuizResults() {
  const total = quizQuestions.length;
  const pct = Math.round((quizScore / total) * 100);
  let msg = "Keep drilling the ones you missed!";
  if (pct >= 90) msg = "Excellent — you're exam-ready on this set! 🎉";
  else if (pct >= 75) msg = "Solid! A bit more review and you've got it.";
  else if (pct >= 50) msg = "Good start — go back through the flashcards for the ones you missed.";

  app.innerHTML = `
    <div class="header"><h1>Quiz Results</h1></div>
    <div class="results-card">
      <div class="results-score">${quizScore} / ${total}</div>
      <div class="results-pct">${pct}%</div>
      <p class="results-msg">${msg}</p>
    </div>

    ${quizWrong.length > 0 ? `
      <h3 class="section-title">Review Missed Questions (${quizWrong.length})</h3>
      <div class="review-list">
        ${quizWrong.map(q => `
          <div class="review-item">
            <p class="review-term">${q.correct}</p>
            <p class="review-def">${q.full}</p>
          </div>
        `).join("")}
      </div>
    ` : ""}

    <div class="menu">
      <button class="menu-btn primary full" id="retry-wrong" ${quizWrong.length === 0 ? "style=display:none" : ""}>Retry Missed Questions</button>
      <button class="menu-btn full" id="back-home3">← Back to Home</button>
    </div>
  `;

  document.getElementById("back-home3").onclick = () => { currentView = "home"; render(); };
  const retryBtn = document.getElementById("retry-wrong");
  if (retryBtn) retryBtn.onclick = () => {
    const wrongTerms = quizWrong.map(q => q.correct);
    const pool = CARDS.filter(c => wrongTerms.includes(c.term));
    quizQuestions = pool.map(card => buildQuestion(card));
    quizIndex = 0; quizScore = 0; quizWrong = []; quizAnswered = false;
    currentView = "quiz";
    render();
  };
}

// ===== Init =====
render();

// Register service worker for installability/offline use
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
