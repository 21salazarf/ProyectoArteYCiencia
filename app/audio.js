/*
 * audio.js
 * --------
 * Hace sonar la composición con Web Audio:
 *   - instrumentos reales a partir de samples (samples/<instrumento>/<midi>.mp3);
 *     si no se pueden cargar, cae a un sintetizador simple para no quedarse mudo;
 *   - senos y clics sintetizados para el mundo acromático;
 *   - reverberación generada (más en lo frío);
 *   - la misma función sirve para reproducir en vivo y para exportar a WAV.
 */
(function () {
  "use strict";

  const { INSTRUMENTOS } = window.Composicion;

  const GANANCIA = { piano: 0.9, trompeta: 0.55, saxofon: 0.6, marimba: 1, flauta: 0.8, cuerdas: 0.75, chelo: 0.9, coro: 0.8, vibrafono: 0.85 };
  const PANEO = { piano: 0, trompeta: 0.25, saxofon: -0.25, marimba: 0.4, flauta: -0.4, cuerdas: -0.15, chelo: 0.1, coro: 0.3, vibrafono: -0.3 };
  const LIGADOS = new Set(["cuerdas", "chelo", "coro", "flauta"]);
  const REFUERZO = 5; // los samples vienen grabados a unos −19 dB: se suben ~14 dB

  let ctx = null;
  const buffers = new Map();     // "trompeta/60" -> AudioBuffer
  const cargas = new Map();      // "trompeta/60" -> Promise
  const sinSamples = new Set();  // instrumentos que no se pudieron cargar

  function contexto() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    return ctx;
  }

  // --- Samples -------------------------------------------------------------

  function rejilla(clave) {
    const { lo, hi } = INSTRUMENTOS[clave];
    const desde = (lo - 2) - ((lo - 2) % 3), hasta = hi + 2;
    return [desde, hasta - ((hasta - desde) % 3)];
  }

  function sampleCercano(clave, midi) {
    const [a, b] = rejilla(clave);
    return Math.max(a, Math.min(b, Math.round(midi / 3) * 3));
  }

  function cargarSample(clave, s) {
    const id = `${clave}/${s}`;
    if (!cargas.has(id)) {
      cargas.set(id, fetch(`samples/${id}.mp3`)
        .then((r) => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
        .then((ab) => contexto().decodeAudioData(ab))
        .then((buf) => { buffers.set(id, buf); })
        .catch(() => { sinSamples.add(clave); }));
    }
    return cargas.get(id);
  }

  /** Carga solo los samples que esta composición necesita. */
  function prepararSamples(comp) {
    const pedidos = [];
    for (const n of comp.notas) {
      if (!INSTRUMENTOS[n.inst] || sinSamples.has(n.inst)) continue;
      pedidos.push(cargarSample(n.inst, sampleCercano(n.inst, n.midi)));
    }
    return Promise.all(pedidos);
  }

  // --- Grafo ----------------------------------------------------------------

  function respuestaImpulso(c, segundos) {
    const largo = Math.floor(c.sampleRate * segundos);
    const ir = c.createBuffer(2, largo, c.sampleRate);
    for (let canal = 0; canal < 2; canal++) {
      const d = ir.getChannelData(canal);
      for (let i = 0; i < largo; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / largo, 3);
    }
    return ir;
  }

  function crearGrafo(c, reverb) {
    const compresor = c.createDynamicsCompressor();
    compresor.threshold.value = -14; compresor.ratio.value = 4;
    const maestro = c.createGain(); maestro.gain.value = 0.85;
    compresor.connect(maestro); maestro.connect(c.destination);

    const entrada = c.createGain();
    entrada.connect(compresor);
    const envio = c.createGain(); envio.gain.value = reverb;
    const conv = c.createConvolver(); conv.buffer = respuestaImpulso(c, 2.6);
    entrada.connect(envio); envio.connect(conv); conv.connect(compresor);
    return { entrada, maestro };
  }

  let ruido = null;
  function bufferRuido(c) {
    if (!ruido || ruido.sampleRate !== c.sampleRate) {
      ruido = c.createBuffer(1, Math.floor(c.sampleRate * 0.03), c.sampleRate);
      const d = ruido.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    return ruido;
  }

  function panear(c, destino, valor) {
    if (!c.createStereoPanner) return destino;
    const p = c.createStereoPanner(); p.pan.value = valor; p.connect(destino);
    return p;
  }

  /** Programa una nota en el contexto `c` a partir del instante `t` (segundos del contexto). */
  function programar(c, destino, n, t) {
    const fuentes = [];
    const env = c.createGain();

    if (n.inst === "clic") {
      const src = c.createBufferSource(); src.buffer = bufferRuido(c);
      const hp = c.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 2500;
      src.connect(hp); hp.connect(env); env.connect(panear(c, destino, n.pan !== undefined ? n.pan : (n.fila % 2 ? 0.6 : -0.6)));
      env.gain.setValueAtTime(n.vel * 0.8, t);
      env.gain.exponentialRampToValueAtTime(0.0001, t + n.dur);
      src.start(t); src.stop(t + n.dur + 0.01);
      fuentes.push(src);
      return fuentes;
    }

    if (n.inst === "seno") {
      const osc = c.createOscillator(); osc.type = "sine"; osc.frequency.value = n.hz;
      osc.connect(env); env.connect(panear(c, destino, n.pan !== undefined ? n.pan : (n.fila % 2 ? 0.35 : -0.35)));
      const pico = n.vel * 0.45;
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(pico, t + 0.004);
      env.gain.setValueAtTime(pico, t + Math.max(0.005, n.dur - 0.008));
      env.gain.linearRampToValueAtTime(0, t + n.dur);
      osc.start(t); osc.stop(t + n.dur + 0.01);
      fuentes.push(osc);
      return fuentes;
    }

    // Instrumento con samples (o sintetizador de respaldo)
    const clave = n.inst;
    const ligado = LIGADOS.has(clave);
    const ataque = ligado ? 0.05 : 0.008;
    const suelta = ligado ? 0.45 : 0.22;
    const pico = n.vel * (GANANCIA[clave] || 0.8) * REFUERZO;
    env.connect(panear(c, destino, n.pan !== undefined ? n.pan : PANEO[clave] || 0));

    const s = sampleCercano(clave, n.midi);
    const buf = buffers.get(`${clave}/${s}`);
    let fuente;
    if (buf) {
      fuente = c.createBufferSource();
      fuente.buffer = buf;
      fuente.playbackRate.value = Math.pow(2, (n.midi - s) / 12);
      fuente.connect(env);
    } else {
      fuente = c.createOscillator();
      fuente.type = INSTRUMENTOS[clave].onda;
      fuente.frequency.value = 440 * Math.pow(2, (n.midi - 69) / 12);
      const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 2200;
      fuente.connect(lp); lp.connect(env);
    }
    const fin = t + n.dur;
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(pico, t + ataque);
    env.gain.setValueAtTime(pico, Math.max(t + ataque, fin));
    env.gain.exponentialRampToValueAtTime(0.0001, fin + suelta);
    fuente.start(t); fuente.stop(fin + suelta + 0.05);
    fuentes.push(fuente);
    return fuentes;
  }

  // --- Reproducción en vivo -------------------------------------------------

  let actual = null; // { grafo, fuentes, t0, desde }

  async function reproducir(comp, desde = 0) {
    detener();
    const c = contexto();
    await c.resume();
    await prepararSamples(comp);
    const grafo = crearGrafo(c, comp.reverb);
    const t0 = c.currentTime + 0.08;
    const fuentes = [];
    for (const n of comp.notas) {
      if (n.t < desde) continue;
      fuentes.push(...programar(c, grafo.entrada, n, t0 + n.t - desde));
    }
    actual = { grafo, fuentes, t0, desde };
  }

  function detener() {
    if (!actual) return;
    const { grafo, fuentes } = actual;
    const c = contexto();
    grafo.maestro.gain.setTargetAtTime(0, c.currentTime, 0.015);
    setTimeout(() => { fuentes.forEach((f) => { try { f.stop(); } catch (e) { /* ya paró */ } }); grafo.maestro.disconnect(); }, 80);
    actual = null;
  }

  /** Segundo de la composición que está sonando ahora (o null si no suena nada). */
  function posicion() {
    if (!actual) return null;
    return actual.desde + (contexto().currentTime - actual.t0);
  }

  // --- Exportar WAV --------------------------------------------------------

  async function renderizar(comp) {
    await prepararSamples(comp);
    const sr = 44100;
    const largo = comp.duracion + 3;
    const off = new OfflineAudioContext(2, Math.ceil(sr * largo), sr);
    const grafo = crearGrafo(off, comp.reverb);
    for (const n of comp.notas) programar(off, grafo.entrada, n, n.t);
    const buf = await off.startRendering();
    // normalizar: el pico queda en −1 dB para que todas las descargas suenen igual de fuerte
    let pico = 0;
    for (let k = 0; k < buf.numberOfChannels; k++) {
      const d = buf.getChannelData(k);
      for (let i = 0; i < d.length; i++) pico = Math.max(pico, Math.abs(d[i]));
    }
    if (pico > 0) {
      const g = 0.89 / pico;
      for (let k = 0; k < buf.numberOfChannels; k++) {
        const d = buf.getChannelData(k);
        for (let i = 0; i < d.length; i++) d[i] *= g;
      }
    }
    return buf;
  }

  function aWav(buf) {
    const canales = buf.numberOfChannels, sr = buf.sampleRate, n = buf.length;
    const datos = new DataView(new ArrayBuffer(44 + n * canales * 2));
    const texto = (o, s) => { for (let i = 0; i < s.length; i++) datos.setUint8(o + i, s.charCodeAt(i)); };
    texto(0, "RIFF"); datos.setUint32(4, 36 + n * canales * 2, true); texto(8, "WAVE");
    texto(12, "fmt "); datos.setUint32(16, 16, true); datos.setUint16(20, 1, true);
    datos.setUint16(22, canales, true); datos.setUint32(24, sr, true);
    datos.setUint32(28, sr * canales * 2, true); datos.setUint16(32, canales * 2, true); datos.setUint16(34, 16, true);
    texto(36, "data"); datos.setUint32(40, n * canales * 2, true);
    const ch = []; for (let k = 0; k < canales; k++) ch.push(buf.getChannelData(k));
    let o = 44;
    for (let i = 0; i < n; i++) {
      for (let k = 0; k < canales; k++) {
        const v = Math.max(-1, Math.min(1, ch[k][i]));
        datos.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true); o += 2;
      }
    }
    return new Blob([datos], { type: "audio/wav" });
  }

  window.Sonido = {
    reproducir, detener, posicion, renderizar,  aWav, prepararSamples,
    get sinSamples() { return [...sinSamples]; },
  };
})();
