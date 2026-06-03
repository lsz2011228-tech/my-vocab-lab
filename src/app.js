const STORAGE_KEY = "my-vocab-lab-state-v1";
const CUSTOM_KEY = "my-vocab-lab-custom-words-v1";
const starterVocabulary = dedupeWordsByText(window.starterVocabulary || []);

const statusMeta = {
  new: { label: "新单词", rank: 1 },
  learning: { label: "正在学", rank: 2 },
  mastered: { label: "已掌握", rank: 3 },
  difficult: { label: "容易忘", rank: 0 }
};

const learnSourceMeta = {
  "new-learning": { label: "新单词 + 正在学" },
  new: { label: "只学新单词" },
  learning: { label: "只学正在学" },
  difficult: { label: "只学容易忘" }
};

const app = document.querySelector("#app");

let progress = loadJson(STORAGE_KEY, {});
let customWords = loadJson(CUSTOM_KEY, []);
let activeView = "home";
let filters = {
  query: "",
  category: "All",
  level: "All",
  status: "All"
};
let quizFilters = {
  category: "All",
  level: "All",
  status: "All",
  count: "10"
};
let learnFilters = {
  source: "new-learning",
  category: "All",
  level: "All",
  count: "10"
};
let learnQueue = [];
let learnIndex = 0;
let learnOpen = false;
let reviewQueue = [];
let reviewIndex = 0;
let reviewShowingAnswer = false;
let reviewOpen = false;
let quizQueue = [];
let quizIndex = 0;
let quizOpen = false;
let quizHintShown = false;
let quizResult = null;
let importMessage = null;
let importMode = "merge";
let csvImportMessage = null;
let csvImportStatus = "new";
let authReady = false;
let currentSession = null;
let authMode = "sign-in";
let authMessage = null;
let authBusy = false;
let cloudReady = false;
let cloudMessage = null;
let cloudSaveTimer = null;
let cloudSaveBusy = false;
let cloudLastSavedAt = null;
let loadedCloudUserId = null;

function saveProgress() {
  saveJson(STORAGE_KEY, progress);
  scheduleCloudSave();
}

function saveCustomWords() {
  saveJson(CUSTOM_KEY, customWords);
  scheduleCloudSave();
}

function allWords() {
  return dedupeWordsByText([...starterVocabulary, ...customWords]);
}

