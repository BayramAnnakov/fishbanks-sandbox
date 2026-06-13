// Drawing and canvas utilities for prediction gallery

export const CHART_PADDING = { top: 20, right: 20, bottom: 30, left: 45 };

export function setupCanvas(canvas) {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  return { ctx, w: rect.width, h: rect.height, dpr };
}

export function drawGrid(ctx, w, h, ex, padding = CHART_PADDING) {
  const p = padding;
  const cw = w - p.left - p.right;
  const ch = h - p.top - p.bottom;

  ctx.clearRect(0, 0, w, h);

  // Grid lines
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  const gx = ex.gridLines?.x || 10;
  const gy = ex.gridLines?.y || 5;

  for (let i = 0; i <= gx; i++) {
    const x = p.left + (i / gx) * cw;
    ctx.beginPath(); ctx.moveTo(x, p.top); ctx.lineTo(x, p.top + ch); ctx.stroke();
  }
  for (let i = 0; i <= gy; i++) {
    const y = p.top + (i / gy) * ch;
    ctx.beginPath(); ctx.moveTo(p.left, y); ctx.lineTo(p.left + cw, y); ctx.stroke();
  }

  // Axes
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(p.left, p.top);
  ctx.lineTo(p.left, p.top + ch);
  ctx.lineTo(p.left + cw, p.top + ch);
  ctx.stroke();

  // Labels
  ctx.fillStyle = '#64748B';
  ctx.font = '11px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(String(ex.xRange[0]), p.left, h - 6);
  ctx.fillText(String(ex.xRange[1]), w - p.right, h - 6);
  ctx.fillText(ex.xLabel || '', p.left + cw / 2, h - 6);

  ctx.textAlign = 'right';
  ctx.fillText(String(ex.yRange[1]), p.left - 6, p.top + 10);
  ctx.fillText(String(ex.yRange[0]), p.left - 6, p.top + ch + 4);

  return { cw, ch, p };
}

export function drawCurve(ctx, points, color, lineWidth, w, h, padding = CHART_PADDING) {
  if (!points || points.length < 2) return;
  const p = padding;
  const cw = w - p.left - p.right;
  const ch = h - p.top - p.bottom;

  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  points.forEach(([nx, ny], i) => {
    const x = p.left + nx * cw;
    const y = p.top + ch - ny * ch;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.stroke();
}

export function drawCurveWithGlow(ctx, points, color, lineWidth, w, h, padding = CHART_PADDING) {
  // Glow layer
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = lineWidth * 4;
  drawCurve(ctx, points, color, lineWidth * 0.6, w, h, padding);
  ctx.restore();
  // Main line
  drawCurve(ctx, points, color, lineWidth, w, h, padding);
}

export function drawCurveAnimated(ctx, points, color, lineWidth, w, h, duration, padding = CHART_PADDING) {
  return new Promise(resolve => {
    if (!points || points.length < 2) { resolve(); return; }
    const p = padding;
    const cw = w - p.left - p.right;
    const ch = h - p.top - p.bottom;
    const startTime = performance.now();

    function frame(now) {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const count = Math.max(2, Math.floor(progress * points.length));

      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = lineWidth * 3;
      ctx.beginPath();
      for (let i = 0; i < count; i++) {
        const [nx, ny] = points[i];
        const x = p.left + nx * cw;
        const y = p.top + ch - ny * ch;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();

      if (progress < 1) requestAnimationFrame(frame);
      else resolve();
    }
    requestAnimationFrame(frame);
  });
}

export function sampleCurve(points, count) {
  if (points.length <= count) return points;
  const sampled = [];
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    let j = 0;
    while (j < points.length - 1 && points[j + 1][0] < t) j++;
    if (j >= points.length - 1) {
      sampled.push([...points[points.length - 1]]);
    } else {
      const [x0, y0] = points[j];
      const [x1, y1] = points[j + 1];
      const frac = x1 === x0 ? 0 : (t - x0) / (x1 - x0);
      sampled.push([t, y0 + frac * (y1 - y0)]);
    }
  }
  return sampled;
}

// Color palette for 13+ distinguishable curves on dark background
export const CURVE_COLORS = [
  '#06B6D4', '#F97316', '#8B5CF6', '#10B981', '#F43F5E',
  '#FACC15', '#38BDF8', '#E879F9', '#FB923C', '#34D399',
  '#A78BFA', '#F472B6', '#2DD4BF', '#FDE047', '#C084FC',
  '#4ADE80', '#22D3EE', '#FB7185', '#818CF8', '#FBBF24',
];
