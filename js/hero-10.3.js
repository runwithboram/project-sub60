(function () {
  const originalRenderApp = window.renderApp;

  if (typeof originalRenderApp !== "function") return;

  function timeToSeconds(value) {
    const parts = String(value || "").trim().split(":").map(Number);
    if (parts.some(Number.isNaN)) return 0;
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    return 0;
  }

  function formatGap(seconds) {
    const safeSeconds = Math.max(0, Math.round(seconds));
    const minutes = Math.floor(safeSeconds / 60);
    const remainder = safeSeconds % 60;

    if (minutes && remainder) return `${minutes}분 ${remainder}초`;
    if (minutes) return `${minutes}분`;
    return `${remainder}초`;
  }

  function getGoalRecord() {
    const raceTarget = Array.isArray(appData?.races)
      ? appData.races.find(race => race?.target)?.target
      : null;

    return /^\d{1,2}:\d{2}(?::\d{2})?$/.test(String(raceTarget || ""))
      ? raceTarget
      : "59:59";
  }

  function getNextRaceInfo() {
    if (!Array.isArray(appData?.races) || !appData.races.length) {
      return { name: "다음 레이스", dday: "준비 중" };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const race = appData.races
      .map(item => ({ ...item, parsedDate: new Date(`${item.date}T00:00:00`) }))
      .filter(item => !Number.isNaN(item.parsedDate.getTime()) && item.parsedDate >= today)
      .sort((a, b) => a.parsedDate - b.parsedDate)[0] || appData.races[appData.races.length - 1];

    const target = new Date(`${race.date}T00:00:00`);
    const diff = Math.ceil((target - today) / 86400000);
    const dday = diff > 0 ? `D-${diff}` : diff === 0 ? "D-DAY" : "완료";

    return { name: race.name || "다음 레이스", dday };
  }

  function getProgress(currentSeconds, goalSeconds) {
    const baseline = 75 * 60;
    if (!currentSeconds || currentSeconds <= goalSeconds) return 100;
    return Math.max(0, Math.min(100, Math.round(
      ((baseline - currentSeconds) / (baseline - goalSeconds)) * 100
    )));
  }

  function applyHeroV105() {
    const hero = document.querySelector(".hero");
    if (!hero || typeof appData === "undefined") return;

    const currentRecord = appData.records?.tenK || "1:02:17";
    const goalRecord = getGoalRecord();
    const currentSeconds = timeToSeconds(currentRecord);
    const goalSeconds = timeToSeconds(goalRecord);
    const gapSeconds = Math.max(0, currentSeconds - goalSeconds);
    const gap = formatGap(gapSeconds);
    const race = getNextRaceInfo();
    const progress = getProgress(currentSeconds, goalSeconds);

    hero.innerHTML = `
      <div class="hero-sub60 hero-sub60-v105">
        <div class="hero-topline">
          <div>
            <span class="hero-eyebrow">ROAD TO</span>
            <h1>SUB<strong>60</strong></h1>
          </div>
          <div class="hero-race-chip">
            <b>${race.dday}</b>
            <span>${race.name}</span>
          </div>
        </div>

        <div class="hero-gap">
          <span>${gapSeconds > 0 ? "SUB60까지" : "현재 상태"}</span>
          <div class="hero-gap-value">
            <strong>${gapSeconds > 0 ? gap : "달성권"}</strong>
            ${gapSeconds > 0 ? "<em>남음</em>" : "<em>SUB60</em>"}
          </div>
        </div>

        <div class="hero-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress}">
          <div class="hero-progress-head">
            <span>SUB60 여정</span>
            <b>${progress}%</b>
          </div>
          <div class="hero-progress-track"><i style="width:${progress}%"></i></div>
        </div>

        <div class="hero-records">
          <div class="hero-record">
            <span>현재 10K PB</span>
            <b>${currentRecord}</b>
          </div>
          <div class="hero-record is-goal">
            <span>목표 기록</span>
            <b>${goalRecord}</b>
          </div>
        </div>

        <div class="hero-pace">
          <span>이번 주 목표 페이스</span>
          <b>6'15" ~ 6'25"/km</b>
        </div>
      </div>
    `;
  }

  window.renderApp = function renderAppHeroV105() {
    originalRenderApp();
    applyHeroV105();
  };
})();