function dedupeWordsByText(words) {
  const seen = new Set();
  return words.filter((item) => {
    const key = normaliseAnswer(item?.word || "");
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function wordStatus(id) {
  return progress[id]?.status || "new";
}

function wordScore(id) {
  return progress[id]?.score || 0;
}

function touchWord(id, patch) {
  progress[id] = {
    status: "new",
    score: 0,
    lastReviewed: null,
    ...progress[id],
    ...patch
  };
  saveProgress();
}

function getCategories() {
  return ["All", ...new Set(allWords().map((item) => item.category))].sort((a, b) => {
    if (a === "All") return -1;
    if (b === "All") return 1;
    return a.localeCompare(b);
  });
}

function getLevels() {
  return ["All", ...new Set(allWords().map((item) => item.level))];
}

function getFilteredWords() {
  const query = filters.query.trim().toLowerCase();
  return allWords()
    .filter((item) => {
      const searchableText = [
        item.word,
        item.meaningZh,
        item.definition,
        item.example,
        item.notes,
        ...getFormsSearchTokens(item.forms)
      ]
        .join(" ")
        .toLowerCase();
      const matchesQuery =
        !query || searchableText.includes(query);
      const matchesCategory = filters.category === "All" || item.category === filters.category;
      const matchesLevel = filters.level === "All" || item.level === filters.level;
      const matchesStatus = filters.status === "All" || wordStatus(item.id) === filters.status;
      return matchesQuery && matchesCategory && matchesLevel && matchesStatus;
    })
    .sort((a, b) => {
      const statusDiff = statusMeta[wordStatus(a.id)].rank - statusMeta[wordStatus(b.id)].rank;
      return statusDiff || a.category.localeCompare(b.category) || a.word.localeCompare(b.word);
    });
}

function getStats() {
  const words = allWords();
  const counts = words.reduce(
    (acc, item) => {
      acc[wordStatus(item.id)] += 1;
      return acc;
    },
    { new: 0, learning: 0, mastered: 0, difficult: 0 }
  );
  const reviewed = words.filter((item) => progress[item.id]?.lastReviewed).length;
  return {
    total: words.length,
    custom: customWords.length,
    reviewed,
    ...counts
  };
}

function render() {
  if (!window.vocabCloud?.isAvailable) {
    app.innerHTML = renderAuthUnavailable();
    return;
  }

  if (!authReady) {
    app.innerHTML = renderAuthLoading();
    return;
  }

  if (!currentSession) {
    app.innerHTML = renderAuthView();
    bindEvents();
    return;
  }

  if (!cloudReady) {
    app.innerHTML = renderCloudLoading();
    return;
  }

  const stats = getStats();
  const filteredWords = getFilteredWords();

  app.innerHTML = `
    <main class="shell">
      <section class="topbar">
        <div class="brand-block">
          <p class="eyebrow">Year 9 Australia Starter Pack</p>
          <h1>My Vocab Lab</h1>
          <p class="app-subtitle">A personal English workspace for school words, writing, and daily life.</p>
        </div>
        <div class="topbar-actions">
          <span class="cloud-pill ${cloudMessage?.type || "idle"}">${escapeHtml(getCloudStatusText())}</span>
          <span class="account-pill">${escapeHtml(getUserEmail())}</span>
          <button class="icon-button" id="exportBtn" title="Export vocabulary backup" aria-label="Export vocabulary backup">⇩</button>
          <button class="secondary compact" id="signOutBtn" type="button">退出</button>
        </div>
      </section>

      ${renderNavigation()}
      ${renderActiveView(stats, filteredWords)}
    </main>
  `;

  bindEvents();
}

function renderCloudLoading() {
  return `
    <main class="auth-shell">
      <section class="auth-card">
        <p class="eyebrow">Cloud sync</p>
        <h1>My Vocab Lab</h1>
        <p class="auth-copy">正在读取你的云端学习数据...</p>
      </section>
    </main>
  `;
}

function renderAuthUnavailable() {
  return `
    <main class="auth-shell">
      <section class="auth-card">
        <p class="eyebrow">Cloud sign in</p>
        <h1>My Vocab Lab</h1>
        <p class="auth-copy">云端登录没有加载成功。请检查网络，或者确认 Supabase 设置文件还在。</p>
      </section>
    </main>
  `;
}

function renderAuthLoading() {
  return `
    <main class="auth-shell">
      <section class="auth-card">
        <p class="eyebrow">Checking account</p>
        <h1>My Vocab Lab</h1>
        <p class="auth-copy">正在检查登录状态...</p>
      </section>
    </main>
  `;
}

function renderAuthView() {
  const isSignUp = authMode === "sign-up";
  return `
    <main class="auth-shell">
      <section class="auth-card">
        <div>
          <p class="eyebrow">Private vocabulary lab</p>
          <h1>My Vocab Lab</h1>
          <p class="auth-copy">登录后才能进入词库。之后手机、电脑会用同一个账号同步学习数据。</p>
        </div>
        <form class="auth-form" id="authForm">
          <label>
            <span>Email</span>
            <input name="email" type="email" autocomplete="email" required placeholder="you@example.com" />
          </label>
          <label>
            <span>Password</span>
            <input name="password" type="password" autocomplete="${isSignUp ? "new-password" : "current-password"}" required minlength="6" placeholder="至少 6 位密码" />
          </label>
          ${authMessage ? `<p class="auth-message ${authMessage.type}">${escapeHtml(authMessage.text)}</p>` : ""}
          <button class="primary full" type="submit" ${authBusy ? "disabled" : ""}>${authBusy ? "处理中..." : isSignUp ? "注册账号" : "登录"}</button>
        </form>
        <button class="secondary full" id="authModeToggle" type="button">
          ${isSignUp ? "已有账号？去登录" : "还没有账号？注册一个"}
        </button>
      </section>
    </main>
  `;
}

function getUserEmail() {
  return currentSession?.user?.email || "已登录";
}

function getCloudStatusText() {
  if (cloudSaveBusy) return "云端保存中";
  if (cloudMessage?.text) return cloudMessage.text;
  if (cloudLastSavedAt) return "已云端同步";
  return "云端已连接";
}

function renderNavigation() {
  const items = [
    ["home", "Home"],
    ["words", "Words"],
    ["learn", "Learn"],
    ["quiz", "Quiz"],
    ["add", "Add"],
    ["settings", "Settings"]
  ];

  return `
    <nav class="app-nav" aria-label="Main sections">
      ${items
        .map(
          ([view, label]) => `
            <button class="nav-tab ${activeView === view ? "active" : ""}" data-view="${view}" type="button">
              ${label}
            </button>
          `
        )
        .join("")}
    </nav>
  `;
}

function renderActiveView(stats, filteredWords) {
  if (activeView === "words") return renderWordsView(filteredWords);
  if (activeView === "learn") return renderLearnView(stats);
  if (activeView === "quiz") return renderQuizView(stats);
  if (activeView === "add") return renderAddView(stats);
  if (activeView === "settings") return renderSettingsView(stats);
  return renderHomeView(stats);
}

function renderHomeView(stats) {
  const difficultWords = allWords()
    .filter((item) => wordStatus(item.id) === "difficult")
    .slice(0, 4);
  const categoryCards = getCategories()
    .filter((category) => category !== "All")
    .slice(0, 8)
    .map((category) => {
      const count = allWords().filter((item) => item.category === category).length;
      return `
        <button class="category-pill" data-category-jump="${escapeHtml(category)}" type="button">
          <span>${escapeHtml(category)}</span>
          <strong>${count}</strong>
        </button>
      `;
    })
    .join("");

  return `
      <section class="dashboard-grid">
        <article class="hero dashboard-hero">
          <img class="hero-image" src="./assets/study-banner.png" alt="A study desk with vocabulary cards and a laptop" />
          <div class="hero-content">
            <div>
              <p class="eyebrow">Today's focus</p>
              <h2>Build your school English, one useful word at a time.</h2>
            </div>
            <div class="hero-actions">
              <button class="primary" data-view="learn" type="button">开始学习</button>
              <button class="secondary" data-start-quiz="all" type="button">拼写测试</button>
              <button class="secondary" data-view="words" type="button">查看词库</button>
            </div>
          </div>
        </article>

        <aside class="panel today-panel">
          <p class="eyebrow">Study plan</p>
          <h2>今天先做这三件事</h2>
          <div class="plan-list">
            <button class="plan-item" data-view="learn" type="button">
              <span>学习一组词</span>
              <strong>${Math.min(stats.new + stats.learning, 10)}</strong>
            </button>
            <button class="plan-item" data-start-quiz="all" type="button">
              <span>拼写测试</span>
              <strong>${Math.min(stats.total, 12)}</strong>
            </button>
            <button class="plan-item" data-start-review="difficult" type="button">
              <span>易忘复习</span>
              <strong>${stats.difficult}</strong>
            </button>
          </div>
        </aside>
      </section>

      <section class="stats-grid" aria-label="Vocabulary progress">
        ${statCard("全部单词", stats.total)}
        ${statCard("正在学", stats.learning)}
        ${statCard("容易忘", stats.difficult)}
        ${statCard("已掌握", stats.mastered)}
      </section>

      <section class="home-grid">
        <article class="panel action-panel">
          <div class="panel-heading">
            <div>
              <p class="eyebrow">Quick actions</p>
              <h2>今天可以做什么</h2>
            </div>
          </div>
          <div class="action-list">
            <button class="action-row" data-view="learn" type="button">
              <span>先认识一组新词</span>
              <strong>Learn</strong>
            </button>
            <button class="action-row" data-start-quiz="all" type="button">
              <span>中文出来，拼英文</span>
              <strong>Quiz</strong>
            </button>
            <button class="action-row" data-start-review="difficult" type="button">
              <span>复习容易忘的词</span>
              <strong>${stats.difficult}</strong>
            </button>
            <button class="action-row" data-view="add" type="button">
              <span>添加今天遇到的新词</span>
              <strong>+</strong>
            </button>
          </div>
        </article>

        <article class="panel category-panel">
          <div class="panel-heading">
            <div>
              <p class="eyebrow">Categories</p>
              <h2>按分类进入词库</h2>
            </div>
          </div>
          <div class="category-grid">
            ${categoryCards}
          </div>
        </article>

        <article class="panel wide-panel attention-panel">
          <div class="section-heading">
            <div>
              <p class="eyebrow">Needs attention</p>
              <h2>容易忘的词</h2>
            </div>
            <button class="secondary" data-start-quiz="difficult" type="button">测试易忘词</button>
          </div>
          <div class="mini-word-list">
            ${
              difficultWords.length
                ? difficultWords.map(miniWordCard).join("")
                : `<p class="empty-note">现在还没有容易忘的词。做几轮拼写测试后，错题会自动出现在这里。</p>`
            }
          </div>
        </article>
      </section>
  `;
}

function renderWordsView(filteredWords) {
  return `
    <section class="page-header">
      <div>
        <p class="eyebrow">Word Bank</p>
        <h2>词库</h2>
      </div>
      <div class="page-actions">
        <button class="secondary" id="resetFiltersBtn" type="button">查看全部</button>
        <button class="primary" data-view="add" type="button">添加新词</button>
      </div>
    </section>

    <section class="main-panel words-panel">
      <div class="controls filters-panel">
        <label class="search-box">
          <span>Search</span>
          <input id="searchInput" value="${escapeHtml(filters.query)}" placeholder="word, 中文, forms, example..." />
        </label>
        ${selectControl("categoryFilter", "Category", getCategories(), filters.category)}
        ${selectControl("levelFilter", "Level", getLevels(), filters.level)}
        ${selectControl("statusFilter", "Status", ["All", "new", "learning", "difficult", "mastered"], filters.status, statusMeta)}
      </div>

      <div class="bulk-status-panel">
        <div>
          <p class="eyebrow">Bulk status</p>
          <h3>批量改当前筛选结果</h3>
          <p class="review-copy">当前筛选出 <strong id="bulkStatusCount">${filteredWords.length}</strong> 个词。</p>
        </div>
        <div class="bulk-status-controls">
          ${selectControl("bulkStatusSelect", "Change to", ["new", "learning", "difficult", "mastered"], "new", statusMeta)}
          <button class="primary" id="applyBulkStatusBtn" type="button" ${filteredWords.length ? "" : "disabled"}>批量修改</button>
        </div>
      </div>

      <div class="section-heading">
        <div>
          <p class="eyebrow" id="wordCountLabel">${filteredWords.length} words shown</p>
          <h2 id="wordSectionTitle">${filters.category === "All" ? "All words" : escapeHtml(filters.category)}</h2>
        </div>
        <button class="secondary" data-start-review="difficult" type="button">复习易忘词</button>
      </div>

      <div class="word-list" id="wordList">
        ${renderWordList(filteredWords)}
      </div>
    </section>
  `;
}

function renderLearnView() {
  const candidateWords = getLearnCandidateWords();
  const selectedWords = getScopedLearnWords();
  const selectedCountText = learnFilters.count === "All" ? "全部" : `${selectedWords.length}`;
  const sourceCounts = getLearnSourceCounts();

  return `
    <section class="page-header">
      <div>
        <p class="eyebrow">Learn</p>
        <h2>学习模式</h2>
      </div>
      <p class="page-note">先认识单词，再去 Quiz 测。适合每天学一小组。</p>
    </section>

    <section class="main-panel learn-setup-panel">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Learning path</p>
          <h2>今天学哪一组</h2>
        </div>
        <button class="secondary" id="resetLearnFiltersBtn" type="button">重置范围</button>
      </div>

      <div class="learn-path-grid">
        <div>
          <span>1</span>
          <strong>认识</strong>
          <small>看意思、例句、词形</small>
        </div>
        <div>
          <span>2</span>
          <strong>判断</strong>
          <small>我懂了 / 还不熟</small>
        </div>
        <div>
          <span>3</span>
          <strong>测试</strong>
          <small>学完直接进 Quiz</small>
        </div>
      </div>

      <div class="learn-preset-grid" aria-label="Learning sources">
        <button class="learn-preset ${isLearnPresetActive("new-learning") ? "active" : ""}" data-learn-preset="new-learning" type="button">
          <span>新 + 学</span>
          <strong>${sourceCounts.newLearning}</strong>
        </button>
        <button class="learn-preset ${isLearnPresetActive("new") ? "active" : ""}" data-learn-preset="new" type="button">
          <span>新单词</span>
          <strong>${sourceCounts.new}</strong>
        </button>
        <button class="learn-preset ${isLearnPresetActive("learning") ? "active" : ""}" data-learn-preset="learning" type="button">
          <span>正在学</span>
          <strong>${sourceCounts.learning}</strong>
        </button>
        <button class="learn-preset ${isLearnPresetActive("difficult") ? "active" : ""}" data-learn-preset="difficult" type="button">
          <span>容易忘</span>
          <strong>${sourceCounts.difficult}</strong>
        </button>
      </div>

      <div class="learn-controls">
        ${selectControl("learnCategoryFilter", "Category", getCategories(), learnFilters.category)}
        ${selectControl("learnLevelFilter", "Level", getLevels(), learnFilters.level)}
        ${selectControl("learnCountFilter", "Number", ["5", "10", "20", "All"], learnFilters.count)}
      </div>

      <div class="quiz-range-summary">
        <div>
          <span>符合范围</span>
          <strong>${candidateWords.length}</strong>
        </div>
        <div>
          <span>本次学习</span>
          <strong>${selectedCountText}</strong>
        </div>
        <div>
          <span>来源</span>
          <strong>${escapeHtml(learnSourceMeta[learnFilters.source].label)}</strong>
        </div>
      </div>

      <div class="quiz-action-row">
        <button class="primary" id="startLearnBtn" type="button" ${selectedWords.length ? "" : "disabled"}>开始学习这组词</button>
        <button class="secondary" id="learnToQuizBtn" type="button" ${selectedWords.length ? "" : "disabled"}>直接测这组词</button>
      </div>
    </section>

    <section class="learn-panel" id="learnPanel" ${learnOpen ? "" : "hidden"}>
      ${renderLearnSession()}
    </section>
  `;
}

function renderLearnSession() {
  if (!learnQueue.length) {
    return `
      <div class="learn-card">
        <p class="eyebrow">Learn</p>
        <h2>现在没有可学习的单词</h2>
        <p class="review-copy">换一个范围，或者先导入/添加一些词。</p>
      </div>
    `;
  }

  if (learnIndex >= learnQueue.length) {
    return `
      <div class="learn-card">
        <p class="eyebrow">Finished</p>
        <h2>这一组学完了</h2>
        <p class="review-copy">现在可以用 Quiz 测一下这组词，看看哪些还不熟。</p>
        <div class="quiz-action-row">
          <button class="primary" id="quizLearnedWordsBtn" type="button">开始 Quiz 测这组词</button>
          <button class="secondary" id="restartLearnBtn" type="button">再学一遍</button>
        </div>
      </div>
    `;
  }

  const item = learnQueue[learnIndex];
  const status = wordStatus(item.id);
  const progressPercent = Math.round((learnIndex / learnQueue.length) * 100);

  return `
    <div class="learn-card">
      <div class="learn-progress" aria-label="Learn progress">
        <span style="width: ${progressPercent}%"></span>
      </div>
      <div class="learn-card-top">
        <div>
          <p class="eyebrow">Learn ${learnIndex + 1} / ${learnQueue.length}</p>
          <div class="practice-title">
            <h2>${escapeHtml(item.word)}</h2>
            ${audioButton(item.word)}
          </div>
        </div>
        <span class="status ${status}">${statusMeta[status].label}</span>
      </div>
      <div class="learn-body">
        <div class="learn-info-grid">
          <div>
            <span>中文</span>
            <strong>${escapeHtml(item.meaningZh)}</strong>
          </div>
          <div>
            <span>Definition</span>
            <strong>${escapeHtml(item.definition)}</strong>
          </div>
        </div>
        <p class="example">"${escapeHtml(item.example)}"</p>
        ${renderWordForms(item.forms)}
        ${item.notes ? `<p class="notes">${escapeHtml(item.notes)}</p>` : ""}
      </div>
      <div class="learn-actions">
        <button class="secondary" id="learnHardBtn" type="button">还不熟</button>
        <button class="secondary" id="learnSkipBtn" type="button">先跳过</button>
        <button class="primary" id="learnKnowBtn" type="button">我懂了</button>
      </div>
    </div>
  `;
}

function renderQuizView(stats) {
  const candidateWords = getQuizCandidateWords();
  const selectedWords = getScopedPracticeWords();
  const selectedCountText = quizFilters.count === "All" ? "全部" : `${selectedWords.length}`;
  const difficultCount = allWords().filter((item) => wordStatus(item.id) === "difficult").length;

  return `
    <section class="page-header">
      <div>
        <p class="eyebrow">Practice</p>
        <h2>Quiz</h2>
      </div>
    </section>

    <section class="main-panel quiz-setup-panel">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Quiz range</p>
          <h2>选择这次要练的范围</h2>
        </div>
        <button class="secondary" id="resetQuizFiltersBtn" type="button">重置范围</button>
      </div>

      <div class="quiz-preset-grid" aria-label="Quick quiz ranges">
        <button class="quiz-preset ${isQuizPresetActive("all") ? "active" : ""}" data-quiz-preset="all" type="button">
          <span>全部词</span>
          <strong>${allWords().length}</strong>
        </button>
        <button class="quiz-preset ${isQuizPresetActive("learning") ? "active" : ""}" data-quiz-preset="learning" type="button">
          <span>正在学</span>
          <strong>${allWords().filter((item) => wordStatus(item.id) === "learning").length}</strong>
        </button>
        <button class="quiz-preset ${isQuizPresetActive("difficult") ? "active" : ""}" data-quiz-preset="difficult" type="button">
          <span>只练易忘</span>
          <strong>${difficultCount}</strong>
        </button>
        <button class="quiz-preset ${isQuizPresetActive("mastered") ? "active" : ""}" data-quiz-preset="mastered" type="button">
          <span>已掌握</span>
          <strong>${allWords().filter((item) => wordStatus(item.id) === "mastered").length}</strong>
        </button>
      </div>

      <div class="quiz-controls">
        ${selectControl("quizCategoryFilter", "Category", getCategories(), quizFilters.category)}
        ${selectControl("quizLevelFilter", "Level", getLevels(), quizFilters.level)}
        ${selectControl("quizStatusFilter", "Status", ["All", "new", "learning", "difficult", "mastered"], quizFilters.status, statusMeta)}
        ${selectControl("quizCountFilter", "Number", ["10", "20", "50", "100", "All"], quizFilters.count)}
      </div>

      <div class="quiz-range-summary">
        <div>
          <span>符合范围</span>
          <strong>${candidateWords.length}</strong>
        </div>
        <div>
          <span>本次练习</span>
          <strong>${selectedCountText}</strong>
        </div>
        <div>
          <span>容易忘</span>
          <strong>${candidateWords.filter((item) => wordStatus(item.id) === "difficult").length}</strong>
        </div>
      </div>

      <div class="quiz-action-row">
        <button class="primary" id="startScopedQuizBtn" type="button" ${selectedWords.length ? "" : "disabled"}>中文出来，拼英文</button>
        <button class="primary" id="startScopedReviewBtn" type="button" ${selectedWords.length ? "" : "disabled"}>卡片复习</button>
      </div>

      ${
        selectedWords.length
          ? `<p class="review-copy">会优先练“容易忘”和“正在学”的词。想只练易忘词，就点上面的“只练易忘”。</p>`
          : `<p class="empty-note">当前范围没有单词。换一个分类、状态或等级就可以开始。</p>`
      }
    </section>

    <section class="quiz-panel" id="quizPanel" ${quizOpen ? "" : "hidden"}>
      ${renderQuiz()}
    </section>

    <section class="review-panel" id="reviewPanel" ${reviewOpen ? "" : "hidden"}>
      ${renderReview()}
    </section>
  `;
}

function renderAddView(stats) {
  return `
    <section class="page-header">
      <div>
        <p class="eyebrow">Add your own</p>
        <h2>添加新词</h2>
      </div>
      <p class="page-note">你添加的词会自动保存，也会自动拥有发音按钮。</p>
    </section>

    <section class="add-layout">
      <div class="add-main-column">
        <article class="panel add-form-panel">
          ${renderAddForm()}
        </article>
        <article class="panel csv-import-panel">
          ${renderCsvImportPanel()}
        </article>
      </div>
      <aside class="panel helper-panel add-helper-panel">
        <p class="eyebrow">Your words</p>
        <h2>${stats.custom}</h2>
        <p class="review-copy">自定义词会和内置词一起出现在 Words、Quiz 和复习里。</p>
        <button class="secondary full" data-view="words" type="button">去词库查看</button>
      </aside>
    </section>
  `;
}

function renderCsvImportPanel() {
  return `
    <div class="form-section-title">
      <p class="eyebrow">CSV Import</p>
      <h2>批量导入词表</h2>
    </div>
    <p class="review-copy">用 Excel、Numbers 或 Google Sheets 做表格，再导出 CSV。需要列：word, meaningZh, definition, example。</p>
    <div class="csv-template-box">
      <span>可选列：category, level, notes, noun, verb, adjective, adverb, past, participle, ing, plural</span>
      <button class="secondary" id="downloadCsvTemplateBtn" type="button">下载模板</button>
    </div>
    <div class="import-mode csv-status-mode" role="radiogroup" aria-label="CSV imported word status">
      <label>
        <input type="radio" name="csvImportStatus" value="new" ${csvImportStatus === "new" ? "checked" : ""} />
        <span>导入为新单词</span>
        <small>适合一次导入很多词，先放进词库</small>
      </label>
      <label>
        <input type="radio" name="csvImportStatus" value="learning" ${csvImportStatus === "learning" ? "checked" : ""} />
        <span>导入为正在学</span>
        <small>适合今天马上要练的一批词</small>
      </label>
    </div>
    <label class="import-control">
      <span>CSV file</span>
      <input id="csvImportInput" type="file" accept=".csv,text/csv" />
    </label>
    <p class="import-status ${csvImportMessage ? csvImportMessage.type : ""}" id="csvImportStatusMessage" role="status">
      ${csvImportMessage ? escapeHtml(csvImportMessage.text) : ""}
    </p>
  `;
}

function renderSettingsView(stats) {
  return `
    <section class="page-header">
      <div>
        <p class="eyebrow">Settings</p>
        <h2>设置与备份</h2>
      </div>
    </section>

    <section class="settings-grid">
      <article class="panel">
        <p class="eyebrow">Backup</p>
        <h2>导出学习数据</h2>
        <p class="review-copy">导出文件会包含你自己添加的词和学习进度。以后可以用导入功能恢复。</p>
        <button class="primary" id="settingsExportBtn" type="button">导出备份</button>
      </article>
      <article class="panel">
        <p class="eyebrow">Restore</p>
        <h2>导入备份</h2>
        <p class="review-copy">选择之前导出的 JSON 文件。合并导入更安全；恢复备份会用备份替换当前数据。</p>
        <div class="import-mode" role="radiogroup" aria-label="Import mode">
          <label>
            <input type="radio" name="importMode" value="merge" ${importMode === "merge" ? "checked" : ""} />
            <span>合并导入</span>
            <small>保留当前词，只加入备份里没有的词</small>
          </label>
          <label>
            <input type="radio" name="importMode" value="restore" ${importMode === "restore" ? "checked" : ""} />
            <span>恢复备份</span>
            <small>用备份替换当前自定义词和进度</small>
          </label>
        </div>
        <label class="import-control">
          <span>Backup file</span>
          <input id="backupImportInput" type="file" accept="application/json,.json" />
        </label>
        <p class="import-status ${importMessage ? importMessage.type : ""}" id="importStatus" role="status">
          ${importMessage ? escapeHtml(importMessage.text) : ""}
        </p>
      </article>
      <article class="panel">
        <p class="eyebrow">Storage</p>
        <h2>本地保存</h2>
        <div class="settings-list">
          <span>全部单词 <strong>${stats.total}</strong></span>
          <span>自定义词 <strong>${stats.custom}</strong></span>
          <span>已复习过 <strong>${stats.reviewed}</strong></span>
        </div>
      </article>
      <article class="panel wide-panel">
        <p class="eyebrow">Next content</p>
        <h2>下一步适合补更多 Word Family</h2>
        <p class="review-copy">网站现在已经支持词性、变形和衍生词搜索。后面可以慢慢给更多内置词补 noun、verb、adjective、past、-ing 等形式。</p>
      </article>
    </section>
  `;
}

function renderAddForm() {
  return `
    <form id="addWordForm" class="word-form">
      <div class="form-section-title">
        <p class="eyebrow">Basics</p>
        <h2>单词信息</h2>
      </div>
      <label>
        English word
        <input name="word" autocomplete="off" required placeholder="e.g. migrate" />
      </label>
      <label>
        中文意思
        <input name="meaningZh" required placeholder="e.g. 迁移 / 移居" />
      </label>
      <label>
        English definition
        <textarea name="definition" rows="2" required placeholder="a short meaning in English"></textarea>
      </label>
      <label>
        Example sentence
        <textarea name="example" rows="2" required placeholder="Use it in a school or daily-life sentence."></textarea>
      </label>
      <div class="two-col">
        <label>
          Category
          <input name="category" required value="My Words" />
        </label>
        <label>
          Level
          <select name="level">
            <option>Essential</option>
            <option>Useful</option>
            <option>Important</option>
          </select>
        </label>
      </div>
      <label>
        Notes
        <textarea name="notes" rows="2" placeholder="Optional personal note"></textarea>
      </label>
      <details class="forms-details">
        <summary>
          <span>Word family 可选</span>
          <small>noun / verb / adjective / past / -ing</small>
        </summary>
        <div class="forms-form-grid">
          <label>
            Noun
            <input name="formNoun" placeholder="e.g. improvement, analysis" />
          </label>
          <label>
            Verb
            <input name="formVerb" placeholder="e.g. improve, analyse" />
          </label>
          <label>
            Adjective
            <input name="formAdjective" placeholder="e.g. improved, analytical" />
          </label>
          <label>
            Adverb
            <input name="formAdverb" placeholder="e.g. confidently" />
          </label>
          <label>
            Past
            <input name="formPast" placeholder="e.g. submitted" />
          </label>
          <label>
            Participle
            <input name="formParticiple" placeholder="e.g. submitted" />
          </label>
          <label>
            -ing
            <input name="formIng" placeholder="e.g. improving" />
          </label>
          <label>
            Plural
            <input name="formPlural" placeholder="e.g. analyses" />
          </label>
        </div>
      </details>
      <button class="primary full" type="submit">添加到词库</button>
    </form>
  `;
}

function miniWordCard(item) {
  return `
    <button class="mini-word" data-word-jump="${item.id}" type="button">
      <span>${escapeHtml(item.word)}</span>
      <small>${escapeHtml(item.meaningZh)}</small>
    </button>
  `;
}

function statCard(label, value) {
  return `
    <article class="stat-card">
      <span>${label}</span>
      <strong>${value}</strong>
    </article>
  `;
}

function selectControl(id, label, options, selected, meta = null) {
  return `
    <label>
      <span>${label}</span>
      <select id="${id}">
        ${options
          .map((option) => {
            const text = meta && meta[option] ? meta[option].label : option;
            return `<option value="${escapeHtml(option)}" ${option === selected ? "selected" : ""}>${escapeHtml(text)}</option>`;
          })
          .join("")}
      </select>
    </label>
  `;
}

function wordCard(item) {
  const status = wordStatus(item.id);
  const score = wordScore(item.id);
  return `
    <article class="word-card" data-id="${item.id}">
      <div class="word-card-top">
        <div>
          <p class="word-category">${escapeHtml(item.category)} · ${escapeHtml(item.level)}</p>
          <div class="word-title">
            <h3>${escapeHtml(item.word)}</h3>
            ${audioButton(item.word)}
          </div>
        </div>
        <span class="status ${status}">${statusMeta[status].label}</span>
      </div>
      <p class="meaning">${escapeHtml(item.meaningZh)}</p>
      <p class="definition">${escapeHtml(item.definition)}</p>
      <p class="example">"${escapeHtml(item.example)}"</p>
      ${renderWordForms(item.forms)}
      ${item.notes ? `<p class="notes">${escapeHtml(item.notes)}</p>` : ""}
      <div class="word-actions">
        <button class="chip" data-action="learning">正在学</button>
        <button class="chip" data-action="difficult">容易忘</button>
        <button class="chip" data-action="mastered">已掌握</button>
        ${item.id.startsWith("custom-") ? `<button class="chip danger" data-delete-word="${item.id}">删除</button>` : ""}
        <span class="score">Score ${score}</span>
      </div>
    </article>
  `;
}

function renderWordList(words) {
  return words.length ? words.map(wordCard).join("") : `<p class="empty-note">没有找到符合条件的单词。</p>`;
}

function renderReview() {
  if (!reviewQueue.length) {
    return `
      <div class="review-card">
        <button class="close-review" id="closeReviewBtn" aria-label="Close review">×</button>
        <p class="eyebrow">Review</p>
        <h2>现在没有需要复习的单词</h2>
        <p class="review-copy">你可以先添加几个新词，或者把一些词标记为“正在学”。</p>
      </div>
    `;
  }

  const item = reviewQueue[reviewIndex];
  return `
    <div class="review-card">
      <button class="close-review" id="closeReviewBtn" aria-label="Close review">×</button>
      <p class="eyebrow">Review ${reviewIndex + 1} / ${reviewQueue.length}</p>
      <div class="practice-title">
        <h2>${escapeHtml(item.word)}</h2>
        ${audioButton(item.word)}
      </div>
      <p class="review-prompt">先在心里想：中文意思、英文解释、一个例句。</p>
      <div class="answer ${reviewShowingAnswer ? "visible" : ""}">
        <p><strong>中文：</strong>${escapeHtml(item.meaningZh)}</p>
        <p><strong>Definition：</strong>${escapeHtml(item.definition)}</p>
        <p><strong>Example：</strong>${escapeHtml(item.example)}</p>
      </div>
      <div class="review-actions">
        ${
          reviewShowingAnswer
            ? `
              <button class="secondary" id="forgotBtn">不熟</button>
              <button class="primary" id="knowBtn">记住了</button>
            `
            : `<button class="primary" id="showAnswerBtn">显示答案</button>`
        }
      </div>
    </div>
  `;
}

function renderQuiz() {
  if (!quizQueue.length) {
    return `
      <div class="quiz-card">
        <button class="close-review" id="closeQuizBtn" aria-label="Close quiz">×</button>
        <p class="eyebrow">Quiz Mode</p>
        <h2>现在没有可测试的单词</h2>
        <p class="review-copy">你可以先添加新词，或者把一些已掌握的词改成“正在学”。</p>
      </div>
    `;
  }

  const item = quizQueue[quizIndex];
  const resultClass = quizResult?.correct ? "correct" : "wrong";

  return `
    <div class="quiz-card">
      <button class="close-review" id="closeQuizBtn" aria-label="Close quiz">×</button>
      <p class="eyebrow">Quiz ${quizIndex + 1} / ${quizQueue.length}</p>
      <div class="quiz-prompt">
        <span>${escapeHtml(item.category)} · ${escapeHtml(item.level)}</span>
        <h2>${escapeHtml(item.meaningZh)}</h2>
        <p>${escapeHtml(item.definition)}</p>
      </div>
      ${quizHintShown ? `<p class="hint">提示：${escapeHtml(makeHint(item.word))}</p>` : ""}
      <form id="quizForm" class="quiz-form">
        <label>
          Type the English word
          <input
            id="quizAnswerInput"
            name="answer"
            autocomplete="off"
            ${quizResult ? "disabled" : ""}
            placeholder="输入英文单词或短语"
          />
        </label>
        <div class="review-actions">
          ${
            quizResult
              ? `<button class="primary" type="button" id="nextQuizBtn">${quizIndex >= quizQueue.length - 1 ? "完成" : "下一题"}</button>`
              : `
                <button class="secondary" type="button" id="hintBtn">首字母提示</button>
                <button class="primary" type="submit">提交答案</button>
              `
          }
        </div>
      </form>
      ${
        quizResult
          ? `
            <div class="quiz-result ${resultClass}">
              <strong>${quizResult.correct ? "答对了" : "答错了"}</strong>
              <p>你的答案：${escapeHtml(quizResult.answer || "没有输入")}</p>
              <p class="answer-line">正确答案：<span>${escapeHtml(item.word)}</span>${audioButton(item.word)}</p>
              <p class="example">"${escapeHtml(item.example)}"</p>
            </div>
          `
          : ""
      }
    </div>
  `;
}

function bindEvents() {
  document.querySelector("#authForm")?.addEventListener("submit", submitAuthForm);
  document.querySelector("#authModeToggle")?.addEventListener("click", () => {
    authMode = authMode === "sign-in" ? "sign-up" : "sign-in";
    authMessage = null;
    render();
  });
  document.querySelector("#signOutBtn")?.addEventListener("click", signOut);

  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      activeView = button.dataset.view;
      render();
    });
  });

  document.querySelectorAll("[data-category-jump]").forEach((button) => {
    button.addEventListener("click", () => {
      filters = { query: "", category: button.dataset.categoryJump, level: "All", status: "All" };
      activeView = "words";
      render();
    });
  });

  document.querySelectorAll("[data-word-jump]").forEach((button) => {
    button.addEventListener("click", () => {
      const item = allWords().find((word) => word.id === button.dataset.wordJump);
      filters = {
        query: item?.word || "",
        category: "All",
        level: "All",
        status: "All"
      };
      activeView = "words";
      render();
    });
  });

  document.querySelector("#searchInput")?.addEventListener("input", (event) => {
    filters.query = event.target.value;
    refreshWordResults();
  });

  document.querySelector("#categoryFilter")?.addEventListener("change", (event) => {
    filters.category = event.target.value;
    render();
  });

  document.querySelector("#levelFilter")?.addEventListener("change", (event) => {
    filters.level = event.target.value;
    render();
  });

  document.querySelector("#statusFilter")?.addEventListener("change", (event) => {
    filters.status = event.target.value;
    render();
  });

  document.querySelector("#resetFiltersBtn")?.addEventListener("click", () => {
    filters = { query: "", category: "All", level: "All", status: "All" };
    activeView = "words";
    render();
  });

  document.querySelector("#applyBulkStatusBtn")?.addEventListener("click", applyBulkStatus);

  document.querySelector("#learnSourceFilter")?.addEventListener("change", (event) => {
    learnFilters.source = event.target.value;
    closeLearnSession();
    render();
  });

  document.querySelector("#learnCategoryFilter")?.addEventListener("change", (event) => {
    learnFilters.category = event.target.value;
    closeLearnSession();
    render();
  });

  document.querySelector("#learnLevelFilter")?.addEventListener("change", (event) => {
    learnFilters.level = event.target.value;
    closeLearnSession();
    render();
  });

  document.querySelector("#learnCountFilter")?.addEventListener("change", (event) => {
    learnFilters.count = event.target.value;
    closeLearnSession();
    render();
  });

  document.querySelector("#resetLearnFiltersBtn")?.addEventListener("click", () => {
    learnFilters = { source: "new-learning", category: "All", level: "All", count: "10" };
    closeLearnSession();
    render();
  });

  document.querySelectorAll("[data-learn-preset]").forEach((button) => {
    button.addEventListener("click", () => {
      learnFilters.source = button.dataset.learnPreset;
      closeLearnSession();
      render();
    });
  });

  document.querySelector("#startLearnBtn")?.addEventListener("click", () => {
    startLearn(getScopedLearnWords());
  });

  document.querySelector("#learnToQuizBtn")?.addEventListener("click", () => {
    startQuiz(getScopedLearnWords());
  });

  document.querySelector("#quizCategoryFilter")?.addEventListener("change", (event) => {
    quizFilters.category = event.target.value;
    closeOpenPractice();
    render();
  });

  document.querySelector("#quizLevelFilter")?.addEventListener("change", (event) => {
    quizFilters.level = event.target.value;
    closeOpenPractice();
    render();
  });

  document.querySelector("#quizStatusFilter")?.addEventListener("change", (event) => {
    quizFilters.status = event.target.value;
    closeOpenPractice();
    render();
  });

  document.querySelector("#quizCountFilter")?.addEventListener("change", (event) => {
    quizFilters.count = event.target.value;
    closeOpenPractice();
    render();
  });

  document.querySelector("#resetQuizFiltersBtn")?.addEventListener("click", () => {
    quizFilters = { category: "All", level: "All", status: "All", count: "10" };
    closeOpenPractice();
    render();
  });

  document.querySelectorAll("[data-quiz-preset]").forEach((button) => {
    button.addEventListener("click", () => {
      applyQuizPreset(button.dataset.quizPreset);
      closeOpenPractice();
      render();
    });
  });

  document.querySelector("#startScopedQuizBtn")?.addEventListener("click", () => {
    startQuiz(getScopedPracticeWords());
  });

  document.querySelector("#startScopedReviewBtn")?.addEventListener("click", () => {
    startReview(getScopedPracticeWords());
  });

  document.querySelectorAll("[data-start-review]").forEach((button) => {
    button.addEventListener("click", () => {
      startReview(getPracticeWords(button.dataset.startReview));
    });
  });

  document.querySelectorAll("[data-start-quiz]").forEach((button) => {
    button.addEventListener("click", () => {
      startQuiz(getPracticeWords(button.dataset.startQuiz));
    });
  });

  document.querySelector("#exportBtn")?.addEventListener("click", exportBackup);
  document.querySelector("#settingsExportBtn")?.addEventListener("click", exportBackup);
  document.querySelectorAll("input[name='importMode']").forEach((input) => {
    input.addEventListener("change", () => {
      importMode = input.value;
      importMessage = null;
    });
  });
  document.querySelector("#backupImportInput")?.addEventListener("change", importBackup);

  document.querySelector("#addWordForm")?.addEventListener("submit", addCustomWord);
  document.querySelectorAll("input[name='csvImportStatus']").forEach((input) => {
    input.addEventListener("change", () => {
      csvImportStatus = input.value;
      csvImportMessage = null;
    });
  });
  document.querySelector("#csvImportInput")?.addEventListener("change", importCsvWords);
  document.querySelector("#downloadCsvTemplateBtn")?.addEventListener("click", downloadCsvTemplate);

  document.querySelectorAll("button[data-speak]").forEach((button) => {
    button.addEventListener("click", () => speakWord(button.dataset.speak));
  });

  document.querySelectorAll(".word-card button[data-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const card = button.closest(".word-card");
      const action = button.dataset.action;
      touchWord(card.dataset.id, {
        status: action,
        lastReviewed: new Date().toISOString(),
        score: action === "mastered" ? wordScore(card.dataset.id) + 2 : Math.max(0, wordScore(card.dataset.id) + 1)
      });
      render();
    });
  });

  document.querySelectorAll("button[data-delete-word]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.deleteWord;
      customWords = customWords.filter((item) => item.id !== id);
      delete progress[id];
      saveCustomWords();
      saveProgress();
      render();
    });
  });

  const reviewPanel = document.querySelector("#reviewPanel");
  if (reviewPanel) {
    reviewPanel.addEventListener("click", (event) => {
      if (event.target.id === "closeReviewBtn") closeReview();
      if (event.target.id === "showAnswerBtn") {
        reviewShowingAnswer = true;
        render();
      }
      if (event.target.id === "forgotBtn") markReviewed(false);
      if (event.target.id === "knowBtn") markReviewed(true);
    });
  }

  const quizPanel = document.querySelector("#quizPanel");
  if (quizPanel) {
    quizPanel.addEventListener("click", (event) => {
      if (event.target.id === "closeQuizBtn") closeQuiz();
      if (event.target.id === "hintBtn") showQuizHint();
      if (event.target.id === "nextQuizBtn") nextQuizWord();
    });

    const quizForm = document.querySelector("#quizForm");
    if (quizForm) {
      quizForm.addEventListener("submit", submitQuizAnswer);
    }
  }

  const learnPanel = document.querySelector("#learnPanel");
  if (learnPanel) {
    learnPanel.addEventListener("click", (event) => {
      if (event.target.id === "learnHardBtn") markLearnedWord("hard");
      if (event.target.id === "learnSkipBtn") markLearnedWord("skip");
      if (event.target.id === "learnKnowBtn") markLearnedWord("known");
      if (event.target.id === "quizLearnedWordsBtn") startQuiz(learnQueue);
      if (event.target.id === "restartLearnBtn") {
        learnIndex = 0;
        render();
      }
    });
  }
}

