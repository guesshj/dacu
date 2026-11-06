/**
 * stickers.js
 * 스티커 카탈로그, 캔버스 그리기, 선택/충돌 판정을 담당합니다.
 * 스티커 하나의 모양:
 *   { id, kind: "emoji" | "text" | "shape", value, color?, x, y, scale, rot }
 *   x, y 는 페이지(900×1200) 기준 중심 좌표, rot 은 라디안입니다.
 */
window.Dakku = window.Dakku || {};

(function (D) {
  "use strict";

  const INK = "#1d1a17";
  const EMOJI_FONT = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
  const HAND_FONT = '"Gaegu", "Gowun Dodum", sans-serif';

  /* ---------- 카탈로그 ---------- */
  const EMOJI = [
    "💖",
    "✨",
    "🌸",
    "🍀",
    "⭐",
    "🐯",
    "🎀",
    "🍡",
    "🍓",
    "☕",
    "📚",
    "🏃",
    "💪",
    "🌙",
    "🔥",
    "🎧",
    "📸",
    "🫶",
    "🌈",
    "🍰",
    "🐰",
    "🧸",
    "💌",
    "🌷",
  ];

  const TEXTS = [
    { value: "갓생", color: "#ef4b35" },
    { value: "오운완", color: "#36b39a" },
    { value: "완독!", color: "#3d5bd9" },
    { value: "럭키비키", color: "#ffb3c7" },
    { value: "오늘도 해냄", color: "#ffd84d" },
    { value: "행복 저장", color: "#c7b8ff" },
    { value: "기록 중", color: "#fffdf8" },
    { value: "최고의 하루", color: "#ef4b35" },
    { value: "Seoul 2026", color: "#1d1a17" },
    { value: "수고했어", color: "#36b39a" },
  ];

  const SHAPES = [
    { value: "bokjumeoni", label: "복주머니", w: 104, h: 120 },
    { value: "dancheong", label: "단청 꽃", w: 112, h: 112 },
    { value: "mugunghwa", label: "꽃", w: 112, h: 112 },
    { value: "cloud", label: "구름", w: 140, h: 84 },
    { value: "heart", label: "하트", w: 104, h: 96 },
    { value: "star", label: "별", w: 108, h: 104 },
    { value: "sparkle", label: "반짝", w: 96, h: 96 },
    { value: "tape-dot", label: "땡땡이 테이프", w: 210, h: 48 },
    { value: "tape-stripe", label: "줄무늬 테이프", w: 210, h: 48 },
    { value: "tape-jogakbo", label: "조각보 테이프", w: 210, h: 48 },
  ];

  const CUSTOM_COLORS = [
    "#ffd84d",
    "#ffb3c7",
    "#c7b8ff",
    "#36b39a",
    "#3d5bd9",
    "#ef4b35",
    "#fffdf8",
    "#1d1a17",
  ];

  /* ---------- 유틸 ---------- */
  function isDark(hex) {
    const h = hex.replace("#", "");
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return 0.299 * r + 0.587 * g + 0.114 * b < 150;
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function starPath(ctx, cx, cy, outer, inner, points = 5) {
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 === 0 ? outer : inner;
      const a = (Math.PI / points) * i - Math.PI / 2;
      ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    ctx.closePath();
  }

  function inkStyle(ctx, width = 3) {
    ctx.lineWidth = width;
    ctx.strokeStyle = INK;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
  }

  /* ---------- 크기 계산 (회전·확대 전) ---------- */
  function box(ctx, s) {
    if (s.kind === "emoji") return { w: 96, h: 96 };
    if (s.kind === "text") {
      ctx.save();
      ctx.font = `700 34px ${HAND_FONT}`;
      const w = ctx.measureText(s.value).width + 44;
      ctx.restore();
      return { w, h: 60 };
    }
    const shape = SHAPES.find((x) => x.value === s.value);
    return shape ? { w: shape.w, h: shape.h } : { w: 100, h: 100 };
  }

  /* ---------- 모양 스티커 그리기 (중심 0,0 기준) ---------- */
  const SHAPE_DRAW = {
    bokjumeoni(ctx) {
      inkStyle(ctx);
      // 몸통
      ctx.beginPath();
      ctx.moveTo(-18, -22);
      ctx.bezierCurveTo(-56, -8, -54, 56, 0, 58);
      ctx.bezierCurveTo(54, 56, 56, -8, 18, -22);
      ctx.closePath();
      ctx.fillStyle = "#ef4b35";
      ctx.fill();
      ctx.stroke();
      // 주름
      ctx.beginPath();
      ctx.moveTo(-18, -22);
      ctx.lineTo(-32, -52);
      ctx.lineTo(-13, -42);
      ctx.lineTo(0, -58);
      ctx.lineTo(13, -42);
      ctx.lineTo(32, -52);
      ctx.lineTo(18, -22);
      ctx.closePath();
      ctx.fillStyle = "#ffb3c7";
      ctx.fill();
      ctx.stroke();
      // 끈
      roundRect(ctx, -24, -28, 48, 11, 5);
      ctx.fillStyle = "#ffd84d";
      ctx.fill();
      ctx.stroke();
      // 가운데 '복'
      ctx.beginPath();
      ctx.arc(0, 20, 18, 0, Math.PI * 2);
      ctx.fillStyle = "#ffd84d";
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#ef4b35";
      ctx.font = '700 20px "Gowun Batang", serif';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("복", 0, 21);
    },

    dancheong(ctx) {
      inkStyle(ctx, 2.5);
      for (let i = 0; i < 8; i++) {
        ctx.save();
        ctx.rotate((Math.PI / 4) * i);
        ctx.beginPath();
        ctx.ellipse(0, -34, 14, 22, 0, 0, Math.PI * 2);
        ctx.fillStyle = i % 2 ? "#36b39a" : "#ef4b35";
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
      ctx.beginPath();
      ctx.arc(0, 0, 26, 0, Math.PI * 2);
      ctx.fillStyle = "#3d5bd9";
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, 16, 0, Math.PI * 2);
      ctx.fillStyle = "#ffd84d";
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, 6, 0, Math.PI * 2);
      ctx.fillStyle = "#ef4b35";
      ctx.fill();
    },

    mugunghwa(ctx) {
      inkStyle(ctx, 2.5);
      for (let i = 0; i < 5; i++) {
        ctx.save();
        ctx.rotate(((Math.PI * 2) / 5) * i);
        ctx.beginPath();
        ctx.ellipse(0, -28, 22, 28, 0, 0, Math.PI * 2);
        ctx.fillStyle = "#ffb3c7";
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
      ctx.beginPath();
      ctx.arc(0, 0, 15, 0, Math.PI * 2);
      ctx.fillStyle = "#ef4b35";
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = "#ef4b35";
      ctx.lineWidth = 2;
      for (let i = 0; i < 5; i++) {
        const a = ((Math.PI * 2) / 5) * i - Math.PI / 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 15, Math.sin(a) * 15);
        ctx.lineTo(Math.cos(a) * 30, Math.sin(a) * 30);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fillStyle = "#ffd84d";
      ctx.fill();
    },

    cloud(ctx) {
      const puffs = [
        [-36, 8, 26],
        [-6, -10, 32],
        [30, 4, 28],
        [56, 18, 16],
      ];
      ctx.fillStyle = INK;
      puffs.forEach(([x, y, r]) => {
        ctx.beginPath();
        ctx.arc(x, y, r + 3, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.fillRect(-62, 14, 124, 23);
      ctx.fillStyle = "#fffdf8";
      puffs.forEach(([x, y, r]) => {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.fillRect(-59, 14, 118, 20);
      // 구름 문양 소용돌이
      ctx.strokeStyle = "#3d5bd9";
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      [
        [-6, -6],
        [30, 8],
      ].forEach(([x, y]) => {
        ctx.beginPath();
        for (let t = 0; t < Math.PI * 3.2; t += 0.15) {
          const r = 2 + t * 2.2;
          ctx.lineTo(x + Math.cos(t) * r, y + Math.sin(t) * r);
        }
        ctx.stroke();
      });
    },

    heart(ctx) {
      inkStyle(ctx);
      ctx.beginPath();
      ctx.moveTo(0, 40);
      ctx.bezierCurveTo(-64, -2, -38, -54, 0, -22);
      ctx.bezierCurveTo(38, -54, 64, -2, 0, 40);
      ctx.closePath();
      ctx.fillStyle = "#ffb3c7";
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(-20, -14, 7, 11, -0.6, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,.85)";
      ctx.fill();
    },

    star(ctx) {
      inkStyle(ctx);
      starPath(ctx, 0, 4, 52, 23);
      ctx.fillStyle = "#ffd84d";
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.arc(-9, 2, 3.5, 0, Math.PI * 2);
      ctx.arc(9, 2, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.lineWidth = 2.5;
      ctx.arc(0, 8, 7, 0.2, Math.PI - 0.2);
      ctx.stroke();
    },

    sparkle(ctx) {
      inkStyle(ctx);
      ctx.beginPath();
      ctx.moveTo(0, -46);
      ctx.quadraticCurveTo(6, -6, 46, 0);
      ctx.quadraticCurveTo(6, 6, 0, 46);
      ctx.quadraticCurveTo(-6, 6, -46, 0);
      ctx.quadraticCurveTo(-6, -6, 0, -46);
      ctx.closePath();
      ctx.fillStyle = "#c7b8ff";
      ctx.fill();
      ctx.stroke();
    },

    "tape-dot"(ctx) {
      drawTape(ctx, 210, 48, "rgba(255,179,199,.88)", (c) => {
        c.fillStyle = "rgba(255,255,255,.9)";
        for (let x = -100; x < 110; x += 20) {
          for (let y = -20; y < 30; y += 20) {
            c.beginPath();
            c.arc(x + (y % 40 === 0 ? 0 : 10), y, 4, 0, Math.PI * 2);
            c.fill();
          }
        }
      });
    },

    "tape-stripe"(ctx) {
      drawTape(ctx, 210, 48, "rgba(61,91,217,.82)", (c) => {
        c.strokeStyle = "rgba(255,255,255,.75)";
        c.lineWidth = 7;
        for (let x = -160; x < 160; x += 22) {
          c.beginPath();
          c.moveTo(x, 30);
          c.lineTo(x + 50, -30);
          c.stroke();
        }
      });
    },

    "tape-jogakbo"(ctx) {
      drawTape(ctx, 210, 48, "rgba(255,253,248,.9)", (c) => {
        const colors = ["#ffd84d", "#ffb3c7", "#36b39a", "#c7b8ff", "#ef4b35"];
        let x = -105;
        let i = 0;
        while (x < 105) {
          const w = 26 + ((i * 13) % 22);
          c.fillStyle = colors[i % colors.length];
          c.globalAlpha = 0.85;
          c.fillRect(x, -24, w, 48);
          c.globalAlpha = 1;
          c.strokeStyle = "rgba(255,255,255,.95)";
          c.setLineDash([4, 4]);
          c.lineWidth = 1.5;
          c.beginPath();
          c.moveTo(x, -24);
          c.lineTo(x, 24);
          c.stroke();
          c.setLineDash([]);
          x += w;
          i++;
        }
      });
    },
  };

  /** 마스킹테이프 공통: 지그재그 끝단 + 무늬 */
  function drawTape(ctx, w, h, fill, pattern) {
    const x0 = -w / 2;
    const x1 = w / 2;
    const y0 = -h / 2;
    const y1 = h / 2;
    const teeth = 6;
    const th = h / teeth;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y0);
    for (let i = 1; i <= teeth; i++) ctx.lineTo(x1 - (i % 2 ? 6 : 0), y0 + th * i);
    ctx.lineTo(x0, y1);
    for (let i = 1; i <= teeth; i++) ctx.lineTo(x0 + (i % 2 ? 6 : 0), y1 - th * i);
    ctx.closePath();
    ctx.save();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.clip();
    if (pattern) pattern(ctx);
    ctx.restore();
  }

  /* ---------- 스티커 그리기 ---------- */
  function draw(ctx, s) {
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.rot || 0);
    ctx.scale(s.scale || 1, s.scale || 1);

    if (s.kind === "emoji") {
      ctx.font = `78px ${EMOJI_FONT}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(s.value, 0, 6);
    } else if (s.kind === "text") {
      const b = box(ctx, s);
      const bg = s.color || "#ffd84d";
      ctx.fillStyle = INK;
      roundRect(ctx, -b.w / 2 + 4, -b.h / 2 + 5, b.w, b.h, b.h / 2);
      ctx.fill();
      ctx.fillStyle = bg;
      roundRect(ctx, -b.w / 2, -b.h / 2, b.w, b.h, b.h / 2);
      ctx.fill();
      inkStyle(ctx, 3);
      ctx.stroke();
      ctx.fillStyle = isDark(bg) ? "#fffdf8" : INK;
      ctx.font = `700 34px ${HAND_FONT}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(s.value, 0, 3);
    } else if (SHAPE_DRAW[s.value]) {
      SHAPE_DRAW[s.value](ctx);
    }
    ctx.restore();
  }

  /* ---------- 선택 표시 & 충돌 판정 ---------- */
  const PAD = 10;

  function halfSize(ctx, s) {
    const b = box(ctx, s);
    return { hw: (b.w * s.scale) / 2 + PAD, hh: (b.h * s.scale) / 2 + PAD };
  }

  function handlePos(ctx, s) {
    const { hw, hh } = halfSize(ctx, s);
    const c = Math.cos(s.rot);
    const n = Math.sin(s.rot);
    return { x: s.x + hw * c - hh * n, y: s.y + hw * n + hh * c };
  }

  function drawSelection(ctx, s) {
    const { hw, hh } = halfSize(ctx, s);
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.rot);
    ctx.setLineDash([9, 7]);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = "#3d5bd9";
    ctx.strokeRect(-hw, -hh, hw * 2, hh * 2);
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(hw, hh, 16, 0, Math.PI * 2);
    ctx.fillStyle = "#3d5bd9";
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#fff";
    ctx.stroke();
    // 손잡이 안 화살표
    ctx.beginPath();
    ctx.moveTo(hw - 6, hh - 6);
    ctx.lineTo(hw + 6, hh + 6);
    ctx.moveTo(hw + 6, hh - 1);
    ctx.lineTo(hw + 6, hh + 6);
    ctx.lineTo(hw - 1, hh + 6);
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();
  }

  function hit(ctx, s, px, py) {
    const b = box(ctx, s);
    const dx = px - s.x;
    const dy = py - s.y;
    const c = Math.cos(-s.rot);
    const n = Math.sin(-s.rot);
    const lx = (dx * c - dy * n) / s.scale;
    const ly = (dx * n + dy * c) / s.scale;
    return Math.abs(lx) <= b.w / 2 + 6 && Math.abs(ly) <= b.h / 2 + 6;
  }

  function hitHandle(ctx, s, px, py) {
    const h = handlePos(ctx, s);
    return Math.hypot(px - h.x, py - h.y) <= 26;
  }

  /** 스티커 고르기 칸에 보여줄 미리보기 이미지 */
  function preview(s, size = 112) {
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const ctx = c.getContext("2d");
    const b = box(ctx, s);
    const scale = Math.min((size - 12) / b.w, (size - 12) / b.h, 1);
    draw(ctx, Object.assign({}, s, { x: size / 2, y: size / 2, scale, rot: 0 }));
    return c.toDataURL("image/png");
  }

  D.stickers = {
    EMOJI,
    TEXTS,
    SHAPES,
    CUSTOM_COLORS,
    box,
    draw,
    drawSelection,
    hit,
    hitHandle,
    preview,
    roundRect,
    starPath,
    drawTape,
  };
})(window.Dakku);
