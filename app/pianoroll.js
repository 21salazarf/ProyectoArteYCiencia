/*
 * pianoroll.js
 * ------------
 * Dibuja el "tecladito": un teclado vertical a la izquierda y las notas en el
 * tiempo. Cada nota se pinta con el color medio de la fila de la foto que la
 * produjo. Mientras suena, las teclas activas se encienden.
 */
(function () {
  "use strict";

  const NEGRAS = new Set([1, 3, 6, 8, 10]);
  const TECLADO = 64; // ancho del teclado en px
  const FONDO = "#ECEDEA", CARRIL = "#E2E3DF", LINEA = "#C9CAC5", TINTA = "#1F2022", GRAFITO = "#4D4F53";

  function colorVisible(c, alfa) {
    // oscurece los colores muy claros para que se vean sobre el papel
    const lum = (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255;
    const k = lum > 0.62 ? ((lum - 0.62) / 0.38) * 0.55 : 0;
    const r = Math.round(c[0] + (31 - c[0]) * k), g = Math.round(c[1] + (32 - c[1]) * k), b = Math.round(c[2] + (34 - c[2]) * k);
    return `rgba(${r},${g},${b},${alfa})`;
  }

  class PianoRoll {
    constructor(canvas, alBuscar) {
      this.canvas = canvas;
      this.comp = null;
      this.pos = null;
      this.silenciadas = new Set();
      this.alBuscar = alBuscar;
      canvas.addEventListener("click", (e) => {
        if (!this.comp) return;
        const r = canvas.getBoundingClientRect();
        const x = e.clientX - r.left - TECLADO;
        if (x < 0) return;
        this.alBuscar(Math.max(0, (x / (r.width - TECLADO)) * this.comp.duracion));
      });
      new ResizeObserver(() => this.dibujar()).observe(canvas);
    }

    fijar(comp, silenciadas = new Set()) {
      this.comp = comp;
      this.silenciadas = silenciadas; // fotos silenciadas: sus notas se ven tenues y no encienden teclas
      const alturas = comp.notas.filter((n) => n.midi !== null && !n.adorno).map((n) => n.midi);
      let lo = alturas.length ? Math.floor(Math.min(...alturas)) - 2 : 48;
      let hi = alturas.length ? Math.ceil(Math.max(...alturas)) + 2 : 72;
      while (hi - lo < 24) { lo--; hi++; }
      this.lo = lo; this.hi = hi;
      this.dibujar();
    }

    posicion(seg) {
      this.pos = seg;
      this.dibujar();
    }

    dibujar() {
      const cv = this.canvas, dpr = window.devicePixelRatio || 1;
      const w = cv.clientWidth, h = cv.clientHeight;
      if (!w || !h) return;
      if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
        cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
      }
      const g = cv.getContext("2d");
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.fillStyle = FONDO; g.fillRect(0, 0, w, h);
      if (!this.comp) return;

      const { lo, hi, comp } = this;
      const filas = hi - lo + 1;
      const alto = h / filas;
      const ancho = w - TECLADO;
      const yDe = (m) => h - (m - lo + 1) * alto;
      const xDe = (t) => TECLADO + (t / comp.duracion) * ancho;
      const pos = this.pos;

      // Notas que suenan ahora mismo
      const activas = new Map();
      if (pos !== null) {
        for (const n of comp.notas) {
          if (n.midi !== null && !n.adorno && !this.silenciadas.has(n.voz) && pos >= n.t && pos < n.t + Math.max(n.dur, 0.08)) activas.set(Math.round(n.midi), n);
        }
      }

      // Carriles de fondo (más oscuros en las "teclas negras")
      for (let m = lo; m <= hi; m++) {
        g.fillStyle = NEGRAS.has(((m % 12) + 12) % 12) ? CARRIL : FONDO;
        g.fillRect(TECLADO, yDe(m), ancho, alto);
        if (m % 12 === 0) { g.fillStyle = LINEA; g.fillRect(TECLADO, yDe(m) + alto - 1, ancho, 1); }
      }
      // Rejilla de compases (cada 8 filas de la foto)
      g.fillStyle = LINEA;
      for (let i = 0; i <= 64; i += 8) g.fillRect(Math.round(xDe(i * comp.paso)), 0, 1, h);

      // Notas
      for (const n of comp.notas) {
        const x = xDe(n.t);
        if (n.midi === null || n.adorno) { // clics y destellos agudos: marcas arriba
          g.fillStyle = n.adorno ? GRAFITO : TINTA;
          g.fillRect(x, n.adorno ? 16 : 0, 1.5, Math.min(12, h * 0.04));
          continue;
        }
        const y = h - (n.midi - lo + 1) * alto; // altura exacta (los senos caen entre teclas)
        const wn = Math.max(2, (n.dur / comp.duracion) * ancho);
        const muda = this.silenciadas.has(n.voz);
        const encendida = !muda && pos !== null && pos >= n.t && pos < n.t + Math.max(n.dur, 0.08);
        g.fillStyle = colorVisible(n.color, muda ? 0.18 : encendida ? 1 : 0.88);
        g.fillRect(x, y + alto * 0.12, wn, Math.max(2, alto * 0.76));
        if (encendida) {
          g.strokeStyle = TINTA; g.lineWidth = 2;
          g.strokeRect(x, y + alto * 0.12, wn, Math.max(2, alto * 0.76));
        }
      }

      // Teclado
      for (let m = lo; m <= hi; m++) {
        const negra = NEGRAS.has(((m % 12) + 12) % 12);
        const n = activas.get(m);
        const y = yDe(m);
        g.fillStyle = n ? colorVisible(n.color, 1) : negra ? TINTA : "#FAFAF8";
        g.fillRect(0, y, negra ? TECLADO * 0.62 : TECLADO, alto - 0.5);
        if (n) { g.fillStyle = TINTA; g.fillRect(TECLADO - 5, y, 5, alto - 0.5); }
        if (m % 12 === 0 && alto > 7) {
          g.fillStyle = GRAFITO;
          g.font = `700 ${Math.min(11, alto)}px "Atkinson Hyperlegible Next", Verdana, sans-serif`;
          g.textBaseline = "middle";
          g.fillText(`Do${m / 12 - 1}`, TECLADO * 0.66, y + alto / 2);
        }
      }
      g.fillStyle = TINTA; g.fillRect(TECLADO - 2, 0, 2, h);

      // Cabezal de reproducción
      if (pos !== null) {
        const x = xDe(pos);
        g.fillStyle = TINTA; g.fillRect(x - 1, 0, 3, h);
      }
    }
  }

  window.PianoRoll = PianoRoll;
})();
