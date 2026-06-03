(function () {
  const ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const BASE = ALPHABET.length;
  const CODE_LENGTH = 4;
  const MODULUS = BASE ** CODE_LENGTH;
  const MINUTES_PER_DAY = 24 * 60;
  const END_BUCKETS = MINUTES_PER_DAY + 1;
  const RANGE_COUNT = MINUTES_PER_DAY * END_BUCKETS;
  const FNV64_OFFSET = 14695981039346656037n;
  const FNV64_PRIME = 1099511628211n;
  const FNV64_MASK = (1n << 64n) - 1n;
  const ANCHOR_KEY = "dog";
  const ANCHOR_START = "19:26";
  const ANCHOR_END = "19:30";
  const ANCHOR_CODE = "absd";
  const RECORD_STORAGE_KEY = "yoursheet.records.v1";

  const encoder = new TextEncoder();
  const decKey = document.querySelector("#dec-key");
  const beginInput = document.querySelector("#begin");
  const endInput = document.querySelector("#end");
  const noEndInput = document.querySelector("#no-end");
  const cipherOutput = document.querySelector("#cipher-output");
  const encryptStatus = document.querySelector("#encrypt-status");
  const cipherInput = document.querySelector("#cipher-input");
  const decodedBegin = document.querySelector("#decoded-begin");
  const decodedEnd = document.querySelector("#decoded-end");
  const plainOutput = document.querySelector("#plain-output");
  const decryptStatus = document.querySelector("#decrypt-status");
  const recordDate = document.querySelector("#record-date");
  const recordCodes = document.querySelector("#record-codes");
  const recordStatus = document.querySelector("#record-status");
  const recordList = document.querySelector("#record-list");
  const peekAlert = document.querySelector("#peek-alert");
  const peekClose = document.querySelector("#peek-close");

  let records = {};
  let lastPeekKey = "";

  function mod(value, modulus) {
    return ((value % modulus) + modulus) % modulus;
  }

  function gcd(a, b) {
    while (b !== 0) {
      const temp = b;
      b = a % b;
      a = temp;
    }
    return Math.abs(a);
  }

  function modInverse(value, modulus) {
    let oldR = value;
    let r = modulus;
    let oldS = 1;
    let s = 0;

    while (r !== 0) {
      const quotient = Math.floor(oldR / r);
      [oldR, r] = [r, oldR - quotient * r];
      [oldS, s] = [s, oldS - quotient * s];
    }

    if (oldR !== 1) {
      throw new Error("密钥无效");
    }

    return mod(oldS, modulus);
  }

  function hashInt(key, purpose) {
    if (typeof key !== "string" || key.length === 0) {
      throw new Error("密钥不能为空");
    }

    let value = FNV64_OFFSET;
    const bytes = encoder.encode(`TimeR:${purpose}:${key}`);
    for (const byte of bytes) {
      value ^= BigInt(byte);
      value = (value * FNV64_PRIME) & FNV64_MASK;
    }
    return value;
  }

  function keyMultiplier(key) {
    let candidate = Number(hashInt(key, "multiplier") % BigInt(MODULUS));
    candidate |= 1;

    while (gcd(candidate, MODULUS) !== 1) {
      candidate = (candidate + 2) % MODULUS;
      if (candidate === 0) {
        candidate = 1;
      }
    }

    return candidate;
  }

  function rawOffset(key) {
    return Number(hashInt(key, "offset") % BigInt(MODULUS));
  }

  function keyParameters(key) {
    const multiplier = keyMultiplier(key);
    const offset = mod(rawOffset(key) + ANCHOR_CALIBRATION, MODULUS);
    return { multiplier, offset };
  }

  function parseTime(value) {
    const text = String(value);
    const match = text.match(/^\s*(\d{1,2})\s*(?::|：)\s*(\d{1,2})\s*$/);
    if (!match) {
      throw new Error("时间格式应为 HH:MM");
    }

    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (hour > 23 || minute > 59) {
      throw new Error("时间范围应为 00:00 到 23:59");
    }

    return hour * 60 + minute;
  }

  function parseOptionalEnd(value) {
    const normalized = String(value ?? "").trim().toLowerCase();
    if (["", "n/a", "na", "none", "null", "-"].includes(normalized)) {
      return null;
    }
    return parseTime(value);
  }

  function formatTime(value) {
    const hour = Math.floor(value / 60);
    const minute = value % 60;
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  }

  function rankInterval(startMinute, endMinute) {
    const endBucket = endMinute === null ? MINUTES_PER_DAY : endMinute;
    return startMinute * END_BUCKETS + endBucket;
  }

  function unrankInterval(rank) {
    if (rank < 0 || rank >= RANGE_COUNT) {
      throw new Error("该密文不属于当前密钥的有效时间空间");
    }
    const startMinute = Math.floor(rank / END_BUCKETS);
    const endBucket = rank % END_BUCKETS;
    return {
      start: startMinute,
      end: endBucket === MINUTES_PER_DAY ? null : endBucket
    };
  }

  function valueToCode(value) {
    if (value < 0 || value >= MODULUS) {
      throw new Error("密文数值超出范围");
    }
    const chars = [];
    let current = value;
    for (let i = 0; i < CODE_LENGTH; i += 1) {
      const index = current % BASE;
      current = Math.floor(current / BASE);
      chars.push(ALPHABET[index]);
    }
    return chars.reverse().join("");
  }

  function codeToValue(code) {
    if (code.length !== CODE_LENGTH) {
      throw new Error("密文必须是 4 个字母");
    }
    let value = 0;
    for (const char of code) {
      const index = ALPHABET.indexOf(char);
      if (index < 0) {
        throw new Error("密文只能使用 a-zA-Z");
      }
      value = value * BASE + index;
    }
    return value;
  }

  function calibration() {
    const anchorRank = rankInterval(parseTime(ANCHOR_START), parseTime(ANCHOR_END));
    const targetValue = codeToValue(ANCHOR_CODE);
    const anchorValue = keyMultiplier(ANCHOR_KEY) * anchorRank + rawOffset(ANCHOR_KEY);
    return mod(targetValue - anchorValue, MODULUS);
  }

  const ANCHOR_CALIBRATION = calibration();

  function encryptInterval(start, end, key) {
    const startMinute = parseTime(start);
    const endMinute = parseOptionalEnd(end);
    const rank = rankInterval(startMinute, endMinute);
    const { multiplier, offset } = keyParameters(key);
    return valueToCode(mod(multiplier * rank + offset, MODULUS));
  }

  function decryptCode(code, key) {
    const value = codeToValue(code.trim());
    const { multiplier, offset } = keyParameters(key);
    const inverse = modInverse(multiplier, MODULUS);
    const rank = mod((value - offset) * inverse, MODULUS);
    return unrankInterval(rank);
  }

  function setStatus(element, message, isError = false) {
    element.textContent = message;
    element.classList.toggle("error", isError);
  }

  function updateEncryption() {
    endInput.disabled = noEndInput.checked;
    if (noEndInput.checked) {
      endInput.value = "";
    }

    try {
      const endValue = noEndInput.checked ? null : endInput.value;
      const code = encryptInterval(beginInput.value, endValue, ANCHOR_KEY);
      cipherOutput.textContent = code;
      setStatus(encryptStatus, "有效");
    } catch (error) {
      cipherOutput.textContent = "----";
      setStatus(encryptStatus, error.message, true);
    }
  }

  function updateDecryption() {
    try {
      const key = decKey.value;
      if (!key) {
        throw new Error("密钥不能为空");
      }
      if (key !== ANCHOR_KEY) {
        if (key.length >= ANCHOR_KEY.length) {
          showPeekAlert(key);
        }
        throw new Error("密钥无效");
      }

      const decoded = decryptCode(cipherInput.value, key);
      const begin = formatTime(decoded.start);
      const end = decoded.end === null ? "N/A" : formatTime(decoded.end);
      decodedBegin.value = begin;
      decodedEnd.value = end;
      plainOutput.textContent = `${begin}-${end}`;
      setStatus(decryptStatus, "有效");
    } catch (error) {
      decodedBegin.value = "";
      decodedEnd.value = "";
      plainOutput.textContent = "----";
      setStatus(decryptStatus, error.message, true);
    }
  }

  function showPeekAlert(key) {
    if (lastPeekKey === key && peekAlert.classList.contains("show")) {
      return;
    }
    lastPeekKey = key;
    peekAlert.classList.add("show");
    peekAlert.setAttribute("aria-hidden", "false");
  }

  function hidePeekAlert() {
    peekAlert.classList.remove("show");
    peekAlert.setAttribute("aria-hidden", "true");
  }

  function writeClipboard(text, statusElement) {
    if (!navigator.clipboard) {
      setStatus(statusElement, "当前浏览器不支持剪贴板", true);
      return;
    }
    navigator.clipboard.writeText(text).then(
      () => setStatus(statusElement, "已复制"),
      () => setStatus(statusElement, "复制失败", true)
    );
  }

  function storageGet() {
    try {
      return window.localStorage.getItem(RECORD_STORAGE_KEY);
    } catch {
      return null;
    }
  }

  function storageSet(value) {
    try {
      window.localStorage.setItem(RECORD_STORAGE_KEY, value);
    } catch {
      setStatus(recordStatus, "本地保存不可用，已保留在当前页面", true);
    }
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
      throw new Error("日期示例：603");
    }

    const month = Number(digits.length === 3 ? digits.slice(0, 1) : digits.slice(0, 2));
    const day = Number(digits.length === 3 ? digits.slice(1) : digits.slice(2));
    validateMonthDay(month, day);
    return `${month}${String(day).padStart(2, "0")}`;
  }

  function validateMonthDay(month, day) {
    if (month < 1 || month > 12 || day < 1 || day > 31) {
      throw new Error("日期范围无效");
    }
  }

  function parseCodes(value) {
    const codes = String(value ?? "")
      .split(/[\s,，;；、{}[\]()]+/)
      .map((item) => item.trim())
      .filter(Boolean);

    if (codes.length === 0) {
      throw new Error("请输入至少一个密文");
    }

    codes.forEach(codeToValue);
    return Array.from(new Set(codes));
  }

  function saveRecords() {
    storageSet(JSON.stringify(records, null, 2));
    renderRecords();
  }

  function renderRecords() {
    recordList.replaceChildren();
    const days = Object.keys(records).sort((a, b) => Number(a) - Number(b));

    if (days.length === 0) {
      const empty = document.createElement("div");
      empty.className = "record-empty";
      empty.textContent = "暂无记录";
      recordList.append(empty);
      return;
    }

    for (const day of days) {
      const row = document.createElement("div");
      row.className = "record-row";

      const date = document.createElement("strong");
      date.textContent = `${day}:`;

      const codes = document.createElement("span");
      codes.textContent = `{${records[day].join(", ")}}`;

      row.append(date, codes);
      recordList.append(row);
    }
  }

  async function loadRecords() {
    let repoRecords = {};
    if (typeof fetch === "function") {
      try {
        const response = await fetch("records.json", { cache: "no-store" });
        if (response.ok) {
          repoRecords = await response.json();
        }
      } catch {
        repoRecords = {};
      }
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
        const nextValues = values.map(String).filter((value) => {
          try {
            codeToValue(value);
            return true;
          } catch {
            return false;
          }
        });
        merged[normalizedDay] = Array.from(new Set([...(merged[normalizedDay] || []), ...nextValues]));
      }
    }
    return merged;
  }

  function addRecord() {
    try {
      const day = normalizeDate(recordDate.value);
      const codes = parseCodes(recordCodes.value);
      records[day] = Array.from(new Set([...(records[day] || []), ...codes]));
      saveRecords();
      setStatus(recordStatus, "已保存");
    } catch (error) {
      setStatus(recordStatus, error.message, true);
    }
  }

  function addCurrentCodeToInput() {
    const code = cipherOutput.textContent.trim();
    if (code === "----") {
      setStatus(recordStatus, "当前密文不可用", true);
      return;
    }

    const existing = recordCodes.value.trim();
    recordCodes.value = existing ? `${existing}, ${code}` : code;
    setStatus(recordStatus, "已加入");
  }

  function clearRecordDay() {
    try {
      const day = normalizeDate(recordDate.value);
      delete records[day];
      saveRecords();
      setStatus(recordStatus, "已清空");
    } catch (error) {
      setStatus(recordStatus, error.message, true);
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
    setStatus(recordStatus, "已导出");
  }

  [beginInput, endInput, noEndInput].forEach((element) => {
    element.addEventListener("input", updateEncryption);
    element.addEventListener("change", updateEncryption);
  });

  [decKey, cipherInput].forEach((element) => {
    element.addEventListener("input", updateDecryption);
  });

  document.querySelector("#copy-code").addEventListener("click", () => {
    writeClipboard(cipherOutput.textContent, encryptStatus);
  });

  document.querySelector("#use-code").addEventListener("click", () => {
    cipherInput.value = cipherOutput.textContent;
    updateDecryption();
  });

  document.querySelector("#copy-plain").addEventListener("click", () => {
    writeClipboard(plainOutput.textContent, decryptStatus);
  });

  document.querySelector("#add-current-code").addEventListener("click", addCurrentCodeToInput);
  document.querySelector("#save-record").addEventListener("click", addRecord);
  document.querySelector("#export-records").addEventListener("click", exportRecords);
  document.querySelector("#clear-record-day").addEventListener("click", clearRecordDay);

  peekClose.addEventListener("click", hidePeekAlert);
  peekAlert.addEventListener("click", (event) => {
    if (event.target === peekAlert) {
      hidePeekAlert();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      hidePeekAlert();
    }
  });

  window.YourSheetBackground?.create();
  updateEncryption();
  updateDecryption();
  loadRecords();

  window.YourSheetIndex = {
    updateDecryption,
    hidePeekAlert,
    addRecord
  };
})();
