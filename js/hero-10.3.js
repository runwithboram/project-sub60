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

  function applyHeroV103() {
    const hero = document.querySelector(".hero");
    if (!hero || !window.appData) return;

    const currentRecord = appData.records?.tenK || "1:02:17";
    const goalRecord = appData.user?.goal || "59:59";
    const gap = formatGap(
      timeToSeconds(currentRecord) - timeToSeconds(goalRecord)
    );

    hero.innerHTML = `
      <div class="hero-sub60">
        <span class="hero-eyebrow">Road to</span>
        <h1>SUB<strong>60</strong></h1>

        <div class="hero-gap">
          <span>목표까지</span>
          <div class="hero-gap-value">
            <strong>${gap}</strong>
            <em>남음</em>
          </div>
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

        <div class="hero-route" aria-hidden="true">
          <i class="hero-route-line"></i>
          <i class="hero-route-goal"></i>
        </div>

        <div class="hero-pace">
          <span>이번 주 목표 페이스</span>
          <b>6'15" ~ 6'25"/km</b>
        </div>
      </div>
    `;
  }

  window.renderApp = function () {
    originalRenderApp();
    applyHeroV103();
  };
})();
