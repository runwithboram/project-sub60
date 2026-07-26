(() => {
  "use strict";

  const previousRender = window.renderApp;
  const previousBind = window.bind;

  window.renderApp = function renderHomeV105() {
    previousRender();
    enhanceHomeDashboard();
  };

  window.bind = function bindHomeV105() {
    if (typeof previousBind === "function") previousBind();
    bindHomeInteractions();
  };

  function enhanceHomeDashboard() {
    const panel = document.getElementById("bbRunningPanel") || document.getElementById("app");
    if (!panel) return;

    panel.classList.add("home-v105");
    mountQuickSnapshot(panel);
    organizeSections(panel);
    enhanceRecentRuns(panel);
    labelCoreCards(panel);
  }

  function mountQuickSnapshot(panel) {
    if (panel.querySelector("#homeQuickSnapshot")) return;

    const todayCard = panel.querySelector("#bbTodayRunCard");
    if (!todayCard) return;

    const latest = Array.isArray(appData?.logs) && appData.logs.length
      ? [...appData.logs].sort((a, b) => new Date(b.date) - new Date(a.date))[0]
      : null;
    const weeklyCurrent = Number(appData?.weekly?.current || 0);
    const weeklyGoal = Number(appData?.weekly?.goal || 0);
    const weeklyPct = weeklyGoal ? Math.min(100, Math.round((weeklyCurrent / weeklyGoal) * 100)) : 0;

    const snapshot = document.createElement("section");
    snapshot.id = "homeQuickSnapshot";
    snapshot.className = "home-quick-snapshot";
    snapshot.innerHTML = `
      <article>
        <span>최근 러닝</span>
        <strong>${latest ? `${Number(latest.distance).toFixed(2)} km` : "기록 없음"}</strong>
        <small>${latest ? `${latest.pace || "-"} · ${latest.time || "-"}` : "첫 기록을 추가해 주세요"}</small>
      </article>
      <article>
        <span>이번 주</span>
        <strong>${weeklyCurrent.toFixed(1)} km</strong>
        <small>목표 ${weeklyGoal} km · ${weeklyPct}%</small>
      </article>
      <article>
        <span>VO₂max</span>
        <strong>${appData?.records?.vo2max ?? "-"}</strong>
        <small>현재 러닝 지표</small>
      </article>
    `;

    todayCard.insertAdjacentElement("afterend", snapshot);
  }

  function organizeSections(panel) {
    const hero = panel.querySelector(".hero");
    if (!hero) return;

    const today = panel.querySelector("#bbTodayRunCard");
    const snapshot = panel.querySelector("#homeQuickSnapshot");
    const allCards = [...panel.children];

    const weeklyDistance = allCards.find(el =>
      el.matches?.("section.card") && el.querySelector("h2")?.textContent.trim() === "이번 주"
    );
    const weeklyReport = panel.querySelector(".weekly-report");
    const efficiency = panel.querySelector("#efficiencyDashboard");
    const aiCoach = panel.querySelector(".ai-coach-card");
    const recent = allCards.find(el =>
      el.matches?.("section.card") && el.querySelector("h2")?.textContent.trim() === "최근 운동"
    );
    const record = allCards.find(el =>
      el.matches?.("section.card") && el.querySelector("h2")?.textContent.trim() === "운동 기록"
    );

    [hero, today, snapshot, weeklyDistance, weeklyReport, efficiency, aiCoach, recent, record]
      .filter(Boolean)
      .forEach(el => panel.appendChild(el));
  }

  function enhanceRecentRuns(panel) {
    const recent = [...panel.querySelectorAll("section.card")].find(section =>
      section.querySelector("h2")?.textContent.trim() === "최근 운동"
    );
    if (!recent || recent.dataset.homeEnhanced === "true") return;

    recent.dataset.homeEnhanced = "true";
    recent.classList.add("home-recent-card");

    const header = recent.querySelector("h2");
    const logs = recent.querySelector(".logs");
    if (!header || !logs) return;

    const articles = [...logs.querySelectorAll("article")];
    if (articles.length <= 2) return;

    articles.forEach((article, index) => {
      if (index >= 2) article.classList.add("is-extra-run");
    });

    const toolbar = document.createElement("div");
    toolbar.className = "home-card-toolbar";
    header.replaceWith(toolbar);
    toolbar.appendChild(header);
    toolbar.insertAdjacentHTML("beforeend", `
      <button type="button" class="home-expand-runs" aria-expanded="false">
        전체 ${articles.length}개
      </button>
    `);
  }

  function labelCoreCards(panel) {
    [...panel.querySelectorAll("section.card")].forEach(section => {
      const title = section.querySelector("h2")?.textContent.trim();
      if (!title) return;
      section.dataset.cardTitle = title;
    });
  }

  function bindHomeInteractions() {
    document.querySelectorAll(".home-expand-runs").forEach(button => {
      if (button.dataset.bound === "true") return;
      button.dataset.bound = "true";
      button.addEventListener("click", () => {
        const card = button.closest(".home-recent-card");
        const expanded = card?.classList.toggle("is-expanded") || false;
        button.setAttribute("aria-expanded", String(expanded));
        button.textContent = expanded ? "접기" : `전체 ${card?.querySelectorAll(".logs article").length || 0}개`;
      });
    });
  }
})();
