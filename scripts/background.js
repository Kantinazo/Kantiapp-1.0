'use strict';
// Fondo de la bienvenida: partículas y líneas blancas sobre negro, más un círculo central
// que recuerda al centro de una cancha. Se detiene al entrar a la aplicación.
(() => {
  const canvas = document.getElementById('bg');
  const ctx = canvas.getContext('2d');
  const LINK_DIST = 130;
  let w = 0, h = 0, particles = [], raf = 0, running = false, enabled = true;

  const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const inApp = () => document.body.classList.contains('in-app');

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = Math.max(24, Math.min(90, Math.round((w * h) / 18000)));
    particles = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.28,
      vy: (Math.random() - 0.5) * 0.28,
      r: Math.random() * 1.2 + 0.5
    }));
    if (!running && !inApp()) draw(0);
  }

  function draw(t) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);

    const cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.34;
    ctx.lineWidth = 1;
    ctx.strokeStyle = `rgba(255,255,255,${0.1 + 0.03 * Math.sin(t / 2600)})`;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.beginPath(); ctx.arc(cx, cy, R * 1.28, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, h); ctx.stroke();

    for (const p of particles) {
      if (running) {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = w; else if (p.x > w) p.x = 0;
        if (p.y < 0) p.y = h; else if (p.y > h) p.y = 0;
      }
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    }
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const d = Math.hypot(particles[i].x - particles[j].x, particles[i].y - particles[j].y);
        if (d < LINK_DIST) {
          ctx.strokeStyle = `rgba(255,255,255,${(1 - d / LINK_DIST) * 0.22})`;
          ctx.beginPath(); ctx.moveTo(particles[i].x, particles[i].y); ctx.lineTo(particles[j].x, particles[j].y); ctx.stroke();
        }
      }
    }
  }

  function loop(t) {
    if (!running) return;
    draw(t);
    raf = requestAnimationFrame(loop);
  }

  function start() {
    resize();
    if (!enabled || reducedMotion() || document.hidden) { running = false; draw(0); return; }
    if (running) return;
    running = true;
    raf = requestAnimationFrame(loop);
  }

  function stop() {
    running = false;
    cancelAnimationFrame(raf);
  }

  window.addEventListener('resize', () => { if (!inApp()) resize(); });
  document.addEventListener('visibilitychange', () => {
    if (inApp()) return;
    if (document.hidden) stop(); else start();
  });

  window.KantinazoBg = {
    start,
    stop,
    setEnabled(value) {
      enabled = Boolean(value);
      if (inApp()) return;
      if (enabled) start(); else { stop(); draw(0); }
    }
  };
})();
