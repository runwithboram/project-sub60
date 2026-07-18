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

  function renderBalancePanel() {
    return `
      <section class="bb-hero">
        <small>BODY BALANCE</small>
        <h1>체지방은 줄이고,<br>근육과 러닝 능력은 지킵니다.</h1>
        <p>
          인바디 기록을 기준으로 체지방량 감소와 골격근량 유지를 함께 확인합니다.
        </p>
      </section>

      <section class="bb-card">
        <div class="bb-card-header">
          <div>
            <h2>인바디 기록 추가</h2>
            <p>CSV 일괄 등록을 우선 지원하며, 원본 파일은 저장하지 않습니다.</p>
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
      </section>

      <section id="bbManualCard" class="bb-card" hidden>
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
    renderSummary();
    renderRecordList();
    requestAnimationFrame(drawChart);
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

    list.innerHTML = `
      <div class="bb-record-list">
        ${records.map(record => `
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
            <div class="bb-record-actions">
              <button class="bb-icon-button" type="button"
                data-bb-action="edit" data-date="${record.date}" aria-label="수정">수정</button>
              <button class="bb-icon-button" type="button"
                data-bb-action="delete" data-date="${record.date}" aria-label="삭제">삭제</button>
            </div>
          </article>
        `).join("")}
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


