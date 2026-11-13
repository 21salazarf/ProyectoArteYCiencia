/*
 * composicion.js
 * --------------
 * Convierte el análisis de color en notas. Cada fila de la foto (de arriba a
 * abajo) es un paso de tiempo.
 *
 * Dos mundos sonoros que no se parecen en nada:
 *
 *  1. ACROMÁTICO (foto en blanco y negro o casi sin color, colorido < 15):
 *     senos puros sin escala (frecuencias continuas, microtonales), pulso fijo
 *     y rápido, clics de ruido en las filas de mucho contraste. Sin
 *     instrumentos, sin acordes, sin reverberación. Un guiño a Ryoji Ikeda.
 *
 *  2. TONAL (foto con color):
 *     - el MATIZ dominante elige la tónica (círculo cromático = círculo de
 *       quintas, como el teclado de luces de Scriabin) y el modo/escala;
 *     - el matiz de cada FILA elige el instrumento que toca esa nota;
 *     - el COLORIDO sube el tempo, añade acordes y una línea de bajo;
 *     - la TEMPERATURA hace lo cálido rápido y cortado, y lo frío lento,
 *       ligado y con más reverberación;
 *     - el BRILLO de la fila da la altura y el CONTRASTE la intensidad.
 *
 *  Con varias fotos (hasta 3), componerArmonia() las hace sonar juntas en una
 *  tonalidad común (ver más abajo).
 */
