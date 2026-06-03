(function () {
  const RECORD_STORAGE_KEY = "yoursheet.records.v1";
  const recordList = document.querySelector("#record-list");
  const recordStatus = document.querySelector("#record-status");
  let records = {};

  function setStatus(message, isError = false) {
    recordStatus.textContent = message;
    recordStatus.classList.toggle("error", isError);
  }

  function normalizeDate(value) {
    const text = String(value ?? "").trim();
    if (!text) {
      throw new Error("日期不能为空");
    }

    const calendarMatch = text.match(/(\d{1,2})\D+(\d{1,2})/);
    if (calendarMatch) {
      const month = Number(calendarMatch[1]);
      const day = Number(calendarMatch[2]);
      validateMonthDay(month, day);
      return `${month}${String(day).padStart(2, "0")}`;
    }

    const digits = text.replace(/\D/g, "");
    if (digits.length < 3 || digits.length > 4) {
      throw new Error("日期无效");
    }

    const month = Number(digits.length === 3 ? digits.slice(0, 1) : digits.slice(0, 2));
    const day = Number(digits.length === 3 ? digits.slice(1) : digits.slice(2));
    validateMonthDay(month, day);
    return `${month}${String(day).padStart(2, "0")}`;
  }

  function validateMonthDay(month, day) {
    if (month < 1 || month > 12 || day < 1 || day > 31) {
      throw new Error("日期无效");
    }
  }

  function validCode(value) {
    return /^[a-zA-Z]{4}$/.test(String(value));
  }

  function mergeRecords(...sources) {
    const merged = {};
    for (const source of sources) {
      if (!source || typeof source !== "object") {
        continue;
      }
      for (const [day, values] of Object.entries(source)) {
        if (!Array.isArray(values)) {
          continue;
        }
        let normalizedDay;
        try {
          normalizedDay = normalizeDate(day);
        } catch {
          continue;
        }
        const cleanValues = values.map(String).filter(validCode);
        merged[normalizedDay] = Array.from(new Set([...(merged[normalizedDay] || []), ...cleanValues]));
      }
    }
    return merged;
  }

  function storageGet() {
    try {
      return window.localStorage.getItem(RECORD_STORAGE_KEY);
    } catch {
      return null;
    }
  }

  async function loadRecords() {
    let repoRecords = {};
    try {
      const response = await fetch("records.json", { cache: "no-store" });
      if (response.ok) {
        repoRecords = await response.json();
      }
    } catch {
      repoRecords = {};
    }

    let localRecords = {};
    const stored = storageGet();
    if (stored) {
      try {
        localRecords = JSON.parse(stored);
      } catch {
        localRecords = {};
      }
    }

    records = mergeRecords(repoRecords, localRecords);
    renderRecords();
    setStatus("已加载");
  }

  function renderRecords() {
    recordList.replaceChildren();
    const days = Object.keys(records).sort((a, b) => Number(a) - Number(b));

    if (days.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.textContent = "暂无记录";
      recordList.append(empty);
      return;
    }

    for (const day of days) {
      const row = document.createElement("div");
      row.className = "record-row";

      const date = document.createElement("strong");
      date.textContent = `${day}:`;

      const codes = document.createElement("div");
      codes.className = "record-codes";
      for (const code of records[day]) {
        const chip = document.createElement("span");
        chip.className = "record-chip";
        chip.textContent = code;
        codes.append(chip);
      }

      row.append(date, codes);
      recordList.append(row);
    }
  }

  function exportRecords() {
    const payload = `${JSON.stringify(records, null, 2)}\n`;
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "records.json";
    link.click();
    URL.revokeObjectURL(url);
    setStatus("已导出");
  }

  document.querySelector("#refresh-records").addEventListener("click", loadRecords);
  document.querySelector("#export-records").addEventListener("click", exportRecords);

  window.YourSheetBackground?.create();
  loadRecords();

  window.YourSheetRecord = { loadRecords };
})();
