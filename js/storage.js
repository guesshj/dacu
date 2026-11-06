/**
 * storage.js
 * 데이터 모델과 localStorage 저장/불러오기를 담당합니다.
 * 모든 모듈은 전역 네임스페이스 window.Dakku 아래에 붙습니다.
 * (file:// 로 열어도 동작하도록 ES 모듈 대신 일반 스크립트를 씁니다.)
 */
window.Dakku = window.Dakku || {};

(function (D) {
  "use strict";

  const STORAGE_KEY = "digital-dakku:v1";
  const SECTIONS = ["diary", "book", "workout", "photo", "deco"];

  /** 하루치 기록의 기본 모양 */
  function createEmptyEntry() {
    return {
      diary: { title: "", mood: "", weather: "", text: "" },
      book: { title: "", author: "", pages: "", status: "reading", rating: 0, quote: "" },
      workout: { items: [], steps: "" },
      photo: { src: "", filter: "none", intensity: 100, brightness: 0, frame: "polaroid", caption: "" },
      deco: { theme: "hanji", banner: "오늘의 기록", stickers: [] },
      updatedAt: 0,
    };
  }

  /** 저장된 값(구버전 포함)을 기본 모양에 맞춰 채워 넣습니다. */
  function normalizeEntry(raw) {
    const base = createEmptyEntry();
    if (!raw || typeof raw !== "object") return base;

    SECTIONS.forEach((section) => {
      if (raw[section] && typeof raw[section] === "object") {
        base[section] = Object.assign(base[section], raw[section]);
      }
    });

    if (!Array.isArray(base.workout.items)) base.workout.items = [];
    if (!Array.isArray(base.deco.stickers)) base.deco.stickers = [];
    base.updatedAt = Number(raw.updatedAt) || 0;
    return base;
  }

  /** 어떤 종류의 기록이 들어 있는지 알려줍니다. */
  function contentFlags(entry) {
    return {
      diary: Boolean(entry.diary.title.trim() || entry.diary.text.trim()),
      book: Boolean(entry.book.title.trim()),
      workout: entry.workout.items.length > 0 || Number(entry.workout.steps) > 0,
      photo: Boolean(entry.photo.src),
    };
  }

  function isEmptyEntry(entry) {
    const f = contentFlags(entry);
    return (
      !f.diary &&
      !f.book &&
      !f.workout &&
      !f.photo &&
      !entry.diary.mood &&
      !entry.diary.weather &&
      entry.deco.stickers.length === 0
    );
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { version: 1, entries: {} };
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed.entries !== "object") return { version: 1, entries: {} };
      return parsed;
    } catch (err) {
      console.warn("[dakku] 저장된 기록을 읽지 못했어요.", err);
      return { version: 1, entries: {} };
    }
  }

  /** @returns {{ok: boolean, reason?: string}} */
  function save(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return { ok: true };
    } catch (err) {
      const quota = err && (err.name === "QuotaExceededError" || err.code === 22);
      return { ok: false, reason: quota ? "quota" : "unknown" };
    }
  }

  function getEntry(data, key) {
    return normalizeEntry(data.entries[key]);
  }

  /** 비어 있는 날은 저장소에서 지워 모아보기를 깔끔하게 유지합니다. */
  function setEntry(data, key, entry) {
    if (isEmptyEntry(entry)) delete data.entries[key];
    else data.entries[key] = entry;
  }

  /* ---------- 날짜 도우미 ---------- */
  const pad = (n) => String(n).padStart(2, "0");

  function toKey(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function fromKey(key) {
    const [y, m, d] = key.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  function shiftKey(key, days) {
    const date = fromKey(key);
    date.setDate(date.getDate() + days);
    return toKey(date);
  }

  D.store = {
    STORAGE_KEY,
    createEmptyEntry,
    normalizeEntry,
    contentFlags,
    isEmptyEntry,
    load,
    save,
    getEntry,
    setEntry,
    toKey,
    fromKey,
    shiftKey,
    pad,
  };
})(window.Dakku);
