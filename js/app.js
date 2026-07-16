document.addEventListener("DOMContentLoaded", () => {
  load();
  recalcWeek();
  renderApp();
  bind();
});

let selectedCaptureUrl = null;
let selectedCaptureFile = null;
let isAnalyzing = false;

function bind() {
  const distanceInput = document.getElementById("distance");
  const timeInput = document.getElementById("time");
  const saveButton = document.getElementById("saveRun");
  const captureInput = document.getElementById("garminCapture");
  const removeCaptureButton = document.getElementById("removeCapture");
  const analyzeButton = document.getElementById("analyzeCapture");

  distanceInput?.addEventListener("input", preview);

  timeInput?.addEventListener("input", () => {
    timeInput.value = timeInput.value
      .replace(/\D/g, "")
      .slice(0, 6);

    preview();
  });

  saveButton?.addEventListener("click", saveWorkout);

  captureInput?.addEventListener(
    "change",
    handleCaptureSelection
  );

  removeCaptureButton?.addEventListener(
    "click",
    clearCapturePreview
  );

  analyzeButton?.addEventListener(
    "click",
    analyzeGarminCapture
  );
}

function handleCaptureSelection(event) {
  const file = event.target.files?.[0];

  if (!file) return;

  if (!file.type.startsWith("image/")) {
    alert("이미지 파일을 선택해 주세요.");
    event.target.value = "";
    return;
  }

  selectedCaptureFile = file;

  if (selectedCaptureUrl) {
    URL.revokeObjectURL(selectedCaptureUrl);
  }

  selectedCaptureUrl = URL.createObjectURL(file);

  const previewBox =
    document.getElementById("capturePreviewBox");

  const previewImage =
    document.getElementById("capturePreviewImage");

  previewImage.src = selectedCaptureUrl;
  previewBox.classList.remove("hidden");

  updateOcrStatus(
    "Garmin 읽기를 눌러 주세요.",
    0,
    false
  );
}

async function analyzeGarminCapture() {
  if (isAnalyzing) return;

  if (!selectedCaptureFile) {
    alert("Garmin 캡처를 먼저 선택해 주세요.");
    return;
  }

  if (typeof Tesseract === "undefined") {
    alert(
      "OCR 라이브러리를 불러오지 못했습니다. 페이지를 새로고침해 주세요."
    );
    return;
  }

  const analyzeButton =
    document.getElementById("analyzeCapture");

  isAnalyzing = true;

  if (analyzeButton) {
    analyzeButton.disabled = true;
    analyzeButton.textContent = "Garmin 읽는 중...";
  }

  updateOcrStatus("이미지를 준비하고 있습니다.", 3, true);

  let worker;

  try {
    const processedImage =
      await preprocessImage(selectedCaptureFile);

    worker = await Tesseract.createWorker(
      ["kor", "eng"],
      1,
      {
        logger: handleOcrProgress
      }
    );

    updateOcrStatus(
      "Garmin 데이터를 읽고 있습니다.",
      30,
      true
    );

    const result =
      await worker.recognize(processedImage);

    const extracted =
      parseGarminText(result.data.text);

    applyExtractedData(extracted);

    const found = [];

    if (extracted.distance !== null) {
      found.push(`거리 ${extracted.distance}km`);
    }

    if (extracted.time) {
      found.push(`시간 ${extracted.time}`);
    }

    if (found.length === 0) {
      updateOcrStatus(
        "자동 인식하지 못했습니다. 캡처를 확인하고 직접 입력해 주세요.",
        100,
        true
      );

      alert(
        "거리와 시간을 정확히 찾지 못했습니다.\n" +
        "사진은 그대로 두고 값을 직접 입력해 주세요."
      );
    } else {
      updateOcrStatus(
        `인식 완료: ${found.join(" · ")}`,
        100,
        true
      );

      alert(
        "Garmin 읽기 완료\n\n" +
        found.join("\n") +
        "\n\n저장하기 전에 값을 확인해 주세요."
      );
    }

    console.log("OCR 원문:", result.data.text);
    console.log("추출 결과:", extracted);

  } catch (error) {
    console.error("Garmin OCR 오류:", error);

    updateOcrStatus(
      "인식 중 오류가 발생했습니다.",
      0,
      true
    );

    alert(
      "Garmin 화면을 읽지 못했습니다.\n" +
      "인터넷 연결을 확인하고 다시 시도해 주세요."
    );

  } finally {
    if (worker) {
      await worker.terminate();
    }

    isAnalyzing = false;

    if (analyzeButton) {
      analyzeButton.disabled = false;
      analyzeButton.textContent = "Garmin 읽기";
    }
  }
}

