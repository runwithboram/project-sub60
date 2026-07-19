(() => {
  "use strict";

  const STORAGE_KEY = "sub60-body-balance-v1";
  let pendingRows = [];
  let editingDate = null;
  let selectedInbodyFile = null;
  let selectedInbodyUrl = null;
  let isReadingInbody = false;

  const originalRenderApp = window.renderApp;
  const originalBind = window.bind;

  window.renderApp = function renderAppWithBodyBalance() {
    if (typeof originalRenderApp === "function") {
      originalRenderApp();
    }
    mountBodyBalance();
  };

  window.bind = function bindWithBodyBalance() {
    if (typeof originalBind === "function") {
      originalBind();
    }
    bindBodyBalance();
  };

  function mountBodyBalance() {
    const app = document.getElementById("app");
    if (!app || document.getElementById("bbTabbar")) return;

    /*
     * 기존 러닝 화면을 문자열로 복사하면 버튼 이벤트가 사라집니다.
     * 실제 DOM 노드를 DocumentFragment로 옮겨 이벤트를 그대로 보존합니다.
     */
    const runningNodes = document.createDocumentFragment();

    while (app.firstChild) {
      runningNodes.appendChild(app.firstChild);
    }

    const tabbar = document.createElement("nav");
    tabbar.id = "bbTabbar";
    tabbar.className = "bb-tabbar";
    tabbar.setAttribute("aria-label", "주요 메뉴");
    tabbar.innerHTML = `
      <button class="bb-tab is-active" type="button" data-bb-tab="running">
        러닝
      </button>
      <button class="bb-tab" type="button" data-bb-tab="balance">
        바디 밸런스
      </button>
    `;

    const runningPanel = document.createElement("div");
    runningPanel.id = "bbRunningPanel";
    runningPanel.className = "bb-panel";
    runningPanel.appendChild(runningNodes);
    removeLegacyRecordManagement(runningPanel);
    mountRunningCoachCards(runningPanel);
    compactRecentRuns(runningPanel);

    const balancePanel = document.createElement("div");
    balancePanel.id = "bbBalancePanel";
    balancePanel.className = "bb-panel";
    balancePanel.hidden = true;
    balancePanel.innerHTML = renderBalancePanel();

    const toastElement = document.createElement("div");
    toastElement.id = "bbToast";
    toastElement.className = "bb-toast";
    toastElement.setAttribute("role", "status");

    app.append(tabbar, runningPanel, balancePanel, toastElement);

    refreshBalanceView();
  }

  function removeLegacyRecordManagement(runningPanel) {
    if (!runningPanel) return;

    const headings = [...runningPanel.querySelectorAll("h1, h2, h3")];

    headings
      .filter(heading => heading.textContent.trim() === "기록 관리")
      .forEach(heading => {
        const removable =
          heading.closest("section") ||
          heading.closest("article") ||
          heading.closest(".card") ||
          heading.parentElement;

        removable?.remove();
      });
  }

  function mountRunningCoachCards(runningPanel) {
    if (!runningPanel || runningPanel.querySelector("#bbNextRunCard")) return;

    const hero = runningPanel.querySelector(".hero");
    if (!hero) return;

    const recommendation = buildNextRunRecommendation();
    const briefing = buildTodayBriefing(recommendation);
    const warning = buildTrainingLoadWarning();

    const briefingCard = document.createElement("section");
    briefingCard.id = "bbTodayBriefing";
    briefingCard.className = "card bb-today-briefing";
    briefingCard.innerHTML = `
      <span class="bb-next-run-kicker">TODAY</span>
      <h2>오늘의 한 줄 브리핑</h2>
      <p>${briefing}</p>
    `;

    hero.insertAdjacentElement("afterend", briefingCard);

    if (warning) {
      const warningCard = document.createElement("section");
      warningCard.id = "bbTrainingWarning";
      warningCard.className = "card bb-training-warning";
      warningCard.innerHTML = `
        <div>
          <span>TRAINING LOAD</span>
          <h2>훈련 부담 주의</h2>
        </div>
        <p>${warning.message}</p>
        <small>${warning.note}</small>
      `;
      briefingCard.insertAdjacentElement("afterend", warningCard);
    }

    const card = document.createElement("section");
    card.id = "bbNextRunCard";
    card.className = "card bb-next-run-card";
    card.innerHTML = `
      <header class="bb-next-run-header">
        <div>
          <span class="bb-next-run-kicker">NEXT RUN</span>
          <h2>다음 러닝 추천</h2>
        </div>
        <b>${recommendation.dday}</b>
      </header>

      <div class="bb-next-run-main">
        <div>
          <span>훈련</span>
          <strong>${recommendation.type}</strong>
        </div>
        <div>
          <span>거리</span>
          <strong>${recommendation.distance}</strong>
        </div>
        <div>
          <span>권장 페이스</span>
          <strong>${recommendation.pace}</strong>
        </div>
      </div>

      <div class="bb-next-run-purpose">
        <span>이번 목표</span>
        <b>${recommendation.purpose}</b>
      </div>

      <p class="bb-next-run-reason">${recommendation.reason}</p>
      <small class="bb-next-run-note">${recommendation.note}</small>
    `;

    const anchor = document.getElementById("bbTrainingWarning") || briefingCard;
    anchor.insertAdjacentElement("afterend", card);
  }

  function buildTodayBriefing(recommendation) {
    const warning = buildTrainingLoadWarning();
    if (warning) {
      return `${recommendation.type} ${recommendation.distance}를 권합니다. 최근 훈련 부담이 올라 강도는 낮추는 편이 좋습니다.`;
    }

    return `${recommendation.type} ${recommendation.distance}가 좋습니다. ${recommendation.purpose}에 집중하세요.`;
  }

  function buildTrainingLoadWarning() {
    const logs = getRecommendationLogs();
    if (logs.length < 3) return null;

    const now = recommendationStartDay(new Date());
    const recentStart = new Date(now);
    recentStart.setDate(now.getDate() - 7);
    const previousStart = new Date(now);
    previousStart.setDate(now.getDate() - 14);

    const recentDistance = logs
      .filter(log => {
        const date = new Date(log.date);
        return date >= recentStart && date <= now;
      })
      .reduce((sum, log) => sum + Number(log.distance || 0), 0);

    const previousDistance = logs
      .filter(log => {
        const date = new Date(log.date);
        return date >= previousStart && date < recentStart;
      })
      .reduce((sum, log) => sum + Number(log.distance || 0), 0);

    if (previousDistance > 0) {
      const increase = ((recentDistance - previousDistance) / previousDistance) * 100;
      if (increase >= 30 && recentDistance - previousDistance >= 3) {
        return {
          message: `최근 7일 러닝 거리가 이전 7일보다 ${Math.round(increase)}% 증가했습니다.`,
          note: "다음 러닝은 회복 중심으로 조정했습니다."
        };
      }
    }

    const recentFour = logs.slice(0, 4);
    const previousFour = logs.slice(4, 8);
    const recentSummary = summarizeRecommendationLogs(recentFour);
    const previousSummary = summarizeRecommendationLogs(previousFour);

    if (
      recentSummary.paceSeconds !== null &&
      previousSummary.paceSeconds !== null &&
      recentSummary.paceSeconds - previousSummary.paceSeconds >= 12
    ) {
      return {
        message: "최근 4회 평균 페이스가 이전 기록보다 느려졌습니다.",
        note: "피로, 날씨, 코스 영향을 확인하고 이번에는 무리하지 마세요."
      };
    }

    return null;
  }

  function compactRecentRuns(runningPanel) {
    if (!runningPanel) return;

    const sections = [...runningPanel.querySelectorAll("section.card")];
    const recentSection = sections.find(section =>
      section.querySelector("h2")?.textContent.trim() === "최근 운동"
    );

    if (recentSection) {
      const articles = [...recentSection.querySelectorAll(".logs article")];
      articles.forEach((article, index) => {
        article.hidden = index > 0;
      });
    }

    const manageButton = document.createElement("button");
    manageButton.type = "button";
    manageButton.className = "bb-manage-button";
    manageButton.innerHTML = `
      <span>⚙ 기록 관리</span>
      <small>전체 러닝 · 인바디 기록 수정 및 삭제</small>
    `;
    manageButton.addEventListener("click", () => openRecordManager("running"));
    runningPanel.appendChild(manageButton);
  }

  function buildNextRunRecommendation() {
    const race = getNearestRecommendationRace();
    const days = race ? daysUntilRecommendationRace(race.date) : null;
    const logs = getRecommendationLogs();
    const body = getBodyTrend(getRecords());
    const recent = summarizeRecommendationLogs(logs.slice(0, 4));
    const previous = summarizeRecommendationLogs(logs.slice(4, 8));

    const paceTrend =
      recent.paceSeconds !== null && previous.paceSeconds !== null
        ? previous.paceSeconds - recent.paceSeconds
        : null;

    const mileageJump =
      previous.distance > 0 &&
      recent.distance >= previous.distance * 1.25 &&
      recent.distance - previous.distance >= 3;

    const muscleLoss =
      body.available &&
      body.muscleDelta !== null &&
      body.muscleDelta <= -0.5;

    let recommendation;

    if (days !== null && days <= 2) {
      recommendation = {
        type: days === 0 ? "레이스 데이" : "휴식 또는 아주 가벼운 조깅",
        distance: days === 0 ? "10km" : "2~3km 선택",
        pace: days === 0 ? "목표 페이스 5'59\"/km" : "말할 수 있을 만큼 편하게",
        purpose: "컨디션 최우선",
        reason:
          `${race.name}까지 ${formatRecommendationDday(days)}입니다. 지금은 체력을 더 만드는 것보다 피로를 남기지 않는 것이 중요합니다.`,
        note:
          "통증이나 무거움이 있으면 조깅도 생략하세요."
      };
    } else if (days !== null && days <= 7) {
      recommendation = {
        type: "짧은 레이스 페이스 적응",
        distance: "4~5km",
        pace: "이지 2km + 6'00\"~6'10\"/km 1~2km",
        purpose: "다리 감각 유지",
        reason:
          `${race.name} ${formatRecommendationDday(days)}입니다. 훈련량은 줄이되 목표 페이스 감각만 짧게 확인하는 시기입니다.`,
        note:
          "끝까지 힘들게 밀지 말고 여유를 남겨 마치세요."
      };
    } else if (muscleLoss || mileageJump) {
      recommendation = {
        type: "회복 이지런",
        distance: "4~5km",
        pace: "7'25\"~7'50\"/km",
        purpose: "회복과 근육 보호",
        reason: muscleLoss
          ? "최근 골격근량 감소 신호가 있어 강도보다 편안한 움직임과 회복을 우선합니다."
          : "최근 러닝 거리가 빠르게 늘어 이번 한 회는 훈련 부담을 낮추는 편이 안전합니다.",
        note:
          body.available
            ? "체성분은 보정 요소로만 반영했습니다."
            : "인바디가 없어도 러닝 기록만으로 추천됩니다."
      };
    } else if (days !== null && days <= 21) {
      recommendation = paceTrend !== null && paceTrend < -8
        ? {
            type: "안정적인 이지런",
            distance: "5~6km",
            pace: "7'20\"~7'45\"/km",
            purpose: "피로 조절",
            reason:
              `${race.name} ${formatRecommendationDday(days)}이지만 최근 페이스 흐름이 다소 떨어져 이번에는 회복을 먼저 확보합니다.`,
            note:
              "다음 훈련에서 컨디션이 회복되면 목표 페이스 구간을 넣으세요."
          }
        : {
            type: "10K 목표 페이스 적응",
            distance: "6~7km",
            pace: "이지 2km + 6'05\"~6'15\"/km 3km",
            purpose: "Sub60 페이스 감각",
            reason:
              `${race.name} ${formatRecommendationDday(days)}입니다. 실전 페이스를 길게 버티기보다 짧고 안정적으로 익히는 시기입니다.`,
            note:
              "빠른 구간 사이에 2~3분 걷거나 천천히 뛰어도 됩니다."
          };
    } else if (days !== null && days <= 49) {
      recommendation = {
        type: "지속주",
        distance: "6~7km",
        pace: "6'45\"~7'05\"/km",
        purpose: "지구력과 페이스 안정",
        reason:
          `${race.name} ${formatRecommendationDday(days)}입니다. 기반을 유지하면서 Sub60보다 여유 있는 페이스를 오래 끌고 가는 능력을 키울 시기입니다.`,
        note:
          recent.count < 2
            ? "최근 기록이 적어 보수적으로 추천했습니다."
            : "마지막 1km까지 같은 리듬을 유지하는 것이 목표입니다."
      };
    } else {
      recommendation = {
        type: "이지런",
        distance: "5~6km",
        pace: "7'15\"~7'40\"/km",
        purpose: "유산소 기반 만들기",
        reason: race
          ? `${race.name} ${formatRecommendationDday(days)}입니다. 아직 기반을 쌓는 시기이므로 거리와 꾸준함을 우선합니다.`
          : "예정된 대회가 없어 최근 러닝 흐름을 기준으로 무리 없는 이지런을 추천합니다.",
        note:
          "호흡이 편하고 대화할 수 있는 강도로 달리세요."
      };
    }

    if (!logs.length) {
      recommendation = {
        type: "가벼운 이지런",
        distance: "4~5km",
        pace: "7'30\"~8'00\"/km",
        purpose: "현재 상태 확인",
        reason: race
          ? `${race.name} ${formatRecommendationDday(days)}입니다. 최근 러닝 기록이 없어 첫 회는 편안하게 현재 컨디션을 확인합니다.`
          : "최근 러닝 기록이 없어 첫 회는 편안하게 현재 컨디션을 확인합니다.",
        note:
          "한 번 기록하면 다음 추천부터 실제 페이스 흐름을 반영합니다."
      };
    }

    return {
      ...recommendation,
      dday: race ? `${formatRecommendationDday(days)} · ${race.name}` : "대회 일정 없음"
    };
  }

  function getNearestRecommendationRace() {
    const races = Array.isArray(window.appData?.races)
      ? window.appData.races
      : (typeof appData !== "undefined" && Array.isArray(appData.races)
          ? appData.races
          : []);

    const today = recommendationStartDay(new Date());

    return races
      .map(race => ({
        ...race,
        parsedDate: new Date(`${race.date}T00:00:00`)
      }))
      .filter(race =>
        !Number.isNaN(race.parsedDate.getTime()) &&
        recommendationStartDay(race.parsedDate) >= today
      )
      .sort((a, b) => a.parsedDate - b.parsedDate)[0] || null;
  }

  function daysUntilRecommendationRace(dateString) {
    const target = recommendationStartDay(
      new Date(`${dateString}T00:00:00`)
    );
    const today = recommendationStartDay(new Date());
    return Math.max(0, Math.ceil((target - today) / 86400000));
  }

  function recommendationStartDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function formatRecommendationDday(days) {
    if (days === 0) return "D-DAY";
    return `D-${days}`;
  }

  function getRecommendationLogs() {
    const logs = Array.isArray(window.appData?.logs)
      ? [...window.appData.logs]
      : (typeof appData !== "undefined" && Array.isArray(appData.logs)
          ? [...appData.logs]
          : []);

    return logs
      .filter(log =>
        Number(log.distance) > 0 &&
        inbodyValidRunTime(log.time)
      )
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  function summarizeRecommendationLogs(logs) {
    if (!logs.length) {
      return {
        count: 0,
        distance: 0,
        paceSeconds: null
      };
    }

    const distance = logs.reduce(
      (sum, log) => sum + Number(log.distance || 0),
      0
    );
    const seconds = logs.reduce(
      (sum, log) => sum + inbodyRunSeconds(log.time),
      0
    );

    return {
      count: logs.length,
      distance,
      paceSeconds:
        distance > 0 && seconds > 0
          ? seconds / distance
          : null
    };
  }

  function renderBalancePanel() {
    return `
      <section class="bb-hero">
        <small>BODY BALANCE</small>
        <h1>체지방은 줄이고,<br>근육과 러닝 능력은 지킵니다.</h1>
        <p>
          인바디 기록을 기준으로 체지방량 감소와 골격근량 유지를 함께 확인합니다.
        </p>
      </section>

      <section class="bb-card bb-integrated-card">
        <div class="bb-card-header">
          <div>
            <span class="bb-status-kicker">RUN × BODY</span>
            <h2>Sub60 통합 판정</h2>
            <p>최근 인바디와 러닝 기록을 함께 봅니다.</p>
          </div>
        </div>
        <div id="bbIntegratedStatus"></div>
      </section>

      <section class="bb-card bb-connection-card">
        <div class="bb-card-header">
          <div>
            <span class="bb-status-kicker">CONNECTION</span>
            <h2>러닝 × 체성분 연결 분석</h2>
            <p>두 데이터가 같은 방향으로 움직이는지 확인합니다.</p>
          </div>
        </div>
        <div id="bbConnectionAnalysis"></div>
      </section>

      <button id="bbGoToInput" class="bb-input-shortcut" type="button">
        <span>＋ 인바디 기록 추가</span>
        <small>캡처 · 직접 입력 · CSV</small>
      </button>

      <section class="bb-card">
        <div class="bb-card-header">
          <div>
            <h2>현재 변화</h2>
            <p>첫 기록과 최근 기록을 비교합니다.</p>
          </div>
        </div>
        <div id="bbSummary"></div>
      </section>

      <section class="bb-card">
        <div class="bb-card-header">
          <div>
            <h2>체성분 추세</h2>
            <p>체지방량과 골격근량을 같은 기간에서 비교합니다.</p>
          </div>
        </div>
        <canvas id="bbChart" class="bb-chart"></canvas>
        <div class="bb-legend">
          <span><i></i>체지방량</span>
          <span class="muscle"><i></i>골격근량</span>
        </div>
      </section>

      <section class="bb-card">
        <div class="bb-card-header">
          <div>
            <h2>인바디 기록</h2>
            <p id="bbRecordCount">0건</p>
          </div>
        </div>
        <div id="bbRecordList"></div>
      </section>

      <section id="bbInputSection" class="bb-card bb-input-section">
        <div class="bb-card-header">
          <div>
            <h2>인바디 데이터 등록</h2>
            <p>원본 파일은 저장하지 않고 숫자 기록만 보관합니다.</p>
          </div>
        </div>

        <div class="bb-actions">
          <label class="bb-file-button" for="bbInbodyCapture">
            인바디 캡처 가져오기
            <input id="bbInbodyCapture" type="file" accept="image/*">
          </label>
          <button id="bbManualOpen" class="bb-button secondary" type="button">
            직접 입력
          </button>
          <label class="bb-file-button bb-file-button-sub" for="bbCsvInput">
            CSV 가져오기
            <input id="bbCsvInput" type="file" accept=".csv,text/csv">
          </label>
        </div>

        <p class="bb-help">
          캡처에서 체중·골격근량·체지방량을 읽고, 체지방률은 자동 계산합니다.
          측정일은 오늘로 입력되며 저장 전에 수정할 수 있습니다.
        </p>

        <div id="bbCapturePreview" class="bb-capture-preview" hidden>
          <img id="bbCaptureImage" alt="선택한 인바디 캡처 미리보기">
          <div id="bbCaptureStatus" class="bb-capture-status">
            캡처를 확인한 뒤 숫자 읽기를 눌러 주세요.
          </div>
          <div class="bb-form-actions">
            <button id="bbCaptureCancel" class="bb-button ghost" type="button">
              다시 선택
            </button>
            <button id="bbCaptureRead" class="bb-button" type="button">
              숫자 읽기
            </button>
          </div>
        </div>

        <div id="bbCsvPreview" class="bb-preview-wrap">
          <div id="bbPreviewMeta" class="bb-preview-meta"></div>
          <div class="bb-table-wrap">
            <table class="bb-table">
              <thead>
                <tr>
                  <th>측정일</th>
                  <th>체중</th>
                  <th>골격근량</th>
                  <th>체지방량</th>
                  <th>체지방률</th>
                  <th>상태</th>
                </tr>
              </thead>
              <tbody id="bbPreviewBody"></tbody>
            </table>
          </div>
          <div class="bb-form-actions">
            <button id="bbCancelImport" class="bb-button ghost" type="button">
              취소
            </button>
            <button id="bbConfirmImport" class="bb-button" type="button">
              새 기록 저장
            </button>
          </div>
        </div>

        <section id="bbManualCard" class="bb-manual-inline" hidden>
          <div class="bb-card-header">
            <div>
              <h2 id="bbManualTitle">직접 입력</h2>
              <p>수치는 저장 전에 직접 확인할 수 있습니다.</p>
            </div>
          </div>

          <div class="bb-form-grid">
            ${field("bbDate", "측정일", "date", "", "full")}
            ${field("bbWeight", "체중 (kg)", "number", "예: 61.8")}
            ${field("bbMuscle", "골격근량 (kg)", "number", "예: 22.7")}
            ${field("bbFatMass", "체지방량 (kg)", "number", "예: 17.2")}
            ${field("bbFatRate", "체지방률 (%)", "number", "예: 27.8")}
          </div>

          <div class="bb-form-actions">
            <button id="bbManualCancel" class="bb-button ghost" type="button">
              취소
            </button>
            <button id="bbManualSave" class="bb-button" type="button">
              저장
            </button>
          </div>
        </section>
      </section>

      <button id="bbOpenRecordManager" class="bb-manage-button" type="button">
        <span>⚙ 기록 관리</span>
        <small>전체 러닝 · 인바디 기록 수정 및 삭제</small>
      </button>
    `;
  }


  function field(id, label, type, placeholder, extraClass = "") {
    return `
      <label class="bb-field ${extraClass}">
        <span>${label}</span>
        <input
          id="${id}"
          type="${type}"
          ${type === "number" ? 'inputmode="decimal" step="0.1"' : ""}
          placeholder="${placeholder}"
        >
      </label>
    `;
  }

  function bindBodyBalance() {
    document.querySelectorAll("[data-bb-tab]").forEach(button => {
      button.addEventListener("click", () => switchTab(button.dataset.bbTab));
    });

    document.getElementById("bbInbodyCapture")
      ?.addEventListener("change", handleInbodyCapture);

    document.getElementById("bbCaptureRead")
      ?.addEventListener("click", readInbodyCapture);

    document.getElementById("bbCaptureCancel")
      ?.addEventListener("click", clearInbodyCapture);

    document.getElementById("bbCsvInput")
      ?.addEventListener("change", handleCsvFile);

    document.getElementById("bbConfirmImport")
      ?.addEventListener("click", confirmCsvImport);

    document.getElementById("bbCancelImport")
      ?.addEventListener("click", resetCsvPreview);

    document.getElementById("bbGoToInput")
      ?.addEventListener("click", scrollToInputSection);

    document.getElementById("bbOpenRecordManager")
      ?.addEventListener("click", () => openRecordManager("balance"));

    document.getElementById("bbManualOpen")
      ?.addEventListener("click", () => openManualForm());

    document.getElementById("bbManualCancel")
      ?.addEventListener("click", closeManualForm);

    document.getElementById("bbManualSave")
      ?.addEventListener("click", saveManualRecord);

    document.getElementById("bbRecordList")
      ?.addEventListener("click", handleRecordAction);

    window.addEventListener("resize", debounce(drawChart, 120));
  }

  function scrollToInputSection() {
    const target = document.getElementById("bbInputSection");
    if (!target) return;

    target.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });

    target.classList.remove("is-highlighted");
    requestAnimationFrame(() => {
      target.classList.add("is-highlighted");
      window.setTimeout(() => {
        target.classList.remove("is-highlighted");
      }, 1400);
    });
  }

  function openRecordManager(returnTab = "running") {
    const app = document.getElementById("app");
    const tabbar = document.getElementById("bbTabbar");
    const running = document.getElementById("bbRunningPanel");
    const balance = document.getElementById("bbBalancePanel");
    if (!app || !tabbar || !running || !balance) return;

    document.getElementById("bbRecordManager")?.remove();

    tabbar.hidden = true;
    running.hidden = true;
    balance.hidden = true;

    const manager = document.createElement("section");
    manager.id = "bbRecordManager";
    manager.className = "bb-record-manager";
    manager.dataset.returnTab = returnTab;
    manager.innerHTML = renderRecordManager();

    app.appendChild(manager);
    bindRecordManager();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function closeRecordManager() {
    const manager = document.getElementById("bbRecordManager");
    const returnTab = manager?.dataset.returnTab || "running";
    manager?.remove();

    const tabbar = document.getElementById("bbTabbar");
    if (tabbar) tabbar.hidden = false;
    switchTab(returnTab);
  }

  function renderRecordManager() {
    const runningLogs = getManagerRunningLogs();
    const bodyRecords = getRecords().slice().reverse();

    return `
      <header class="bb-manager-header">
        <button id="bbManagerBack" type="button" aria-label="뒤로 가기">←</button>
        <div>
          <small>SETTINGS</small>
          <h1>기록 관리</h1>
          <p>전체 기록을 확인하고 수정하거나 삭제합니다.</p>
        </div>
      </header>

      <section class="bb-manager-card">
        <div class="bb-manager-title">
          <h2>러닝 기록</h2>
          <span>${runningLogs.length}건</span>
        </div>
        <div class="bb-manager-list">
          ${runningLogs.length ? runningLogs.map(log => `
            <article class="bb-manager-item">
              <div>
                <b>${managerDate(log.date)}</b>
                <p>${Number(log.distance).toFixed(2)}km · ${log.time} · ${log.pace || managerPace(log.distance, log.time)}</p>
              </div>
              <div class="bb-manager-actions">
                <button type="button" data-manager-action="edit-run" data-id="${log.id}">수정</button>
                <button type="button" data-manager-action="delete-run" data-id="${log.id}">삭제</button>
              </div>
            </article>
          `).join("") : `<p class="bb-empty">저장된 러닝 기록이 없습니다.</p>`}
        </div>
      </section>

      <section class="bb-manager-card">
        <div class="bb-manager-title">
          <h2>인바디 기록</h2>
          <span>${bodyRecords.length}건</span>
        </div>
        <div class="bb-manager-list">
          ${bodyRecords.length ? bodyRecords.map(record => `
            <article class="bb-manager-item">
              <div>
                <b>${formatDate(record.date)}</b>
                <p>
                  체중 ${displayUnit(record.weight, "kg")} ·
                  골격근 ${displayUnit(record.muscle, "kg")} ·
                  체지방량 ${displayUnit(record.fatMass, "kg")}
                </p>
              </div>
              <div class="bb-manager-actions">
                <button type="button" data-manager-action="edit-body" data-date="${record.date}">수정</button>
                <button type="button" data-manager-action="delete-body" data-date="${record.date}">삭제</button>
              </div>
            </article>
          `).join("") : `<p class="bb-empty">저장된 인바디 기록이 없습니다.</p>`}
        </div>
      </section>

      <section class="bb-manager-card bb-manager-danger">
        <div class="bb-manager-title">
          <h2>데이터 관리</h2>
        </div>
        <button id="bbClearAllData" class="bb-clear-data" type="button">
          모든 기록 초기화
        </button>
        <small>러닝과 인바디 기록이 모두 삭제되며 되돌릴 수 없습니다.</small>
      </section>
    `;
  }

  function bindRecordManager() {
    document.getElementById("bbManagerBack")
      ?.addEventListener("click", closeRecordManager);

    document.getElementById("bbRecordManager")
      ?.addEventListener("click", handleManagerAction);

    document.getElementById("bbClearAllData")
      ?.addEventListener("click", clearAllRecords);
  }

  function handleManagerAction(event) {
    const button = event.target.closest("[data-manager-action]");
    if (!button) return;

    const action = button.dataset.managerAction;

    if (action === "delete-run") deleteManagerRun(button.dataset.id);
    if (action === "edit-run") editManagerRun(button.dataset.id);
    if (action === "delete-body") deleteManagerBody(button.dataset.date);
    if (action === "edit-body") editManagerBody(button.dataset.date);
  }

  function getManagerRunningLogs() {
    const logs = Array.isArray(window.appData?.logs)
      ? [...window.appData.logs]
      : (typeof appData !== "undefined" && Array.isArray(appData.logs)
          ? [...appData.logs]
          : []);

    return logs.sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  function deleteManagerRun(id) {
    const targetId = String(id);
    const logs = getManagerRunningLogs();
    const target = logs.find(log => String(log.id) === targetId);
    if (!target) return;

    if (!confirm(`${managerDate(target.date)} 러닝 기록을 삭제할까요?`)) return;

    const remaining = logs.filter(log => String(log.id) !== targetId);
    if (typeof appData !== "undefined") {
      appData.logs = remaining;
      recalculateManagerWeek();
      localStorage.setItem("roadToSub60_v1", JSON.stringify(appData));
    }

    reopenManager();
  }

  function editManagerRun(id) {
    const logs = getManagerRunningLogs();
    const target = logs.find(log => String(log.id) === String(id));
    if (!target) return;

    const distanceInput = prompt("거리(km)를 입력하세요.", target.distance);
    if (distanceInput === null) return;
    const distance = Number(distanceInput);
    if (!Number.isFinite(distance) || distance <= 0) {
      alert("올바른 거리를 입력해 주세요.");
      return;
    }

    const timeInput = prompt("시간을 입력하세요. 예: 1:02:17", target.time);
    if (timeInput === null) return;
    if (!inbodyValidRunTime(timeInput)) {
      alert("시간 형식이 올바르지 않습니다.");
      return;
    }

    target.distance = Math.round(distance * 100) / 100;
    target.time = timeInput;
    target.pace = managerPace(target.distance, target.time);

    if (typeof appData !== "undefined") {
      appData.logs = logs;
      recalculateManagerWeek();
      localStorage.setItem("roadToSub60_v1", JSON.stringify(appData));
    }

    reopenManager();
  }

  function deleteManagerBody(date) {
    const records = getRecords();
    const target = records.find(record => record.date === date);
    if (!target) return;

    if (!confirm(`${formatDate(date)} 인바디 기록을 삭제할까요?`)) return;
    saveRecords(records.filter(record => record.date !== date));
    reopenManager();
  }

  function editManagerBody(date) {
    const records = getRecords();
    const target = records.find(record => record.date === date);
    if (!target) return;

    const weight = managerPromptNumber("체중(kg)", target.weight);
    if (weight === undefined) return;
    const muscle = managerPromptNumber("골격근량(kg)", target.muscle);
    if (muscle === undefined) return;
    const fatMass = managerPromptNumber("체지방량(kg)", target.fatMass);
    if (fatMass === undefined) return;
    const fatRate = managerPromptNumber(
      "체지방률(%)",
      target.fatRate ?? (weight && fatMass ? fatMass / weight * 100 : null)
    );
    if (fatRate === undefined) return;

    Object.assign(target, {
      weight,
      muscle,
      fatMass,
      fatRate
    });
    saveRecords(records);
    reopenManager();
  }

  function managerPromptNumber(label, value) {
    const input = prompt(label, value ?? "");
    if (input === null) return undefined;
    if (input.trim() === "") return null;

    const number = Number(input);
    if (!Number.isFinite(number) || number < 0) {
      alert(`${label} 값을 확인해 주세요.`);
      return undefined;
    }
    return Math.round(number * 10) / 10;
  }

  function clearAllRecords() {
    if (!confirm("러닝과 인바디 기록을 모두 초기화할까요?")) return;
    if (!confirm("정말 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.")) return;

    localStorage.removeItem("sub60-body-balance-v1");

    if (typeof appData !== "undefined") {
      appData.logs = [];
      appData.weekly.current = 0;
      localStorage.setItem("roadToSub60_v1", JSON.stringify(appData));
    }

    reopenManager();
  }

  function reopenManager() {
    const manager = document.getElementById("bbRecordManager");
    const returnTab = manager?.dataset.returnTab || "running";
    manager?.remove();
    openRecordManager(returnTab);
  }

  function managerDate(date) {
    const value = new Date(date);
    if (Number.isNaN(value.getTime())) return String(date || "");
    return value.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });
  }

  function managerPace(distance, time) {
    const seconds = inbodyRunSeconds(time);
    if (!distance || !seconds) return "-";

    const paceSeconds = Math.round(seconds / Number(distance));
    const minutes = Math.floor(paceSeconds / 60);
    const secondsPart = String(paceSeconds % 60).padStart(2, "0");
    return `${minutes}'${secondsPart}"/km`;
  }

  function recalculateManagerWeek() {
    if (typeof appData === "undefined") return;

    const now = new Date();
    const day = now.getDay();
    const offset = day === 0 ? -6 : 1 - day;
    const start = new Date(now);
    start.setDate(now.getDate() + offset);
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(start.getDate() + 7);

    appData.weekly.current = Math.round(
      appData.logs
        .filter(log => {
          const date = new Date(log.date);
          return date >= start && date < end;
        })
        .reduce((sum, log) => sum + Number(log.distance || 0), 0) * 100
    ) / 100;
  }

  function switchTab(tab) {
    const running = document.getElementById("bbRunningPanel");
    const balance = document.getElementById("bbBalancePanel");

    document.querySelectorAll("[data-bb-tab]").forEach(button => {
      button.classList.toggle("is-active", button.dataset.bbTab === tab);
    });

    if (tab === "balance") {
      running.hidden = true;
      balance.hidden = false;
      refreshBalanceView();
      requestAnimationFrame(drawChart);
    } else {
      running.hidden = false;
      balance.hidden = true;
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function getRecords() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(parsed)
        ? parsed.map(normalizeRecord).filter(Boolean).sort(sortByDate)
        : [];
    } catch {
      return [];
    }
  }

  function saveRecords(records) {
    const normalized = records
      .map(normalizeRecord)
      .filter(Boolean)
      .sort(sortByDate);

    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  }

  function normalizeRecord(record) {
    if (!record || !record.date) return null;

    const date = normalizeDate(record.date);
    const weight = toNumber(record.weight);
    const muscle = toNumber(record.muscle);
    const fatMass = toNumber(record.fatMass);
    const fatRate = toNumber(record.fatRate);

    if (!date || [weight, muscle, fatMass, fatRate].every(value => value === null)) {
      return null;
    }

    return { date, weight, muscle, fatMass, fatRate };
  }

  function sortByDate(a, b) {
    return a.date.localeCompare(b.date);
  }


  function handleInbodyCapture(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("인바디 캡처 이미지를 선택해 주세요.");
      event.target.value = "";
      return;
    }

    clearInbodyCapture(false);
    selectedInbodyFile = file;
    selectedInbodyUrl = URL.createObjectURL(file);

    const preview = document.getElementById("bbCapturePreview");
    const image = document.getElementById("bbCaptureImage");
    const status = document.getElementById("bbCaptureStatus");

    if (image) image.src = selectedInbodyUrl;
    if (status) status.textContent = "캡처를 확인한 뒤 숫자 읽기를 눌러 주세요.";
    if (preview) preview.hidden = false;
  }

  function clearInbodyCapture(resetInput = true) {
    if (selectedInbodyUrl) {
      URL.revokeObjectURL(selectedInbodyUrl);
    }

    selectedInbodyFile = null;
    selectedInbodyUrl = null;
    isReadingInbody = false;

    const input = document.getElementById("bbInbodyCapture");
    const preview = document.getElementById("bbCapturePreview");
    const image = document.getElementById("bbCaptureImage");
    const status = document.getElementById("bbCaptureStatus");
    const readButton = document.getElementById("bbCaptureRead");

    if (resetInput && input) input.value = "";
    if (image) image.removeAttribute("src");
    if (preview) preview.hidden = true;
    if (status) status.textContent = "캡처를 확인한 뒤 숫자 읽기를 눌러 주세요.";
    if (readButton) {
      readButton.disabled = false;
      readButton.textContent = "숫자 읽기";
    }
  }

  async function readInbodyCapture() {
    if (isReadingInbody) return;

    if (!selectedInbodyFile) {
      alert("인바디 캡처 이미지를 먼저 선택해 주세요.");
      return;
    }

    const status = document.getElementById("bbCaptureStatus");
    const readButton = document.getElementById("bbCaptureRead");
    let worker = null;

    try {
      isReadingInbody = true;
      if (readButton) {
        readButton.disabled = true;
        readButton.textContent = "읽는 중...";
      }
      if (status) status.textContent = "OCR 준비 중...";

      await ensureInbodyTesseract();
      const image = await loadInbodyImage(selectedInbodyFile);
      const crops = createInbodyCrops(image);

      worker = await Tesseract.createWorker("eng", 1, {
        logger(message) {
          if (message.status === "recognizing text" && status) {
            status.textContent =
              `숫자 읽는 중... ${Math.round((message.progress || 0) * 100)}%`;
          }
        }
      });

      await worker.setParameters({
        tessedit_pageseg_mode: "7",
        tessedit_char_whitelist: "0123456789.",
        preserve_interword_spaces: "0"
      });

      const values = {};

      for (let index = 0; index < crops.length; index += 1) {
        const crop = crops[index];
        if (status) status.textContent = `${crop.label} 읽는 중...`;

        const result = await worker.recognize(crop.canvas);
        values[crop.key] = parseInbodyMetric(
          result.data.text,
          crop.min,
          crop.max
        );
      }

      const missing = ["weight", "muscle", "fatMass"]
        .filter(key => values[key] === null);

      if (missing.length === 3) {
        throw new Error(
          "숫자를 읽지 못했습니다. 체중·골격근량·체지방량이 모두 보이는 화면을 올려 주세요."
        );
      }

      const fatRate =
        values.weight !== null &&
        values.weight > 0 &&
        values.fatMass !== null
          ? Math.round((values.fatMass / values.weight) * 1000) / 10
          : null;

      openManualForm({
        date: todayString(),
        weight: values.weight,
        muscle: values.muscle,
        fatMass: values.fatMass,
        fatRate
      });

      const title = document.getElementById("bbManualTitle");
      if (title) title.textContent = "캡처 인식 결과 확인";

      if (status) {
        status.textContent = missing.length
          ? "일부 항목을 읽지 못했습니다. 아래 결과에서 직접 입력해 주세요."
          : "인식 완료. 아래 결과를 확인한 뒤 저장해 주세요.";
      }

      toast("인바디 캡처를 읽었습니다.");
    } catch (error) {
      console.error(error);
      if (status) status.textContent = "인식에 실패했습니다.";
      alert(error.message || "인바디 캡처를 읽지 못했습니다.");
    } finally {
      if (worker) {
        try {
          await worker.terminate();
        } catch {}
      }

      isReadingInbody = false;
      if (readButton) {
        readButton.disabled = false;
        readButton.textContent = "숫자 다시 읽기";
      }
    }
  }

  function ensureInbodyTesseract() {
    if (window.Tesseract) return Promise.resolve();

    if (window.__sub60InbodyTesseractPromise) {
      return window.__sub60InbodyTesseractPromise;
    }

    window.__sub60InbodyTesseractPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src =
        "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(
        new Error("OCR 라이브러리를 불러오지 못했습니다. 인터넷 연결을 확인해 주세요.")
      );
      document.head.appendChild(script);
    });

    return window.__sub60InbodyTesseractPromise;
  }

  function loadInbodyImage(file) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      const url = URL.createObjectURL(file);

      image.onload = () => {
        URL.revokeObjectURL(url);
        resolve(image);
      };

      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("이미지를 열지 못했습니다."));
      };

      image.src = url;
    });
  }

  function createInbodyCrops(image) {
    /*
     * 보람 님이 제공한 인바디 앱 캡처 형식 기준:
     * 왼쪽 숫자 영역을 체중 / 골격근량 / 체지방량 순서로 자릅니다.
     */
    const regions = [
      { key: "weight", label: "체중", x: 0.035, y: 0.085, w: 0.20, h: 0.12, min: 25, max: 250 },
      { key: "muscle", label: "골격근량", x: 0.035, y: 0.415, w: 0.20, h: 0.12, min: 5, max: 100 },
      { key: "fatMass", label: "체지방량", x: 0.035, y: 0.745, w: 0.20, h: 0.12, min: 1, max: 150 }
    ];

    return regions.map(region => ({
      ...region,
      canvas: cropAndEnhanceInbody(image, region)
    }));
  }

  function cropAndEnhanceInbody(image, region) {
    const sourceX = Math.round(image.naturalWidth * region.x);
    const sourceY = Math.round(image.naturalHeight * region.y);
    const sourceWidth = Math.round(image.naturalWidth * region.w);
    const sourceHeight = Math.round(image.naturalHeight * region.h);
    const scale = 3;

    const canvas = document.createElement("canvas");
    canvas.width = sourceWidth * scale;
    canvas.height = sourceHeight * scale;

    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.imageSmoothingEnabled = false;
    context.drawImage(
      image,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      canvas.width,
      canvas.height
    );

    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    for (let index = 0; index < data.length; index += 4) {
      const gray =
        data[index] * 0.299 +
        data[index + 1] * 0.587 +
        data[index + 2] * 0.114;

      const value = gray < 185 ? 0 : 255;
      data[index] = value;
      data[index + 1] = value;
      data[index + 2] = value;
      data[index + 3] = 255;
    }

    context.putImageData(imageData, 0, 0);
    return canvas;
  }

  function parseInbodyMetric(rawText, min, max) {
    const cleaned = String(rawText || "")
      .replace(/,/g, ".")
      .replace(/[^0-9.]/g, "");

    const candidates = [];

    const decimals = cleaned.match(/\d{1,3}\.\d/g) || [];
    decimals.forEach(value => candidates.push(Number(value)));

    const digits = cleaned.replace(/\D/g, "");
    if (digits.length >= 2 && digits.length <= 4) {
      candidates.push(Number(digits));
      candidates.push(Number(digits) / 10);
    }

    const valid = candidates.find(
      value => Number.isFinite(value) && value >= min && value <= max
    );

    return valid === undefined ? null : Math.round(valid * 10) / 10;
  }

  async function handleCsvFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      const text = decodeCsvBuffer(buffer);
      const rows = parseCsv(text);
      const mapped = mapCsvRows(rows);

      if (!mapped.length) {
        throw new Error(
          "인바디 핵심 항목을 찾지 못했습니다. CSV 첫 행의 열 이름을 확인해 주세요."
        );
      }

      const existingDates = new Set(getRecords().map(record => record.date));

      pendingRows = mapped.map(record => ({
        ...record,
        duplicate: existingDates.has(record.date)
      }));

      renderCsvPreview();
    } catch (error) {
      console.error(error);
      resetCsvPreview();
      alert(error.message || "CSV 파일을 읽지 못했습니다.");
    } finally {
      event.target.value = "";
    }
  }

  function decodeCsvBuffer(buffer) {
    const utf8 = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
    const badChars = (utf8.match(/�/g) || []).length;

    if (badChars <= 2) return utf8;

    try {
      return new TextDecoder("euc-kr", { fatal: false }).decode(buffer);
    } catch {
      return utf8;
    }
  }

  function parseCsv(text) {
    const cleaned = String(text || "").replace(/^\uFEFF/, "");
    const delimiter = detectDelimiter(cleaned);
    const rows = [];
    let row = [];
    let field = "";
    let quoted = false;

    for (let index = 0; index < cleaned.length; index += 1) {
      const char = cleaned[index];
      const next = cleaned[index + 1];

      if (char === '"') {
        if (quoted && next === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = !quoted;
        }
      } else if (char === delimiter && !quoted) {
        row.push(field.trim());
        field = "";
      } else if ((char === "\n" || char === "\r") && !quoted) {
        if (char === "\r" && next === "\n") index += 1;
        row.push(field.trim());
        if (row.some(value => value !== "")) rows.push(row);
        row = [];
        field = "";
      } else {
        field += char;
      }
    }

    row.push(field.trim());
    if (row.some(value => value !== "")) rows.push(row);

    return rows;
  }

  function detectDelimiter(text) {
    const firstLine = text.split(/\r?\n/, 1)[0] || "";
    const candidates = [",", ";", "\t"];
    return candidates
      .map(delimiter => ({
        delimiter,
        count: firstLine.split(delimiter).length
      }))
      .sort((a, b) => b.count - a.count)[0].delimiter;
  }

  function mapCsvRows(rows) {
    if (rows.length < 2) return [];

    const headerIndex = findHeaderRow(rows);
    if (headerIndex < 0) return [];

    const headers = rows[headerIndex].map(normalizeHeader);
    const columns = {
      date: findColumn(headers, [
        "측정일", "측정일시", "검사일", "날짜", "date", "measurementdate", "testdate"
      ]),
      weight: findColumn(headers, [
        "체중", "몸무게", "weight", "bodyweight"
      ]),
      muscle: findColumn(headers, [
        "골격근량", "skeletalmusclemass", "smm", "musclemass"
      ]),
      fatMass: findColumn(headers, [
        "체지방량", "bodyfatmass", "fatmass"
      ]),
      fatRate: findColumn(headers, [
        "체지방률", "체지방율", "percentbodyfat", "bodyfatpercentage", "pbf", "bodyfat"
      ])
    };

    if (columns.date < 0) return [];

    return rows
      .slice(headerIndex + 1)
      .map(row => ({
        date: normalizeDate(row[columns.date]),
        weight: valueAt(row, columns.weight),
        muscle: valueAt(row, columns.muscle),
        fatMass: valueAt(row, columns.fatMass),
        fatRate: valueAt(row, columns.fatRate)
      }))
      .map(normalizeRecord)
      .filter(Boolean)
      .filter(record =>
        record.weight !== null ||
        record.muscle !== null ||
        record.fatMass !== null ||
        record.fatRate !== null
      );
  }

  function findHeaderRow(rows) {
    const terms = [
      "측정일", "date", "체중", "weight", "골격근량",
      "skeletalmusclemass", "체지방량", "bodyfatmass", "체지방률"
    ];

    let bestIndex = -1;
    let bestScore = 0;

    rows.slice(0, 20).forEach((row, index) => {
      const normalized = row.map(normalizeHeader);
      const score = terms.reduce(
        (sum, term) => sum + (normalized.some(value => value.includes(normalizeHeader(term))) ? 1 : 0),
        0
      );

      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    });

    return bestScore >= 2 ? bestIndex : -1;
  }

  function normalizeHeader(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/\([^)]*\)/g, "")
      .replace(/[%㎏kg]/g, "")
      .replace(/[^a-z0-9가-힣]/g, "");
  }

  function findColumn(headers, aliases) {
    const normalizedAliases = aliases.map(normalizeHeader);

    for (let index = 0; index < headers.length; index += 1) {
      if (normalizedAliases.includes(headers[index])) return index;
    }

    for (let index = 0; index < headers.length; index += 1) {
      if (normalizedAliases.some(alias => headers[index].includes(alias))) {
        return index;
      }
    }

    return -1;
  }

  function valueAt(row, index) {
    return index >= 0 ? toNumber(row[index]) : null;
  }

  function normalizeDate(raw) {
    const value = String(raw || "").trim();
    if (!value) return null;

    const compact = value.match(/(20\d{2})[.\-\/년\s]*(\d{1,2})[.\-\/월\s]*(\d{1,2})/);
    if (compact) {
      return [
        compact[1],
        String(compact[2]).padStart(2, "0"),
        String(compact[3]).padStart(2, "0")
      ].join("-");
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function toNumber(raw) {
    if (raw === null || raw === undefined || raw === "") return null;

    const value = Number.parseFloat(
      String(raw)
        .replace(/,/g, ".")
        .replace(/[^0-9.\-]/g, "")
    );

    return Number.isFinite(value) ? Math.round(value * 10) / 10 : null;
  }

  function renderCsvPreview() {
    const wrap = document.getElementById("bbCsvPreview");
    const body = document.getElementById("bbPreviewBody");
    const meta = document.getElementById("bbPreviewMeta");
    const saveButton = document.getElementById("bbConfirmImport");

    if (!wrap || !body || !meta || !saveButton) return;

    const fresh = pendingRows.filter(row => !row.duplicate);
    const duplicates = pendingRows.length - fresh.length;

    meta.innerHTML = `
      <span class="bb-chip">총 ${pendingRows.length}건</span>
      <span class="bb-chip">새 기록 ${fresh.length}건</span>
      <span class="bb-chip">중복 ${duplicates}건 제외</span>
    `;

    body.innerHTML = pendingRows
      .slice(0, 100)
      .map(row => `
        <tr>
          <td>${escapeHtml(row.date)}</td>
          <td>${display(row.weight)}</td>
          <td>${display(row.muscle)}</td>
          <td>${display(row.fatMass)}</td>
          <td>${display(row.fatRate)}</td>
          <td>${row.duplicate ? "중복 제외" : "저장 예정"}</td>
        </tr>
      `)
      .join("");

    saveButton.disabled = fresh.length === 0;
    saveButton.textContent = fresh.length
      ? `새 기록 ${fresh.length}건 저장`
      : "저장할 새 기록 없음";

    wrap.classList.add("is-visible");
  }

  function confirmCsvImport() {
    const fresh = pendingRows.filter(row => !row.duplicate);
    if (!fresh.length) return;

    const byDate = new Map(getRecords().map(record => [record.date, record]));
    fresh.forEach(record => byDate.set(record.date, record));

    saveRecords([...byDate.values()]);
    resetCsvPreview();
    refreshBalanceView();
    toast(`${fresh.length}건의 인바디 기록을 저장했습니다.`);
  }

  function resetCsvPreview() {
    pendingRows = [];
    document.getElementById("bbCsvPreview")?.classList.remove("is-visible");
    const body = document.getElementById("bbPreviewBody");
    if (body) body.innerHTML = "";
  }

  function openManualForm(record = null) {
    const card = document.getElementById("bbManualCard");
    if (!card) return;

    editingDate = record?.date || null;

    setValue("bbDate", record?.date || todayString());
    setValue("bbWeight", record?.weight);
    setValue("bbMuscle", record?.muscle);
    setValue("bbFatMass", record?.fatMass);
    setValue("bbFatRate", record?.fatRate);

    const title = document.getElementById("bbManualTitle");
    if (title) title.textContent = record ? "인바디 기록 수정" : "직접 입력";

    card.hidden = false;
    card.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function closeManualForm() {
    editingDate = null;
    const card = document.getElementById("bbManualCard");
    if (card) card.hidden = true;
  }

  function saveManualRecord() {
    const record = normalizeRecord({
      date: getValue("bbDate"),
      weight: getValue("bbWeight"),
      muscle: getValue("bbMuscle"),
      fatMass: getValue("bbFatMass"),
      fatRate: getValue("bbFatRate")
    });

    if (!record) {
      alert("측정일과 한 개 이상의 체성분 수치를 입력해 주세요.");
      return;
    }

    if (!validateRecord(record)) return;

    const records = getRecords().filter(item => item.date !== editingDate);
    const sameDate = records.find(item => item.date === record.date);

    if (sameDate && !confirm("같은 날짜의 기록이 있습니다. 덮어쓸까요?")) {
      return;
    }

    const merged = records.filter(item => item.date !== record.date);
    merged.push(record);

    saveRecords(merged);
    closeManualForm();
    refreshBalanceView();
    toast("인바디 기록을 저장했습니다.");
  }

  function validateRecord(record) {
    const rules = [
      ["체중", record.weight, 25, 250],
      ["골격근량", record.muscle, 5, 100],
      ["체지방량", record.fatMass, 1, 150],
      ["체지방률", record.fatRate, 2, 75]
    ];

    for (const [name, value, min, max] of rules) {
      if (value !== null && (value < min || value > max)) {
        alert(`${name} 값이 일반적인 범위를 벗어났습니다. 소수점을 확인해 주세요.`);
        return false;
      }
    }

    return true;
  }

  function handleRecordAction(event) {
    const button = event.target.closest("[data-bb-action]");
    if (!button) return;

    const date = button.dataset.date;
    const record = getRecords().find(item => item.date === date);
    if (!record) return;

    if (button.dataset.bbAction === "edit") {
      openManualForm(record);
      return;
    }

    if (
      button.dataset.bbAction === "delete" &&
      confirm(`${formatDate(date)} 기록을 삭제할까요?`)
    ) {
      saveRecords(getRecords().filter(item => item.date !== date));
      refreshBalanceView();
      toast("기록을 삭제했습니다.");
    }
  }

  function refreshBalanceView() {
    renderIntegratedStatus();
    renderConnectionAnalysis();
    renderSummary();
    renderRecordList();
    requestAnimationFrame(drawChart);
  }


  function renderConnectionAnalysis() {
    const container = document.getElementById("bbConnectionAnalysis");
    if (!container) return;

    const body = getBodyTrend(getRecords());
    const logs = Array.isArray(window.appData?.logs)
      ? [...window.appData.logs]
      : (typeof appData !== "undefined" && Array.isArray(appData.logs)
          ? [...appData.logs]
          : []);
    const run = getRunTrend(logs);

    if (!body.available || !run.available) {
      container.innerHTML = `
        <div class="bb-connection-empty">
          <b>연결 분석을 준비하고 있습니다.</b>
          <p>
            인바디 2회 이상과 유효한 러닝 기록 2회 이상이 필요합니다.
            기록이 쌓이면 체지방·근육 변화와 러닝 흐름을 함께 설명합니다.
          </p>
          <div class="bb-connection-counts">
            <span>인바디 ${body.count}회</span>
            <span>러닝 ${run.count}회</span>
          </div>
        </div>
      `;
      return;
    }

    const fatText = formatConnectionDelta(body.fatDelta, "kg");
    const muscleText = formatConnectionDelta(body.muscleDelta, "kg");
    const paceText = run.paceDelta === null
      ? "비교 대기"
      : run.paceDelta > 0
        ? `${Math.round(run.paceDelta)}초/km 개선`
        : run.paceDelta < 0
          ? `${Math.round(Math.abs(run.paceDelta))}초/km 저하`
          : "변화 없음";

    const interpretation = getConnectionInterpretation(body, run);

    container.innerHTML = `
      <div class="bb-connection-analysis ${interpretation.className}">
        <div class="bb-connection-metrics">
          <div>
            <span>체지방량</span>
            <b>${fatText}</b>
          </div>
          <div>
            <span>골격근량</span>
            <b>${muscleText}</b>
          </div>
          <div>
            <span>러닝 페이스</span>
            <b>${paceText}</b>
          </div>
        </div>

        <div class="bb-connection-copy">
          <span>${interpretation.label}</span>
          <h3>${interpretation.title}</h3>
          <p>${interpretation.message}</p>
        </div>

        <small>
          ${interpretation.note}
        </small>
      </div>
    `;
  }

  function formatConnectionDelta(value, unit) {
    if (value === null) return "비교 대기";
    const sign = value > 0 ? "+" : "";
    return `${sign}${value.toFixed(1)}${unit}`;
  }

  function getConnectionInterpretation(body, run) {
    const fatDown = body.fatDelta !== null && body.fatDelta <= -0.3;
    const fatUp = body.fatDelta !== null && body.fatDelta >= 0.5;
    const muscleSafe =
      body.muscleDelta === null || body.muscleDelta >= -0.3;
    const muscleDown =
      body.muscleDelta !== null && body.muscleDelta <= -0.5;
    const paceBetter =
      run.paceDelta !== null && run.paceDelta >= 5;
    const paceWorse =
      run.paceDelta !== null && run.paceDelta <= -5;

    if (fatDown && muscleSafe && paceBetter) {
      return {
        label: "함께 개선되는 흐름",
        title: "몸의 부담은 줄고 러닝 효율은 좋아지고 있습니다.",
        message:
          "체지방량 감소, 골격근량 유지, 페이스 개선이 같은 방향으로 나타났습니다.",
        note:
          "연관성은 확인되지만 체성분 변화가 페이스 향상의 직접 원인이라고 단정하지는 않습니다.",
        className: "is-positive"
      };
    }

    if (fatDown && muscleSafe && !paceWorse) {
      return {
        label: "좋은 기반 형성",
        title: "체성분은 Sub60에 유리한 방향으로 움직이고 있습니다.",
        message:
          "체지방량은 감소하고 골격근량은 유지됐습니다. 러닝 기록의 추가 변화를 지켜볼 단계입니다.",
        note:
          "같은 거리와 비슷한 심박 조건의 러닝이 쌓이면 연결 분석의 신뢰도가 높아집니다.",
        className: "is-positive"
      };
    }

    if (muscleDown && paceWorse) {
      return {
        label: "함께 저하되는 흐름",
        title: "근육 감소와 페이스 저하가 동시에 나타났습니다.",
        message:
          "감량 속도, 회복 부족 또는 영양 상태가 러닝 컨디션에 영향을 줬을 가능성이 있습니다.",
        note:
          "수면, 기온, 코스, 운동 강도 등 다른 요인도 함께 확인해야 합니다.",
        className: "is-warning"
      };
    }

    if (fatUp && paceWorse) {
      return {
        label: "생활 흐름 점검",
        title: "체지방과 러닝 기록이 모두 좋지 않은 방향입니다.",
        message:
          "단기 피로, 식사 리듬 또는 훈련 공백의 영향을 점검하는 것이 좋습니다.",
        note:
          "한 번의 인바디 측정만으로 식사량을 급격히 줄이지 마세요.",
        className: "is-warning"
      };
    }

    if (fatDown && paceWorse) {
      return {
        label: "방향이 엇갈림",
        title: "체지방은 줄었지만 러닝 페이스는 떨어졌습니다.",
        message:
          "감량 자체보다 피로, 회복, 날씨 또는 코스 영향이 더 컸을 수 있습니다.",
        note:
          "현재 데이터로는 체성분과 러닝 변화의 직접적인 연결을 판단하기 어렵습니다.",
        className: "is-neutral"
      };
    }

    return {
      label: "추가 관찰 필요",
      title: "아직 뚜렷한 연결 패턴은 보이지 않습니다.",
      message:
        "체성분과 러닝 기록이 서로 다른 방향으로 움직이거나 변화 폭이 작습니다.",
      note:
        "2~4주간 같은 조건의 인바디와 러닝 기록을 더 모으면 패턴을 확인할 수 있습니다.",
      className: "is-neutral"
    };
  }

  function renderIntegratedStatus() {
    const container = document.getElementById("bbIntegratedStatus");
    if (!container) return;

    const bodyRecords = getRecords();
    const runningLogs = Array.isArray(window.appData?.logs)
      ? [...window.appData.logs]
      : (typeof appData !== "undefined" && Array.isArray(appData.logs)
          ? [...appData.logs]
          : []);

    const bodyTrend = getBodyTrend(bodyRecords);
    const runTrend = getRunTrend(runningLogs);
    const status = getIntegratedVerdict(bodyTrend, runTrend);

    container.innerHTML = `
      <div class="bb-integrated-status ${status.className}">
        <span class="bb-status-badge">${status.badge}</span>
        <h3>${status.title}</h3>
        <p>${status.message}</p>

        <div class="bb-status-evidence">
          ${status.evidence.map(item => `
            <div class="${item.tone}">
              <span>${item.label}</span>
              <b>${item.value}</b>
            </div>
          `).join("")}
        </div>

        <small class="bb-status-note">${status.note}</small>
      </div>
    `;
  }

  function getBodyTrend(records) {
    if (!records.length) {
      return {
        available: false,
        count: 0,
        fatDelta: null,
        muscleDelta: null,
        weightDelta: null
      };
    }

    const first = records[0];
    const latest = records[records.length - 1];

    return {
      available: records.length >= 2,
      count: records.length,
      fatDelta: delta(latest.fatMass, first.fatMass),
      muscleDelta: delta(latest.muscle, first.muscle),
      weightDelta: delta(latest.weight, first.weight)
    };
  }

  function getRunTrend(logs) {
    const valid = logs
      .filter(log =>
        Number(log.distance) > 0 &&
        inbodyValidRunTime(log.time)
      )
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    if (!valid.length) {
      return {
        available: false,
        count: 0,
        paceDelta: null,
        recentDistance: 0,
        previousDistance: 0
      };
    }

    const recent = valid.slice(0, 4);
    const previous = valid.slice(4, 8);

    const recentDistance = recent.reduce(
      (sum, log) => sum + Number(log.distance || 0),
      0
    );

    const previousDistance = previous.reduce(
      (sum, log) => sum + Number(log.distance || 0),
      0
    );

    const recentPace = weightedRunPace(recent);
    const previousPace = weightedRunPace(previous);

    return {
      available: recent.length >= 2,
      count: valid.length,
      paceDelta:
        recentPace !== null && previousPace !== null
          ? previousPace - recentPace
          : null,
      recentDistance: Math.round(recentDistance * 10) / 10,
      previousDistance: Math.round(previousDistance * 10) / 10
    };
  }

  function weightedRunPace(logs) {
    if (!logs.length) return null;

    const distance = logs.reduce(
      (sum, log) => sum + Number(log.distance || 0),
      0
    );

    const seconds = logs.reduce(
      (sum, log) => sum + inbodyRunSeconds(log.time),
      0
    );

    return distance > 0 && seconds > 0
      ? seconds / distance
      : null;
  }

  function inbodyValidRunTime(time) {
    const parts = String(time || "").split(":").map(Number);

    if (
      parts.length < 2 ||
      parts.length > 3 ||
      parts.some(Number.isNaN)
    ) {
      return false;
    }

    return parts.every((value, index) =>
      index === 0 ? value >= 0 : value >= 0 && value < 60
    );
  }

  function inbodyRunSeconds(time) {
    const parts = String(time || "").split(":").map(Number);

    if (parts.length === 2) {
      return parts[0] * 60 + parts[1];
    }

    if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }

    return 0;
  }

  function getIntegratedVerdict(body, run) {
    const bodyReady = body.available;
    const runReady = run.available;

    if (!bodyReady && !runReady) {
      return {
        badge: "START",
        title: "기준 기록을 쌓는 중입니다.",
        message:
          "인바디 2회 이상과 러닝 기록 2회 이상이 쌓이면 Sub60 관점의 통합 판정을 시작합니다.",
        className: "is-neutral",
        evidence: [
          {
            label: "인바디",
            value: `${body.count}회`,
            tone: "is-neutral"
          },
          {
            label: "러닝",
            value: `${run.count}회`,
            tone: "is-neutral"
          }
        ],
        note: "한 번의 수치보다 반복 측정의 흐름을 중요하게 봅니다."
      };
    }

    const fatDown = body.fatDelta !== null && body.fatDelta <= -0.3;
    const fatUp = body.fatDelta !== null && body.fatDelta >= 0.5;
    const muscleSafe =
      body.muscleDelta === null || body.muscleDelta >= -0.3;
    const muscleLoss =
      body.muscleDelta !== null && body.muscleDelta <= -0.5;
    const paceBetter =
      run.paceDelta !== null && run.paceDelta >= 5;
    const paceWorse =
      run.paceDelta !== null && run.paceDelta <= -5;
    const mileageUp =
      run.previousDistance > 0 &&
      run.recentDistance >= run.previousDistance + 2;

    if (fatDown && muscleSafe && paceBetter) {
      return {
        badge: "BEST FLOW",
        title: "가벼워지면서 빨라지고 있습니다.",
        message:
          "체지방은 줄고 골격근량은 유지되며, 최근 러닝 페이스도 좋아졌습니다. Sub60에 가장 이상적인 흐름입니다.",
        className: "is-best",
        evidence: [
          evidenceDelta("체지방량", body.fatDelta, "kg", "good"),
          evidenceDelta("골격근량", body.muscleDelta, "kg", "good"),
          evidencePace(run.paceDelta)
        ],
        note: "현재 식사와 훈련 강도를 무리하게 바꾸지 않는 것이 좋습니다."
      };
    }

    if (fatDown && muscleSafe) {
      return {
        badge: "GOOD CUT",
        title: "러닝에 좋은 감량 흐름입니다.",
        message:
          "체지방 부담은 줄고 추진력에 필요한 골격근량은 유지되고 있습니다.",
        className: "is-good",
        evidence: [
          evidenceDelta("체지방량", body.fatDelta, "kg", "good"),
          evidenceDelta("골격근량", body.muscleDelta, "kg", "good"),
          {
            label: "최근 러닝",
            value: runReady ? "흐름 확인 중" : "기록 필요",
            tone: "is-neutral"
          }
        ],
        note: "러닝 페이스 변화가 함께 확인되면 통합 판정이 더 정교해집니다."
      };
    }

    if (muscleLoss) {
      return {
        badge: "RECOVERY FIRST",
        title: "감량 속도를 조절해야 합니다.",
        message:
          "체중이나 체지방이 줄었더라도 골격근량 감소 폭이 큽니다. 회복과 영양을 먼저 점검하세요.",
        className: "is-warning",
        evidence: [
          evidenceDelta("체지방량", body.fatDelta, "kg", "neutral"),
          evidenceDelta("골격근량", body.muscleDelta, "kg", "bad"),
          {
            label: "권장",
            value: "회복 우선",
            tone: "is-bad"
          }
        ],
        note: "단백질 섭취, 운동일 탄수화물, 수면 상태를 함께 확인하세요."
      };
    }

    if (mileageUp && muscleSafe) {
      return {
        badge: "BASE UP",
        title: "지구력 기반이 강화되고 있습니다.",
        message:
          "최근 러닝 거리가 늘었지만 골격근량은 안정적으로 유지되고 있습니다.",
        className: "is-good",
        evidence: [
          {
            label: "최근 4회 거리",
            value: `${run.recentDistance.toFixed(1)}km`,
            tone: "is-good"
          },
          evidenceDelta("골격근량", body.muscleDelta, "kg", "good"),
          {
            label: "훈련 상태",
            value: "기반 강화",
            tone: "is-good"
          }
        ],
        note: "거리 증가와 함께 회복일을 유지하세요."
      };
    }

    if (fatUp && paceWorse) {
      return {
        badge: "CHECK FLOW",
        title: "회복과 식사 흐름을 점검할 때입니다.",
        message:
          "체지방량이 늘고 최근 러닝 페이스도 느려졌습니다. 단기 피로 또는 생활 리듬의 영향을 확인하세요.",
        className: "is-warning",
        evidence: [
          evidenceDelta("체지방량", body.fatDelta, "kg", "bad"),
          evidencePace(run.paceDelta),
          {
            label: "권장",
            value: "컨디션 점검",
            tone: "is-bad"
          }
        ],
        note: "한 번의 인바디 수치만으로 식사량을 급격히 줄이지 마세요."
      };
    }

    return {
      badge: "BUILDING",
      title: "Sub60 기반을 차근차근 쌓고 있습니다.",
      message:
        "현재 변화는 크지 않지만 위험 신호도 뚜렷하지 않습니다. 같은 조건의 기록을 조금 더 모아보세요.",
      className: "is-neutral",
      evidence: [
        evidenceDelta("체지방량", body.fatDelta, "kg", "neutral"),
        evidenceDelta("골격근량", body.muscleDelta, "kg", "neutral"),
        {
          label: "러닝 기록",
          value: `${run.count}회`,
          tone: "is-neutral"
        }
      ],
      note: "2~4주 단위의 추세가 가장 신뢰할 만합니다."
    };
  }

  function evidenceDelta(label, value, unit, preferredTone) {
    if (value === null) {
      return {
        label,
        value: "비교 대기",
        tone: "is-neutral"
      };
    }

    const sign = value > 0 ? "+" : "";
    let tone = "is-neutral";

    if (preferredTone === "good") {
      tone = value >= -0.3 ? "is-good" : "is-bad";
    } else if (preferredTone === "bad") {
      tone = value <= -0.5 ? "is-bad" : "is-neutral";
    }

    return {
      label,
      value: `${sign}${value.toFixed(1)}${unit}`,
      tone
    };
  }

  function evidencePace(value) {
    if (value === null) {
      return {
        label: "러닝 페이스",
        value: "비교 대기",
        tone: "is-neutral"
      };
    }

    const seconds = Math.round(Math.abs(value));
    return {
      label: "러닝 페이스",
      value:
        value > 0
          ? `${seconds}초/km 개선`
          : value < 0
            ? `${seconds}초/km 저하`
            : "변화 없음",
      tone:
        value >= 5
          ? "is-good"
          : value <= -5
            ? "is-bad"
            : "is-neutral"
    };
  }

  function renderSummary() {
    const container = document.getElementById("bbSummary");
    if (!container) return;

    const records = getRecords();

    if (!records.length) {
      container.innerHTML = `
        <p class="bb-empty">
          인바디 캡처를 가져오거나 최근 측정값을 직접 입력해 주세요.
        </p>
      `;
      return;
    }

    const first = records[0];
    const latest = records[records.length - 1];
    const fatDelta = delta(latest.fatMass, first.fatMass);
    const muscleDelta = delta(latest.muscle, first.muscle);
    const weightDelta = delta(latest.weight, first.weight);

    const verdict = getVerdict(fatDelta, muscleDelta, records.length);

    container.innerHTML = `
      <div class="bb-summary-grid">
        ${metric("최근 체지방량", displayUnit(latest.fatMass, "kg"), changeText(fatDelta, "kg"))}
        ${metric("최근 골격근량", displayUnit(latest.muscle, "kg"), changeText(muscleDelta, "kg"))}
        ${metric("최근 체지방률", displayUnit(latest.fatRate, "%"), `${formatDate(latest.date)} 측정`)}
        ${metric("체중 변화", changeText(weightDelta, "kg", true), `${records.length}회 기록 기준`)}
      </div>
      <div class="bb-verdict ${verdict.warn ? "warn" : ""}">
        <b>${verdict.title}</b><br>
        ${verdict.message}
      </div>
    `;
  }

  function metric(label, value, subtext) {
    return `
      <div class="bb-metric">
        <span>${label}</span>
        <b>${value}</b>
        <small>${subtext}</small>
      </div>
    `;
  }

  function getVerdict(fatDelta, muscleDelta, count) {
    if (count < 2) {
      return {
        title: "기준 기록이 저장되었습니다.",
        message: "다음 인바디 기록부터 체지방량 감소와 골격근량 유지 여부를 비교합니다.",
        warn: false
      };
    }

    if (fatDelta !== null && fatDelta < -0.2 && (muscleDelta === null || muscleDelta >= -0.3)) {
      return {
        title: "좋은 체지방 감소 흐름입니다.",
        message: "체지방량은 감소하고 골격근량은 대체로 유지되고 있습니다. 현재 식사와 운동 방식을 유지하세요.",
        warn: false
      };
    }

    if (muscleDelta !== null && muscleDelta < -0.5) {
      return {
        title: "근손실 가능성을 확인해야 합니다.",
        message: "골격근량 감소 폭이 큽니다. 단백질 섭취, 운동일 탄수화물, 수면과 회복 상태를 함께 점검하세요.",
        warn: true
      };
    }

    if (fatDelta !== null && fatDelta > 0.5) {
      return {
        title: "한 번의 수치로 계획을 바꾸지 마세요.",
        message: "체수분이나 측정 조건에 따른 변동일 수 있습니다. 같은 조건에서 다음 측정값까지 추세를 확인하세요.",
        warn: true
      };
    }

    return {
      title: "추가 기록이 필요합니다.",
      message: "현재 변화 폭은 작습니다. 동일한 측정 조건으로 2~4주 추세를 더 확인하는 것이 좋습니다.",
      warn: false
    };
  }

  function renderRecordList() {
    const list = document.getElementById("bbRecordList");
    const count = document.getElementById("bbRecordCount");
    if (!list || !count) return;

    const records = getRecords().slice().reverse();
    count.textContent = `${records.length}건`;

    if (!records.length) {
      list.innerHTML = `<p class="bb-empty">저장된 인바디 기록이 없습니다.</p>`;
      return;
    }

    const record = records[0];
    list.innerHTML = `
      <div class="bb-record-list">
        <article class="bb-record">
          <div class="bb-record-main">
            <b>${formatDate(record.date)}</b>
            <div class="bb-record-values">
              <span>체중 ${displayUnit(record.weight, "kg")}</span>
              <span>골격근 ${displayUnit(record.muscle, "kg")}</span>
              <span>체지방량 ${displayUnit(record.fatMass, "kg")}</span>
              <span>체지방률 ${displayUnit(record.fatRate, "%")}</span>
            </div>
          </div>
        </article>
      </div>
    `;
  }

  function drawChart() {
    const canvas = document.getElementById("bbChart");
    const panel = document.getElementById("bbBalancePanel");
    if (!canvas || panel?.hidden) return;

    const records = getRecords()
      .filter(record => record.fatMass !== null || record.muscle !== null)
      .slice(-12);

    const rect = canvas.getBoundingClientRect();
    if (!rect.width) return;

    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(rect.width * ratio);
    canvas.height = Math.round(220 * ratio);

    const ctx = canvas.getContext("2d");
    ctx.scale(ratio, ratio);

    const width = rect.width;
    const height = 220;
    const padding = { top: 20, right: 18, bottom: 34, left: 38 };

    ctx.clearRect(0, 0, width, height);

    if (records.length < 2) {
      ctx.fillStyle = "#6d7773";
      ctx.font = "13px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("두 번 이상 기록하면 추세 그래프가 표시됩니다.", width / 2, height / 2);
      return;
    }

    const values = records
      .flatMap(record => [record.fatMass, record.muscle])
      .filter(value => value !== null);

    let min = Math.min(...values);
    let max = Math.max(...values);
    const gap = Math.max(1, (max - min) * 0.18);
    min -= gap;
    max += gap;

    const x = index =>
      padding.left +
      index * ((width - padding.left - padding.right) / (records.length - 1));

    const y = value =>
      padding.top +
      (max - value) / (max - min) *
      (height - padding.top - padding.bottom);

    ctx.strokeStyle = "rgba(26,48,41,.10)";
    ctx.lineWidth = 1;
    ctx.fillStyle = "#6d7773";
    ctx.font = "11px system-ui";
    ctx.textAlign = "right";

    for (let i = 0; i <= 4; i += 1) {
      const value = max - (max - min) * (i / 4);
      const yy = padding.top + (height - padding.top - padding.bottom) * (i / 4);
      ctx.beginPath();
      ctx.moveTo(padding.left, yy);
      ctx.lineTo(width - padding.right, yy);
      ctx.stroke();
      ctx.fillText(value.toFixed(1), padding.left - 6, yy + 4);
    }

    drawSeries(
      records.map(record => record.fatMass),
      "#315d4f",
      x,
      y,
      ctx
    );

    drawSeries(
      records.map(record => record.muscle),
      "#d77a4a",
      x,
      y,
      ctx
    );

    ctx.fillStyle = "#6d7773";
    ctx.textAlign = "center";

    records.forEach((record, index) => {
      if (index === 0 || index === records.length - 1 || records.length <= 5) {
        ctx.fillText(record.date.slice(5).replace("-", "."), x(index), height - 12);
      }
    });
  }

  function drawSeries(values, color, x, y, ctx) {
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    let started = false;
    ctx.beginPath();

    values.forEach((value, index) => {
      if (value === null) return;
      if (!started) {
        ctx.moveTo(x(index), y(value));
        started = true;
      } else {
        ctx.lineTo(x(index), y(value));
      }
    });
    ctx.stroke();

    values.forEach((value, index) => {
      if (value === null) return;
      ctx.beginPath();
      ctx.arc(x(index), y(value), 3.5, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function delta(latest, first) {
    if (latest === null || first === null) return null;
    return Math.round((latest - first) * 10) / 10;
  }

  function changeText(value, unit, standalone = false) {
    if (value === null) return standalone ? "-" : "비교 데이터 없음";
    const sign = value > 0 ? "+" : "";
    return `${sign}${value.toFixed(1)}${unit}`;
  }

  function display(value) {
    return value === null ? "-" : Number(value).toFixed(1);
  }

  function displayUnit(value, unit) {
    return value === null ? "-" : `${Number(value).toFixed(1)}${unit}`;
  }

  function formatDate(date) {
    const [year, month, day] = date.split("-");
    return `${year}.${month}.${day}`;
  }

  function todayString() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function getValue(id) {
    return document.getElementById(id)?.value ?? "";
  }

  function setValue(id, value) {
    const element = document.getElementById(id);
    if (element) element.value = value ?? "";
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function toast(message) {
    const element = document.getElementById("bbToast");
    if (!element) return;

    element.textContent = message;
    element.classList.add("is-visible");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => {
      element.classList.remove("is-visible");
    }, 2200);
  }

  function debounce(fn, delay) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }
})();


