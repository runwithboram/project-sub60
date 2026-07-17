/*
 * Heart-rate drift v1.2
 * 기존 app.js / ui.js를 직접 덮어쓰지 않고 기능을 확장합니다.
 */
(() => {
  let pendingHeartData = null;

  const originalRenderApp = window.renderApp;
  const originalSaveWorkout = window.saveWorkout;
  const originalApplyExtractedData = window.applyExtractedData;

  window.renderApp = function renderAppWithHeartDrift() {
    originalRenderApp();
    injectHeartInputs();
    injectHeartDriftCard();
  };

  window.applyExtractedData = function applyExtractedDataWithHeartRate(extracted) {
    originalApplyExtractedData(extracted);

    const avgHeartRateInput = document.getElementById("avgHeartRate");
    if (
      avgHeartRateInput &&
      Number.isFinite(Number(extracted?.avgHeartRate))
    ) {
      avgHeartRateInput.value = extracted.avgHeartRate;
    }
  };

  window.saveWorkout = function saveWorkoutWithHeartDrift() {
    pendingHeartData = readHeartInputs();
    const beforeId = appData.logs[0]?.id;

    originalSaveWorkout();

    const newestLog = appData.logs[0];
    if (!newestLog || newestLog.id === beforeId) {
      pendingHeartData = null;
      return;
    }

    if (pendingHeartData) {
      Object.assign(newestLog, pendingHeartData);
      save();
    }

    pendingHeartData = null;
    injectHeartInputs();
    injectHeartDriftCard();
  };

  function injectHeartInputs() {
    const saveButton = document.getElementById("saveRun");
    if (!saveButton || document.getElementById("heartDriftFields")) return;

    const box = document.createElement("div");
    box.id = "heartDriftFields";
    box.className = "heart-fields";
    box.innerHTML = `
      <div class="heart-fields-title">
        <div>
          <b>심박 드리프트</b>
          <small>선택 입력 · 전반부와 후반부 평균 심박을 입력하세요.</small>
        </div>
        <span>HR</span>
      </div>

      <label>
        <span>전체 평균 심박 (bpm)</span>
        <input
          id="avgHeartRate"
          type="number"
          inputmode="numeric"
          min="40"
          max="230"
          placeholder="예: 164"
        >
      </label>

      <div class="heart-input-grid">
        <label>
          <span>전반부 평균 심박</span>
          <input
            id="firstHalfHeartRate"
            type="number"
            inputmode="numeric"
            min="40"
            max="230"
            placeholder="예: 158"
          >
        </label>

        <label>
          <span>후반부 평균 심박</span>
          <input
            id="secondHalfHeartRate"
            type="number"
            inputmode="numeric"
            min="40"
            max="230"
            placeholder="예: 166"
          >
        </label>
      </div>

      <div id="driftPreview" class="drift-preview">
        전·후반 심박을 입력하면 드리프트가 계산됩니다.
      </div>
    `;

    saveButton.before(box);

    document
      .getElementById("firstHalfHeartRate")
      ?.addEventListener("input", updateDriftPreview);

    document
      .getElementById("secondHalfHeartRate")
      ?.addEventListener("input", updateDriftPreview);
  }

  function readHeartInputs() {
    const avgHeartRate = validHeartRate(
      document.getElementById("avgHeartRate")?.value
    );
    const firstHalfHeartRate = validHeartRate(
      document.getElementById("firstHalfHeartRate")?.value
    );
    const secondHalfHeartRate = validHeartRate(
      document.getElementById("secondHalfHeartRate")?.value
    );

    if (
      avgHeartRate === null &&
      firstHalfHeartRate === null &&
      secondHalfHeartRate === null
    ) {
      return null;
    }

    const heartDrift =
      firstHalfHeartRate !== null && secondHalfHeartRate !== null
        ? calculateHeartDrift(firstHalfHeartRate, secondHalfHeartRate)
        : null;

    return {
      avgHeartRate,
      firstHalfHeartRate,
      secondHalfHeartRate,
      heartDrift
    };
  }

  function updateDriftPreview() {
    const first = validHeartRate(
      document.getElementById("firstHalfHeartRate")?.value
    );
    const second = validHeartRate(
      document.getElementById("secondHalfHeartRate")?.value
    );
    const preview = document.getElementById("driftPreview");

    if (!preview) return;

    if (first === null || second === null) {
      preview.textContent =
        "전·후반 심박을 입력하면 드리프트가 계산됩니다.";
      preview.className = "drift-preview";
      return;
    }

    const drift = calculateHeartDrift(first, second);
    const evaluation = evaluateHeartDrift(drift);

    preview.innerHTML = `
      예상 드리프트 <b>${formatSignedPercent(drift)}</b>
      <span>${evaluation.label}</span>
    `;
    preview.className = `drift-preview ${evaluation.className}`;
  }

  function injectHeartDriftCard() {
    document.getElementById("heartDriftCard")?.remove();

    const latest = appData.logs.find(
      log => Number.isFinite(Number(log.heartDrift))
    );

    const recentCard = findRecentWorkoutCard();
    if (!recentCard) return;

    const card = document.createElement("section");
    card.id = "heartDriftCard";
    card.className = "card heart-drift-card";

    if (!latest) {
      card.innerHTML = `
        <div class="drift-card-header">
          <div>
            <h2>심박 드리프트</h2>
            <small>유산소 지구력과 페이스 안정성 확인</small>
          </div>
          <span class="drift-badge is-empty">기록 대기</span>
        </div>

        <p class="drift-empty">
          다음 러닝 저장 시 전반부와 후반부 평균 심박을 입력하면 자동 분석됩니다.
        </p>
      `;
    } else {
      const drift = Number(latest.heartDrift);
      const evaluation = evaluateHeartDrift(drift);

      card.innerHTML = `
        <div class="drift-card-header">
          <div>
            <h2>심박 드리프트</h2>
            <small>${logDate(latest.date)} · ${Number(latest.distance).toFixed(2)} km</small>
          </div>
          <span class="drift-badge ${evaluation.className}">
            ${evaluation.label}
          </span>
        </div>

        <div class="drift-number ${evaluation.className}">
          <b>${formatSignedPercent(drift)}</b>
          <span>후반부 심박 변화</span>
        </div>

        <div class="drift-metrics">
          <div>
            <span>전반부</span>
            <b>${latest.firstHalfHeartRate} bpm</b>
          </div>
          <div>
            <span>후반부</span>
            <b>${latest.secondHalfHeartRate} bpm</b>
          </div>
          <div>
            <span>전체 평균</span>
            <b>${latest.avgHeartRate ?? "-"}${latest.avgHeartRate ? " bpm" : ""}</b>
          </div>
        </div>

        <div class="drift-coach">
          <span>Coach Analysis</span>
          <p>${evaluation.message}</p>
        </div>

        <small class="drift-note">
          동일하거나 비슷한 페이스로 달린 구간에서 비교할수록 정확합니다.
        </small>
      `;
    }

    recentCard.before(card);
  }

  function findRecentWorkoutCard() {
    return [...document.querySelectorAll(".card")].find(
      card => card.querySelector("h2")?.textContent.trim() === "최근 운동"
    );
  }

  function validHeartRate(value) {
    if (value === "" || value === null || value === undefined) return null;

    const number = Number(value);
    if (!Number.isFinite(number) || number < 40 || number > 230) return null;

    return Math.round(number);
  }

  function calculateHeartDrift(first, second) {
    return Math.round((((second - first) / first) * 100) * 10) / 10;
  }

  function formatSignedPercent(value) {
    const sign = value > 0 ? "+" : "";
    return `${sign}${value.toFixed(1)}%`;
  }

  function evaluateHeartDrift(drift) {
    if (drift <= 3) {
      return {
        label: "매우 안정적",
        className: "is-excellent",
        message:
          "후반부까지 심박이 안정적으로 유지됐습니다. 현재 강도에서 유산소 지구력이 좋게 나타납니다."
      };
    }

    if (drift <= 5) {
      return {
        label: "안정적",
        className: "is-good",
        message:
          "일반적으로 양호한 범위입니다. 같은 페이스에서 이 수준을 유지하면 지구력 향상 흐름이 좋습니다."
      };
    }

    if (drift <= 8) {
      return {
        label: "주의",
        className: "is-watch",
        message:
          "후반부 심박 상승이 다소 큽니다. 더위, 수분 부족, 피로 또는 초반 과속 여부를 함께 확인하세요."
      };
    }

    return {
      label: "높음",
      className: "is-high",
      message:
        "심박 상승 폭이 큽니다. 다음 러닝은 속도를 낮추고 회복, 수분 섭취, 기온 영향을 우선 점검하세요."
    };
  }
})();
