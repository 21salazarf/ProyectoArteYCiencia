/*
 * midi.js
 * -------
 * Escribe la composición como archivo MIDI estándar (tipo 1): una pista por
 * instrumento, cada una con su programa General MIDI. Los senos del modo
 * acromático no caben en la escala temperada: se escriben como la nota más
 * cercana más un pitch bend con la desviación exacta.
 */
(function () {
  "use strict";

  const { INSTRUMENTOS } = window.Composicion;
  const PPQ = 480;

  function vlq(n) {
    const bytes = [n & 0x7f];
    while ((n >>= 7)) bytes.unshift((n & 0x7f) | 0x80);
    return bytes;
  }

  // Texto en ASCII: los programas de música leen los nombres de pista como Latin-1
  function texto(s) {
    return Array.from(s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7e]/g, "?"), (c) => c.charCodeAt(0));
  }

  function pista(eventos) {
    // eventos: [{tick, datos:[...], orden}] → bytes de un chunk MTrk
    eventos.sort((a, b) => a.tick - b.tick || a.orden - b.orden);
    const cuerpo = [];
    let previo = 0;
    for (const e of eventos) {
      cuerpo.push(...vlq(e.tick - previo), ...e.datos);
      previo = e.tick;
    }
    cuerpo.push(0, 0xff, 0x2f, 0); // fin de pista
    const largo = cuerpo.length;
    return [0x4d, 0x54, 0x72, 0x6b, (largo >>> 24) & 255, (largo >>> 16) & 255, (largo >>> 8) & 255, largo & 255, ...cuerpo];
  }

  function exportarMidi(comp, titulo) {
    const ticksPorSeg = (PPQ * comp.bpm) / 60;
    const tick = (s) => Math.max(0, Math.round(s * ticksPorSeg));
    const mpq = Math.round(60000000 / comp.bpm);

    const pistas = [pista([
      { tick: 0, orden: 0, datos: [0xff, 0x03, ...vlq(texto(titulo).length), ...texto(titulo)] },
      { tick: 0, orden: 1, datos: [0xff, 0x51, 0x03, (mpq >> 16) & 255, (mpq >> 8) & 255, mpq & 255] },
    ])];

    // Una pista por foto e instrumento. El canal MIDI se comparte por instrumento
    // (así nunca pasan de 16); los senos usan un canal por foto porque cada uno
    // lleva su propio pitch bend. Los clics van al canal de percusión.
    const varias = (comp.voces || 1) > 1;
    const grupos = new Map();
    for (const n of comp.notas) {
      const k = `${n.voz || 0}|${n.inst}`;
      if (!grupos.has(k)) grupos.set(k, []);
      grupos.get(k).push(n);
    }
    const canales = new Map();
    let siguiente = 0;
    const canalDe = (k) => {
      if (!canales.has(k)) { if (siguiente === 9) siguiente++; canales.set(k, Math.min(15, siguiente++)); }
      return canales.get(k);
    };

    for (const [k, notas] of grupos) {
      const [voz, clave] = k.split("|");
      const esClic = clave === "clic";
      const ch = esClic ? 9 : canalDe(clave === "seno" ? `seno${voz}` : clave);
      const programa = clave === "seno" ? 79 : INSTRUMENTOS[clave] ? INSTRUMENTOS[clave].gm : 0; // 79 = ocarina, lo más cercano a un seno
      const base = clave === "seno" ? "senos" : clave === "clic" ? "clics" : INSTRUMENTOS[clave].nombre;
      const nombre = varias ? `foto ${Number(voz) + 1}: ${base}` : base;
      const ev = [{ tick: 0, orden: 0, datos: [0xff, 0x03, ...vlq(texto(nombre).length), ...texto(nombre)] }];
      if (!esClic) ev.push({ tick: 0, orden: 1, datos: [0xc0 | ch, programa] });

      for (const n of notas) {
        let nota, bend = null;
        if (esClic) nota = 42; // charles cerrado
        else if (clave === "seno") {
          nota = Math.max(0, Math.min(127, Math.round(n.midi)));
          const desvio = n.midi - nota; // −0.5 … +0.5 semitonos (rango de bend: ±2)
          bend = Math.max(0, Math.min(16383, Math.round(8192 + (desvio / 2) * 8192)));
        } else nota = Math.max(0, Math.min(127, Math.round(n.midi)));

        const vel = Math.max(1, Math.min(127, Math.round(n.vel * 127)));
        const ini = tick(n.t), fin = Math.max(ini + 1, tick(n.t + n.dur));
        if (bend !== null) ev.push({ tick: ini, orden: 2, datos: [0xe0 | ch, bend & 0x7f, bend >> 7] });
        ev.push({ tick: ini, orden: 3, datos: [0x90 | ch, nota, vel] });
        ev.push({ tick: fin, orden: 1, datos: [0x80 | ch, nota, 0] }); // las notas que terminan van antes que las que empiezan
      }
      pistas.push(pista(ev));
    }

    const cabecera = [0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 1, (pistas.length >> 8) & 255, pistas.length & 255, (PPQ >> 8) & 255, PPQ & 255];
    return new Blob([new Uint8Array([...cabecera, ...pistas.flat()])], { type: "audio/midi" });
  }

  window.Midi = { exportarMidi };
})();