function refreshWordResults() {
  const filteredWords = getFilteredWords();
  const wordList = document.querySelector("#wordList");
  const countLabel = document.querySelector("#wordCountLabel");
  const sectionTitle = document.querySelector("#wordSectionTitle");

  if (countLabel) countLabel.textContent = `${filteredWords.length} words shown`;
  if (sectionTitle) sectionTitle.textContent = filters.category === "All" ? "All words" : filters.category;
  if (wordList) {
    wordList.innerHTML = renderWordList(filteredWords);
    bindWordCardEvents();
  }
}

function bindWordCardEvents() {
  document.querySelectorAll("#wordList button[data-speak]").forEach((button) => {
    button.addEventListener("click", () => speakWord(button.dataset.speak));
  });

  document.querySelectorAll("#wordList .word-card button[data-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const card = button.closest(".word-card");
      const action = button.dataset.action;
      touchWord(card.dataset.id, {
        status: action,
        lastReviewed: new Date().toISOString(),
        score: action === "mastered" ? wordScore(card.dataset.id) + 2 : Math.max(0, wordScore(card.dataset.id) + 1)
      });
      refreshWordResults();
    });
  });

  document.querySelectorAll("#wordList button[data-delete-word]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.deleteWord;
      customWords = customWords.filter((item) => item.id !== id);
      delete progress[id];
      saveCustomWords();
      saveProgress();
      refreshWordResults();
    });
  });
}

