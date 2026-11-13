/*
 * analisis.js
 * -----------
 * Lee el color de la foto: rotación de matiz (para el slider), conversión a
 * HSV/croma y las medidas que luego usa la composición.
 *
 * Medidas globales:
 *   - colorido: métrica de Hasler y Süsstrunk (2003), "Measuring colourfulness
 *     in natural images". 0 = blanco y negro, ~110 = extremadamente colorida.
 *   - matiz dominante: media circular del matiz, ponderada por el croma
 *     (los grises no "votan").
 *   - temperatura: qué tan cerca está el matiz dominante del naranja (cálido)
 *     o del azul celeste (frío).
 */
(function () {
  "use strict";

  const GRILLA = 64; // la foto se reduce a 64 × 64 para analizarla

  // --- Conversión de color -------------------------------------------------

  function rgbAHsv(r, g, b) {
    const max = Math.max(r, g, b), min = Math.min(r, g, b), c = max - min;
    let h = 0;
    if (c > 0) {
      if (max === r) h = ((g - b) / c) % 6;
      else if (max === g) h = (b - r) / c + 2;
      else h = (r - g) / c + 4;
      h *= 60;
      if (h < 0) h += 360;
    }
    return [h, max === 0 ? 0 : c / max, max];
  }

  function hsvARgb(h, s, v) {
    const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
    let r = 0, g = 0, b = 0;
    if (h < 60) { r = c; g = x; }
    else if (h < 120) { r = x; g = c; }
    else if (h < 180) { g = c; b = x; }
    else if (h < 240) { g = x; b = c; }
    else if (h < 300) { r = x; b = c; }
    else { r = c; b = x; }
    return [r + m, g + m, b + m];
  }

  /**
   * Rota el matiz de cada píxel `grados` en el círculo HSV, sin tocar
   * saturación ni brillo. Es exactamente lo que mueve el slider: lo que se ve
   * y lo que se analiza son la misma imagen.
   */
  function rotarMatiz(origen, destino, grados) {
    const a = origen.data, d = destino.data;
    if (!grados) { d.set(a); return destino; }
    for (let i = 0; i < a.length; i += 4) {
      const r = a[i] / 255, g = a[i + 1] / 255, b = a[i + 2] / 255;
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      if (max - min < 1e-3) { // gris: no tiene matiz que rotar
        d[i] = a[i]; d[i + 1] = a[i + 1]; d[i + 2] = a[i + 2]; d[i + 3] = a[i + 3];
        continue;
      }
      const hsv = rgbAHsv(r, g, b);
      let h = (hsv[0] + grados) % 360;
      if (h < 0) h += 360;
      const rgb = hsvARgb(h, hsv[1], hsv[2]);
      d[i] = rgb[0] * 255; d[i + 1] = rgb[1] * 255; d[i + 2] = rgb[2] * 255; d[i + 3] = a[i + 3];
    }
    return destino;
  }

  // --- Medidas -------------------------------------------------------------

  function mediaCircular(sx, sy) {
    let h = (Math.atan2(sy, sx) * 180) / Math.PI;
    return h < 0 ? h + 360 : h;
  }

  /**
   * Analiza una ImageData de GRILLA × GRILLA píxeles.
   * Devuelve medidas por fila (cada fila será un paso de tiempo) y globales.
   */
  function analizar(imagen) {
    const { data, width: an, height: al } = imagen;
    const filas = [];
    let gx = 0, gy = 0, gCroma = 0;
    let sumRg = 0, sumYb = 0, sumRg2 = 0, sumYb2 = 0, n = 0;

    for (let y = 0; y < al; y++) {
      let sL = 0, sL2 = 0, sC = 0, sC2 = 0, hx = 0, hy = 0, sR = 0, sG = 0, sB = 0;
      let cR = 0, cG = 0, cB = 0, cL = 0; // promedios ponderados por croma (la parte con color)
      for (let x = 0; x < an; x++) {
        const i = (y * an + x) * 4;
        const R = data[i], G = data[i + 1], B = data[i + 2];
        const r = R / 255, g = G / 255, b = B / 255;
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        const max = Math.max(r, g, b), croma = max - Math.min(r, g, b);
        const h = rgbAHsv(r, g, b)[0];
        const rad = (h * Math.PI) / 180;

        sL += lum; sL2 += lum * lum; sC += croma; sC2 += croma * croma;
        cR += croma * R; cG += croma * G; cB += croma * B; cL += croma * lum;
        hx += croma * Math.cos(rad); hy += croma * Math.sin(rad);
        sR += R; sG += G; sB += B;

        // Hasler & Süsstrunk: oponentes rojo-verde y amarillo-azul
        const rg = R - G, yb = 0.5 * (R + G) - B;
        sumRg += rg; sumYb += yb; sumRg2 += rg * rg; sumYb2 += yb * yb; n++;
      }
      const media = sL / an;
      const matizFila = mediaCircular(hx, hy);
      // intensidad: qué tan saturada es la parte coloreada de la fila, sin
      // importar cuánto fondo blanco o gris tenga alrededor
      const intensidad = sC > 0 ? sC2 / sC : 0;
      const conColor = intensidad > 0.1;
      filas.push({
        luz: media,                                       // 0..1 brillo medio
        luzColor: conColor ? cL / sC : media,             // brillo de la parte con color
        contraste: Math.sqrt(Math.max(0, sL2 / an - media * media)), // desviación
        croma: sC / an,                                   // 0..1 cuánto color hay (área)
        intensidad,                                       // 0..1 qué tan vivo es ese color
        matiz: matizFila,                                 // 0..360
        // color para pintar la nota: el matiz que eligió su instrumento
        // (promediar RGB de una fila con muchos colores daría gris)
        color: conColor
          ? hsvARgb(matizFila, Math.min(0.95, 0.45 + intensidad), 0.5 + 0.35 * (cL / sC)).map((v) => v * 255)
          : [sR / an, sG / an, sB / an],
      });
      gx += hx; gy += hy; gCroma += sC;
    }

    const mRg = sumRg / n, mYb = sumYb / n;
    const dRg = Math.sqrt(Math.max(0, sumRg2 / n - mRg * mRg));
    const dYb = Math.sqrt(Math.max(0, sumYb2 / n - mYb * mYb));
    const colorido = Math.sqrt(dRg * dRg + dYb * dYb) + 0.3 * Math.sqrt(mRg * mRg + mYb * mYb);

    const matiz = mediaCircular(gx, gy);
    // concentración: 1 = un solo matiz, 0 = matices repartidos por todo el círculo
    const concentracion = gCroma > 0 ? Math.hypot(gx, gy) / gCroma : 0;
    // temperatura: +1 naranja (40°), −1 azul celeste (220°)
    const temperatura = Math.cos(((matiz - 40) * Math.PI) / 180);

    return {
      filas,
      colorido,                                // escala de Hasler (0 ~ 110+)
      coloridoNorm: Math.min(1, colorido / 100),
      matiz,
      concentracion,
      temperatura,
      croma: gCroma / (an * al),
    };
  }

  window.Analisis = { GRILLA, rotarMatiz, analizar, rgbAHsv, hsvARgb };
})();