function handleOcrProgress(message) {
  const progress =
    Number.isFinite(message.progress)
      ? Math.round(message.progress * 100)
      : 0;

  const statusMap = {
    "loading tesseract core":
      "문자 인식 엔진을 준비하고 있습니다.",
    "initializing tesseract":
      "문자 인식 엔진을 시작하고 있습니다.",
    "loading language traineddata":
      "언어 데이터를 불러오고 있습니다.",
    "initializing api":
      "Garmin 화면 분석을 준비하고 있습니다.",
    "recognizing text":
      "Garmin 화면에서 숫자를 읽고 있습니다."
  };

  const statusText =
    statusMap[message.status]
    || "Garmin 화면을 분석하고 있습니다.";

  updateOcrStatus(
    `${statusText} ${progress}%`,
    progress,
    true
  );
}

function updateOcrStatus(text, progress, show) {
  const statusBox =
    document.getElementById("ocrStatus");

  const statusText =
    document.getElementById("ocrStatusText");

  const progressBar =
    document.getElementById("ocrProgressBar");

  if (statusText) {
    statusText.textContent = text;
  }

  if (progressBar) {
    progressBar.style.width =
      `${Math.max(0, Math.min(100, progress))}%`;
  }

  if (statusBox) {
    statusBox.classList.toggle("hidden", !show);
  }
}

function preprocessImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => {
      reject(new Error("이미지를 읽지 못했습니다."));
    };

    reader.onload = () => {
      const image = new Image();

      image.onerror = () => {
        reject(new Error("이미지를 열지 못했습니다."));
      };

      image.onload = () => {
        const maxWidth = 1600;

        const scale =
          image.width > maxWidth
            ? maxWidth / image.width
            : 1;

        const width =
          Math.round(image.width * scale);

        const height =
          Math.round(image.height * scale);

        const canvas =
          document.createElement("canvas");

        canvas.width = width;
        canvas.height = height;

        const context =
          canvas.getContext("2d", {
            willReadFrequently: true
          });

        context.drawImage(
          image,
          0,
          0,
          width,
          height
        );

        const imageData =
          context.getImageData(
            0,
            0,
            width,
            height
          );

        const pixels = imageData.data;

        for (
          let index = 0;
          index < pixels.length;
          index += 4
        ) {
          const gray =
            pixels[index] * 0.299
            + pixels[index + 1] * 0.587
            + pixels[index + 2] * 0.114;

          const enhanced =
            gray > 155
              ? 255
              : Math.max(0, gray - 20);

          pixels[index] = enhanced;
          pixels[index + 1] = enhanced;
          pixels[index + 2] = enhanced;
        }

        context.putImageData(
          imageData,
          0,
          0
        );

        resolve(
          canvas.toDataURL(
            "image/jpeg",
            0.92
          )
        );
      };

      image.src = reader.result;
    };

    reader.readAsDataURL(file);
  });
}

function parseGarminText(rawText) {
  const text = normalizeOcrText(rawText);

  const distance =
    extractDistance(text);

  const time =
    extractTotalTime(text);

  return {
    distance,
    time,
    rawText
  };
}

