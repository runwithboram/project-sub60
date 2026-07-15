document.addEventListener("DOMContentLoaded", () => {
    loadData();
    renderApp();
    initEvents();
});

function initEvents() {

    const startBtn = document.getElementById("startBtn");

    if (startBtn) {
        startBtn.addEventListener("click", () => {

            const form = document.getElementById("logForm");

            form.classList.toggle("hidden");

            attachInputPreview();

        });
    }

    const saveBtn = document.getElementById("saveRun");

    if (saveBtn) {
        saveBtn.addEventListener("click", saveWorkout);
    }

}

function attachInputPreview() {

    const distanceInput = document.getElementById("distance");
    const timeInput = document.getElementById("time");

    if (!distanceInput || !timeInput) return;

    distanceInput.oninput = updatePreview;
    timeInput.oninput = updatePreview;

}

function updatePreview() {

    const distance =
        parseFloat(document.getElementById("distance").value) || 0;

    const rawTime =
        document.getElementById("time").value;

    const formatted =
        formatTime(rawTime);

    document.getElementById("time").value = formatted;

    const timePreview =
        document.getElementById("timePreview");

    if (timePreview) {
        timePreview.textContent = formatted || "-";
    }

    const pacePreview =
        document.getElementById("pacePreview");

    if (pacePreview) {

        if (distance > 0 && formatted !== "") {
            pacePreview.textContent =
                calculatePace(distance, formatted);
        } else {
            pacePreview.textContent = "-";
        }

    }

}

function saveWorkout() {

    const distance =
        parseFloat(document.getElementById("distance").value) || 0;

    const time =
        formatTime(
            document.getElementById("time").value
        );

    if (distance <= 0) {
        alert("거리를 입력해주세요.");
        return;
    }

    if (time === "") {
        alert("시간을 입력해주세요.");
        return;
    }

    const pace =
        calculatePace(distance, time);

    if (!appData.logs) {
        appData.logs = [];
    }

    appData.logs.unshift({

        date: new Date().toLocaleDateString("ko-KR"),

        distance,

        time,

        pace

    });

    appData.weekly.current += distance;

    saveData();

    renderApp();

    initEvents();

    alert("운동 기록이 저장되었습니다. 🎉");
}

function formatTime(input) {

    const numbers = input.replace(/\D/g, "");

    if (numbers.length === 0) {
        return "";
    }

    if (numbers.length <= 2) {
        return numbers;
    }

    if (numbers.length <= 4) {

        const min = numbers.slice(0, numbers.length - 2);
        const sec = numbers.slice(-2);

        return `${parseInt(min, 10)}:${sec}`;
    }

    const hour = numbers.slice(0, numbers.length - 4);
    const min = numbers.slice(-4, -2);
    const sec = numbers.slice(-2);

    return `${parseInt(hour, 10)}:${min}:${sec}`;

}

function calculatePace(distance, time) {

    const parts = time.split(":").map(Number);

    let totalSeconds = 0;

    if (parts.length === 2) {

        totalSeconds =
            parts[0] * 60 +
            parts[1];

    } else if (parts.length === 3) {

        totalSeconds =
            parts[0] * 3600 +
            parts[1] * 60 +
            parts[2];

    }

    const paceSeconds =
        totalSeconds / distance;

    const minutes =
        Math.floor(paceSeconds / 60);

    const seconds =
        Math.round(paceSeconds % 60);

    return `${minutes}'${String(seconds).padStart(2, "0")}" /km`;

}

function saveData() {

    localStorage.setItem(
        "roadToSub60",
        JSON.stringify(appData)
    );

}

function loadData() {

    const saved =
        localStorage.getItem("roadToSub60");

    if (!saved) return;

    try {

        const parsed = JSON.parse(saved);

        Object.assign(appData, parsed);

        if (!appData.logs) {
            appData.logs = [];
        }

    } catch (e) {

        console.error(e);

        localStorage.removeItem("roadToSub60");

    }

}