function applyBulkStatus() {
  const words = getFilteredWords();
  const status = document.querySelector("#bulkStatusSelect")?.value || "new";

  if (!words.length || !statusMeta[status]) return;

  const shouldApply =
    typeof confirm !== "function" ||
    confirm(`确定把当前筛选出的 ${words.length} 个词全部改成“${statusMeta[status].label}”吗？`);

  if (!shouldApply) return;

  words.forEach((item) => {
    touchWord(item.id, {
      status,
      score: getBulkStatusScore(item.id, status),
      lastReviewed: status === "new" ? null : new Date().toISOString()
    });
  });

  render();
}

function getBulkStatusScore(id, status) {
  const score = wordScore(id);
  if (status === "new") return 0;
  if (status === "mastered") return Math.max(score, 3);
  if (status === "difficult") return Math.max(0, Math.min(score, 1));
  return Math.max(score, 1);
}

function addCustomWord(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const word = String(data.get("word")).trim();
  const id = `custom-${word.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`;

  customWords.unshift({
    id,
    word,
    meaningZh: String(data.get("meaningZh")).trim(),
    definition: String(data.get("definition")).trim(),
    example: String(data.get("example")).trim(),
    category: String(data.get("category")).trim() || "My Words",
    level: String(data.get("level")).trim() || "Useful",
    notes: String(data.get("notes")).trim(),
    forms: collectFormsFromForm(data)
  });

  touchWord(id, { status: "learning", score: 0 });
  saveCustomWords();
  form.reset();
  filters = { query: word, category: "All", level: "All", status: "All" };
  activeView = "words";
  render();
}