function normalizeOcrText(text) {
  return String(text || "")
    .replace(/，/g, ".")
    .replace(/,/g, ".")
    .replace(/[：;]/g, ":")
    .replace(/\s+/g, " ")
    .trim();
}

function extractDistance(text) {
  const labeledPatterns = [
    /(?:거리|distance)\s*[:\-]?\s*(\d{1,3}(?:\.\d{1,2})?)\s*(?:km|킬로미터)/i,
    /(\d{1,3}(?:\.\d{1,2})?)\s*(?:km|킬로미터)/i
  ];

  for (const pattern of labeledPatterns) {
    const match = text.match(pattern);

    if (match) {
      const value =
        Number.parseFloat(match[1]);

      if (
        Number.isFinite(value)
        && value >= 0.5
        && value <= 100
      ) {
        return Math.round(value * 100) / 100;
      }
    }
  }

  return null;
}

function extractTotalTime(text) {
  const labeledPatterns = [
    /(?:총\s*시간|total\s*time|elapsed\s*time)\s*[:\-]?\s*(\d{1,2}:\d{2}(?::\d{2})?)/i,
    /(?:시간|time)\s*[:\-]?\s*(\d{1,2}:\d{2}(?::\d{2})?)/i
  ];

  for (const pattern of labeledPatterns) {
    const match = text.match(pattern);

    if (
      match
      && validTime(match[1])
    ) {
      return match[1];
    }
  }

  const candidates =
    text.match(
      /\b\d{1,2}:\d{2}(?::\d{2})?\b/g
    ) || [];

  const validCandidates =
    candidates
      .filter(validTime)
      .sort(
        (first, second) =>
          seconds(second) - seconds(first)
      );

  return validCandidates[0] || null;
}

function applyExtractedData(extracted) {
  const distanceInput =
    document.getElementById("distance");

  const timeInput =
    document.getElementById("time");

  if (
    extracted.distance !== null
    && distanceInput
  ) {
    distanceInput.value =
      extracted.distance;
  }

  if (
    extracted.time
    && timeInput
  ) {
    timeInput.value =
      extracted.time.replace(/\D/g, "");
  }

  preview();
}

function clearCapturePreview() {
  const captureInput =
    document.getElementById("garminCapture");

  const previewBox =
    document.getElementById("capturePreviewBox");

  const previewImage =
    document.getElementById("capturePreviewImage");

  if (selectedCaptureUrl) {
    URL.revokeObjectURL(selectedCaptureUrl);
  }

  selectedCaptureUrl = null;
  selectedCaptureFile = null;

  if (captureInput) {
    captureInput.value = "";
  }

  if (previewImage) {
    previewImage.removeAttribute("src");
  }

  previewBox?.classList.add("hidden");

  updateOcrStatus("", 0, false);
}

function preview() {
  const distance =
    Number.parseFloat(
      document.getElementById("distance")?.value
      || "0"
    );

  const formattedTime =
    formatTime(
      document.getElementById("time")?.value
      || ""
    );

  const timePreview =
    document.getElementById("timePreview");

  const pacePreview =
    document.getElementById("pacePreview");

  if (timePreview) {
    timePreview.textContent =
      formattedTime || "-";
  }

  if (pacePreview) {
    pacePreview.textContent =
      distance > 0
      && validTime(formattedTime)
        ? pace(distance, formattedTime)
        : "-";
  }
}

function saveWorkout() {
  const distanceInput =
    document.getElementById("distance");

  const timeInput =
    document.getElementById("time");

  const distance =
    Number.parseFloat(
      distanceInput?.value || "0"
    );

  const formattedTime =
    formatTime(
      timeInput?.value || ""
    );

  if (
    !Number.isFinite(distance)
    || distance <= 0
  ) {
    alert("거리를 입력해 주세요.");
    distanceInput?.focus();
    return;
  }

  if (!validTime(formattedTime)) {
    alert(
      "시간을 숫자로 입력해 주세요. 예: 5120 → 51:20"
    );

    timeInput?.focus();
    return;
  }

  const log = {
    id: Date.now(),
    date: new Date().toISOString(),
    distance: round(distance),
    time: formattedTime,
    pace: pace(
      distance,
      formattedTime
    )
  };

  appData.logs.unshift(log);

  recalcWeek();
  save();
  renderApp();
  bind();

  selectedCaptureUrl = null;
  selectedCaptureFile = null;

  alert(
    `저장 완료\n`
    + `${log.distance}km · `
    + `${log.time} · `
    + `${log.pace}`
  );
}

