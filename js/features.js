/* Road to SUB60 v2.5: record management, dates, backup, improved 10K estimate */
(() => {
  let pendingWorkoutDate = "";
  const baseRenderApp = window.renderApp;
  const baseSaveWorkout = window.saveWorkout;

  window.renderApp = function renderAppV25() {
    baseRenderApp();
    injectFeatureStyles();
    injectWorkoutDate();
    injectRecordManager();
    enhanceSettingsBackup();
    refreshTenKEstimate();
  };

  window.saveWorkout = function saveWorkoutV25() {
    pendingWorkoutDate = document.getElementById("workoutDate")?.value || localDateValue();
    const beforeId = appData.logs[0]?.id;
    baseSaveWorkout();
    const newest = appData.logs[0];

    if (!newest || newest.id === beforeId) return;

    newest.date = dateValueToIso(pendingWorkoutDate);
    newest.efficiencyScore = calculateEfficiencyForFeature(newest);
    sortLogs();
    recalcWeek();
    save();
    renderApp();
    bind();
  };

  function injectWorkoutDate() {
    const distanceInput = document.getElementById("distance");
    const parentLabel = distanceInput?.closest("label");
    if (!parentLabel || document.getElementById("workoutDate")) return;

    const label = document.createElement("label");
    label.innerHTML = `
      <span>운동 날짜</span>
      <input id="workoutDate" type="date" max="${localDateValue()}" value="${localDateValue()}">
    `;
    parentLabel.before(label);
  }

  function injectRecordManager() {
    document.getElementById("recordManager")?.remove();
    const recentCard = findCard("최근 운동");
    if (!recentCard) return;

    const card = document.createElement("section");
    card.id = "recordManager";
    card.className = "card record-manager";
    const logs = [...appData.logs].sort((a, b) => new Date(b.date) - new Date(a.date));

    card.innerHTML = `
      <header class="record-manager-head">
        <div><h2>기록 관리</h2><small>날짜·거리·시간·심박 수정 및 개별 삭제</small></div>
        <b>${logs.length}개</b>
      </header>
      ${logs.length ? `
        <div class="record-manager-list">
          ${logs.map(log => `
            <article>
              <div class="record-manager-main">
                <b>${formatDate(log.date)} · ${Number(log.distance).toFixed(2)} km</b>
                <small>${log.time} · ${log.pace}${validHeartRateForFeature(log.avgHeartRate) !== null ? ` · ${log.avgHeartRate} bpm` : ""}</small>
              </div>
              <div class="record-manager-actions">
                <button type="button" data-edit-log="${log.id}">수정</button>
                <button type="button" class="danger-text" data-delete-log="${log.id}">삭제</button>
              </div>
            </article>
          `).join("")}
        </div>
      ` : `<p class="muted">수정할 기록이 없습니다.</p>`}
    `;

    recentCard.after(card);
    card.querySelectorAll("[data-edit-log]").forEach(button => {
      button.addEventListener("click", () => openEditModal(Number(button.dataset.editLog)));
    });
    card.querySelectorAll("[data-delete-log]").forEach(button => {
      button.addEventListener("click", () => deleteLog(Number(button.dataset.deleteLog)));
    });
  }

  function openEditModal(id) {
    const log = appData.logs.find(item => Number(item.id) === id);
    if (!log) return;

    document.getElementById("recordEditModal")?.remove();
    const modal = document.createElement("div");
    modal.id = "recordEditModal";
    modal.className = "feature-modal is-open";
    modal.innerHTML = `
      <div class="feature-backdrop" data-close-edit></div>
      <section class="feature-sheet" role="dialog" aria-modal="true" aria-labelledby="editRecordTitle">
        <div class="feature-sheet-head">
          <div><span>EDIT RUN</span><h2 id="editRecordTitle">러닝 기록 수정</h2></div>
          <button type="button" data-close-edit aria-label="닫기">×</button>
        </div>
        <label><span>운동 날짜</span><input id="editDate" type="date" max="${localDateValue()}" value="${isoToDateValue(log.date)}"></label>
        <label><span>거리 (km)</span><input id="editDistance" type="number" inputmode="decimal" step="0.01" min="0.01" value="${Number(log.distance)}"></label>
        <label><span>시간</span><input id="editTime" type="text" inputmode="numeric" value="${String(log.time).replace(/\D/g, "")}" placeholder="예: 5120"></label>
        <label><span>평균 심박 (bpm)</span><input id="editHeartRate" type="number" inputmode="numeric" min="40" max="230" value="${log.avgHeartRate ?? ""}"></label>
        <div class="feature-preview">평균 페이스 <b id="editPacePreview">${log.pace}</b></div>
        <button id="saveEditedLog" type="button" class="feature-primary">수정 저장</button>
      </section>
    `;
    document.body.appendChild(modal);
    document.body.classList.add("feature-modal-open");

    const close = () => {
      modal.remove();
      document.body.classList.remove("feature-modal-open");
    };
    modal.querySelectorAll("[data-close-edit]").forEach(element => element.addEventListener("click", close));
    ["editDistance", "editTime"].forEach(inputId => {
      modal.querySelector(`#${inputId}`)?.addEventListener("input", updateEditPace);
    });
    modal.querySelector("#saveEditedLog")?.addEventListener("click", () => saveEditedLog(id, close));
  }

  function updateEditPace() {
    const distance = Number(document.getElementById("editDistance")?.value || 0);
    const formatted = formatTime(document.getElementById("editTime")?.value || "");
    const preview = document.getElementById("editPacePreview");
    if (preview) preview.textContent = distance > 0 && validTime(formatted) ? pace(distance, formatted) : "-";
  }

  function saveEditedLog(id, close) {
    const log = appData.logs.find(item => Number(item.id) === id);
    if (!log) return;

    const date = document.getElementById("editDate")?.value;
    const distance = Number(document.getElementById("editDistance")?.value || 0);
    const formattedTime = formatTime(document.getElementById("editTime")?.value || "");
    const heartRate = validHeartRateForFeature(document.getElementById("editHeartRate")?.value);

    if (!date) return alert("운동 날짜를 선택해 주세요.");
    if (!Number.isFinite(distance) || distance <= 0) return alert("거리를 확인해 주세요.");
    if (!validTime(formattedTime)) return alert("시간을 확인해 주세요.");

    log.date = dateValueToIso(date);
    log.distance = round(distance);
    log.time = formattedTime;
    log.pace = pace(distance, formattedTime);
    if (heartRate === null) delete log.avgHeartRate;
    else log.avgHeartRate = heartRate;
    log.efficiencyScore = calculateEfficiencyForFeature(log);

    sortLogs();
    recalcWeek();
    save();
    close();
    renderApp();
    bind();
  }

  function deleteLog(id) {
    const log = appData.logs.find(item => Number(item.id) === id);
    if (!log) return;
    if (!window.confirm(`${formatDate(log.date)} ${Number(log.distance).toFixed(2)}km 기록을 삭제할까요?`)) return;
    appData.logs = appData.logs.filter(item => Number(item.id) !== id);
    recalcWeek();
    save();
    renderApp();
    bind();
  }

  function enhanceSettingsBackup() {
    const sheet = document.querySelector("#settingsModal .settings-sheet");
    if (!sheet || sheet.querySelector("#backupWorkoutData")) return;
    const resetItem = sheet.querySelector(".settings-item");
    if (!resetItem) return;

    const section = document.createElement("div");
    section.className = "settings-item backup-item";
    section.innerHTML = `
      <div><b>데이터 백업·복원</b><p>기록과 설정을 JSON 파일로 저장하거나 다시 불러옵니다.</p></div>
      <div class="backup-actions">
        <button id="backupWorkoutData" type="button">백업</button>
        <label class="restore-button" for="restoreWorkoutData">복원</label>
        <input id="restoreWorkoutData" type="file" accept="application/json,.json" hidden>
      </div>
    `;
    resetItem.before(section);
    section.querySelector("#backupWorkoutData")?.addEventListener("click", exportBackup);
    section.querySelector("#restoreWorkoutData")?.addEventListener("change", importBackup);
  }

  function exportBackup() {
    const payload = {
      app: "Road to SUB60",
      version: 2,
      exportedAt: new Date().toISOString(),
      data: appData
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `sub60-backup-${localDateValue()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function importBackup(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const parsed = JSON.parse(await file.text());
      const data = parsed?.data || parsed;
      if (!data || !Array.isArray(data.logs)) throw new Error("올바른 Sub60 백업 파일이 아닙니다.");
      if (!window.confirm(`백업의 러닝 기록 ${data.logs.length}개로 현재 데이터를 교체할까요?`)) return;

      appData.user = { ...appData.user, ...(data.user || {}) };
      appData.weekly = { ...appData.weekly, ...(data.weekly || {}) };
      appData.records = { ...appData.records, ...(data.records || {}) };
      if (Array.isArray(data.races)) appData.races = data.races;
      appData.logs = data.logs.map(normalizeImportedLog).filter(Boolean);
      sortLogs();
      recalcWeek();
      save();
      renderApp();
      bind();
      alert("백업을 복원했습니다.");
    } catch (error) {
      alert(error.message || "백업 파일을 읽지 못했습니다.");
    }
  }

  function normalizeImportedLog(log) {
    const distance = Number(log?.distance);
    const time = String(log?.time || "");
    if (!Number.isFinite(distance) || distance <= 0 || !validTime(time)) return null;
    const normalized = {
      ...log,
      id: Number(log.id) || Date.now() + Math.random(),
      date: Number.isNaN(new Date(log.date).getTime()) ? new Date().toISOString() : new Date(log.date).toISOString(),
      distance: round(distance),
      time,
      pace: pace(distance, time)
    };
    const heartRate = validHeartRateForFeature(log.avgHeartRate);
    if (heartRate === null) delete normalized.avgHeartRate;
    else normalized.avgHeartRate = heartRate;
    normalized.efficiencyScore = calculateEfficiencyForFeature(normalized);
    return normalized;
  }

  function refreshTenKEstimate() {
    const estimate = improvedTenKEstimate();
    if (!estimate) return;
    const dashboard = document.getElementById("efficiencyDashboard");
    if (!dashboard || dashboard.classList.contains("is-empty")) return;

    const metricBoxes = dashboard.querySelectorAll(".dashboard-metrics > div");
    const predictionBox = metricBoxes[2];
    if (predictionBox) {
      const label = predictionBox.querySelector("span");
      const value = predictionBox.querySelector("b");
      if (label) label.textContent = "10K 추정";
      if (value) value.textContent = estimate.formatted;
      if (!predictionBox.querySelector("small")) {
        const note = document.createElement("small");
        note.textContent = `${estimate.distance.toFixed(1)}km 기록 기준`;
        predictionBox.appendChild(note);
      }
    }

    const progress = getProgressForFeature(estimate.seconds);
    const head = dashboard.querySelector(".goal-panel-head b");
    const percent = dashboard.querySelector(".goal-panel-head > strong");
    const track = dashboard.querySelector(".goal-track i");
    const message = dashboard.querySelector(".goal-panel > small");
    if (head) head.textContent = progress.headline;
    if (percent) percent.textContent = `${progress.percent}%`;
    if (track) track.style.width = `${progress.percent}%`;
    if (message) message.textContent = progress.message;

    dashboard.querySelectorAll(".coach-signals span").forEach(signal => {
      if (/Sub60 페이스권|목표까지/.test(signal.textContent || "")) {
        signal.textContent = estimate.seconds <= 3600 ? "Sub60 페이스권" : `목표까지 ${formatGapForFeature(estimate.seconds - 3600)}`;
      }
    });

    const disclaimer = dashboard.querySelector(".efficiency-disclaimer");
    if (disclaimer) {
      disclaimer.textContent = "10K 추정은 최근 3km 이상 기록을 거리 보정한 값 중 가장 좋은 기록을 사용합니다. 코스·날씨·컨디션에 따라 실제 기록은 달라질 수 있습니다.";
    }
  }

  function improvedTenKEstimate() {
    const candidates = [...appData.logs]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 12)
      .filter(log => Number(log.distance) >= 3 && Number(log.distance) <= 15 && timeToSecondsForFeature(log.time) > 0)
      .map(log => {
        const distance = Number(log.distance);
        const raw = timeToSecondsForFeature(log.time) * Math.pow(10 / distance, 1.06);
        const shortDistancePenalty = distance < 5 ? (5 - distance) * 30 : 0;
        return { log, distance, seconds: Math.round(raw + shortDistancePenalty) };
      })
      .sort((a, b) => a.seconds - b.seconds);

    const best = candidates[0];
    if (!best) return null;
    return { ...best, formatted: formatDurationForFeature(best.seconds) };
  }

  function getProgressForFeature(seconds) {
    const target = 3600;
    const baseline = 4500;
    const percent = Math.max(0, Math.min(100, Math.round(((baseline - seconds) / (baseline - target)) * 100)));
    const gap = seconds - target;
    return gap <= 0
      ? { percent: 100, headline: "SUB60 기준 통과", message: "최근 기록 기반 10K 추정이 60분 이내입니다." }
      : { percent, headline: `${formatGapForFeature(gap)} 남음`, message: `최근 기록 기반 추정으로 Sub60까지 ${formatGapForFeature(gap)} 단축이 필요합니다.` };
  }

  function injectFeatureStyles() {
    if (document.getElementById("featureStylesV25")) return;
    const style = document.createElement("style");
    style.id = "featureStylesV25";
    style.textContent = `
      .record-manager-head,.record-manager-list article,.record-manager-actions,.backup-actions,.feature-sheet-head{display:flex;align-items:center;justify-content:space-between;gap:12px}.record-manager-head small,.record-manager-main small{display:block;margin-top:4px}.record-manager-list{display:grid;gap:10px;margin-top:16px}.record-manager-list article{padding:14px;border-radius:16px;background:rgba(255,255,255,.055)}.record-manager-actions button,.backup-actions button,.restore-button{border:0;border-radius:10px;padding:9px 11px;font:inherit;cursor:pointer;background:rgba(255,255,255,.09);color:inherit}.record-manager-actions .danger-text{color:#ff9d9d}.feature-modal{position:fixed;inset:0;z-index:1000;display:none}.feature-modal.is-open{display:block}.feature-backdrop{position:absolute;inset:0;background:rgba(0,0,0,.62)}.feature-sheet{position:absolute;left:50%;bottom:0;transform:translateX(-50%);width:min(100%,520px);max-height:92vh;overflow:auto;padding:24px;border-radius:24px 24px 0 0;background:#141821;box-sizing:border-box}.feature-sheet-head{margin-bottom:18px}.feature-sheet-head span{font-size:11px;letter-spacing:.12em;opacity:.65}.feature-sheet-head h2{margin:4px 0 0}.feature-sheet-head button{border:0;background:none;color:inherit;font-size:28px}.feature-sheet label{display:block;margin:14px 0}.feature-sheet label span{display:block;margin-bottom:7px}.feature-sheet input{width:100%;box-sizing:border-box;padding:13px;border:1px solid rgba(255,255,255,.12);border-radius:12px;background:rgba(255,255,255,.06);color:inherit;font:inherit}.feature-preview{margin:14px 0;padding:13px;border-radius:12px;background:rgba(255,255,255,.055)}.feature-primary{width:100%;padding:14px;border:0;border-radius:13px;font:inherit;font-weight:700;cursor:pointer}.feature-modal-open{overflow:hidden}.backup-item{align-items:flex-start!important}.backup-actions{flex-wrap:wrap}.restore-button{display:inline-flex;align-items:center}.dashboard-metrics>div small{display:block;margin-top:3px;font-size:10px;opacity:.65}@media(max-width:420px){.record-manager-list article{align-items:flex-start}.record-manager-actions{flex-direction:column}.record-manager-actions button{width:100%}}
    `;
    document.head.appendChild(style);
  }

  function findCard(title) {
    return [...document.querySelectorAll(".card")].find(card => card.querySelector(":scope > h2")?.textContent.trim() === title);
  }
  function localDateValue() {
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  }
  function dateValueToIso(value) { return new Date(`${value}T12:00:00`).toISOString(); }
  function isoToDateValue(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return localDateValue();
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  }
  function formatDate(value) { return new Intl.DateTimeFormat("ko-KR", { month: "numeric", day: "numeric" }).format(new Date(value)); }
  function sortLogs() { appData.logs.sort((a, b) => new Date(b.date) - new Date(a.date)); }
  function validHeartRateForFeature(value) {
    if (value === "" || value === null || value === undefined) return null;
    const number = Number(value);
    return Number.isFinite(number) && number >= 40 && number <= 230 ? Math.round(number) : null;
  }
  function calculateEfficiencyForFeature(log) {
    const minutes = timeToSecondsForFeature(log.time) / 60;
    const heartRate = validHeartRateForFeature(log.avgHeartRate);
    if (!(minutes > 0) || heartRate === null) return null;
    return Math.max(0, Math.min(100, Math.round((((Number(log.distance) * 1000) / minutes) / heartRate) * 100)));
  }
  function timeToSecondsForFeature(time) {
    const parts = String(time || "").split(":").map(Number);
    if (parts.some(Number.isNaN)) return 0;
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    return 0;
  }
  function formatDurationForFeature(totalSeconds) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secondsPart = totalSeconds % 60;
    return hours > 0 ? `${hours}:${String(minutes).padStart(2,"0")}:${String(secondsPart).padStart(2,"0")}` : `${minutes}:${String(secondsPart).padStart(2,"0")}`;
  }
  function formatGapForFeature(totalSeconds) {
    const minutes = Math.floor(Math.max(0, totalSeconds) / 60);
    const secondsPart = Math.max(0, totalSeconds) % 60;
    return `${minutes}분 ${String(secondsPart).padStart(2,"0")}초`;
  }
})();