async function importCsvWords(event) {
  const input = event.currentTarget;
  const file = input.files?.[0];
  if (!file) return;

  try {
    const result = parseCsvImport(await file.text());
    const selectedStatus = document.querySelector("input[name='csvImportStatus']:checked")?.value || csvImportStatus;
    const importedStatus = statusMeta[selectedStatus] ? selectedStatus : "new";

    if (!result.words.length) {
      csvImportMessage = {
        type: "error",
        text: `没有导入新词。跳过 ${result.skipped} 个重复词，错误 ${result.errors.length} 行。${formatCsvErrors(result.errors)}`
      };
      render();
      return;
    }

    customWords = [...result.words, ...customWords];
    result.words.forEach((item) => {
      progress[item.id] = {
        status: importedStatus,
        score: 0,
        lastReviewed: null,
        ...progress[item.id]
      };
    });
    saveCustomWords();
    saveProgress();

    csvImportMessage = {
      type: "success",
      text: `CSV 导入成功：新增 ${result.words.length} 个词，状态设为“${statusMeta[importedStatus].label}”，跳过 ${result.skipped} 个重复词，错误 ${result.errors.length} 行。${formatCsvErrors(result.errors)}`
    };
    filters = { query: "", category: "All", level: "All", status: importedStatus };
    activeView = "add";
    render();
  } catch (error) {
    csvImportMessage = {
      type: "error",
      text: error.message || "CSV 导入失败。请确认文件格式正确。"
    };
    render();
  } finally {
    input.value = "";
  }
}

