/* Road to SUB60 v2.6: motivation dashboard + GPT copy only */
(() => {
  const TARGET = 3599;
  const BASE = 4500;
  const previousRender = window.renderApp;

  window.renderApp = function renderAppV26() {
    previousRender();
    addStyles();
    updateDashboard();
  };

  function updateDashboard() {
    const board = document.getElementById("efficiencyDashboard");
    if (!board || board.classList.contains("is-empty")) return;

    const estimate = getEstimate(appData.logs);
    if (!estimate) return;

    const gap = estimate.seconds - TARGET;
    const progress = Math.max(
      0,
      Math.min(
        100,
        Math.round(((BASE - estimate.seconds) / (BASE - TARGET)) * 100)
      )
    );
    const change = getFourWeekChange();

    setText(board.querySelector(".dashboard-kicker"), "CURRENT PROGRESS");
    setText(board.querySelector(".dashboard-topline h2"), "ROAD TO SUB60");

    const status = board.querySelector(".efficiency-status");
    if (status) {
      status.textContent = gap <= 0 ? "SUB60 달성권" : "목표 추적 중";
      status.className =
        `efficiency-status ${gap <= 0 ? "is-excellent" : "is-good"}`;
    }

    const ring = board.querySelector(".score-ring");

    if (ring) {
      ring.style.setProperty("--score", progress);

      setText(
        ring.querySelector("strong"),
        gap <= 0 ? `-${formatClock(Math.abs(gap))}` : formatClock(gap)
      );

      setText(
        ring.querySelector("span"),
        gap <= 0 ? "AHEAD" : "TO SUB60"
      );

      ring.setAttribute(
        "aria-label",
        gap <= 0
          ? `Sub60 목표보다 ${formatGap(Math.abs(gap))} 빠름`
          : `Sub60까지 ${formatGap(gap)} 남음`
      );
    }

    const summary = board.querySelector(".latest-summary");

    if (summary) {
      setText(summary.querySelector("span"), "현재 10K 환산");
      setText(summary.querySelector("strong"), estimate.formatted);

      const note = summary.querySelector("p");

      if (note) {
        note.textContent = change.text;
        note.className = change.className;
      }
    }

    const metrics = board.querySelectorAll(".dashboard-metrics > div");

    setMetric(
      metrics[0],
      "현재 10K 환산",
      estimate.formatted,
      `${estimate.count}개 기록 반영`
    );

    setMetric(
      metrics[1],
      "목표 기록",
      "59:59",
      gap <= 0 ? "달성권" : `${formatGap(gap)} 단축 필요`
    );

    setMetric(
      metrics[2],
      "최근 4주",
      change.value,
      change.detail
    );

    setText(
      board.querySelector(".goal-panel-head b"),
      gap <= 0 ? "SUB60 기준 통과" : `${formatGap(gap)} 남음`
    );

    setText(
      board.querySelector(".goal-panel-head > strong"),
      `${progress}%`
    );

    const track = board.querySelector(".goal-track i");

    if (track) {
      track.style.width = `${progress}%`;
    }

    setText(
      board.querySelector(".goal-panel > small"),
      gap <= 0
        ? `현재 환산 기록이 목표보다 ${formatGap(Math.abs(gap))} 빠릅니다.`
        : `현재 위치에서 ${formatGap(gap)}만 단축하면 Sub60입니다.`
    );

    board.querySelector(".trend-panel")?.remove();

    const disclaimer = board.querySelector(".efficiency-disclaimer");

    if (disclaimer) {
      disclaimer.textContent =
        "최근 3~15km 기록 중 성과가 좋은 최대 3개를 거리 보정해 반영합니다.";
    }

    addGptCopyButton(board, estimate, change);
  }

  function getEstimate(logs) {
    const best = buildCandidates(logs)
      .sort((a, b) => a.seconds - b.seconds)
      .slice(0, 3);

    if (!best.length) return null;

    const weights = [0.5, 0.3, 0.2].slice(0, best.length);
    const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);

    const estimateSeconds = Math.round(
      best.reduce(
        (sum, item, index) =>
          sum + item.seconds * weights[index],
        0
      ) / weightTotal
    );

    return {
      seconds: estimateSeconds,
      formatted: formatDuration(estimateSeconds),
      count: best.length
    };
  }

  function buildCandidates(logs) {
    return [...logs]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 12)
      .filter(log => {
        const distance = Number(log.distance);

        return (
          distance >= 3 &&
          distance <= 15 &&
          timeToSeconds(log.time) > 0
        );
      })
      .map(log => {
        const distance = Number(log.distance);

        const converted =
          timeToSeconds(log.time) *
          Math.pow(10 / distance, 1.06);

        const shortDistancePenalty =
          distance < 5 ? (5 - distance) * 30 : 0;

        return {
          seconds: Math.round(
            converted + shortDistancePenalty
          )
        };
      });
  }

  function getFourWeekChange() {
    const now = new Date();

    const currentStart = new Date(now);
    currentStart.setDate(now.getDate() - 28);

    const previousStart = new Date(now);
    previousStart.setDate(now.getDate() - 56);

    const currentEstimate = getEstimate(
      appData.logs.filter(log => {
        const date = new Date(log.date);

        return (
          date >= currentStart &&
          date <= now
        );
      })
    );

    const previousEstimate = getEstimate(
      appData.logs.filter(log => {
        const date = new Date(log.date);

        return (
          date >= previousStart &&
          date < currentStart
        );
      })
    );

    if (!currentEstimate || !previousEstimate) {
      return {
        text: "비교 기록이 더 필요해요",
        value: "기록 축적 중",
        detail: "4주 전 기록과 비교 예정",
        className: "is-neutral"
      };
    }

    const delta =
      previousEstimate.seconds - currentEstimate.seconds;

    if (delta > 0) {
      return {
        text: `최근 4주 ${formatGap(delta)} 단축`,
        value: `-${formatClock(delta)}`,
        detail: "4주 전보다 빨라짐",
        className: "is-up"
      };
    }

    if (delta < 0) {
      return {
        text: `최근 4주 ${formatGap(Math.abs(delta))} 증가`,
        value: `+${formatClock(Math.abs(delta))}`,
        detail: "최근 컨디션 점검",
        className: "is-down"
      };
    }

    return {
      text: "최근 4주 변화 없음",
      value: "0:00",
      detail: "4주 전과 동일",
      className: "is-neutral"
    };
  }

  function addGptCopyButton(board, estimate, change) {
    board.querySelector("#sendToGpt")?.remove();

    const newRunButton =
      board.querySelector("#openRecordFromDashboard");

    if (!newRunButton) return;

    const button = document.createElement("button");

    button.id = "sendToGpt";
    button.type = "button";
    button.className = "dashboard-action gpt-action";
    button.textContent = "GPT 분석 내용 복사";

    button.addEventListener("click", async () => {
      const prompt = buildPrompt(estimate, change);

      try {
        await copyText(prompt);

        alert(
          "GPT 분석 요청 내용을 복사했습니다. " +
          "이 프로젝트 대화방에 붙여넣어 주세요."
        );
      } catch (error) {
        alert(
          "자동 복사에 실패했습니다. " +
          "브라우저의 클립보드 권한을 확인해 주세요."
        );
      }
    });

    newRunButton.before(button);
  }

  function buildPrompt(estimate, change) {
    const recentRuns = [...appData.logs]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 10)
      .map(log => {
        const date = new Intl.DateTimeFormat(
          "ko-KR",
          {
            month: "numeric",
            day: "numeric"
          }
        ).format(new Date(log.date));

        const heartRate = Number(log.avgHeartRate);

        const heartRateText =
          Number.isFinite(heartRate)
            ? `${Math.round(heartRate)} bpm`
            : "심박 없음";

        return (
          `- ${date}: ` +
          `${Number(log.distance).toFixed(2)}km / ` +
          `${log.time} / ${log.pace} / ${heartRateText}`
        );
      })
      .join("\n");

    const gapText =
      estimate.seconds <= TARGET
        ? `목표보다 ${formatGap(
            TARGET - estimate.seconds
          )} 빠름`
        : `${formatGap(
            estimate.seconds - TARGET
          )} 남음`;

    return `[Road to SUB60 러닝 분석 요청]

이름: ${appData.user?.name || "보람"}
목표: 10K 59:59 이내
10K PB: ${appData.records?.tenK || "1:02:17"}
하프 PB: ${appData.records?.half || "2:17:59"}

현재 10K 환산: ${estimate.formatted}
Sub60까지: ${gapText}
최근 4주 변화: ${change.text}

최근 러닝
${recentRuns || "- 저장된 기록 없음"}

최근 러닝 흐름과 심박 대비 페이스를 분석해 주세요.
현재 Sub60 가능성과 다음 러닝 한 회의 거리·권장 페이스를 추천해 주세요.
기록만으로 판단하기 어려운 부분은 추정이라고 표시해 주세요.`;
  }

  function setMetric(box, label, value, note) {
    if (!box) return;

    box.innerHTML = `
      <span>${label}</span>
      <b>${value}</b>
      <small>${note}</small>
    `;
  }

  function setText(element, value) {
    if (element) {
      element.textContent = value;
    }
  }

  function timeToSeconds(value) {
    const parts = String(value || "")
      .split(":")
      .map(Number);

    if (parts.some(Number.isNaN)) return 0;

    if (parts.length === 2) {
      return parts[0] * 60 + parts[1];
    }

    if (parts.length === 3) {
      return (
        parts[0] * 3600 +
        parts[1] * 60 +
        parts[2]
      );
    }

    return 0;
  }

  function formatDuration(totalSeconds) {
    const hours =
      Math.floor(totalSeconds / 3600);

    const minutes =
      Math.floor((totalSeconds % 3600) / 60);

    const seconds =
      totalSeconds % 60;

    return hours > 0
      ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
      : `${minutes}:${String(seconds).padStart(2, "0")}`;
  }

  function formatClock(totalSeconds) {
    const minutes =
      Math.floor(Math.max(0, totalSeconds) / 60);

    const seconds =
      Math.max(0, totalSeconds) % 60;

    return (
      `${minutes}:` +
      String(seconds).padStart(2, "0")
    );
  }

  function formatGap(totalSeconds) {
    const minutes =
      Math.floor(Math.max(0, totalSeconds) / 60);

    const seconds =
      Math.max(0, totalSeconds) % 60;

    return (
      `${minutes}분 ` +
      `${String(seconds).padStart(2, "0")}초`
    );
  }

  async function copyText(value) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return;
    }

    const textarea =
      document.createElement("textarea");

    textarea.value = value;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";

    document.body.appendChild(textarea);

    textarea.select();

    const copied =
      document.execCommand("copy");

    textarea.remove();

    if (!copied) {
      throw new Error("copy failed");
    }
  }

  function addStyles() {
    if (
      document.getElementById(
        "motivationStylesV26"
      )
    ) {
      return;
    }

    const style =
      document.createElement("style");

    style.id = "motivationStylesV26";

    style.textContent = `
      .score-ring-inner strong {
        font-size: clamp(26px, 8vw, 42px);
        letter-spacing: -.05em;
      }

      .gpt-action {
        margin-top: 14px;
        background:
          linear-gradient(
            135deg,
            #7df4bd,
            #7cb8ff
          ) !important;
        color: #071018 !important;
      }

      .dashboard-metrics > div small {
        display: block;
        margin-top: 4px;
        font-size: 10px;
        opacity: .68;
      }

      .latest-summary strong {
        font-variant-numeric: tabular-nums;
      }
    `;

    document.head.appendChild(style);
  }
})();