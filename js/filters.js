/**
 * filters.js
 * 사진 필터. CSS filter 대신 픽셀을 직접 계산해서
 * 미리보기와 다운로드 이미지가 모든 브라우저에서 똑같이 나오도록 합니다.
 */
window.Dakku = window.Dakku || {};

(function (D) {
  "use strict";

  const clamp = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);
  const lum = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;
  const contrast = (v, c) => (v - 128) * c + 128;
  const lift = (v, a) => v * (1 - a / 255) + a; // 검은 부분을 살짝 띄워 필름 느낌

  function saturate(r, g, b, s) {
    const l = lum(r, g, b);
    return [l + (r - l) * s, l + (g - l) * s, l + (b - l) * s];
  }

  /**
   * 필터 프리셋. fn(r, g, b) → [r, g, b]
   * 이름은 2026 K-감성 사진 앱에서 많이 쓰는 무드를 따랐습니다.
   */
  const PRESETS = [
    { id: "none", label: "원본", fn: (r, g, b) => [r, g, b] },
    {
      id: "film",
      label: "서울 필름",
      fn(r, g, b) {
        const [sr, sg, sb] = saturate(r, g, b, 0.85);
        return [
          lift(contrast(sr, 0.92), 22) + 12,
          lift(contrast(sg, 0.92), 22) + 4,
          lift(contrast(sb, 0.92), 22) - 10,
        ];
      },
    },
    {
      id: "mono",
      label: "먹빛 흑백",
      fn(r, g, b) {
        const l = contrast(lum(r, g, b), 1.18);
        return [l, l, l - 2];
      },
    },
    {
      id: "retro",
      label: "레트로 90s",
      fn(r, g, b) {
        const sr = 0.393 * r + 0.769 * g + 0.189 * b;
        const sg = 0.349 * r + 0.686 * g + 0.168 * b;
        const sb = 0.272 * r + 0.534 * g + 0.131 * b;
        return [
          lift(r * 0.35 + sr * 0.65, 16),
          lift(g * 0.35 + sg * 0.65, 16),
          lift(b * 0.35 + sb * 0.65, 26),
        ];
      },
    },
    {
      id: "cool",
      label: "청량 여름",
      fn(r, g, b) {
        const [sr, sg, sb] = saturate(r, g, b, 1.12);
        return [sr - 10 + 8, sg + 6 + 8, sb + 22 + 8];
      },
    },
    {
      id: "blossom",
      label: "벚꽃 엔딩",
      fn(r, g, b) {
        const [sr, sg, sb] = saturate(r, g, b, 0.92);
        return [lift(sr, 14) + 18, lift(sg, 14) - 2, lift(sb, 14) + 10];
      },
    },
    {
      id: "vivid",
      label: "K-비비드",
      fn(r, g, b) {
        const [sr, sg, sb] = saturate(r, g, b, 1.45);
        return [contrast(sr, 1.12), contrast(sg, 1.12), contrast(sb, 1.12)];
      },
    },
    {
      id: "soft",
      label: "몽글 파스텔",
      fn(r, g, b) {
        const [sr, sg, sb] = saturate(r, g, b, 0.8);
        return [lift(contrast(sr, 0.8), 30), lift(contrast(sg, 0.8), 30), lift(contrast(sb, 0.8), 34)];
      },
    },
    {
      id: "citypop",
      label: "시티팝 나이트",
      fn(r, g, b) {
        const [sr, sg, sb] = saturate(r, g, b, 1.2);
        return [contrast(sr, 1.08) + 12, contrast(sg, 1.08) - 12, contrast(sb, 1.08) + 26];
      },
    },
  ];

  const byId = (id) => PRESETS.find((p) => p.id === id) || PRESETS[0];

  /**
   * 원본 캔버스에 필터를 적용한 새 캔버스를 돌려줍니다.
   * @param {HTMLCanvasElement} source
   * @param {string} id 프리셋 id
   * @param {number} intensity 0~100 (원본과 섞는 비율)
   * @param {number} brightness -40~40
   */
  function apply(source, id, intensity = 100, brightness = 0) {
    const out = document.createElement("canvas");
    out.width = source.width;
    out.height = source.height;
    const ctx = out.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(source, 0, 0);

    const preset = byId(id);
    const k = Math.max(0, Math.min(1, intensity / 100));
    const bright = brightness * 1.6;
    if ((preset.id === "none" || k === 0) && bright === 0) return out;

    const img = ctx.getImageData(0, 0, out.width, out.height);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i];
      const g = d[i + 1];
      const b = d[i + 2];
      const f = preset.fn(r, g, b);
      d[i] = clamp(r + (f[0] - r) * k + bright);
      d[i + 1] = clamp(g + (f[1] - g) * k + bright);
      d[i + 2] = clamp(b + (f[2] - b) * k + bright);
    }
    ctx.putImageData(img, 0, 0);
    return out;
  }

  /** 사진이 없을 때 필터 미리보기에 쓰는 샘플 그림 (노을 진 한강 느낌) */
  function sampleCanvas(size = 120) {
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const ctx = c.getContext("2d");
    const sky = ctx.createLinearGradient(0, 0, 0, size);
    sky.addColorStop(0, "#7fb2ff");
    sky.addColorStop(0.55, "#ffc2a8");
    sky.addColorStop(1, "#ffe39a");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = "#fff4c2";
    ctx.beginPath();
    ctx.arc(size * 0.68, size * 0.48, size * 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#3f6fb0";
    ctx.fillRect(0, size * 0.66, size, size * 0.34);
    ctx.fillStyle = "#2a3b4f";
    for (let i = 0; i < 6; i++) {
      const w = size * (0.08 + (i % 3) * 0.03);
      const h = size * (0.16 + ((i * 7) % 5) * 0.04);
      ctx.fillRect(i * size * 0.17, size * 0.66 - h, w, h);
    }
    ctx.fillStyle = "#3aa36b";
    ctx.beginPath();
    ctx.ellipse(size * 0.18, size * 0.95, size * 0.4, size * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();
    return c;
  }

  /** 정사각형으로 잘라낸 소스에 각 필터를 입힌 썸네일 dataURL 목록 */
  function thumbnails(source, size = 96) {
    const square = document.createElement("canvas");
    square.width = square.height = size;
    const sctx = square.getContext("2d");
    const s = Math.min(source.width, source.height);
    sctx.drawImage(source, (source.width - s) / 2, (source.height - s) / 2, s, s, 0, 0, size, size);
    return PRESETS.map((p) => ({
      id: p.id,
      label: p.label,
      url: apply(square, p.id, 100, 0).toDataURL("image/jpeg", 0.85),
    }));
  }

  D.filters = { PRESETS, byId, apply, sampleCanvas, thumbnails };
})(window.Dakku);