(function () {
  "use strict";

  // Instrumentos con samples reales (carpeta samples/<clave>/<midi>.mp3)
  const INSTRUMENTOS = {
    piano:     { nombre: "piano",      gm: 0,  lo: 36, hi: 96, onda: "triangle" },
    trompeta:  { nombre: "trompeta",   gm: 56, lo: 55, hi: 84, onda: "sawtooth" },
    saxofon:   { nombre: "saxofón",    gm: 65, lo: 49, hi: 81, onda: "sawtooth" },
    marimba:   { nombre: "marimba",    gm: 12, lo: 48, hi: 91, onda: "sine" },
    flauta:    { nombre: "flauta",     gm: 73, lo: 60, hi: 96, onda: "sine" },
    cuerdas:   { nombre: "cuerdas",    gm: 48, lo: 43, hi: 84, onda: "sawtooth" },
    chelo:     { nombre: "violonchelo", gm: 42, lo: 36, hi: 72, onda: "sawtooth" },
    coro:      { nombre: "coro",       gm: 52, lo: 48, hi: 79, onda: "triangle" },
    vibrafono: { nombre: "vibráfono",  gm: 11, lo: 53, hi: 89, onda: "sine" },
  };

  const ESCALAS = {
    "frigio dominante": [0, 1, 4, 5, 7, 8, 10],
    "mixolidio":        [0, 2, 4, 5, 7, 9, 10],
    "mayor":            [0, 2, 4, 5, 7, 9, 11],
    "pentatónica":      [0, 2, 4, 7, 9],
    "dórico":           [0, 2, 3, 5, 7, 9, 10],
    "menor":            [0, 2, 3, 5, 7, 8, 10],
    "frigio":           [0, 1, 3, 5, 7, 8, 10],
    "lidio":            [0, 2, 4, 6, 7, 9, 11],
  };

  // Familias de matiz: [desde, hasta) en grados
  const FAMILIAS = [
    { nombre: "rojo",     desde: 345, hasta: 15,  instrumento: "trompeta",  escala: "frigio dominante" },
    { nombre: "naranja",  desde: 15,  hasta: 45,  instrumento: "saxofon",   escala: "mixolidio" },
    { nombre: "amarillo", desde: 45,  hasta: 75,  instrumento: "marimba",   escala: "mayor" },
    { nombre: "verde",    desde: 75,  hasta: 160, instrumento: "flauta",    escala: "pentatónica" },
    { nombre: "cian",     desde: 160, hasta: 200, instrumento: "cuerdas",   escala: "dórico" },
    { nombre: "azul",     desde: 200, hasta: 250, instrumento: "chelo",     escala: "menor" },
    { nombre: "violeta",  desde: 250, hasta: 290, instrumento: "coro",      escala: "frigio" },
    { nombre: "magenta",  desde: 290, hasta: 345, instrumento: "vibrafono", escala: "lidio" },
  ];

  const NOTAS = ["Do", "Re bemol", "Re", "Mi bemol", "Mi", "Fa", "Fa sostenido", "Sol", "La bemol", "La", "Si bemol", "Si"];

  // "a, b y c"
  const enLista = (xs) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}`);
  const mayuscula = (t) => t.charAt(0).toUpperCase() + t.slice(1);

  const UMBRAL_ACROMATICO = 15; // en la escala de Hasler: por debajo, "no colorida"
  const FILA_PLANA = 0.018;     // contraste mínimo para que una fila suene

  const lerp = (a, b, t) => a + (b - a) * t;
  const limitar = (x, a, b) => Math.max(a, Math.min(b, x));

  function familiaDe(h) {
    for (const f of FAMILIAS) {
      if (f.desde > f.hasta ? (h >= f.desde || h < f.hasta) : (h >= f.desde && h < f.hasta)) return f;
    }
    return FAMILIAS[0];
  }

  // Scriabin: el círculo de colores se recorre como el círculo de quintas.
  // rojo → Do, naranja → Sol, amarillo → Re, verde → La, cian → Mi, azul → Si...
  function tonicaDe(h) {
    const k = Math.round(h / 30) % 12;
    return (7 * k) % 12;
  }

  function plegar(m, lo, hi) {
    while (m > hi) m -= 12;
    while (m < lo) m += 12;
    return m;
  }

  function componer(a) {
    if (a.colorido < UMBRAL_ACROMATICO) return componerAcromatico(a);
    return componerTonal(a);
  }

  // ---------------------------------------------------------------------------
  function componerAcromatico(a) {
    const paso = 0.16;
    const notas = [];
    let silencios = 0, clics = 0;
    a.filas.forEach((f, i) => {
      if (f.contraste < FILA_PLANA) { silencios++; return; }
      const t = i * paso;
      const hz = 55 * Math.pow(2, f.luz * 6); // 55 Hz – 3520 Hz, sin escala
      notas.push({
        t, dur: paso * 0.85, inst: "seno", hz, midi: 69 + 12 * Math.log2(hz / 440),
        vel: limitar(0.3 + f.contraste * 2.2, 0.3, 1), fila: i, color: f.color,
      });
      if (f.contraste > 0.12) {
        clics++;
        notas.push({ t, dur: 0.012, inst: "clic", midi: null, vel: limitar(f.contraste * 2.5, 0.2, 0.9), fila: i, color: f.color });
        const hzAlto = 4000 + f.contraste * 6000;
        notas.push({
          t: t + paso * 0.5, dur: 0.035, inst: "seno", hz: hzAlto, midi: 69 + 12 * Math.log2(hzAlto / 440),
          vel: 0.12, fila: i, color: f.color, adorno: true,
        });
      }
    });
    return {
      modo: "acromatico",
      notas,
      paso,
      temperatura: 0,
      bpm: Math.round(60 / (paso * 2)),
      reverb: 0.03,
      duracion: a.filas.length * paso,
      instrumentos: ["seno", "clic"],
      datos: { silencios, clics, filas: a.filas.length, colorido: a.colorido },
      resumen: {
        mundo: "Sin color",
        tonalidad: "Sin escala: frecuencias continuas",
        instrumentos: "Senos puros y clics",
        textura: "Una sola voz sobre un pulso fijo",
      },
    };
  }

  // ---------------------------------------------------------------------------
  function componerTonal(a) {
    const C = a.coloridoNorm;                       // 0..1
    // Si la foto tiene matices de todo el círculo (policromática), su "promedio"
    // no es ni frío ni cálido: la temperatura pesa según qué tan concentrado esté el color.
    const peso = limitar((a.concentracion - 0.15) / 0.45, 0, 1);
    const W = a.temperatura * peso;                 // −1 frío … +1 cálido
    const policromatica = a.concentracion < 0.35 && C > 0.3;
    const fam = familiaDe(a.matiz);
    const escala = ESCALAS[fam.escala];
    const L = escala.length;
    const tonica = tonicaDe(a.matiz);

    const bpm = limitar(Math.round(70 + 55 * C + 22 * W), 56, 150);
    const paso = 60 / bpm / 2;                      // una fila = una corchea
    const articulacion = lerp(1.9, 0.6, (W + 1) / 2); // frío ligado, cálido cortado
    const reverb = lerp(0.14, 0.42, (1 - W) / 2);

    const notas = [];
    const usados = new Set();
    let anterior = null;
    // para explicar el resultado: cuántas filas toca cada instrumento, acordes y silencios
    const filasPorInst = {};
    let silencios = 0, triadas = 0, dobles = 0;

    // Altura: brillo de la fila (mitad general, mitad de la parte con color),
    // estirado al rango de la foto para que toda imagen use sus dos octavas.
    const suena = (f) => !(f.contraste < FILA_PLANA && f.croma < 0.12);
    const luces = a.filas.map((f) => 0.5 * f.luz + 0.5 * f.luzColor);
    const audibles = luces.filter((_, i) => suena(a.filas[i]));
    const lMin = Math.min(...audibles), lMax = Math.max(...audibles);
    const estirar = (l) => (lMax - lMin > 0.05 ? (l - lMin) / (lMax - lMin) : l);

    a.filas.forEach((f, i) => {
      const t = i * paso;
      if (!suena(f)) { anterior = null; silencios++; return; } // fila plana y gris: silencio

      const clave = f.intensidad < 0.1 ? "piano" : familiaDe(f.matiz).instrumento;
      const inst = INSTRUMENTOS[clave];
      // tónica dentro del registro del instrumento
      let base = inst.lo + 2;
      while (((base % 12) + 12) % 12 !== tonica) base++;

      const grado = Math.round(estirar(luces[i]) * 2 * L); // 0..2 octavas de la escala
      const midiDe = (g) => plegar(base + 12 * Math.floor(g / L) + escala[g % L], inst.lo, inst.hi);
      const vel = limitar((48 + f.contraste * 180 + f.croma * 40) / 127, 0.25, 0.95);
      const dur = Math.min(2.9, paso * articulacion);

      const principal = midiDe(grado);
      filasPorInst[clave] = (filasPorInst[clave] || 0) + 1;
      // En lo frío, si la nota se repite con el mismo instrumento, se alarga en vez de repetirse
      if (W < 0 && anterior && anterior.inst === clave && anterior.midi === principal) {
        anterior.dur = Math.min(2.9, t + dur - anterior.t);
        return;
      }

      const voces = [grado];
      if (f.croma > 0.22) voces.push(grado + 2);   // tercera
      if (f.croma > 0.4) voces.push(grado + 4);    // quinta
      if (voces.length === 3) triadas++; else if (voces.length === 2) dobles++;
      voces.forEach((g, k) => {
        const n = { t, dur, inst: clave, midi: midiDe(g), vel: k ? vel * 0.7 : vel, fila: i, color: f.color };
        notas.push(n);
        if (k === 0) anterior = n;
      });
      usados.add(clave);
    });

    // Línea de bajo: solo en fotos bastante coloridas
    if (C > 0.3) {
      const grupo = 8;
      const gradosBajo = [0, 4, 3, 5];               // tónica, quinta, cuarta, sexta
      for (let i = 0; i < a.filas.length; i += grupo) {
        const bloque = a.filas.slice(i, i + grupo);
        const luz = bloque.reduce((s, f) => s + f.luz, 0) / bloque.length;
        const g = gradosBajo[Math.min(3, Math.floor(luz * 4))] % L;
        let m = 36;
        while (m % 12 !== tonica) m++;
        notas.push({
          t: i * paso, dur: Math.min(2.9, grupo * paso * 0.95), inst: "chelo", midi: plegar(m + escala[g], 36, 52),
          vel: 0.5, fila: i, color: bloque[0].color, bajo: true,
        });
      }
      usados.add("chelo");
    }

    const temp = policromatica ? "Policromática" : W > 0.35 ? "Cálida" : W < -0.35 ? "Fría" : "Templada";
    return {
      modo: "tonal",
      notas,
      paso,
      temperatura: W,
      bpm,
      reverb,
      duracion: a.filas.length * paso,
      instrumentos: [...usados],
      familia: fam.nombre,
      datos: {
        familia: fam.nombre, escala: fam.escala, tonica: NOTAS[tonica], matiz: a.matiz,
        colorido: a.colorido, policromatica, temperatura: W, bpm,
        filasPorInst, silencios, triadas, dobles, bajo: C > 0.3, filas: a.filas.length,
      },
      resumen: {
        mundo: temp,
        tonalidad: `${NOTAS[tonica]} ${fam.escala}`,
        instrumentos: mayuscula(enLista([...usados].map((k) => INSTRUMENTOS[k].nombre))),
        // la textura se describe con lo que realmente sonó, igual que la explicación
        textura: triadas || dobles || C > 0.3
          ? enLista(["Melodía", ...(triadas || dobles ? ["acordes"] : []), ...(C > 0.3 ? ["bajo"] : [])])
          : "Una sola voz",
      },
    };
  }

  // ===========================================================================
  // ARMONÍA: hasta 3 fotos sonando juntas.
  //  - una sola tonalidad para todas: el promedio circular de sus matices,
  //    donde cada foto pesa según su colorido (una foto sin color no vota);
  //  - un solo tempo (colorido y temperatura promedio), así la fila 1 de todas
  //    las fotos suena al mismo tiempo;
  //  - cada foto conserva sus instrumentos (el color de cada fila) y su
  //    articulación (cálida cortada, fría ligada), pero toca un papel distinto
  //    en un registro distinto para no taparse con las otras;
  //  - una foto sin color aporta un pulso de senos agudos afinados y clics.
  // ===========================================================================
  const MAX_FOTOS = 3;
  // Los papeles se reparten solo entre las fotos con color; una foto sin color es "pulso".
  const PAPELES = {
    1: ["melodía"],
    2: ["melodía", "bajo con acordes"],
    3: ["melodía", "contramelodía", "bajo con acordes"],
  };
  const REGISTROS = { "melodía": [64, 91], "contramelodía": [52, 76], "bajo con acordes": [36, 60] };
  const CADA = { "melodía": 1, "contramelodía": 2, "bajo con acordes": 4 }; // filas por nota
  const PANEO_VOZ = [0, -0.35, 0.3];

  // Ventana de alturas para un papel con un instrumento dado
  function ventana(papel, inst) {
    const [rlo, rhi] = REGISTROS[papel];
    let lo = Math.max(rlo, inst.lo), hi = Math.min(rhi, inst.hi);
    if (hi - lo < 14) { // el instrumento no llega a ese registro: usa su extremo más cercano
      if (papel === "melodía") { hi = inst.hi; lo = Math.max(inst.lo, hi - 19); }
      else if (papel === "bajo con acordes") { lo = inst.lo; hi = Math.min(inst.hi, lo + 19); }
      else { const c = Math.round((inst.lo + inst.hi) / 2); lo = Math.max(inst.lo, c - 10); hi = Math.min(inst.hi, c + 10); }
    }
    return [lo, hi];
  }

  function tonicaEn(lo, tonica) {
    let b = lo;
    while (((b % 12) + 12) % 12 !== tonica) b++;
    return b;
  }

  /** lista: el análisis de cada foto (con su tono ya aplicado), en orden. */
  function componerArmonia(lista) {
    const n = Math.min(lista.length, MAX_FOTOS);
    if (n === 1) {
      const c = componer(lista[0]);
      c.notas.forEach((x) => { x.voz = 0; });
      c.voces = 1;
      return c;
    }
    lista = lista.slice(0, n);
    const conColor = lista.map((a) => a.colorido >= UMBRAL_ACROMATICO);
    if (!conColor.some(Boolean)) return armoniaAcromatica(lista);
    const reparto = PAPELES[conColor.filter(Boolean).length];
    let k = 0;
    const papeles = conColor.map((cc) => (cc ? reparto[k++] : "pulso"));

    // Tonalidad común
    const pesos = lista.map((a, i) => (conColor[i] ? a.colorido : 0));
    let sx = 0, sy = 0, sp = 0, cx = 0, cy = 0;
    lista.forEach((a, i) => {
      const w = pesos[i];
      if (!w) return;
      const r = (a.matiz * Math.PI) / 180;
      sx += w * Math.cos(r); sy += w * Math.sin(r); sp += w;
      cx += w * a.concentracion * Math.cos(r); cy += w * a.concentracion * Math.sin(r);
    });
    let matiz = (Math.atan2(sy, sx) * 180) / Math.PI;
    if (matiz < 0) matiz += 360;
    const concentracion = Math.hypot(cx, cy) / sp;
    const coloridoProm = lista.reduce((s, a) => s + a.colorido, 0) / n;
    const C = lista.reduce((s, a) => s + a.coloridoNorm, 0) / n;
    const Ws = lista.map((a) => a.temperatura * limitar((a.concentracion - 0.15) / 0.45, 0, 1));
    const W = lista.reduce((s, a, i) => s + pesos[i] * Ws[i], 0) / sp;
    const policromatica = concentracion < 0.35 && C > 0.3;
    const fam = familiaDe(matiz);
    const escala = ESCALAS[fam.escala];
    const L = escala.length;
    const tonica = tonicaDe(matiz);

    const bpm = limitar(Math.round(70 + 55 * C + 22 * W), 56, 150);
    const paso = 60 / bpm / 2;
    const reverb = lerp(0.14, 0.42, (1 - W) / 2);
    const notas = [];
    const usados = new Set();
    const voces = [];

    lista.forEach((a, v) => {
      const papel = papeles[v];
      const pan = PANEO_VOZ[v];
      const info = {
        papel, acromatica: !conColor[v], filasPorInst: {}, silencios: 0, acordes: 0,
        familia: conColor[v] ? familiaDe(a.matiz).nombre : null, matiz: a.matiz,
        colorido: a.colorido, peso: pesos[v] / sp, temperatura: Ws[v],
      };
      voces.push(info);
      if (!conColor[v]) { pulsoAfinado(a, v, info); return; }

      const articulacion = lerp(1.9, 0.6, (Ws[v] + 1) / 2);
      const cada = CADA[papel];
      const suena = (f) => !(f.contraste < FILA_PLANA && f.croma < 0.12);
      const luces = a.filas.map((f) => 0.5 * f.luz + 0.5 * f.luzColor);
      const aud = luces.filter((_, i) => suena(a.filas[i]));
      const lMin = aud.length ? Math.min(...aud) : 0, lMax = aud.length ? Math.max(...aud) : 1;
      const estirar = (l) => (lMax - lMin > 0.05 ? (l - lMin) / (lMax - lMin) : l);
      const vel0 = papel === "melodía" ? 1 : 0.85;
      let anterior = null;

      for (let i = 0; i < a.filas.length; i += cada) {
        const filas = a.filas.slice(i, i + cada);
        if (!filas.some(suena)) { info.silencios += filas.length; anterior = null; continue; }
        // el bloque se resume: promedio de brillo, contraste y croma; matiz y color de su fila más viva
        const prom = (k) => filas.reduce((s, f) => s + f[k], 0) / filas.length;
        const luz = luces.slice(i, i + cada).reduce((s, x) => s + x, 0) / filas.length;
        const viva = filas.reduce((m, f) => (f.intensidad > m.intensidad ? f : m), filas[0]);
        const croma = prom("croma"), contraste = prom("contraste");

        const clave = viva.intensidad < 0.1 ? "piano" : familiaDe(viva.matiz).instrumento;
        const inst = INSTRUMENTOS[clave];
        const [lo, hi] = ventana(papel, inst);
        const base = tonicaEn(lo, tonica);
        const midiDe = (g) => plegar(base + 12 * Math.floor(g / L) + escala[g % L], lo, hi);

        let grados;
        if (papel === "bajo con acordes") {
          const g = [0, 4, 3, 5][Math.min(3, Math.floor(estirar(luz) * 4))] % L; // tónica, quinta, cuarta, sexta
          grados = [g];
          if (croma > 0.15) grados.push(g + 2);
          if (croma > 0.3) grados.push(g + 4);
        } else {
          const g = Math.round(estirar(luz) * 2 * L);
          grados = [g];
          if (papel === "melodía" && croma > 0.22) grados.push(g + 2);
          if (papel === "melodía" && croma > 0.4) grados.push(g + 4);
        }

        const t = i * paso;
        const dur = Math.min(2.9, paso * cada * (papel === "melodía" ? articulacion : Math.max(0.95, articulacion * 0.9)));
        const vel = limitar((48 + contraste * 180 + croma * 40) / 127, 0.25, 0.95) * vel0;
        const principal = midiDe(grados[0]);
        info.filasPorInst[clave] = (info.filasPorInst[clave] || 0) + filas.length;

        if (Ws[v] < 0 && anterior && anterior.inst === clave && anterior.midi === principal) {
          anterior.dur = Math.min(2.9, t + dur - anterior.t);
          continue;
        }
        if (grados.length > 1) info.acordes++;
        grados.forEach((g, k) => {
          const nota = { t, dur, inst: clave, midi: midiDe(g), vel: k ? vel * 0.7 : vel, fila: i, color: viva.color, voz: v, pan };
          notas.push(nota);
          if (!k) anterior = nota;
        });
        usados.add(clave);
      }
    });

    // Una foto sin color dentro de una armonía con color: pulso de senos agudos afinados y clics
    function pulsoAfinado(a, v, info) {
      const base = tonicaEn(72, tonica);
      let senos = 0;
      a.filas.forEach((f, i) => {
        if (f.contraste < FILA_PLANA) { info.silencios++; return; }
        const g = Math.round(f.luz * 2 * L);
        const m = plegar(base + 12 * Math.floor(g / L) + escala[g % L], 72, 98);
        const t = i * paso;
        notas.push({ t, dur: paso * 0.45, inst: "seno", hz: 440 * Math.pow(2, (m - 69) / 12), midi: m, vel: limitar(0.25 + f.contraste * 1.5, 0.25, 0.7), fila: i, color: f.color, voz: v, pan: PANEO_VOZ[v] });
        senos++;
        if (f.contraste > 0.12) notas.push({ t, dur: 0.012, inst: "clic", midi: null, vel: limitar(f.contraste * 2, 0.2, 0.7), fila: i, color: f.color, voz: v, pan: PANEO_VOZ[v] });
      });
      info.filasPorInst.seno = senos;
      usados.add("seno");
    }

    const temp = policromatica ? "Policromática" : W > 0.35 ? "Cálida" : W < -0.35 ? "Fría" : "Templada";
    const nombres = [...usados].map((k) => (k === "seno" ? "senos" : INSTRUMENTOS[k].nombre));
    return {
      modo: "tonal",
      armonia: true,
      voces: n,
      notas,
      paso,
      bpm,
      reverb,
      temperatura: W,
      duracion: Math.max(...lista.map((a) => a.filas.length)) * paso,
      instrumentos: [...usados],
      familia: fam.nombre,
      lectura: { colorido: coloridoProm, matiz, acromatica: false },
      datos: {
        familia: fam.nombre, escala: fam.escala, tonica: NOTAS[tonica], matiz,
        colorido: coloridoProm, policromatica, temperatura: W, bpm, voces,
      },
      resumen: {
        mundo: temp,
        tonalidad: `${NOTAS[tonica]} ${fam.escala}`,
        instrumentos: mayuscula(enLista(nombres)),
        textura: mayuscula(`${n} voces: ${enLista(papeles)}`),
      },
    };
  }

  // Ninguna foto tiene color: cada una es una capa de senos, separadas por octavas
  function armoniaAcromatica(lista) {
    const octava = [1, 0.5, 2];
    const notas = [];
    const voces = [];
    let paso = 0.16, duracion = 0;
    lista.forEach((a, v) => {
      const c = componerAcromatico(a);
      paso = c.paso; duracion = Math.max(duracion, c.duracion);
      c.notas.forEach((x) => {
        if (x.hz) { x.hz *= octava[v]; x.midi = 69 + 12 * Math.log2(x.hz / 440); }
        x.voz = v; x.pan = PANEO_VOZ[v];
        notas.push(x);
      });
      voces.push({ papel: "capa", acromatica: true, silencios: c.datos.silencios, clics: c.datos.clics, colorido: a.colorido });
    });
    return {
      modo: "acromatico",
      armonia: true,
      voces: lista.length,
      notas, paso,
      bpm: Math.round(60 / (paso * 2)),
      reverb: 0.03,
      temperatura: 0,
      duracion,
      instrumentos: ["seno", "clic"],
      lectura: { colorido: lista.reduce((s, a) => s + a.colorido, 0) / lista.length, matiz: 0, acromatica: true },
      datos: { voces },
      resumen: {
        mundo: "Sin color",
        tonalidad: "Sin escala: frecuencias continuas",
        instrumentos: "Senos puros y clics",
        textura: mayuscula(`${lista.length} capas de senos separadas por octavas`),
      },
    };
  }

  window.Composicion = { componer, componerArmonia, familiaDe, tonicaDe, INSTRUMENTOS, FAMILIAS, ESCALAS, NOTAS, UMBRAL_ACROMATICO, MAX_FOTOS };
})();