function formatTime(input) {
  const numbers =
    String(input || "")
      .replace(/\D/g, "")
      .slice(0, 6);

  if (!numbers) return "";

  if (numbers.length <= 2) {
    return `0:${numbers.padStart(2, "0")}`;
  }

  if (numbers.length <= 4) {
    return (
      `${Number(numbers.slice(0, -2))}`
      + `:${numbers.slice(-2)}`
    );
  }

  return (
    `${Number(numbers.slice(0, -4))}`
    + `:${numbers.slice(-4, -2)}`
    + `:${numbers.slice(-2)}`
  );
}

function validTime(time) {
  const parts =
    String(time)
      .split(":")
      .map(Number);

  if (parts.some(Number.isNaN)) {
    return false;
  }

  if (parts.length === 2) {
    return (
      parts[0] >= 0
      && parts[1] >= 0
      && parts[1] < 60
    );
  }

  return (
    parts.length === 3
    && parts[0] >= 0
    && parts[1] >= 0
    && parts[1] < 60
    && parts[2] >= 0
    && parts[2] < 60
  );
}

function seconds(time) {
  const parts =
    time.split(":").map(Number);

  if (parts.length === 2) {
    return (
      parts[0] * 60
      + parts[1]
    );
  }

  return (
    parts[0] * 3600
    + parts[1] * 60
    + parts[2]
  );
}

function pace(distance, time) {
  const paceSeconds =
    Math.round(
      seconds(time) / distance
    );

  const minutes =
    Math.floor(paceSeconds / 60);

  return (
    `${minutes}'`
    + `${String(
      paceSeconds % 60
    ).padStart(2, "0")}`
    + `"/km`
  );
}

function weekRange() {
  const now = new Date();
  const day = now.getDay();

  const offset =
    day === 0
      ? -6
      : 1 - day;

  const start = new Date(now);

  start.setDate(
    now.getDate() + offset
  );

  start.setHours(0, 0, 0, 0);

  const end = new Date(start);

  end.setDate(
    start.getDate() + 7
  );

  return {
    start,
    end
  };
}

function recalcWeek() {
  const {
    start,
    end
  } = weekRange();

  appData.weekly.current =
    round(
      appData.logs
        .filter(log => {
          const date =
            new Date(log.date);

          return (
            date >= start
            && date < end
          );
        })
        .reduce(
          (sum, log) =>
            sum
            + Number(log.distance || 0),
          0
        )
    );
}

function round(value) {
  return (
    Math.round(
      (value + Number.EPSILON)
      * 100
    )
    / 100
  );
}

function save() {
  localStorage.setItem(
    "roadToSub60_v1",
    JSON.stringify(appData)
  );
}

function load() {
  const saved =
    localStorage.getItem(
      "roadToSub60_v1"
    );

  if (!saved) return;

  try {
    const parsed =
      JSON.parse(saved);

    appData.user = {
      ...appData.user,
      ...(parsed.user || {})
    };

    appData.weekly = {
      ...appData.weekly,
      ...(parsed.weekly || {})
    };

    appData.records = {
      ...appData.records,
      ...(parsed.records || {})
    };

    appData.races =
      Array.isArray(parsed.races)
        ? parsed.races
        : appData.races;

    appData.logs =
      Array.isArray(parsed.logs)
        ? parsed.logs
        : [];

  } catch (error) {
    localStorage.removeItem(
      "roadToSub60_v1"
    );
  }
}
