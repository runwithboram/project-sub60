/*
 * Road to SUB60 Dashboard v2.4
 * - 최신 러닝 효율 원형 게이지
 * - 최근 기록 비교
 * - Sub60 진행률
 * - Coach Analysis
 * - 운동 기록 입력 아코디언
 * - 최근 효율 추세 차트와 평균·최고점
 * - AI Coach: 컨디션, 레이스 준비도, 다음 러닝 추천
 */
(() => {
  let pendingHeartRate = null;
  let recordPanelOpen = false;

  const originalRenderApp = window.renderApp;
  const originalSaveWorkout = window.saveWorkout;
  const originalApplyExtractedData = window.applyExtractedData;

  window.renderApp = function renderAppV22() {
    backfillEfficiencyScores();
    originalRenderApp();
    enhanceHero();
    injectHeartRateInput();
    injectEfficiencyDashboard();
    arrangeDashboard();
    setupRecordAccordion();
  };

  window.applyExtractedData = function applyExtractedDataV22(extracted) {
    originalApplyExtractedData(extracted);

    const input = document.getElementById("avgHeartRate");
    const heartRate = validHeartRate(extracted?.avgHeartRate);

    if (input && heartRate !== null) {
      input.value = heartRate;
    }
  };

  window.saveWorkout = function saveWorkoutV22() {
    pendingHeartRate = validHeartRate(
      document.getElementById("avgHeartRate")?.value
    );

    const beforeId = appData.logs[0]?.id;
    originalSaveWorkout();

    const newestLog = appData.logs[0];

    if (!newestLog || newestLog.id === beforeId) {
      pendingHeartRate = null;
      return;
    }

    if (pendingHeartRate !== null) {
      newestLog.avgHeartRate = pendingHeartRate;
      newestLog.efficiencyScore = calculateEfficiencyScore(newestLog);
      save();
    }

    pendingHeartRate = null;
    recordPanelOpen = false;

    renderApp();
    bind();
  };

  function backfillEfficiencyScores() {
    let changed = false;

    appData.logs.forEach(log => {
      if (!hasEfficiencyData(log)) return;

      const score = calculateEfficiencyScore(log);

      if (score !== null && Number(log.efficiencyScore) !== score) {
        log.efficiencyScore = score;
        changed = true;
      }
    });

    if (changed) save();
  }

  function enhanceHero() {
    const heroRow = document.querySelector(".heroRow");
    if (!heroRow || heroRow.querySelector(".hero-target")) return;

    const race = typeof getNextRace === "function" ? getNextRace() : null;
    const target = race?.target || "59:59";

    const targetLine = document.createElement("span");
    targetLine.className = "hero-target";
    targetLine.textContent = `목표 ${target}`;

    const raceInfo = heroRow.querySelector("div");
    raceInfo?.appendChild(targetLine);
  }

  function injectHeartRateInput() {
    const saveButton = document.getElementById("saveRun");

    if (!saveButton || document.getElementById("efficiencyHeartField")) {
      return;
    }

    const box = document.createElement("div");
    box.id = "efficiencyHeartField";
    box.className = "efficiency-heart-field";

    box.innerHTML = `
      <label>
        <span>평균 심박 (bpm)</span>
        <input
          id="avgHeartRate"
          type="number"
          inputmode="numeric"
          min="40"
          max="230"
          placeholder="Garmin 자동 인식 또는 직접 입력"
        >
      </label>
      <small>
        평균 심박이 포함된 기록부터 효율 점수가 계산됩니다.
      </small>
    `;

    saveButton.before(box);
  }

  function injectEfficiencyDashboard() {
    document.getElementById("efficiencyDashboard")?.remove();

    const hero = document.querySelector(".hero");
    if (!hero) return;

    const dashboard = document.createElement("section");
    dashboard.id = "efficiencyDashboard";
    dashboard.className = "card efficiency-dashboard";

    const validLogs = appData.logs
      .filter(hasEfficiencyData)
      .map(log => ({
        ...log,
        efficiencyScore: calculateEfficiencyScore(log)
      }));

    const latest = validLogs[0];

    if (!latest) {
      dashboard.classList.add("is-empty");
      dashboard.innerHTML = `
        <div class="empty-efficiency-icon">↗</div>

        <div class="empty-efficiency-copy">
          <span>LATEST RUN</span>
          <h2>첫 효율 기록을 기다리고 있어요</h2>
          <p>
            Garmin 캡처를 읽고 저장하면 평균 심박과 페이스를 바탕으로
            효율 점수가 자동 계산됩니다.
          </p>
        </div>

        <button
          id="openRecordFromEmpty"
          class="dashboard-action"
          type="button"
        >
          첫 러닝 기록하기
        </button>
      `;

      hero.after(dashboard);

      dashboard
        .querySelector("#openRecordFromEmpty")
        ?.addEventListener("click", () => {
          recordPanelOpen = true;
          openRecordPanel();
        });

      return;
    }

    const previousLogs = validLogs.slice(1, 6);
    const comparison = compareWithRecent(latest, previousLogs);
    const prediction = predictTenK(latest);
    const progress = getSub60Progress(prediction.seconds);
    const evaluation = evaluateEfficiency(
      latest.efficiencyScore,
      comparison.delta
    );
    const circumference = 100;
    const scoreValue = Math.max(0, Math.min(100, latest.efficiencyScore));

    dashboard.innerHTML = `
      <div class="dashboard-topline">
        <div>
          <span class="dashboard-kicker">LATEST RUN</span>
          <h2>러닝 효율</h2>
        </div>

        <span class="efficiency-status ${evaluation.className}">
          ${evaluation.label}
        </span>
      </div>

      <div class="dashboard-primary">
        <div
          class="score-ring"
          style="--score:${scoreValue}"
          aria-label="러닝 효율 ${scoreValue}점"
        >
          <div class="score-ring-inner">
            <strong>${scoreValue}</strong>
            <span>EFFICIENCY</span>
          </div>
        </div>

        <div class="latest-summary">
          <span>${logDate(latest.date)}</span>
          <strong>${Number(latest.distance).toFixed(2)} km</strong>
          <p class="${comparison.className}">
            ${comparison.text}
          </p>
        </div>
      </div>

      <div class="dashboard-metrics">
        <div>
          <span>평균 페이스</span>
          <b>${latest.pace}</b>
        </div>

        <div>
          <span>평균 심박</span>
          <b>${latest.avgHeartRate}</b>
          <small>bpm</small>
        </div>

        <div>
          <span>예상 10K</span>
          <b>${prediction.formatted}</b>
        </div>
      </div>

      <div class="goal-panel">
        <div class="goal-panel-head">
          <div>
            <span>ROAD TO SUB60</span>
            <b>${progress.headline}</b>
          </div>

          <strong>${progress.percent}%</strong>
        </div>

        <div class="goal-track">
          <i style="width:${progress.percent}%"></i>
        </div>

        <small>${progress.message}</small>
      </div>

      ${buildTrendPanel(validLogs)}

      ${buildCoachPanel(latest, comparison, validLogs, prediction)}

      <button
        id="openRecordFromDashboard"
        class="dashboard-action secondary"
        type="button"
      >
        새 러닝 기록하기
      </button>

      <small class="efficiency-disclaimer">
        개인 기록의 변화 추세를 보기 위한 지표입니다.
        코스와 날씨가 비슷한 러닝끼리 비교할수록 유용합니다.
      </small>
    `;

    hero.after(dashboard);

    dashboard
      .querySelector("#openRecordFromDashboard")
      ?.addEventListener("click", () => {
        recordPanelOpen = true;
        openRecordPanel();
      });
  }

  function arrangeDashboard() {
    const app = document.getElementById("app");
    const recordCard = findCardByTitle("운동 기록");

    if (!app || !recordCard) return;

    recordCard.classList.add("record-card");
    app.appendChild(recordCard);
  }

  function setupRecordAccordion() {
    const card = findCardByTitle("운동 기록");
    if (!card || card.dataset.accordionReady === "true") return;

    card.dataset.accordionReady = "true";

    const oldTitle = card.querySelector(":scope > h2");
    if (!oldTitle) return;

    const content = document.createElement("div");
    content.className = "record-panel-content";

    [...card.children]
      .filter(child => child !== oldTitle)
      .forEach(child => content.appendChild(child));

    const header = document.createElement("button");
    header.type = "button";
    header.className = "record-panel-toggle";
    header.setAttribute("aria-expanded", String(recordPanelOpen));
    header.innerHTML = `
      <span>
        <small>ADD WORKOUT</small>
        <b>운동 기록</b>
      </span>

      <i aria-hidden="true">+</i>
    `;

    oldTitle.replaceWith(header);
    card.appendChild(content);

    card.classList.toggle("is-open", recordPanelOpen);

    header.addEventListener("click", () => {
      recordPanelOpen = !card.classList.contains("is-open");
      card.classList.toggle("is-open", recordPanelOpen);
      header.setAttribute("aria-expanded", String(recordPanelOpen));

      if (recordPanelOpen) {
        setTimeout(() => {
          card.scrollIntoView({
            behavior: "smooth",
            block: "start"
          });
        }, 80);
      }
    });
  }

  function openRecordPanel() {
    const card = findCardByTitle("운동 기록") ||
      document.querySelector(".record-card");

    if (!card) return;

    card.classList.add("is-open");

    const toggle = card.querySelector(".record-panel-toggle");
    toggle?.setAttribute("aria-expanded", "true");

    setTimeout(() => {
      card.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }, 80);
  }

  function findCardByTitle(title) {
    return [...document.querySelectorAll(".card")].find(card => {
      const heading = card.querySelector(":scope > h2");
      const toggleTitle = card.querySelector(
        ":scope > .record-panel-toggle b"
      );

      return (
        heading?.textContent.trim() === title ||
        toggleTitle?.textContent.trim() === title
      );
    });
  }

  function hasEfficiencyData(log) {
    return (
      Number(log?.distance) > 0 &&
      validHeartRate(log?.avgHeartRate) !== null &&
      timeToSeconds(log?.time) > 0
    );
  }

  function calculateEfficiencyScore(log) {
    const totalMinutes = timeToSeconds(log.time) / 60;
    const speedMetersPerMinute =
      Number(log.distance) * 1000 / totalMinutes;
    const heartRate = validHeartRate(log.avgHeartRate);

    if (
      !Number.isFinite(speedMetersPerMinute) ||
      heartRate === null
    ) {
      return null;
    }

    return Math.max(
      0,
      Math.min(
        100,
        Math.round((speedMetersPerMinute / heartRate) * 100)
      )
    );
  }

  function compareWithRecent(latest, previousLogs) {
    if (!previousLogs.length) {
      return {
        delta: null,
        text: "첫 번째 효율 기준 기록입니다",
        className: "is-neutral"
      };
    }

    const average =
      previousLogs.reduce(
        (sum, log) => sum + Number(log.efficiencyScore || 0),
        0
      ) / previousLogs.length;

    const delta =
      Math.round((latest.efficiencyScore - average) * 10) / 10;

    if (delta > 0) {
      return {
        delta,
        text:
          `최근 ${previousLogs.length}회 평균보다 ` +
          `+${delta.toFixed(1)}점`,
        className: "is-up"
      };
    }

    if (delta < 0) {
      return {
        delta,
        text:
          `최근 ${previousLogs.length}회 평균보다 ` +
          `${delta.toFixed(1)}점`,
        className: "is-down"
      };
    }

    return {
      delta,
      text: `최근 ${previousLogs.length}회 평균과 동일`,
      className: "is-neutral"
    };
  }

  function evaluateEfficiency(score, delta) {
    if (delta !== null && delta >= 3) {
      return {
        label: "효율 향상",
        className: "is-excellent"
      };
    }

    if (delta !== null && delta <= -3) {
      return {
        label: "회복 점검",
        className: "is-watch"
      };
    }

    if (score >= 88) {
      return {
        label: "매우 좋음",
        className: "is-excellent"
      };
    }

    if (score >= 82) {
      return {
        label: "좋음",
        className: "is-good"
      };
    }

    return {
      label: "기준 기록",
      className: "is-neutral"
    };
  }

  function buildTrendPanel(validLogs) {
    const recent = validLogs.slice(0, 7).reverse();

    if (recent.length < 2) {
      return `
        <div class="trend-panel is-locked">
          <div class="trend-panel-head">
            <div>
              <span>RECENT TREND</span>
              <b>효율 추세</b>
            </div>
            <small>1회 더 필요</small>
          </div>
          <p>
            평균 심박이 포함된 러닝을 한 번 더 저장하면
            최근 효율 변화가 그래프로 나타납니다.
          </p>
        </div>
      `;
    }

    const scores = recent.map(log => Number(log.efficiencyScore));
    const average = Math.round(
      scores.reduce((sum, score) => sum + score, 0) / scores.length
    );
    const best = Math.max(...scores);
    const first = scores[0];
    const last = scores[scores.length - 1];
    const change = last - first;
    const trendClass = change > 0 ? "is-up" : change < 0 ? "is-down" : "is-neutral";
    const trendText = change > 0
      ? `+${change}점`
      : change < 0
        ? `${change}점`
        : "변화 없음";
    const chart = buildTrendSvg(scores);

    return `
      <div class="trend-panel">
        <div class="trend-panel-head">
          <div>
            <span>RECENT TREND</span>
            <b>최근 ${recent.length}회 효율</b>
          </div>
          <small class="${trendClass}">${trendText}</small>
        </div>

        <div class="trend-chart" aria-label="최근 러닝 효율 추세">
          ${chart}
        </div>

        <div class="trend-stats">
          <div>
            <span>최근 평균</span>
            <b>${average}</b>
          </div>
          <div>
            <span>최고 효율</span>
            <b>${best}</b>
          </div>
          <div>
            <span>최근 점수</span>
            <b>${last}</b>
          </div>
        </div>
      </div>
    `;
  }

  function buildTrendSvg(scores) {
    const width = 300;
    const height = 96;
    const paddingX = 10;
    const paddingY = 12;
    const minScore = Math.min(...scores);
    const maxScore = Math.max(...scores);
    const range = Math.max(8, maxScore - minScore);
    const chartMin = minScore - Math.max(2, (8 - (maxScore - minScore)) / 2);
    const chartMax = chartMin + range;
    const step = scores.length > 1
      ? (width - paddingX * 2) / (scores.length - 1)
      : 0;

    const points = scores.map((score, index) => {
      const x = paddingX + step * index;
      const ratio = (score - chartMin) / (chartMax - chartMin);
      const y = height - paddingY - ratio * (height - paddingY * 2);
      return { x, y, score };
    });

    const line = points
      .map(point => `${point.x.toFixed(1)},${point.y.toFixed(1)}`)
      .join(" ");
    const area = [
      `${points[0].x.toFixed(1)},${height - paddingY}`,
      line,
      `${points[points.length - 1].x.toFixed(1)},${height - paddingY}`
    ].join(" ");
    const dots = points.map((point, index) => `
      <circle
        cx="${point.x.toFixed(1)}"
        cy="${point.y.toFixed(1)}"
        r="${index === points.length - 1 ? 4.5 : 3}"
        class="${index === points.length - 1 ? "is-latest" : ""}"
      ></circle>
    `).join("");

    return `
      <svg viewBox="0 0 ${width} ${height}" role="img">
        <defs>
          <linearGradient id="efficiencyTrendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="currentColor" stop-opacity=".24"></stop>
            <stop offset="100%" stop-color="currentColor" stop-opacity="0"></stop>
          </linearGradient>
        </defs>
        <line x1="10" y1="84" x2="290" y2="84" class="trend-baseline"></line>
        <polygon points="${area}" fill="url(#efficiencyTrendFill)"></polygon>
        <polyline points="${line}" class="trend-line"></polyline>
        <g class="trend-dots">${dots}</g>
      </svg>
    `;
  }

  function buildCoachPanel(latest, comparison, validLogs, prediction) {
    const coach = getCoachAnalysis(
      latest,
      comparison,
      validLogs,
      prediction
    );

    return `
      <section class="ai-coach-card ${coach.className}">
        <div class="ai-coach-head">
          <div class="ai-coach-title">
            <div class="coach-symbol">AI</div>
            <div>
              <span>AI COACH</span>
              <h3>${coach.condition}</h3>
            </div>
          </div>

          <div class="readiness-score" aria-label="레이스 준비도 ${coach.readiness}퍼센트">
            <strong>${coach.readiness}</strong>
            <span>READINESS</span>
          </div>
        </div>

        <p class="coach-summary">${coach.message}</p>

        <div class="coach-signals">
          ${coach.signals.map(signal => `
            <span class="${signal.className}">${signal.text}</span>
          `).join("")}
        </div>

        <div class="next-run-card">
          <div>
            <span>NEXT RUN</span>
            <b>${coach.nextRun.title}</b>
          </div>
          <strong>${coach.nextRun.distance}</strong>
          <p>${coach.nextRun.detail}</p>
        </div>

        <small class="coach-note">
          최근 저장 기록을 바탕으로 한 자동 코칭입니다. 컨디션이 좋지 않으면 회복을 우선하세요.
        </small>
      </section>
    `;
  }

  function getCoachAnalysis(latest, comparison, validLogs, prediction) {
    const recent = validLogs.slice(0, 5);
    const scores = recent.map(log => Number(log.efficiencyScore));
    const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    const latestScore = Number(latest.efficiencyScore);
    const trendDelta = comparison.delta ?? 0;
    const targetGap = Math.max(0, prediction.seconds - 3600);

    let readiness = Math.round(
      45 +
      Math.max(0, Math.min(30, (latestScore - 70) * 1.5)) +
      Math.max(-8, Math.min(8, trendDelta * 1.4)) +
      Math.max(0, Math.min(12, recent.length * 2.4))
    );

    if (targetGap <= 0) readiness += 8;
    else if (targetGap <= 180) readiness += 5;
    else if (targetGap >= 600) readiness -= 5;

    readiness = Math.max(20, Math.min(96, readiness));

    let condition = "안정적인 흐름";
    let className = "is-steady";
    let message = buildCoachMessage(latest, comparison);
    let nextRun = {
      title: "이지런",
      distance: "5–6 km",
      detail: "대화가 가능한 강도로 편안하게 달리며 회복과 주간 볼륨을 확보하세요."
    };

    if (trendDelta >= 3 && latestScore >= average) {
      condition = "컨디션 좋음";
      className = "is-ready";
      nextRun = {
        title: "템포런",
        distance: "5–7 km",
        detail: "워밍업 후 15–20분을 6:05–6:20/km 범위로 유지해 Sub60 페이스 적응을 높이세요."
      };
    } else if (trendDelta <= -3) {
      condition = "회복 우선";
      className = "is-recovery";
      nextRun = {
        title: "회복런 또는 휴식",
        distance: "3–5 km",
        detail: "심박을 낮게 유지하고 다리가 무겁다면 러닝 대신 걷기·스트레칭으로 바꾸세요."
      };
    } else if (targetGap > 300 && latestScore >= 82) {
      condition = "속도 자극 필요";
      className = "is-build";
      nextRun = {
        title: "짧은 인터벌",
        distance: "총 6 km",
        detail: "400m 빠르게·400m 천천히를 5회 반복하고, 빠른 구간은 무리하지 않는 5K 노력도로 진행하세요."
      };
    }

    const signals = [
      {
        text: trendDelta > 0
          ? `효율 +${trendDelta.toFixed(1)}`
          : trendDelta < 0
            ? `효율 ${trendDelta.toFixed(1)}`
            : "효율 유지",
        className: trendDelta > 0 ? "is-positive" : trendDelta < 0 ? "is-caution" : ""
      },
      {
        text: `평균 심박 ${latest.avgHeartRate} bpm`,
        className: ""
      },
      {
        text: prediction.seconds <= 3600
          ? "Sub60 페이스권"
          : `목표까지 ${formatGap(prediction.seconds - 3600)}`,
        className: prediction.seconds <= 3600 ? "is-positive" : ""
      }
    ];

    return {
      readiness,
      condition,
      className,
      message,
      nextRun,
      signals
    };
  }

  function buildCoachMessage(latest, comparison) {
    if (comparison.delta === null) {
      return (
        "첫 효율 기준이 저장됐습니다. 앞으로 기록이 쌓이면 " +
        "최근 5회 평균과 자동으로 비교합니다."
      );
    }

    if (comparison.delta >= 3) {
      return (
        `최근 평균보다 효율이 ${comparison.delta.toFixed(1)}점 ` +
        "높습니다. 같은 심박 대비 속도가 좋아진 흐름입니다."
      );
    }

    if (comparison.delta <= -3) {
      return (
        `최근 평균보다 효율이 ` +
        `${Math.abs(comparison.delta).toFixed(1)}점 낮습니다. ` +
        "더위, 피로, 수면 상태와 코스 난도를 함께 확인하세요."
      );
    }

    return (
      `${latest.avgHeartRate}bpm에서 ${latest.pace}를 기록했습니다. ` +
      "최근 효율 범위를 안정적으로 유지하고 있습니다."
    );
  }

  function predictTenK(log) {
    const paceSeconds =
      timeToSeconds(log.time) / Number(log.distance);
    const predictedSeconds = Math.round(paceSeconds * 10);

    return {
      seconds: predictedSeconds,
      formatted: formatDuration(predictedSeconds)
    };
  }

  function getSub60Progress(predictedSeconds) {
    const target = 60 * 60;
    const baseline = 75 * 60;
    const rawPercent =
      ((baseline - predictedSeconds) / (baseline - target)) * 100;
    const percent = Math.max(
      0,
      Math.min(100, Math.round(rawPercent))
    );
    const gap = predictedSeconds - target;

    if (gap <= 0) {
      return {
        percent: 100,
        headline: "SUB60 기준 통과",
        message: "현재 페이스 기준 예상 기록이 60분 이내입니다."
      };
    }

    return {
      percent,
      headline: `${formatGap(gap)} 남음`,
      message:
        `현재 페이스 기준 Sub60까지 ` +
        `${formatGap(gap)} 단축이 필요합니다.`
    };
  }

  function timeToSeconds(time) {
    const parts = String(time || "").split(":").map(Number);

    if (parts.some(Number.isNaN)) return 0;

    if (parts.length === 2) {
      return parts[0] * 60 + parts[1];
    }

    if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }

    return 0;
  }

  function formatDuration(totalSeconds) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secondsPart = totalSeconds % 60;

    if (hours > 0) {
      return (
        `${hours}:` +
        `${String(minutes).padStart(2, "0")}:` +
        `${String(secondsPart).padStart(2, "0")}`
      );
    }

    return (
      `${minutes}:` +
      `${String(secondsPart).padStart(2, "0")}`
    );
  }

  function formatGap(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60);
    const secondsPart = totalSeconds % 60;

    return (
      `${minutes}분 ` +
      `${String(secondsPart).padStart(2, "0")}초`
    );
  }

  function validHeartRate(value) {
    if (
      value === "" ||
      value === null ||
      value === undefined
    ) {
      return null;
    }

    const number = Number(value);

    if (
      !Number.isFinite(number) ||
      number < 40 ||
      number > 230
    ) {
      return null;
    }

    return Math.round(number);
  }
})();
