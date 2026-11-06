/**
 * app.js
 * 화면(폼, 탭, 스티커 조작, 모아보기, 다운로드)과 데이터를 연결합니다.
 */
(function (D) {
  "use strict";

  /* ---------- 설정 ---------- */
  const MOODS = [
    ["😊", "좋음"],
    ["🥰", "설렘"],
    ["😌", "평온"],
    ["😐", "그저 그럼"],
    ["😢", "슬픔"],
    ["😤", "화남"],
    ["😴", "피곤"],
  ];
  const WEATHERS = [
    ["☀️", "맑음"],
    ["⛅", "구름 조금"],
    ["☁️", "흐림"],
    ["🌧️", "비"],
    ["❄️", "눈"],
    ["🌈", "무지개"],
  ];
  const CAPTIONS = [
    "오늘의 나, 맑음",
    "갓생 사는 중",
    "행복은 가까이에",
    "Seoul, 2026",
    "기억하고 싶은 순간",
    "오늘도 수고했어",
  ];
  const ARCHIVE_CATS = [
    ["all", "전체"],
    ["diary", "✏️ 일기"],
    ["book", "📚 독서"],
    ["workout", "💪 운동"],
    ["photo", "📸 사진"],
  ];
  const PHOTO_MAX = 1100; // 저장 공간을 아끼기 위해 긴 변 기준으로 줄입니다.

  const CHIPSETS = {
    "diary.mood": MOODS.map(([v, l]) => ({ value: v, label: `${v} ${l}` })),
    "diary.weather": WEATHERS.map(([v, l]) => ({ value: v, label: `${v} ${l}` })),
    "photo.frame": Object.entries(D.renderer.FRAMES).map(([v, f]) => ({ value: v, label: f.label })),
    "deco.theme": Object.entries(D.renderer.THEMES).map(([v, t]) => ({ value: v, label: t.label })),
  };

  /* ---------- 상태 ---------- */
  const data = D.store.load();
  let currentKey = D.store.toKey(new Date());
  let entry = D.store.getEntry(data, currentKey);
  let selectedId = null;
  let stickerTab = "emoji";
  let customColor = D.stickers.CUSTOM_COLORS[0];
  let archiveCat = "all";

  const assets = {
    src: null, // 현재 불러온 사진 dataURL
    base: null, // 원본 캔버스
    processed: null, // 필터 적용 캔버스
    processedKey: "",
  };

  /* ---------- DOM ---------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const canvas = $("#page");
  const ctx = canvas.getContext("2d");
  const W = D.renderer.W;
  const H = D.renderer.H;
  const viewScale = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
  canvas.width = W * viewScale;
  canvas.height = H * viewScale;

  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
      if (k === "class") node.className = v;
      else if (k === "text") node.textContent = v;
      else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v);
    });
    [].concat(children).forEach((c) => c && node.append(c));
    return node;
  }

  const getPath = (obj, path) => path.split(".").reduce((o, k) => (o == null ? o : o[k]), obj);
  function setPath(obj, path, value) {
    const keys = path.split(".");
    const last = keys.pop();
    keys.reduce((o, k) => o[k], obj)[last] = value;
  }

  const uid = () => Math.random().toString(36).slice(2, 10);
  const rand = (a, b) => a + Math.random() * (b - a);

  /* ---------- 토스트 ---------- */
  let toastTimer = 0;
  function toast(message) {
    const t = $("#toast");
    t.textContent = message;
    t.classList.add("is-show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("is-show"), 2200);
  }

  /* ---------- 저장 ---------- */
  let saveTimer = 0;
  function setSaveStatus(text, isError = false) {
    const s = $("#saveStatus");
    s.textContent = text;
    s.classList.toggle("is-error", isError);
  }

  function scheduleSave() {
    setSaveStatus("저장 중…");
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      const res = D.store.save(data);
      if (res.ok) {
        setSaveStatus("저장됨");
      } else if (res.reason === "quota") {
        setSaveStatus("저장 공간 부족", true);
        toast("브라우저 저장 공간이 가득 찼어요. 백업 파일을 받은 뒤 오래된 사진을 빼주세요.");
      } else {
        setSaveStatus("저장 실패", true);
        toast("저장하지 못했어요. 브라우저의 사이트 데이터 설정을 확인해주세요.");
      }
    }, 350);
  }

  /** 기록이 바뀔 때마다 호출 */
  function commit() {
    entry.updatedAt = Date.now();
    D.store.setEntry(data, currentKey, entry);
    scheduleSave();
    requestRender();
  }

  /* ---------- 렌더링 ---------- */
  let raf = 0;
  function requestRender() {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      ensureProcessed();
      D.renderer.render(ctx, currentKey, entry, assets, { scale: viewScale, selectedId });
    });
  }

  function ensureProcessed() {
    if (!assets.base) {
      assets.processed = null;
      assets.processedKey = "";
      return;
    }
    const p = entry.photo;
    const key = `${p.filter}|${p.intensity}|${p.brightness}`;
    if (key !== assets.processedKey) {
      assets.processed = D.filters.apply(assets.base, p.filter, p.intensity, p.brightness);
      assets.processedKey = key;
    }
  }

  /* ---------- 사진 ---------- */
  function loadPhotoAsset() {
    const src = entry.photo.src;
    if (src === assets.src) return;
    assets.src = src;
    assets.base = null;
    assets.processed = null;
    assets.processedKey = "";
    if (!src) {
      buildFilterThumbs();
      requestRender();
      return;
    }
    const img = new Image();
    img.onload = () => {
      if (assets.src !== src) return; // 그 사이 날짜가 바뀐 경우
      const c = document.createElement("canvas");
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      c.getContext("2d").drawImage(img, 0, 0);
      assets.base = c;
      buildFilterThumbs();
      requestRender();
    };
    img.src = src;
  }

  function readPhotoFile(file) {
    if (!file || !file.type.startsWith("image/")) {
      toast("이미지 파일만 올릴 수 있어요.");
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const ratio = Math.min(1, PHOTO_MAX / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement("canvas");
      c.width = Math.round(img.naturalWidth * ratio);
      c.height = Math.round(img.naturalHeight * ratio);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      entry.photo.src = c.toDataURL("image/jpeg", 0.84);
      loadPhotoAsset();
      updatePhotoUI();
      commit();
      toast("사진을 붙였어요.");
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      toast("이 사진은 열 수 없어요. JPG나 PNG로 다시 올려주세요.");
    };
    img.src = url;
  }

  function buildFilterThumbs() {
    const grid = $("#filterGrid");
    const source = assets.base || D.filters.sampleCanvas(120);
    grid.replaceChildren(
      ...D.filters.thumbnails(source, 96).map((t) =>
        el(
          "button",
          {
            type: "button",
            class: `filter-btn${entry.photo.filter === t.id ? " is-active" : ""}`,
            "data-filter": t.id,
            "aria-pressed": String(entry.photo.filter === t.id),
            onclick: () => {
              entry.photo.filter = t.id;
              syncFilterButtons();
              commit();
            },
          },
          [el("img", { src: t.url, alt: "" }), el("span", { text: t.label })]
        )
      )
    );
  }

  function syncFilterButtons() {
    $$(".filter-btn").forEach((b) => {
      const on = b.dataset.filter === entry.photo.filter;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-pressed", String(on));
    });
  }

  function updatePhotoUI() {
    $("#removePhoto").hidden = !entry.photo.src;
    $("#intensityVal").textContent = `${entry.photo.intensity}%`;
    $("#brightnessVal").textContent =
      entry.photo.brightness > 0 ? `+${entry.photo.brightness}` : String(entry.photo.brightness);
    syncFilterButtons();
  }

  /* ---------- 폼 바인딩 ---------- */
  function fillForm() {
    $$("[data-bind]").forEach((input) => {
      const v = getPath(entry, input.dataset.bind);
      input.value = v == null ? "" : v;
    });
    syncChipsets();
    syncRating();
    updateDiaryCount();
    renderWorkouts();
    updatePhotoUI();
  }

  function updateDiaryCount() {
    $("#diaryCount").textContent = `${entry.diary.text.length} / 500`;
  }

  function bindInputs() {
    $$("[data-bind]").forEach((input) => {
      input.addEventListener("input", () => {
        const path = input.dataset.bind;
        const value = input.type === "range" ? Number(input.value) : input.value;
        setPath(entry, path, value);
        if (path === "diary.text") updateDiaryCount();
        if (path.startsWith("photo.")) updatePhotoUI();
        commit();
      });
    });
  }

  /* ---------- 칩 묶음 ---------- */
  function buildChipsets() {
    $$("[data-chipset]").forEach((box) => {
      const path = box.dataset.chipset;
      const toggle = box.dataset.toggle === "true";
      box.replaceChildren(
        ...CHIPSETS[path].map((opt) =>
          el("button", {
            type: "button",
            class: "chip",
            "data-value": opt.value,
            "aria-pressed": "false",
            text: opt.label,
            onclick: () => {
              const cur = getPath(entry, path);
              setPath(entry, path, toggle && cur === opt.value ? "" : opt.value);
              syncChipsets();
              commit();
            },
          })
        )
      );
    });
  }

  function syncChipsets() {
    $$("[data-chipset]").forEach((box) => {
      const cur = getPath(entry, box.dataset.chipset);
      $$(".chip", box).forEach((chip) => {
        const on = chip.dataset.value === cur;
        chip.classList.toggle("is-active", on);
        chip.setAttribute("aria-pressed", String(on));
      });
    });
  }

  /* ---------- 별점 ---------- */
  function buildRating() {
    const box = $("#rating");
    for (let i = 1; i <= 5; i++) {
      box.append(
        el("button", {
          type: "button",
          role: "radio",
          "aria-label": `별 ${i}개`,
          "data-rating": String(i),
          text: "★",
          onclick: () => {
            entry.book.rating = entry.book.rating === i ? 0 : i;
            syncRating();
            commit();
          },
        })
      );
    }
  }

  function syncRating() {
    $$("#rating button").forEach((b) => {
      const n = Number(b.dataset.rating);
      b.classList.toggle("is-on", n <= entry.book.rating);
      b.setAttribute("aria-checked", String(n === entry.book.rating));
    });
  }

  /* ---------- 운동 ---------- */
  function buildWorkoutForm() {
    const select = $("#wType");
    Object.keys(D.renderer.WORKOUT_ICON).forEach((name) => {
      select.append(el("option", { value: name, text: `${D.renderer.WORKOUT_ICON[name]} ${name}` }));
    });
    select.value = "러닝";

    $("#wAdd").addEventListener("click", () => {
      const min = Math.round(Number($("#wMin").value));
      if (!min || min < 1) {
        toast("운동 시간을 1분 이상으로 적어주세요.");
        $("#wMin").focus();
        return;
      }
      entry.workout.items.push({ id: uid(), type: select.value, min, level: $("#wLevel").value });
      renderWorkouts();
      commit();
      toast("운동을 기록했어요. 오운완!");
    });
  }

  function renderWorkouts() {
    const list = $("#wList");
    const items = entry.workout.items;
    if (!items.length) {
      list.replaceChildren(
        el("li", {
          class: "workout-empty",
          text: "아직 기록한 운동이 없어요. 위에서 종류와 시간을 골라 추가해보세요.",
        })
      );
    } else {
      list.replaceChildren(
        ...items.map((it) =>
          el("li", {}, [
            el("span", {
              class: "w-icon",
              "aria-hidden": "true",
              text: D.renderer.WORKOUT_ICON[it.type] || "✨",
            }),
            el("span", { class: "w-main" }, [
              document.createTextNode(`${it.type} ${it.min}분`),
              el("br"),
              el("span", { class: "w-sub", text: it.level }),
            ]),
            el("button", {
              type: "button",
              class: "w-del",
              "aria-label": `${it.type} 기록 지우기`,
              text: "✕",
              onclick: () => {
                entry.workout.items = entry.workout.items.filter((x) => x !== it);
                renderWorkouts();
                commit();
              },
            }),
          ])
        )
      );
    }
    const total = items.reduce((s, it) => s + (Number(it.min) || 0), 0);
    const totalBox = $("#wTotal");
    totalBox.replaceChildren();
    if (total) totalBox.append("오늘 총 ", el("strong", { text: String(total) }), "분 움직였어요");
  }

  /* ---------- 프레임 문구 프리셋 ---------- */
  function buildCaptionPresets() {
    $("#captionPresets").replaceChildren(
      ...CAPTIONS.map((c) =>
        el("button", {
          type: "button",
          class: "chip",
          text: c,
          onclick: () => {
            entry.photo.caption = c;
            $('[data-bind="photo.caption"]').value = c;
            commit();
          },
        })
      )
    );
  }

  /* ---------- 스티커 ---------- */
  function buildStickerTray() {
    const grid = $("#stickerGrid");
    let buttons = [];
    if (stickerTab === "emoji") {
      buttons = D.stickers.EMOJI.map((e) =>
        el("button", {
          type: "button",
          class: "sticker-btn",
          "aria-label": `${e} 스티커 붙이기`,
          text: e,
          onclick: () => addSticker({ kind: "emoji", value: e }),
        })
      );
    } else if (stickerTab === "text") {
      buttons = D.stickers.TEXTS.map((t) =>
        el(
          "button",
          {
            type: "button",
            class: "sticker-btn",
            "aria-label": `${t.value} 문구 스티커 붙이기`,
            onclick: () => addSticker({ kind: "text", value: t.value, color: t.color }),
          },
          [
            el("img", {
              src: D.stickers.preview({ kind: "text", value: t.value, color: t.color, scale: 1 }),
              alt: "",
            }),
          ]
        )
      );
    } else {
      buttons = D.stickers.SHAPES.map((s) =>
        el(
          "button",
          {
            type: "button",
            class: "sticker-btn",
            "aria-label": `${s.label} 스티커 붙이기`,
            onclick: () => addSticker({ kind: "shape", value: s.value }),
          },
          [el("img", { src: D.stickers.preview({ kind: "shape", value: s.value, scale: 1 }), alt: "" })]
        )
      );
    }
    grid.replaceChildren(...buttons);
  }

  function buildStickerTabs() {
    $$("[data-sticker-tab]").forEach((b) =>
      b.addEventListener("click", () => {
        stickerTab = b.dataset.stickerTab;
        $$("[data-sticker-tab]").forEach((x) => x.classList.toggle("is-active", x === b));
        buildStickerTray();
      })
    );
  }

  function buildCustomSticker() {
    const box = $("#customColors");
    D.stickers.CUSTOM_COLORS.forEach((c) => {
      box.append(
        el("button", {
          type: "button",
          role: "radio",
          "aria-label": `색 ${c}`,
          "aria-checked": String(c === customColor),
          class: c === customColor ? "is-active" : "",
          style: `background:${c}`,
          onclick: (ev) => {
            customColor = c;
            $$("button", box).forEach((x) => {
              x.classList.toggle("is-active", x === ev.currentTarget);
              x.setAttribute("aria-checked", String(x === ev.currentTarget));
            });
          },
        })
      );
    });
    const add = () => {
      const text = $("#customText").value.trim();
      if (!text) {
        toast("스티커에 넣을 문구를 적어주세요.");
        $("#customText").focus();
        return;
      }
      addSticker({ kind: "text", value: text, color: customColor });
      $("#customText").value = "";
    };
    $("#customAdd").addEventListener("click", add);
    $("#customText").addEventListener("keydown", (e) => {
      if (e.key === "Enter") add();
    });
  }

  function addSticker(partial) {
    const s = Object.assign(
      { id: uid(), x: rand(330, 570), y: rand(460, 720), scale: 1, rot: rand(-0.25, 0.25) },
      partial
    );
    entry.deco.stickers.push(s);
    selectedId = s.id;
    updateStickerTools();
    commit();
    if (window.matchMedia("(max-width: 960px)").matches) {
      canvas.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  const findSticker = (id) => entry.deco.stickers.find((s) => s.id === id);

  function updateStickerTools() {
    $("#stickerTools").hidden = !findSticker(selectedId);
  }

  function stickerAction(act) {
    const s = findSticker(selectedId);
    if (!s) return;
    const list = entry.deco.stickers;
    switch (act) {
      case "smaller":
        s.scale = Math.max(0.3, s.scale / 1.15);
        break;
      case "bigger":
        s.scale = Math.min(4, s.scale * 1.15);
        break;
      case "rotl":
        s.rot -= Math.PI / 12;
        break;
      case "rotr":
        s.rot += Math.PI / 12;
        break;
      case "front":
        list.splice(list.indexOf(s), 1);
        list.push(s);
        break;
      case "dup": {
        const copy = Object.assign({}, s, { id: uid(), x: s.x + 30, y: s.y + 30 });
        list.push(copy);
        selectedId = copy.id;
        break;
      }
      case "delete":
        list.splice(list.indexOf(s), 1);
        selectedId = null;
        break;
      default:
        return;
    }
    updateStickerTools();
    commit();
  }

  /* ---------- 캔버스 위 스티커 조작 ---------- */
  function toPage(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) / rect.width) * W, y: ((e.clientY - rect.top) / rect.height) * H };
  }

  function stickerAt(p) {
    const list = entry.deco.stickers;
    for (let i = list.length - 1; i >= 0; i--) {
      if (D.stickers.hit(ctx, list[i], p.x, p.y)) return list[i];
    }
    return null;
  }

  let drag = null;

  function bindCanvas() {
    canvas.addEventListener("pointerdown", (e) => {
      const p = toPage(e);
      const sel = findSticker(selectedId);
      if (sel && D.stickers.hitHandle(ctx, sel, p.x, p.y)) {
        drag = {
          mode: "handle",
          s: sel,
          startDist: Math.max(1, Math.hypot(p.x - sel.x, p.y - sel.y)),
          startAngle: Math.atan2(p.y - sel.y, p.x - sel.x),
          startScale: sel.scale,
          startRot: sel.rot,
        };
      } else {
        const hit = stickerAt(p);
        if (hit) {
          selectedId = hit.id;
          drag = { mode: "move", s: hit, dx: p.x - hit.x, dy: p.y - hit.y };
        } else {
          selectedId = null;
        }
      }
      if (drag) canvas.setPointerCapture(e.pointerId);
      updateStickerTools();
      requestRender();
    });

    canvas.addEventListener("pointermove", (e) => {
      const p = toPage(e);
      if (!drag) {
        const sel = findSticker(selectedId);
        if (sel && D.stickers.hitHandle(ctx, sel, p.x, p.y)) canvas.style.cursor = "nwse-resize";
        else canvas.style.cursor = stickerAt(p) ? "grab" : "default";
        return;
      }
      const s = drag.s;
      if (drag.mode === "move") {
        s.x = Math.max(0, Math.min(W, p.x - drag.dx));
        s.y = Math.max(0, Math.min(H, p.y - drag.dy));
        canvas.style.cursor = "grabbing";
      } else {
        const dist = Math.hypot(p.x - s.x, p.y - s.y);
        s.scale = Math.max(0.3, Math.min(4, (drag.startScale * dist) / drag.startDist));
        s.rot = drag.startRot + (Math.atan2(p.y - s.y, p.x - s.x) - drag.startAngle);
      }
      requestRender();
    });

    const end = () => {
      if (!drag) return;
      drag = null;
      canvas.style.cursor = "default";
      commit();
    };
    canvas.addEventListener("pointerup", end);
    canvas.addEventListener("pointercancel", end);

    canvas.addEventListener(
      "wheel",
      (e) => {
        const s = findSticker(selectedId);
        if (!s || !D.stickers.hit(ctx, s, toPage(e).x, toPage(e).y)) return;
        e.preventDefault();
        s.scale = Math.max(0.3, Math.min(4, s.scale * (e.deltaY < 0 ? 1.08 : 1 / 1.08)));
        commit();
      },
      { passive: false }
    );

    document.addEventListener("keydown", (e) => {
      if (!selectedId) return;
      const tag = (document.activeElement && document.activeElement.tagName) || "";
      if (/INPUT|TEXTAREA|SELECT/.test(tag)) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        stickerAction("delete");
      } else if (e.key === "Escape") {
        selectedId = null;
        updateStickerTools();
        requestRender();
      }
    });

    $$("#stickerTools [data-act]").forEach((b) =>
      b.addEventListener("click", () => stickerAction(b.dataset.act))
    );
  }

  /* ---------- 탭 ---------- */
  function bindTabs() {
    const tabs = $$(".tab");
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        tabs.forEach((t) => {
          const on = t === tab;
          t.classList.toggle("is-active", on);
          t.setAttribute("aria-selected", String(on));
        });
        $$(".panel").forEach((p) => (p.hidden = p.dataset.panel !== tab.dataset.tab));
      });
    });
  }

  /* ---------- 날짜 ---------- */
  function switchDate(key) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return;
    currentKey = key;
    entry = D.store.getEntry(data, key);
    selectedId = null;
    $("#dateInput").value = key;
    fillForm();
    loadPhotoAsset();
    updateStickerTools();
    requestRender();
  }

  function bindDateNav() {
    $("#dateInput").addEventListener("change", (e) => switchDate(e.target.value));
    $("#prevDay").addEventListener("click", () => switchDate(D.store.shiftKey(currentKey, -1)));
    $("#nextDay").addEventListener("click", () => switchDate(D.store.shiftKey(currentKey, 1)));
    $("#todayBtn").addEventListener("click", () => switchDate(D.store.toKey(new Date())));
  }

  /* ---------- 다운로드 ---------- */
  function saveBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = el("a", { href: url, download: filename });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  async function downloadImage() {
    await fontsReady;
    ensureProcessed();
    const scale = 2; // 1800 × 2400 고해상도
    const out = document.createElement("canvas");
    out.width = W * scale;
    out.height = H * scale;
    D.renderer.render(out.getContext("2d"), currentKey, entry, assets, { scale, selectedId: null });
    out.toBlob((blob) => {
      if (!blob) {
        toast("이미지를 만들지 못했어요. 다시 눌러주세요.");
        return;
      }
      saveBlob(blob, `digital-dakku-${currentKey}.png`);
      toast("이미지를 다운로드했어요.");
    }, "image/png");
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    saveBlob(blob, `digital-dakku-backup-${D.store.toKey(new Date())}.json`);
    toast("백업 파일을 다운로드했어요.");
    $(".menu").open = false;
  }

  function importJson(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (!parsed || typeof parsed.entries !== "object") throw new Error("형식 오류");
        const count = Object.keys(parsed.entries).length;
        const ok = window.confirm(
          `백업 파일에 ${count}일치 기록이 있어요.\n지금 기록과 합칠까요? 같은 날짜는 백업 파일 내용으로 바뀝니다.`
        );
        if (!ok) return;
        Object.entries(parsed.entries).forEach(([k, v]) => {
          if (/^\d{4}-\d{2}-\d{2}$/.test(k)) data.entries[k] = D.store.normalizeEntry(v);
        });
        assets.src = null;
        switchDate(currentKey);
        scheduleSave();
        toast(`${count}일치 기록을 불러왔어요.`);
      } catch (err) {
        toast("백업 파일을 읽지 못했어요. 이 앱에서 받은 JSON 파일인지 확인해주세요.");
      }
    };
    reader.readAsText(file);
  }

  function bindActions() {
    $("#downloadBtn").addEventListener("click", downloadImage);
    $("#exportJsonBtn").addEventListener("click", exportJson);
    $("#importJsonBtn").addEventListener("click", () => {
      $(".menu").open = false;
      $("#importFile").click();
    });
    $("#importFile").addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (file) importJson(file);
      e.target.value = "";
    });

    // 사진 올리기
    const input = $("#photoInput");
    input.addEventListener("change", () => {
      if (input.files[0]) readPhotoFile(input.files[0]);
      input.value = "";
    });
    const zone = $("#dropzone");
    ["dragenter", "dragover"].forEach((t) =>
      zone.addEventListener(t, (e) => {
        e.preventDefault();
        zone.classList.add("is-over");
      })
    );
    ["dragleave", "drop"].forEach((t) => zone.addEventListener(t, () => zone.classList.remove("is-over")));
    zone.addEventListener("drop", (e) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) readPhotoFile(file);
    });

    $("#removePhoto").addEventListener("click", () => {
      entry.photo.src = "";
      loadPhotoAsset();
      updatePhotoUI();
      commit();
      toast("사진을 뺐어요.");
    });

    $("#clearStickers").addEventListener("click", () => {
      if (!entry.deco.stickers.length) return;
      if (!window.confirm("이 날의 스티커를 모두 뗄까요?")) return;
      entry.deco.stickers = [];
      selectedId = null;
      updateStickerTools();
      commit();
    });
  }

  /* ---------- 모아보기 (필터 & 검색) ---------- */
  const WEEK = ["일", "월", "화", "수", "목", "금", "토"];

  function openArchive() {
    const months = Array.from(new Set(Object.keys(data.entries).map((k) => k.slice(0, 7))))
      .sort()
      .reverse();
    const select = $("#archiveMonth");
    const prev = select.value;
    select.replaceChildren(
      el("option", { value: "", text: "모든 달" }),
      ...months.map((m) => el("option", { value: m, text: `${m.slice(0, 4)}년 ${Number(m.slice(5))}월` }))
    );
    if (months.includes(prev)) select.value = prev;
    renderArchive();
    $("#archive").showModal();
  }

  function renderArchive() {
    const all = Object.keys(data.entries)
      .sort()
      .reverse()
      .map((k) => ({ key: k, e: D.store.normalizeEntry(data.entries[k]) }));

    // 통계
    const stats = [
      [all.length, "기록한 날"],
      [all.filter((x) => x.e.book.status === "done" && x.e.book.title.trim()).length, "완독한 책"],
      [
        all.reduce((s, x) => s + x.e.workout.items.reduce((a, it) => a + (Number(it.min) || 0), 0), 0),
        "운동한 분",
      ],
      [all.filter((x) => x.e.photo.src).length, "남긴 사진"],
    ];
    $("#archiveStats").replaceChildren(
      ...stats.map(([n, label]) =>
        el("div", { class: "stat" }, [
          el("b", { text: Number(n).toLocaleString("ko-KR") }),
          el("span", { text: label }),
        ])
      )
    );

    const month = $("#archiveMonth").value;
    const q = $("#archiveSearch").value.trim().toLowerCase();
    const items = all.filter(({ key, e }) => {
      const f = D.store.contentFlags(e);
      if (archiveCat !== "all" && !f[archiveCat]) return false;
      if (month && !key.startsWith(month)) return false;
      if (q) {
        const hay = [
          e.diary.title,
          e.diary.text,
          e.book.title,
          e.book.author,
          e.book.quote,
          e.photo.caption,
          ...e.workout.items.map((it) => it.type),
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    const list = $("#archiveList");
    if (!items.length) {
      list.replaceChildren(
        el("li", {
          class: "archive-empty",
          text: all.length
            ? "조건에 맞는 기록이 없어요. 필터나 검색어를 바꿔보세요."
            : "아직 기록이 없어요. 오늘 페이지부터 채워보세요.",
        })
      );
      return;
    }

    list.replaceChildren(
      ...items.map(({ key, e }) => {
        const f = D.store.contentFlags(e);
        const d = D.store.fromKey(key);
        const tags = [f.diary && "✏️", f.book && "📚", f.workout && "💪", f.photo && "📸"]
          .filter(Boolean)
          .join(" ");
        const minutes = e.workout.items.reduce((a, it) => a + (Number(it.min) || 0), 0);
        const title =
          e.diary.title ||
          (e.book.title && `『${e.book.title}』`) ||
          (minutes && `운동 ${minutes}분`) ||
          "제목 없는 하루";
        const snippet = e.diary.text || e.book.quote || e.photo.caption || "";
        const thumb = e.photo.src
          ? el("img", { src: e.photo.src, alt: "" })
          : document.createTextNode(e.diary.mood || "📄");
        return el("li", {}, [
          el(
            "button",
            {
              type: "button",
              class: "archive-item",
              onclick: () => {
                $("#archive").close();
                switchDate(key);
              },
            },
            [
              el("span", { class: "archive-item__thumb" }, [thumb]),
              el("span", {}, [
                el("span", {
                  class: "archive-item__date",
                  text: `${d.getFullYear()}.${D.store.pad(d.getMonth() + 1)}.${D.store.pad(d.getDate())} (${WEEK[d.getDay()]})`,
                }),
                el("span", { class: "archive-item__tags", text: tags }),
                el("div", { class: "archive-item__title", text: title }),
                snippet ? el("div", { class: "archive-item__snippet", text: snippet }) : null,
              ]),
            ]
          ),
        ]);
      })
    );
  }

  function bindArchive() {
    $("#archiveBtn").addEventListener("click", openArchive);
    $("#archiveClose").addEventListener("click", () => $("#archive").close());
    $("#archive").addEventListener("click", (e) => {
      if (e.target === e.currentTarget) e.currentTarget.close(); // 바깥 클릭으로 닫기
    });
    $("#archiveCats").replaceChildren(
      ...ARCHIVE_CATS.map(([v, l]) =>
        el("button", {
          type: "button",
          class: `chip${v === archiveCat ? " is-active" : ""}`,
          "data-cat": v,
          text: l,
          onclick: () => {
            archiveCat = v;
            $$("#archiveCats .chip").forEach((c) => c.classList.toggle("is-active", c.dataset.cat === v));
            renderArchive();
          },
        })
      )
    );
    $("#archiveMonth").addEventListener("change", renderArchive);
    $("#archiveSearch").addEventListener("input", renderArchive);
  }

  /* ---------- 폰트 ---------- */
  const fontsReady =
    document.fonts && document.fonts.load
      ? Promise.all(
          [
            '86px "Black Han Sans"',
            '28px "Gaegu"',
            '700 28px "Gaegu"',
            '28px "Gowun Batang"',
            '700 28px "Gowun Batang"',
            '17px "Gowun Dodum"',
          ].map((f) => document.fonts.load(f, "다꾸 기록 0123"))
        ).catch(() => null)
      : Promise.resolve();

  /* ---------- 시작 ---------- */
  function init() {
    buildChipsets();
    buildRating();
    buildWorkoutForm();
    buildCaptionPresets();
    buildStickerTabs();
    buildStickerTray();
    buildCustomSticker();
    bindInputs();
    bindTabs();
    bindDateNav();
    bindActions();
    bindCanvas();
    bindArchive();
    switchDate(currentKey);
    buildFilterThumbs();

    fontsReady.then(() => {
      buildStickerTray(); // 손글씨 폰트로 미리보기 다시 그리기
      requestRender();
    });
  }

  init();
})(window.Dakku);