function parseCsvImport(text) {
  const rows = parseCsvRows(text);
  if (rows.length < 2) {
    throw new Error("CSV 至少需要一行表头和一行单词。");
  }

  const headers = rows[0].map(normalizeCsvHeader);
  const required = ["word", "meaningZh", "definition", "example"];
  const missing = required.filter((key) => !headers.includes(key));

  if (missing.length) {
    throw new Error(`CSV 缺少必要列：${missing.join(", ")}。`);
  }

  const knownWords = new Set(allWords().map((item) => normaliseAnswer(item.word)));
  const words = [];
  const errors = [];
  let skipped = 0;

  rows.slice(1).forEach((row, index) => {
    const lineNumber = index + 2;
    if (!row.some((cell) => cleanImportedText(cell))) return;

    const record = Object.fromEntries(headers.map((key, cellIndex) => [key, cleanImportedText(row[cellIndex])]));
    const word = record.word;
    const wordKey = normaliseAnswer(word);

    if (!word || !record.meaningZh || !record.definition || !record.example) {
      errors.push(`第 ${lineNumber} 行缺少 word / meaningZh / definition / example`);
      return;
    }

    if (knownWords.has(wordKey)) {
      skipped += 1;
      return;
    }

    knownWords.add(wordKey);
    words.push({
      id: makeCustomWordId(word, lineNumber),
      word,
      meaningZh: record.meaningZh,
      definition: record.definition,
      example: record.example,
      category: record.category || "My Words",
      level: record.level || "Useful",
      notes: record.notes || "",
      forms: collectFormsFromCsvRecord(record)
    });
  });

  return { words, skipped, errors };
}

