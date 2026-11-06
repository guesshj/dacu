/**
 * renderer.js
 * 다꾸 페이지(900×1200)를 캔버스에 그립니다.
 * 미리보기와 다운로드가 같은 함수를 쓰기 때문에 보이는 그대로 저장됩니다.
 */
window.Dakku = window.Dakku || {};

(function (D) {
  "use strict";

  const W = 900;
  const H = 1200;

  const FONT = {
    display: '"Black Han Sans", "Gowun Dodum", sans-serif',
    serif: '"Gowun Batang", serif',
    hand: '"Gaegu", "Gowun Dodum", cursive',
    ui: '"Gowun Dodum", "Apple SD Gothic Neo", sans-serif',
    emoji: '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif',
  };

  const C = {
    ink: "#1d1a17",
    soft: "#6d6359",
    faint: "#a99d8e",
    dahong: "#ef4b35",
    jjok: "#3d5bd9",
    songhwa: "#ffd84d",
    cheongrok: "#36b39a",
    bunhong: "#ffb3c7",
    bora: "#c7b8ff",
    paper: "#fffdf8",
  };

  const WEEK_KO = ["일", "월", "화", "수", "목", "금", "토"];
  const STATUS = { reading: "읽는 중", done: "완독", again: "다시 읽기", paused: "잠시 멈춤" };

  const { roundRect, starPath, drawTape } = D.stickers;

  /* ---------- 유틸 ---------- */
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  /** 한글은 어절 단위로, 너무 긴 어절은 글자 단위로 줄바꿈 */
  function wrap(ctx, text, maxW) {
    const lines = [];
    String(text)
      .split("\n")
      .forEach((para) => {
        if (!para.trim()) {
          lines.push("");
          return;
        }
        let line = "";
        para.split(" ").forEach((word) => {
          const next = line ? `${line} ${word}` : word;
          if (ctx.measureText(next).width <= maxW) {
            line = next;
            return;
          }
          if (line) lines.push(line);
          line = "";
          for (const ch of word) {
            if (ctx.measureText(line + ch).width > maxW && line) {
              lines.push(line);
              line = ch;
            } else {
              line += ch;
            }
          }
        });
        lines.push(line);
      });
    return lines;
  }

  /** 최대 줄 수를 넘으면 마지막 줄을 말줄임표로 */
  function fitLines(ctx, text, maxW, maxLines) {
    const lines = wrap(ctx, text, maxW);
    if (lines.length <= maxLines) return lines;
    const out = lines.slice(0, maxLines);
    let last = out[maxLines - 1];
    while (last && ctx.measureText(`${last}…`).width > maxW) last = last.slice(0, -1);
    out[maxLines - 1] = `${last}…`;
    return out;
  }

  /** 회전된 박스 안에서 (0,0)~(w,h) 좌표로 그리기 */
  function inBox(ctx, x, y, w, h, rot, fn) {
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);
    ctx.rotate(rot);
    ctx.translate(-w / 2, -h / 2);
    fn();
    ctx.restore();
  }

  /** 먹선 테두리 + 오프셋 그림자 카드 */
  function inkCard(ctx, w, h, fill, r = 16) {
    ctx.fillStyle = C.ink;
    roundRect(ctx, 6, 7, w, h, r);
    ctx.fill();
    ctx.fillStyle = fill;
    roundRect(ctx, 0, 0, w, h, r);
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = C.ink;
    ctx.stroke();
  }

  function tag(ctx, x, y, text, bg, fg = "#fff") {
    ctx.font = `700 17px ${FONT.ui}`;
    const w = ctx.measureText(text).width + 26;
    ctx.fillStyle = bg;
    roundRect(ctx, x, y, w, 32, 16);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = C.ink;
    ctx.stroke();
    ctx.fillStyle = fg;
    ctx.textBaseline = "middle";
    ctx.fillText(text, x + 13, y + 17);
    ctx.textBaseline = "alphabetic";
    return w;
  }

  function tape(ctx, cx, cy, w, h, rot, fill, pattern) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    drawTape(ctx, w, h, fill, pattern);
    ctx.restore();
  }

  function hanjiFibers(ctx, r, count, alpha) {
    ctx.save();
    ctx.lineCap = "round";
    for (let i = 0; i < count; i++) {
      const x = r() * W;
      const y = r() * H;
      const len = 10 + r() * 34;
      const a = r() * Math.PI;
      ctx.strokeStyle = `rgba(140,110,70,${alpha * (0.4 + r() * 0.6)})`;
      ctx.lineWidth = 0.6 + r() * 1.3;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(
        x + Math.cos(a) * len * 0.5 + (r() - 0.5) * 8,
        y + Math.sin(a) * len * 0.5 + (r() - 0.5) * 8,
        x + Math.cos(a) * len,
        y + Math.sin(a) * len
      );
      ctx.stroke();
    }
    ctx.restore();
  }

  /* ---------- 속지(배경) 테마 ---------- */
  const THEMES = {
    hanji: {
      label: "한지",
      draw(ctx, r) {
        ctx.fillStyle = "#f6eddd";
        ctx.fillRect(0, 0, W, H);
        hanjiFibers(ctx, r, 340, 0.16);
        const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.78);
        g.addColorStop(0, "rgba(0,0,0,0)");
        g.addColorStop(1, "rgba(150,110,60,.2)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
      },
    },
    jogakbo: {
      label: "조각보",
      draw(ctx, r) {
        ctx.fillStyle = "#f8f1e4";
        ctx.fillRect(0, 0, W, H);
        const colors = [C.bunhong, C.songhwa, C.jjok, C.cheongrok, C.dahong, C.bora, "#ffffff"];
        const rects = [];
        (function split(x, y, w, h, depth) {
          if (depth === 0 || w < 150 || h < 150) {
            rects.push([x, y, w, h]);
            return;
          }
          const cut = 0.3 + r() * 0.4;
          if (w > h) {
            split(x, y, w * cut, h, depth - 1);
            split(x + w * cut, y, w * (1 - cut), h, depth - 1);
          } else {
            split(x, y, w, h * cut, depth - 1);
            split(x, y + h * cut, w, h * (1 - cut), depth - 1);
          }
        })(0, 0, W, H, 5);
        rects.forEach(([x, y, w, h], i) => {
          ctx.globalAlpha = 0.26;
          ctx.fillStyle = colors[Math.floor(r() * colors.length + i) % colors.length];
          ctx.fillRect(x, y, w, h);
          ctx.globalAlpha = 1;
          ctx.strokeStyle = "rgba(255,255,255,.95)";
          ctx.lineWidth = 4;
          ctx.strokeRect(x, y, w, h);
          ctx.setLineDash([7, 6]);
          ctx.lineWidth = 1.6;
          ctx.strokeStyle = "rgba(120,95,60,.35)";
          ctx.strokeRect(x + 9, y + 9, w - 18, h - 18);
          ctx.setLineDash([]);
        });
        hanjiFibers(ctx, r, 160, 0.12);
      },
    },
    blossom: {
      label: "벚꽃",
      draw(ctx, r) {
        const g = ctx.createLinearGradient(0, 0, W * 0.3, H);
        g.addColorStop(0, "#ffe1ea");
        g.addColorStop(0.6, "#fff4ec");
        g.addColorStop(1, "#fff8e1");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
        for (let i = 0; i < 46; i++) {
          ctx.save();
          ctx.translate(r() * W, r() * H);
          ctx.rotate(r() * Math.PI * 2);
          const s = 0.6 + r() * 0.9;
          ctx.scale(s, s);
          ctx.fillStyle = `rgba(255,${150 + Math.floor(r() * 40)},${180 + Math.floor(r() * 30)},.55)`;
          ctx.beginPath();
          ctx.moveTo(0, -12);
          ctx.bezierCurveTo(10, -10, 10, 8, 0, 12);
          ctx.bezierCurveTo(-10, 8, -10, -10, 0, -12);
          ctx.fill();
          ctx.restore();
        }
      },
    },
    minihompy: {
      label: "미니홈피",
      draw(ctx) {
        ctx.fillStyle = "#eef3ff";
        ctx.fillRect(0, 0, W, H);
        ctx.strokeStyle = "rgba(61,91,217,.12)";
        ctx.lineWidth = 1;
        for (let x = 0; x <= W; x += 30) {
          ctx.beginPath();
          ctx.moveTo(x + 0.5, 0);
          ctx.lineTo(x + 0.5, H);
          ctx.stroke();
        }
        for (let y = 0; y <= H; y += 30) {
          ctx.beginPath();
          ctx.moveTo(0, y + 0.5);
          ctx.lineTo(W, y + 0.5);
          ctx.stroke();
        }
        ctx.setLineDash([10, 6]);
        ctx.strokeStyle = "rgba(61,91,217,.55)";
        ctx.lineWidth = 2.5;
        roundRect(ctx, 16, 16, W - 32, H - 32, 20);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = C.jjok;
        ctx.font = `700 15px ${FONT.ui}`;
        ctx.textAlign = "left";
        ctx.fillText("TODAY 1 | TOTAL 2026", 40, H - 30);
      },
    },
  };

  /* ---------- 머리말 ---------- */
  function drawHeader(ctx, key, entry) {
    const date = D.store.fromKey(key);
    const mmdd = `${D.store.pad(date.getMonth() + 1)}.${D.store.pad(date.getDate())}`;

    ctx.textAlign = "left";
    ctx.fillStyle = C.ink;
    ctx.font = `86px ${FONT.display}`;
    ctx.fillText(mmdd, 52, 148);
    const w = ctx.measureText(mmdd).width;

    ctx.font = `700 24px ${FONT.serif}`;
    ctx.fillText(`${WEEK_KO[date.getDay()]}요일`, 52 + w + 18, 112);
    ctx.font = `700 18px ${FONT.ui}`;
    ctx.fillStyle = C.dahong;
    ctx.fillText(`${date.getFullYear()}년의 기록`, 52 + w + 18, 142);

    // 기분 · 날씨 동그라미
    const badges = [
      { emoji: entry.diary.mood, label: "기분", color: C.bunhong },
      { emoji: entry.diary.weather, label: "날씨", color: "#bfe6ff" },
    ];
    badges.forEach((b, i) => {
      const cx = 742 + i * 84;
      const cy = 106;
      ctx.beginPath();
      ctx.arc(cx + 3, cy + 4, 34, 0, Math.PI * 2);
      ctx.fillStyle = C.ink;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, cy, 34, 0, Math.PI * 2);
      ctx.fillStyle = b.emoji ? b.color : "rgba(255,255,255,.7)";
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = C.ink;
      ctx.stroke();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      if (b.emoji) {
        ctx.font = `38px ${FONT.emoji}`;
        ctx.fillText(b.emoji, cx, cy + 3);
      } else {
        ctx.fillStyle = C.faint;
        ctx.font = `700 26px ${FONT.ui}`;
        ctx.fillText("?", cx, cy + 1);
      }
      ctx.fillStyle = C.soft;
      ctx.font = `700 15px ${FONT.ui}`;
      ctx.fillText(b.label, cx, cy + 54);
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
    });
  }

  function drawBanner(ctx, text) {
    const label = (text || "").trim();
    if (!label) return;
    ctx.font = `700 30px ${FONT.hand}`;
    const w = Math.max(200, ctx.measureText(label).width + 70);
    tape(ctx, 470, 34, w, 50, -0.035, "rgba(255,216,77,.9)", (c) => {
      c.strokeStyle = "rgba(255,255,255,.55)";
      c.lineWidth = 5;
      for (let x = -w; x < w; x += 18) {
        c.beginPath();
        c.moveTo(x, 30);
        c.lineTo(x + 30, -30);
        c.stroke();
      }
    });
    ctx.save();
    ctx.translate(470, 36);
    ctx.rotate(-0.035);
    ctx.fillStyle = C.ink;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, 0, 2);
    ctx.restore();
  }

  /* ---------- 사진 + 프레임 ---------- */
  function drawCover(ctx, src, x, y, w, h) {
    const sr = src.width / src.height;
    const dr = w / h;
    let sw = src.width;
    let sh = src.height;
    let sx = 0;
    let sy = 0;
    if (sr > dr) {
      sw = src.height * dr;
      sx = (src.width - sw) / 2;
    } else {
      sh = src.width / dr;
      sy = (src.height - sh) / 2;
    }
    ctx.drawImage(src, sx, sy, sw, sh, x, y, w, h);
  }

  function drawPhotoArea(ctx, photo, x, y, w, h, radius = 0) {
    ctx.save();
    if (radius) {
      roundRect(ctx, x, y, w, h, radius);
      ctx.clip();
    } else {
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      ctx.clip();
    }
    if (photo) {
      drawCover(ctx, photo, x, y, w, h);
    } else {
      ctx.fillStyle = "#ece3d3";
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = "rgba(160,140,110,.25)";
      ctx.lineWidth = 10;
      for (let i = -h; i < w; i += 28) {
        ctx.beginPath();
        ctx.moveTo(x + i, y + h);
        ctx.lineTo(x + i + h, y);
        ctx.stroke();
      }
      ctx.fillStyle = C.soft;
      ctx.textAlign = "center";
      ctx.font = `52px ${FONT.emoji}`;
      ctx.fillText("📷", x + w / 2, y + h / 2 - 6);
      ctx.font = `700 22px ${FONT.ui}`;
      ctx.fillText("오늘의 한 컷을 올려주세요", x + w / 2, y + h / 2 + 40);
      ctx.textAlign = "left";
    }
    ctx.restore();
  }

  const FRAMES = {
    polaroid: {
      label: "폴라로이드",
      draw(ctx, w, h, photo, caption, key) {
        ctx.save();
        ctx.shadowColor = "rgba(60,40,20,.28)";
        ctx.shadowBlur = 22;
        ctx.shadowOffsetY = 10;
        ctx.fillStyle = "#fffefb";
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
        ctx.strokeStyle = "rgba(0,0,0,.12)";
        ctx.lineWidth = 1;
        ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
        drawPhotoArea(ctx, photo, 24, 24, w - 48, h - 132);
        ctx.fillStyle = C.ink;
        ctx.textAlign = "center";
        ctx.font = `700 36px ${FONT.hand}`;
        ctx.fillText(caption || "", w / 2, h - 52);
        ctx.font = `15px ${FONT.ui}`;
        ctx.fillStyle = C.faint;
        ctx.textAlign = "right";
        ctx.fillText(key.slice(2).replace(/-/g, "."), w - 24, h - 18);
        ctx.textAlign = "left";
      },
    },
    photocard: {
      label: "포토카드",
      draw(ctx, w, h, photo, caption) {
        const holo = ctx.createLinearGradient(0, 0, w, h);
        holo.addColorStop(0, "#ffb3c7");
        holo.addColorStop(0.35, "#c7b8ff");
        holo.addColorStop(0.65, "#a8e6ff");
        holo.addColorStop(1, "#ffe9a6");
        ctx.fillStyle = C.ink;
        roundRect(ctx, 6, 8, w, h, 28);
        ctx.fill();
        ctx.fillStyle = holo;
        roundRect(ctx, 0, 0, w, h, 28);
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = C.ink;
        ctx.stroke();
        drawPhotoArea(ctx, photo, 14, 14, w - 28, h - 28, 20);
        // 반짝이 홀로그램 줄
        ctx.save();
        roundRect(ctx, 14, 14, w - 28, h - 28, 20);
        ctx.clip();
        const sheen = ctx.createLinearGradient(0, 0, w, h * 0.6);
        sheen.addColorStop(0.3, "rgba(255,255,255,0)");
        sheen.addColorStop(0.45, "rgba(255,255,255,.28)");
        sheen.addColorStop(0.6, "rgba(255,255,255,0)");
        ctx.fillStyle = sheen;
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
        ctx.fillStyle = "rgba(255,255,255,.9)";
        ctx.font = `700 15px ${FONT.ui}`;
        ctx.fillText("PHOTO CARD", 34, 46);
        if (caption) {
          ctx.font = `700 26px ${FONT.serif}`;
          const cw = ctx.measureText(caption).width + 40;
          ctx.fillStyle = "rgba(29,26,23,.72)";
          roundRect(ctx, (w - cw) / 2, h - 86, cw, 46, 23);
          ctx.fill();
          ctx.fillStyle = "#fff";
          ctx.textAlign = "center";
          ctx.fillText(caption, w / 2, h - 54);
          ctx.textAlign = "left";
        }
      },
    },
    film: {
      label: "필름",
      draw(ctx, w, h, photo, caption, key) {
        ctx.fillStyle = "#1b1916";
        roundRect(ctx, 0, 0, w, h, 8);
        ctx.fill();
        ctx.fillStyle = "#efe6d6";
        for (let y = 18; y < h - 20; y += 36) {
          roundRect(ctx, 11, y, 16, 22, 4);
          ctx.fill();
          roundRect(ctx, w - 27, y, 16, 22, 4);
          ctx.fill();
        }
        drawPhotoArea(ctx, photo, 42, 30, w - 84, h - 132);
        ctx.fillStyle = "#f3a64a";
        ctx.font = `700 22px ${FONT.ui}`;
        ctx.fillText(`▶ ${caption || "ROLL 01"}`, 46, h - 60);
        ctx.font = `16px ${FONT.ui}`;
        ctx.textAlign = "right";
        ctx.fillText(`'${key.slice(2).replace(/-/g, " ")}`, w - 46, h - 30);
        ctx.textAlign = "left";
      },
    },
    hanji: {
      label: "한지 액자",
      draw(ctx, w, h, photo, caption) {
        ctx.save();
        ctx.shadowColor = "rgba(60,40,20,.22)";
        ctx.shadowBlur = 18;
        ctx.shadowOffsetY = 8;
        ctx.fillStyle = "#efe2c9";
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
        // 한지 결
        const r = rng(91);
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, w, h);
        ctx.clip();
        for (let i = 0; i < 120; i++) {
          ctx.strokeStyle = `rgba(150,115,70,${0.08 + r() * 0.1})`;
          ctx.lineWidth = 0.8 + r();
          const x = r() * w;
          const y = r() * h;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + (r() - 0.5) * 40, y + (r() - 0.5) * 40);
          ctx.stroke();
        }
        ctx.restore();
        drawPhotoArea(ctx, photo, 32, 44, w - 64, h - 160);
        ctx.strokeStyle = C.dahong;
        ctx.lineWidth = 2;
        ctx.strokeRect(24, 36, w - 48, h - 144);
        // 매듭
        ctx.fillStyle = C.dahong;
        ctx.beginPath();
        ctx.arc(w / 2, 14, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = C.dahong;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(w / 2 - 4, 20);
        ctx.lineTo(w / 2 - 14, 40);
        ctx.moveTo(w / 2 + 4, 20);
        ctx.lineTo(w / 2 + 14, 40);
        ctx.stroke();
        // 문구
        ctx.fillStyle = C.ink;
        ctx.textAlign = "center";
        ctx.font = `700 30px ${FONT.serif}`;
        ctx.fillText(caption || "", w / 2 - 20, h - 52);
        ctx.textAlign = "left";
        // 낙관 도장
        ctx.save();
        ctx.translate(w - 64, h - 80);
        ctx.rotate(0.08);
        ctx.fillStyle = C.dahong;
        roundRect(ctx, -26, -26, 52, 52, 6);
        ctx.fill();
        ctx.strokeStyle = "#f6e9d4";
        ctx.lineWidth = 2;
        roundRect(ctx, -21, -21, 42, 42, 4);
        ctx.stroke();
        ctx.fillStyle = "#f6e9d4";
        ctx.font = `20px ${FONT.display}`;
        ctx.textAlign = "center";
        ctx.fillText("다", 0, -2);
        ctx.fillText("꾸", 0, 18);
        ctx.restore();
      },
    },
  };

  function drawPhotoBlock(ctx, key, entry, assets) {
    const frame = FRAMES[entry.photo.frame] || FRAMES.polaroid;
    inBox(ctx, 48, 196, 476, 548, -0.028, () => {
      frame.draw(ctx, 476, 548, assets.processed, entry.photo.caption.trim(), key);
    });
    // 사진 위 마스킹테이프
    tape(ctx, 140, 196, 130, 36, -0.5, "rgba(199,184,255,.85)");
  }

  /* ---------- 독서 카드 ---------- */
  function drawBook(ctx, book) {
    const x = 562;
    const y = 200;
    const w = 290;
    const h = 300;
    inBox(ctx, x, y, w, h, 0.018, () => {
      inkCard(ctx, w, h, C.paper);
      tag(ctx, 18, 18, "📚 오늘의 독서", C.jjok);
      ctx.textAlign = "left";

      if (!book.title.trim()) {
        ctx.fillStyle = C.faint;
        ctx.font = `700 21px ${FONT.ui}`;
        ctx.textAlign = "center";
        ctx.fillText("오늘 펼친 책을", w / 2, 150);
        ctx.fillText("적어보세요", w / 2, 180);
        ctx.textAlign = "left";
        return;
      }

      ctx.fillStyle = C.ink;
      ctx.font = `700 26px ${FONT.serif}`;
      const titleLines = fitLines(ctx, book.title, w - 40, 2);
      titleLines.forEach((l, i) => ctx.fillText(l, 20, 86 + i * 32));
      let cy = 86 + titleLines.length * 32 - 6;

      if (book.author.trim()) {
        ctx.font = `17px ${FONT.ui}`;
        ctx.fillStyle = C.soft;
        ctx.fillText(fitLines(ctx, book.author, w - 40, 1)[0], 20, cy + 6);
        cy += 26;
      }

      // 별점
      for (let i = 0; i < 5; i++) {
        starPath(ctx, 32 + i * 26, cy + 10, 11, 5);
        ctx.fillStyle = i < book.rating ? C.songhwa : "#e7ddcd";
        ctx.fill();
        ctx.lineWidth = 1.6;
        ctx.strokeStyle = C.ink;
        ctx.stroke();
      }
      const pages = Number(book.pages) > 0 ? ` ${Number(book.pages)}쪽` : "";
      ctx.font = `700 16px ${FONT.ui}`;
      ctx.fillStyle = book.status === "done" ? C.dahong : C.cheongrok;
      ctx.fillText(`${STATUS[book.status] || ""}${pages}`, 168, cy + 16);
      cy += 40;

      if (book.quote.trim()) {
        ctx.fillStyle = "#f3ecdf";
        roundRect(ctx, 14, cy, w - 28, h - cy - 14, 10);
        ctx.fill();
        ctx.fillStyle = C.ink;
        ctx.font = `700 21px ${FONT.hand}`;
        const max = Math.max(1, Math.floor((h - cy - 22) / 25));
        fitLines(ctx, `“${book.quote.trim()}”`, w - 52, max).forEach((l, i) => {
          ctx.fillText(l, 26, cy + 28 + i * 25);
        });
      }
    });
  }

  /* ---------- 운동 카드 ---------- */
  const WORKOUT_ICON = {
    걷기: "🚶",
    러닝: "🏃",
    요가: "🧘",
    필라테스: "🤸",
    헬스: "🏋️",
    자전거: "🚴",
    수영: "🏊",
    홈트: "💦",
    등산: "⛰️",
    클라이밍: "🧗",
    기타: "✨",
  };

  function drawWorkout(ctx, workout) {
    const x = 562;
    const y = 526;
    const w = 290;
    const h = 214;
    inBox(ctx, x, y, w, h, -0.016, () => {
      inkCard(ctx, w, h, "#f2fbf7");
      tag(ctx, 18, 18, "💪 오운완", C.cheongrok);
      const items = workout.items;
      const total = items.reduce((sum, it) => sum + (Number(it.min) || 0), 0);
      const steps = Number(workout.steps) || 0;

      if (!items.length && !steps) {
        ctx.fillStyle = C.faint;
        ctx.font = `700 21px ${FONT.ui}`;
        ctx.textAlign = "center";
        ctx.fillText("오늘은 쉬어가는 날 🌿", w / 2, 128);
        ctx.textAlign = "left";
        return;
      }

      ctx.fillStyle = C.ink;
      ctx.font = `50px ${FONT.display}`;
      ctx.fillText(String(total), 20, 104);
      const tw = ctx.measureText(String(total)).width;
      ctx.font = `700 22px ${FONT.serif}`;
      ctx.fillText("분", 26 + tw, 102);

      if (steps) {
        ctx.font = `700 17px ${FONT.ui}`;
        ctx.textAlign = "right";
        ctx.fillStyle = C.cheongrok;
        ctx.fillText(`👣 ${steps.toLocaleString("ko-KR")}보`, w - 18, 100);
        ctx.textAlign = "left";
      }

      ctx.font = `17px ${FONT.ui}`;
      const shown = items.slice(0, 3);
      shown.forEach((it, i) => {
        const ly = 138 + i * 25;
        ctx.fillStyle = C.ink;
        ctx.fillText(`${WORKOUT_ICON[it.type] || "✨"} ${it.type} ${it.min}분`, 20, ly);
        ctx.fillStyle = C.soft;
        ctx.textAlign = "right";
        ctx.fillText(it.level, w - 18, ly);
        ctx.textAlign = "left";
      });
      if (items.length > 3) {
        ctx.fillStyle = C.soft;
        ctx.fillText(`외 ${items.length - 3}개`, 20, 138 + 3 * 25);
      }
    });
  }

  /* ---------- 일기 카드 ---------- */
  function drawDiary(ctx, diary) {
    const x = 48;
    const y = 782;
    const w = 804;
    const h = 370;
    inBox(ctx, x, y, w, h, 0.006, () => {
      inkCard(ctx, w, h, "#fffef9", 10);
      // 줄 노트
      const LINE = 38;
      const firstRule = 108;
      ctx.strokeStyle = "rgba(61,91,217,.17)";
      ctx.lineWidth = 1.5;
      for (let ly = firstRule; ly < h - 12; ly += LINE) {
        ctx.beginPath();
        ctx.moveTo(14, ly);
        ctx.lineTo(w - 14, ly);
        ctx.stroke();
      }
      ctx.strokeStyle = "rgba(239,75,53,.45)";
      ctx.beginPath();
      ctx.moveTo(66, 12);
      ctx.lineTo(66, h - 12);
      ctx.stroke();

      tag(ctx, 84, 22, "✏️ 오늘의 일기", C.dahong);

      const title = diary.title.trim();
      const text = diary.text.trim();
      ctx.textAlign = "left";
      if (!title && !text) {
        ctx.fillStyle = C.faint;
        ctx.font = `700 30px ${FONT.hand}`;
        ctx.fillText("오늘 하루는 어땠나요?", 84, firstRule + LINE - 10);
        return;
      }

      ctx.fillStyle = C.ink;
      if (title) {
        ctx.font = `700 28px ${FONT.serif}`;
        const tagW = ctx.measureText(title).width;
        ctx.fillText(fitLines(ctx, title, w - 330, 1)[0], 270, 48);
        if (tagW) {
          ctx.fillStyle = "rgba(255,216,77,.55)";
          ctx.fillRect(268, 52, Math.min(tagW, w - 330) + 4, 8);
        }
      }

      ctx.fillStyle = C.ink;
      ctx.font = `28px ${FONT.hand}`;
      const maxLines = Math.floor((h - firstRule - 6) / LINE) + 1;
      fitLines(ctx, text, w - 84 - 30, maxLines).forEach((l, i) => {
        ctx.fillText(l, 84, firstRule - 7 + i * LINE);
      });
    });
    tape(ctx, x + w - 40, y + 4, 120, 34, 0.55, "rgba(255,179,199,.85)");
  }

  function drawFooter(ctx, key) {
    ctx.fillStyle = "rgba(29,26,23,.45)";
    ctx.font = `14px ${FONT.ui}`;
    ctx.textAlign = "right";
    ctx.fillText(`나의 디지털 다꾸 ${key}`, W - 40, H - 22);
    ctx.textAlign = "left";
  }

  /**
   * 페이지 전체 그리기
   * @param {CanvasRenderingContext2D} ctx
   * @param {string} key YYYY-MM-DD
   * @param {object} entry 하루치 기록
   * @param {{processed: HTMLCanvasElement|null}} assets 필터 적용된 사진
   * @param {{scale?: number, selectedId?: string|null}} opts
   */
  function render(ctx, key, entry, assets, opts = {}) {
    const scale = opts.scale || 1;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";

    const seed = hash(key);
    (THEMES[entry.deco.theme] || THEMES.hanji).draw(ctx, rng(seed));
    drawHeader(ctx, key, entry);
    drawPhotoBlock(ctx, key, entry, assets);
    drawBook(ctx, entry.book);
    drawWorkout(ctx, entry.workout);
    drawDiary(ctx, entry.diary);
    drawBanner(ctx, entry.deco.banner);
    drawFooter(ctx, key);

    entry.deco.stickers.forEach((s) => D.stickers.draw(ctx, s));
    if (opts.selectedId) {
      const s = entry.deco.stickers.find((st) => st.id === opts.selectedId);
      if (s) D.stickers.drawSelection(ctx, s);
    }
  }

  D.renderer = {
    W,
    H,
    FONT,
    THEMES,
    FRAMES,
    WORKOUT_ICON,
    render,
  };
})(window.Dakku);
