/*
 * Running efficiency dashboard v2.0
 * 가장 최근 저장 기록을 기준으로 효율 점수와 최근 5회 추세를 표시합니다.
 */
(() => {
  let pendingHeartRate = null;

  const originalRenderApp = window.renderApp;
  const originalSaveWorkout = window.saveWorkout;
  const originalApplyExtractedData = window.applyExtractedData;

  window.renderApp = function renderAppWithEfficiency() {
    originalRenderApp();
    injectHeartRateInput();
    injectEfficiencyDashboard();
  };

  window.applyExtractedData = function applyExtractedDataWithHeartRate(extracted) {
    originalApplyExtractedData(extracted);

    const input = document.getElementById("avgHeartRate");
    const heartRate = validHeartRate(extracted?.avgHeartRate);

    if (input && heartRate !== null) {
      input.value = heartRate;
    }
  };

  window.saveWorkout = function saveWorkoutWithEfficiency() {
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
    renderApp();
    bind();
  };

  function injectHeartRateInput() {
    const saveButton = document.getElementById("saveRun");
    if (!saveButton || document.getElementById("efficiencyHeartField")) return;

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
      <small>평균 심박이 있어야 러닝 효율 점수가 계산됩니다.</small>
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
      dashboard.innerHTML = `
        <div class="efficiency-header">
          <div>
            <span class="efficiency-eyebrow">LATEST RUN</span>
            <h2>러닝 효율</h2>
          </div>
          <span class="efficiency-status is-empty">기록 대기</span>
        </div>
        <p class="efficiency-empty">
          평균 심박이 포함된 러닝을 저장하면 앱을 다시 열어도 가장 최근 효율 점수가 자동으로 표시됩니다.
        </p>
      `;

      hero.after(dashboard);
      return;
    }

    const previousFive = validLogs.slice(1, 6);
    const comparison = compareWithRecent(latest, previousFive);
    const prediction = predictTenK(latest);
    const progress = getSub60Progress(prediction.seconds);
    const evaluation = evaluateEfficiency(latest.efficiencyScore, comparison.delta);

    dashboard.innerHTML = `
      <div class="efficiency-header">
        <div>
          <span class="efficiency-eyebrow">LATEST RUN · ${logDate(latest.date)}</span>
          <h2>러닝 효율</h2>
        </div>
        <span class="efficiency-status ${evaluation.className}">${evaluation.label}</span>
      </div>

      <div class="efficiency-main">
        <div class="efficiency-score">
          <strong>${latest.efficiencyScore}</strong>
          <span>점</span>
        </div>
        <div class="efficiency-change ${comparison.className}">
          ${comparison.text}
        </div>
      </div>

      <div class="efficiency-metrics">
        <div>
          <span>평균 페이스</span>
          <b>${latest.pace}</b>
        </div>
        <div>
          <span>평균 심박</span>
          <b>${latest.avgHeartRate} bpm</b>
        </div>
        <div>
          <span>거리</span>
          <b>${Number(latest.distance).toFixed(2)} km</b>
        </div>
      </div>

      <div class="sub60-progress">
        <div class="sub60-progress-head">
          <div>
            <span>현재 페이스 기준 10K</span>
            <b>${prediction.formatted}</b>
          </div>
          <strong>${progress.percent}%</strong>
        </div>
        <div class="sub60-track"><i style="width:${progress.percent}%"></i></div>
        <small>${progress.message}</small>
      </div>

      <div class="efficiency-coach">
        <span>Coach Analysis</span>
        <p>${buildCoachMessage(latest, comparison, evaluation)}</p>
      </div>

      <small class="efficiency-note">
        효율 점수는 평균 속도와 평균 심박의 비율입니다. 비슷한 거리·코스·날씨의 러닝끼리 비교할 때 가장 유용합니다.
      </small>
    `;

    hero.after(dashboard);
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
    const speedMetersPerMinute = Number(log.distance) * 1000 / totalMinutes;
    const heartRate = validHeartRate(log.avgHeartRate);

    if (!Number.isFinite(speedMetersPerMinute) || heartRate === null) return null;

    return Math.max(
      0,
      Math.min(100, Math.round((speedMetersPerMinute / heartRate) * 100))
    );
  }

  function compareWithRecent(latest, previousLogs) {
    if (!previousLogs.length) {
      return {
        delta: null,
        text: "첫 효율 기록",
        className: "is-neutral"
      };
    }

    const average = previousLogs.reduce(
      (sum, log) => sum + Number(log.efficiencyScore || 0),
      0
    ) / previousLogs.length;

    const delta = Math.round((latest.efficiencyScore - average) * 10) / 10;

    if (delta > 0) {
      return {
        delta,
        text: `최근 ${previousLogs.length}회 평균보다 +${delta.toFixed(1)}점`,
        className: "is-up"
      };
    }

    if (delta < 0) {
      return {
        delta,
        text: `최근 ${previousLogs.length}회 평균보다 ${delta.toFixed(1)}점`,
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
      return { label: "효율 향상", className: "is-excellent" };
    }

    if (delta !== null && delta <= -3) {
      return { label: "회복 점검", className: "is-watch" };
    }

    if (score >= 88) {
      return { label: "매우 좋음", className: "is-excellent" };
    }

    if (score >= 82) {
      return { label: "좋음", className: "is-good" };
    }

    return { label: "기준 기록", className: "is-neutral" };
  }

  function buildCoachMessage(latest, comparison, evaluation) {
    if (comparison.delta === null) {
      return "첫 효율 기준이 저장됐습니다. 앞으로 비슷한 조건의 러닝이 쌓이면 최근 5회 평균과 자동 비교합니다.";
    }

    if (comparison.delta >= 3) {
      return `최근 평균보다 효율이 ${comparison.delta.toFixed(1)}점 높습니다. 같은 심박 대비 속도가 좋아진 긍정적인 흐름입니다.`;
    }

    if (comparison.delta <= -3) {
      return `최근 평균보다 효율이 ${Math.abs(comparison.delta).toFixed(1)}점 낮습니다. 더위, 피로, 오르막, 수면 상태를 함께 확인하고 다음 러닝은 무리하지 않는 편이 좋습니다.`;
    }

    return `${evaluation.label} 흐름입니다. ${latest.avgHeartRate}bpm에서 ${latest.pace}를 기록했으며 최근 효율 범위를 안정적으로 유지하고 있습니다.`;
  }

  function predictTenK(log) {
    const paceSeconds = timeToSeconds(log.time) / Number(log.distance);
    const predictedSeconds = Math.round(paceSeconds * 10);

    return {
      seconds: predictedSeconds,
      formatted: formatDuration(predictedSeconds)
    };
  }

  function getSub60Progress(predictedSeconds) {
    const target = 60 * 60;
    const startingPoint = 75 * 60;
    const rawPercent =
      ((startingPoint - predictedSeconds) / (startingPoint - target)) * 100;
    const percent = Math.max(0, Math.min(100, Math.round(rawPercent)));
    const gap = predictedSeconds - target;

    if (gap <= 0) {
      return { percent: 100, message: "현재 페이스는 Sub60 기준을 통과했습니다." };
    }

    return {
      percent,
      message: `Sub60까지 ${formatGap(gap)} 단축이 필요합니다.`
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

    return hours > 0
      ? `${hours}:${String(minutes).padStart(2, "0")}:${String(secondsPart).padStart(2, "0")}`
      : `${minutes}:${String(secondsPart).padStart(2, "0")}`;
  }

  function formatGap(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60);
    const secondsPart = totalSeconds % 60;
    return `${minutes}분 ${String(secondsPart).padStart(2, "0")}초`;
  }

  function validHeartRate(value) {
    if (value === "" || value === null || value === undefined) return null;

    const number = Number(value);
    if (!Number.isFinite(number) || number < 40 || number > 230) return null;

    return Math.round(number);
  }
})();