function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;
  const csvText = String(text || "").replace(/^\uFEFF/, "");

  for (let index = 0; index < csvText.length; index += 1) {
    const char = csvText[index];
    const nextChar = csvText[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        cell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  row.push(cell);
  rows.push(row);
  return rows.filter((item) => item.some((cellValue) => cleanImportedText(cellValue)));
}

function normalizeCsvHeader(header) {
  const key = String(header || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
  const aliases = {
    english: "word",
    englishword: "word",
    word: "word",
    chinese: "meaningZh",
    zh: "meaningZh",
    meaning: "meaningZh",
    meaningzh: "meaningZh",
    chinesemeaning: "meaningZh",
    definition: "definition",
    englishdefinition: "definition",
    example: "example",
    examplesentence: "example",
    sentence: "example",
    category: "category",
    level: "level",
    notes: "notes",
    note: "notes",
    noun: "noun",
    verb: "verb",
    adjective: "adjective",
    adj: "adjective",
    adverb: "adverb",
    adv: "adverb",
    past: "past",
    participle: "participle",
    ing: "ing",
    plural: "plural"
  };
  return aliases[key] || key;
}

function collectFormsFromCsvRecord(record) {
  const forms = {
    noun: parseForms(record.noun),
    verb: parseForms(record.verb),
    adjective: parseForms(record.adjective),
    adverb: parseForms(record.adverb),
    past: parseForms(record.past),
    participle: parseForms(record.participle),
    ing: parseForms(record.ing),
    plural: parseForms(record.plural)
  };

  return Object.fromEntries(Object.entries(forms).filter(([, values]) => values.length));
}

function makeCustomWordId(word, salt = Date.now()) {
  const slug = String(word)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `custom-${slug || "word"}-${Date.now()}-${salt}`;
}

function formatCsvErrors(errors) {
  if (!errors.length) return "";
  const shown = errors.slice(0, 3).join("；");
  return errors.length > 3 ? `${shown}；还有 ${errors.length - 3} 行错误。` : shown;
}

function downloadCsvTemplate() {
  const rows = [
    [
      "word",
      "meaningZh",
      "definition",
      "example",
      "category",
      "level",
      "notes",
      "noun",
      "verb",
      "adjective",
      "adverb",
      "past",
      "participle",
      "ing",
      "plural"
    ],
    [
      "analyse",
      "分析",
      "to study something carefully",
      "We analyse the poem in English class.",
      "School",
      "Useful",
      "Common in assignments.",
      "analysis",
      "analyse",
      "analytical",
      "analytically",
      "analysed",
      "analysed",
      "analysing",
      "analyses"
    ]
  ];
  const csv = rows.map((row) => row.map(escapeCsvCell).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "my-vocab-lab-csv-template.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function escapeCsvCell(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function getPracticeWords(mode, limit = 12) {
  const words = allWords();
  const candidates =
    mode === "difficult"
      ? words.filter((item) => wordStatus(item.id) === "difficult")
      : words.filter((item) => wordStatus(item.id) !== "mastered");

  return sortPracticeWords(candidates).slice(0, limit);
}

function getLearnCandidateWords() {
  return sortPracticeWords(
    allWords().filter((item) => {
      const status = wordStatus(item.id);
      const matchesSource =
        (learnFilters.source === "new-learning" && ["new", "learning"].includes(status)) ||
        learnFilters.source === status;
      const matchesCategory = learnFilters.category === "All" || item.category === learnFilters.category;
      const matchesLevel = learnFilters.level === "All" || item.level === learnFilters.level;
      return matchesSource && matchesCategory && matchesLevel;
    })
  );
}

function getLearnSourceCounts() {
  const words = allWords();
  const newCount = words.filter((item) => wordStatus(item.id) === "new").length;
  const learningCount = words.filter((item) => wordStatus(item.id) === "learning").length;

  return {
    new: newCount,
    learning: learningCount,
    newLearning: newCount + learningCount,
    difficult: words.filter((item) => wordStatus(item.id) === "difficult").length
  };
}

function isLearnPresetActive(source) {
  return learnFilters.source === source;
}

function getScopedLearnWords() {
  const candidates = getLearnCandidateWords();
  const limit = learnFilters.count === "All" ? candidates.length : Number(learnFilters.count);
  return candidates.slice(0, Number.isFinite(limit) ? limit : 10);
}

function startLearn(words) {
  activeView = "learn";
  learnOpen = true;
  learnQueue = sortPracticeWords(words);
  learnIndex = 0;
  closeOpenPractice();
  render();
  document.querySelector("#learnPanel")?.scrollIntoView({ behavior: "smooth", block: "center" });
}

function closeLearnSession() {
  learnOpen = false;
  learnQueue = [];
  learnIndex = 0;
}

function markLearnedWord(action) {
  const item = learnQueue[learnIndex];
  if (!item) return;

  if (action === "hard") {
    touchWord(item.id, {
      status: "difficult",
      score: Math.max(0, wordScore(item.id) - 1),
      lastReviewed: new Date().toISOString()
    });
  }

  if (action === "known") {
    touchWord(item.id, {
      status: "learning",
      score: wordScore(item.id) + 1,
      lastReviewed: new Date().toISOString()
    });
  }

  learnIndex += 1;
  render();
}

function getQuizCandidateWords() {
  return sortPracticeWords(
    allWords().filter((item) => {
      const matchesCategory = quizFilters.category === "All" || item.category === quizFilters.category;
      const matchesLevel = quizFilters.level === "All" || item.level === quizFilters.level;
      const matchesStatus = quizFilters.status === "All" || wordStatus(item.id) === quizFilters.status;
      return matchesCategory && matchesLevel && matchesStatus;
    })
  );
}

function getScopedPracticeWords() {
  const candidates = getQuizCandidateWords();
  const limit = quizFilters.count === "All" ? candidates.length : Number(quizFilters.count);
  return candidates.slice(0, Number.isFinite(limit) ? limit : 10);
}

function applyQuizPreset(preset) {
  const statusByPreset = {
    all: "All",
    learning: "learning",
    difficult: "difficult",
    mastered: "mastered"
  };

  quizFilters = {
    category: "All",
    level: "All",
    status: statusByPreset[preset] || "All",
    count: preset === "difficult" ? "All" : quizFilters.count
  };
}

function isQuizPresetActive(preset) {
  const statusByPreset = {
    all: "All",
    learning: "learning",
    difficult: "difficult",
    mastered: "mastered"
  };

  return quizFilters.category === "All" && quizFilters.level === "All" && quizFilters.status === statusByPreset[preset];
}

function sortPracticeWords(words) {
  return [...words].sort((a, b) => {
    const statusDiff = statusMeta[wordStatus(a.id)].rank - statusMeta[wordStatus(b.id)].rank;
    return statusDiff || a.category.localeCompare(b.category) || a.word.localeCompare(b.word);
  });
}

function closeOpenPractice() {
  reviewOpen = false;
  quizOpen = false;
  reviewQueue = [];
  quizQueue = [];
  quizResult = null;
  quizHintShown = false;
}

function startReview(words) {
  activeView = "quiz";
  reviewOpen = true;
  quizOpen = false;
  quizQueue = [];
  quizResult = null;
  reviewQueue = sortPracticeWords(words);
  reviewIndex = 0;
  reviewShowingAnswer = false;
  render();
  document.querySelector("#reviewPanel").scrollIntoView({ behavior: "smooth", block: "center" });
}

function closeReview() {
  reviewOpen = false;
  reviewQueue = [];
  reviewIndex = 0;
  reviewShowingAnswer = false;
  render();
}

function startQuiz(words) {
  activeView = "quiz";
  quizOpen = true;
  reviewOpen = false;
  reviewQueue = [];
  reviewShowingAnswer = false;
  quizQueue = sortPracticeWords(words);
  quizIndex = 0;
  quizHintShown = false;
  quizResult = null;
  render();
  document.querySelector("#quizPanel").scrollIntoView({ behavior: "smooth", block: "center" });
  focusQuizInput();
}

function closeQuiz() {
  quizOpen = false;
  quizQueue = [];
  quizIndex = 0;
  quizHintShown = false;
  quizResult = null;
  render();
}

function showQuizHint() {
  quizHintShown = true;
  render();
  focusQuizInput();
}

function submitQuizAnswer(event) {
  event.preventDefault();
  const item = quizQueue[quizIndex];
  if (!item) return closeQuiz();

  const answer = String(new FormData(event.currentTarget).get("answer") || "").trim();
  const correct = normaliseAnswer(answer) === normaliseAnswer(item.word);
  const currentScore = wordScore(item.id);

  touchWord(item.id, {
    status: correct ? (currentScore >= 2 ? "mastered" : "learning") : "difficult",
    score: correct ? currentScore + 1 : Math.max(0, currentScore - 1),
    lastReviewed: new Date().toISOString()
  });

  quizResult = { correct, answer };
  render();
  document.querySelector("#quizPanel").scrollIntoView({ behavior: "smooth", block: "center" });
}

function nextQuizWord() {
  if (quizIndex >= quizQueue.length - 1) {
    closeQuiz();
    return;
  }

  quizIndex += 1;
  quizHintShown = false;
  quizResult = null;
  render();
  focusQuizInput();
}

function focusQuizInput() {
  setTimeout(() => document.querySelector("#quizAnswerInput")?.focus(), 0);
}

function normaliseAnswer(value) {
  return String(value).trim().toLowerCase().replace(/\s+/g, " ");
}

function makeHint(word) {
  let firstLetterShown = false;
  return String(word)
    .split("")
    .map((char) => {
      if (char === " ") return " ";
      if (char === "-") return "-";
      if (!/[a-z]/i.test(char)) return char;
      if (!firstLetterShown) {
        firstLetterShown = true;
        return char;
      }
      return "_";
    })
    .join("");
}

function markReviewed(known) {
  const item = reviewQueue[reviewIndex];
  if (!item) return closeReview();
  const currentScore = wordScore(item.id);
  touchWord(item.id, {
    status: known ? (currentScore >= 2 ? "mastered" : "learning") : "difficult",
    score: known ? currentScore + 1 : Math.max(0, currentScore - 1),
    lastReviewed: new Date().toISOString()
  });

  if (reviewIndex >= reviewQueue.length - 1) {
      closeReview();
    } else {
      reviewIndex += 1;
      reviewShowingAnswer = false;
      render();
    }
  }

function exportBackup() {
  const backup = {
    exportedAt: new Date().toISOString(),
    customWords,
    progress
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "my-vocab-lab-backup.json";
  link.click();
  URL.revokeObjectURL(url);
}

async function importBackup(event) {
  const input = event.currentTarget;
  const file = input.files?.[0];
  if (!file) return;

  try {
    const parsedBackup = JSON.parse(await file.text());
    const backup = validateBackup(parsedBackup);
    const selectedMode = document.querySelector("input[name='importMode']:checked")?.value || importMode;
    const plan = selectedMode === "restore" ? makeRestoreImportPlan(backup) : makeMergeImportPlan(backup);
    const shouldImport =
      typeof confirm !== "function" ||
      confirm(getImportConfirmText(plan));

    if (!shouldImport) {
      importMessage = { type: "info", text: "已取消导入，当前数据没有改变。" };
      render();
      return;
    }

    customWords = plan.nextCustomWords;
    progress = plan.nextProgress;
    saveCustomWords();
    saveProgress();

    filters = { query: "", category: "All", level: "All", status: "All" };
    reviewOpen = false;
    quizOpen = false;
    reviewQueue = [];
    quizQueue = [];
    importMessage = {
      type: "success",
      text: getImportSuccessText(plan)
    };
    activeView = "settings";
    render();
  } catch (error) {
    importMessage = {
      type: "error",
      text: error.message || "导入失败。请确认这是 My Vocab Lab 导出的 JSON 备份。"
    };
    activeView = "settings";
    render();
  } finally {
    input.value = "";
  }
}

function makeMergeImportPlan(backup) {
  const beforeCustomCount = customWords.length;
  const beforeProgressCount = Object.keys(progress).length;
  const beforeTotalCount = allWords().length;
  const knownIds = new Set(customWords.map((item) => item.id));
  const knownWords = new Set(customWords.map(getImportWordKey));
  const wordsToAdd = [];
  let skippedCount = 0;

  backup.customWords.forEach((item) => {
    const wordKey = getImportWordKey(item);
    const isDuplicate = knownIds.has(item.id) || knownWords.has(wordKey);

    if (isDuplicate) {
      skippedCount += 1;
      return;
    }

    knownIds.add(item.id);
    knownWords.add(wordKey);
    wordsToAdd.push(item);
  });

  const nextCustomWords = [...wordsToAdd, ...customWords];
  const importableBackupProgress = filterProgressForWords(backup.progress, nextCustomWords);
  const nextProgress = { ...importableBackupProgress, ...progress };

  return {
    mode: "merge",
    beforeCustomCount,
    beforeProgressCount,
    beforeTotalCount,
    backupCustomCount: backup.customWords.length,
    backupProgressCount: Object.keys(backup.progress).length,
    addedCount: wordsToAdd.length,
    skippedCount,
    nextCustomWords,
    nextProgress,
    afterCustomCount: nextCustomWords.length,
    afterProgressCount: Object.keys(nextProgress).length,
    afterTotalCount: starterVocabulary.length + nextCustomWords.length
  };
}

function makeRestoreImportPlan(backup) {
  const nextCustomWords = backup.customWords;
  const nextProgress = filterProgressForWords(backup.progress, nextCustomWords);

  return {
    mode: "restore",
    beforeCustomCount: customWords.length,
    beforeProgressCount: Object.keys(progress).length,
    beforeTotalCount: allWords().length,
    backupCustomCount: backup.customWords.length,
    backupProgressCount: Object.keys(backup.progress).length,
    addedCount: backup.customWords.length,
    skippedCount: 0,
    nextCustomWords,
    nextProgress,
    afterCustomCount: nextCustomWords.length,
    afterProgressCount: Object.keys(nextProgress).length,
    afterTotalCount: starterVocabulary.length + nextCustomWords.length
  };
}

function getImportConfirmText(plan) {
  if (plan.mode === "restore") {
    return [
      "恢复备份会用备份替换当前数据。",
      `导入前：${plan.beforeCustomCount} 个自定义词，总词库 ${plan.beforeTotalCount} 个词，${plan.beforeProgressCount} 条进度。`,
      `备份里：${plan.backupCustomCount} 个自定义词，${plan.backupProgressCount} 条进度。`,
      `导入后：${plan.afterCustomCount} 个自定义词，总词库 ${plan.afterTotalCount} 个词。`,
      "确定继续吗？"
    ].join("\n");
  }

  return [
    "合并导入不会删除当前已有的词。",
    `导入前：${plan.beforeCustomCount} 个自定义词，总词库 ${plan.beforeTotalCount} 个词，${plan.beforeProgressCount} 条进度。`,
    `备份里：${plan.backupCustomCount} 个自定义词，${plan.backupProgressCount} 条进度。`,
    `预计新增：${plan.addedCount} 个；跳过重复：${plan.skippedCount} 个。`,
    `导入后：${plan.afterCustomCount} 个自定义词，总词库 ${plan.afterTotalCount} 个词。`,
    "确定继续吗？"
  ].join("\n");
}

function getImportSuccessText(plan) {
  if (plan.mode === "restore") {
    return `恢复成功：导入前总词库 ${plan.beforeTotalCount} 个词，备份有 ${plan.backupCustomCount} 个自定义词；现在总词库 ${plan.afterTotalCount} 个词，${plan.afterProgressCount} 条学习进度。`;
  }

  return `合并成功：导入前总词库 ${plan.beforeTotalCount} 个词；新增 ${plan.addedCount} 个，跳过 ${plan.skippedCount} 个重复词；现在总词库 ${plan.afterTotalCount} 个词，${plan.afterProgressCount} 条学习进度。`;
}

function getImportWordKey(item) {
  return normaliseAnswer(item.word);
}

function filterProgressForWords(savedProgress, customWordList) {
  const allowedIds = new Set([
    ...starterVocabulary.map((item) => item.id),
    ...customWordList.map((item) => item.id)
  ]);

  return Object.fromEntries(Object.entries(savedProgress).filter(([id]) => allowedIds.has(id)));
}

function validateBackup(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("导入失败：备份文件格式不正确。");
  }

  if (!Array.isArray(value.customWords)) {
    throw new Error("导入失败：备份里没有有效的自定义词列表。");
  }

  if (!value.progress || typeof value.progress !== "object" || Array.isArray(value.progress)) {
    throw new Error("导入失败：备份里没有有效的学习进度。");
  }

  return {
    customWords: value.customWords.map(normalizeImportedWord),
    progress: normalizeImportedProgress(value.progress)
  };
}

function normalizeImportedWord(item, index) {
  if (!item || typeof item !== "object" || Array.isArray(item)) {
    throw new Error(`导入失败：第 ${index + 1} 个自定义词格式不正确。`);
  }

  const word = cleanImportedText(item.word);
  const meaningZh = cleanImportedText(item.meaningZh);
  const definition = cleanImportedText(item.definition);
  const example = cleanImportedText(item.example);

  if (!word || !meaningZh || !definition || !example) {
    throw new Error(`导入失败：第 ${index + 1} 个自定义词缺少必要内容。`);
  }

  return {
    id: cleanImportedText(item.id) || `custom-${word.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}-${index}`,
    word,
    meaningZh,
    definition,
    example,
    category: cleanImportedText(item.category) || "My Words",
    level: cleanImportedText(item.level) || "Useful",
    notes: cleanImportedText(item.notes),
    forms: normalizeImportedForms(item.forms)
  };
}

function normalizeImportedForms(forms) {
  if (!forms || typeof forms !== "object" || Array.isArray(forms)) return {};

  return Object.fromEntries(
    Object.entries(forms)
      .map(([key, value]) => [
        key,
        Array.isArray(value) ? value.map(cleanImportedText).filter(Boolean) : [cleanImportedText(value)].filter(Boolean)
      ])
      .filter(([, values]) => values.length)
  );
}

function normalizeImportedProgress(savedProgress) {
  return Object.fromEntries(
    Object.entries(savedProgress)
      .filter(([, value]) => value && typeof value === "object" && !Array.isArray(value))
      .map(([id, value]) => [
        id,
        {
          status: statusMeta[value.status] ? value.status : "new",
          score: Number.isFinite(Number(value.score)) ? Number(value.score) : 0,
          lastReviewed: cleanImportedText(value.lastReviewed) || null
        }
      ])
  );
}

function cleanImportedText(value) {
  return typeof value === "string" ? value.trim() : "";
}

async function initAuth() {
  if (!window.vocabCloud?.isAvailable) {
    authReady = true;
    render();
    return;
  }

  try {
    const { data, error } = await window.vocabCloud.getSession();
    if (error) throw error;
    currentSession = data.session;
    authReady = true;
    render();
    if (currentSession) await loadCloudData();
  } catch (error) {
    authMessage = {
      type: "error",
      text: error.message || "登录状态检查失败。"
    };
    authReady = true;
    render();
  }

  window.vocabCloud.onAuthStateChange(async (_event, session) => {
    const previousUserId = currentSession?.user?.id;
    const nextUserId = session?.user?.id;
    const userChanged = Boolean(nextUserId && nextUserId !== previousUserId);
    const signedOut = !nextUserId;

    currentSession = session;
    authMessage = null;
    authBusy = false;

    if (userChanged) {
      cloudReady = false;
      cloudMessage = null;
      render();
      await loadCloudData();
      return;
    }

    if (signedOut) {
      loadedCloudUserId = null;
      cloudReady = false;
      cloudMessage = null;
      render();
      return;
    }

    render();
  });
}

async function submitAuthForm(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const email = String(data.get("email") || "").trim();
  const password = String(data.get("password") || "");

  if (!email || password.length < 6) {
    authMessage = { type: "error", text: "请输入邮箱和至少 6 位密码。" };
    render();
    return;
  }

  authBusy = true;
  authMessage = null;
  render();

  try {
    const result =
      authMode === "sign-up"
        ? await window.vocabCloud.signUp(email, password)
        : await window.vocabCloud.signIn(email, password);

    if (result.error) throw result.error;

    currentSession = result.data.session || currentSession;
    if (currentSession) await loadCloudData();
    authMessage = {
      type: "success",
      text:
        authMode === "sign-up" && !result.data.session
          ? "注册成功。请去邮箱点确认链接，然后回来登录。"
          : "登录成功。"
    };
    form.reset();
  } catch (error) {
    authMessage = {
      type: "error",
      text: error.message || "登录失败，请检查邮箱和密码。"
    };
  } finally {
    authBusy = false;
    render();
  }
}

async function signOut() {
  authBusy = true;
  try {
    await saveCloudNow();
    await window.vocabCloud.signOut();
  } finally {
    currentSession = null;
    cloudReady = false;
    cloudMessage = null;
    cloudLastSavedAt = null;
    loadedCloudUserId = null;
    authBusy = false;
    render();
  }
}

async function loadCloudData() {
  const userId = currentSession?.user?.id;
  if (!userId || !window.vocabCloud?.isAvailable) return;
  if (loadedCloudUserId === userId && cloudReady) return;

  cloudReady = false;
  cloudMessage = null;
  render();

  try {
    const { data, error } = await window.vocabCloud.loadUserData(userId);
    if (error) throw error;

    if (data) {
      customWords = mergeCustomWordLists(normalizeCloudWords(data.custom_words), customWords);
      progress = mergeProgress(normalizeCloudProgress(data.progress), progress);
      cloudLastSavedAt = data.updated_at || null;
    }

    saveJson(CUSTOM_KEY, customWords);
    saveJson(STORAGE_KEY, progress);
    loadedCloudUserId = userId;
    cloudReady = true;
    cloudMessage = {
      type: "success",
      text: data ? "已读取云端" : "新账号云端已准备"
    };

    await saveCloudNow();
  } catch (error) {
    cloudReady = true;
    cloudMessage = {
      type: "error",
      text: "云端同步失败"
    };
    console.warn("Cloud data load failed.", error);
  }

  render();
}

function scheduleCloudSave() {
  if (!currentSession?.user?.id || !cloudReady || !window.vocabCloud?.isAvailable) return;
  window.clearTimeout(cloudSaveTimer);
  cloudSaveTimer = window.setTimeout(() => {
    saveCloudNow();
  }, 700);
}

async function saveCloudNow() {
  if (!currentSession?.user?.id || !window.vocabCloud?.isAvailable) return;
  window.clearTimeout(cloudSaveTimer);
  cloudSaveTimer = null;
  cloudSaveBusy = true;
  cloudMessage = { type: "idle", text: "云端保存中" };
  render();

  try {
    const { data, error } = await window.vocabCloud.saveUserData(currentSession.user.id, customWords, progress);
    if (error) throw error;
    cloudLastSavedAt = data?.updated_at || new Date().toISOString();
    cloudMessage = { type: "success", text: "已云端同步" };
  } catch (error) {
    cloudMessage = { type: "error", text: "云端保存失败" };
    console.warn("Cloud data save failed.", error);
  } finally {
    cloudSaveBusy = false;
    render();
  }
}

function normalizeCloudWords(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index) => {
      try {
        return normalizeImportedWord(item, index);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function normalizeCloudProgress(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return normalizeImportedProgress(value);
}

function mergeCustomWordLists(primaryWords, secondaryWords) {
  const seenIds = new Set();
  const seenWords = new Set();
  const merged = [];

  [...primaryWords, ...secondaryWords].forEach((item) => {
    const id = cleanImportedText(item.id);
    const wordKey = normaliseAnswer(item.word);
    if (!id || !wordKey || seenIds.has(id) || seenWords.has(wordKey)) return;
    seenIds.add(id);
    seenWords.add(wordKey);
    merged.push(item);
  });

  return merged;
}

function mergeProgress(primaryProgress, secondaryProgress) {
  const merged = { ...primaryProgress };

  Object.entries(secondaryProgress).forEach(([id, value]) => {
    if (!merged[id] || isProgressNewer(value, merged[id])) {
      merged[id] = value;
    }
  });

  return merged;
}

function isProgressNewer(nextValue, currentValue) {
  const nextTime = Date.parse(nextValue?.lastReviewed || "");
  const currentTime = Date.parse(currentValue?.lastReviewed || "");

  if (Number.isFinite(nextTime) && Number.isFinite(currentTime)) return nextTime > currentTime;
  if (Number.isFinite(nextTime)) return true;
  if (Number.isFinite(currentTime)) return false;
  return Number(nextValue?.score || 0) > Number(currentValue?.score || 0);
}

render();
initAuth();
