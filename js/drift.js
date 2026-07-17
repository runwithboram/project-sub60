/*
 * Road to SUB60 Dashboard v2.1
 * - 최신 러닝 효율 원형 게이지
 * - 최근 기록 비교
 * - Sub60 진행률
 * - Coach Analysis
 * - 운동 기록 입력 아코디언
 */
(() => {
  let pendingHeartRate = null;
  let recordPanelOpen = false;

  const originalRenderApp = window.renderApp;
  const originalSaveWorkout = window.saveWorkout;
  const originalApplyExtractedData = window.applyExtractedData;

  window.renderApp = function renderAppV21() {
    originalRenderApp();
    enhanceHero();
    injectHeartRateInput();
    injectEfficiencyDashboard();
    arrangeDashboard();
    setupRecordAccordion();
  };

  window.applyExtractedData = function applyExtractedDataV21(extracted) {
    originalApplyExtractedData(extracted);

    const input = document.getElementById("avgHeartRate");
    const heartRate = validHeartRate(extracted?.avgHeartRate);

    if (input && heartRate !== null) {
      input.value = heartRate;
    }
  };

  window.saveWorkout = function saveWorkoutV21() {
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

      <div class="coach-panel">
        <div class="coach-symbol">AI</div>
        <div>
          <span>COACH ANALYSIS</span>
          <p>${buildCoachMessage(latest, comparison)}</p>
        </div>
      </div>

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
