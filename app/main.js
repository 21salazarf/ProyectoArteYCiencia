/*
 * main.js
 * -------
 * Conecta la interfaz: términos → fotos → análisis → composición → sonido.
 *
 * Se trabaja con una lista de hasta 3 fotos. Con una foto, suena sola; con
 * dos o tres, suenan juntas como una armonía (ver componerArmonia). Cada foto
 * tiene su propio slider de tono: lo que se ve es exactamente lo que se
 * analiza, así que el sonido cambia con ella.
 */
(function () {
  "use strict";

  const { GRILLA, rotarMatiz, analizar } = window.Analisis;
  const { componerArmonia, familiaDe, UMBRAL_ACROMATICO, MAX_FOTOS } = window.Composicion;
  const Sonido = window.Sonido;

  const $ = (id) => document.getElementById(id);
  const MAX_LADO = 720; // resolución con la que se muestra cada foto

  const estado = {
    fotos: [],   // { nombre, original, grillaOriginal, tono, familiaOriginal, silenciada, grilla, analisis, dom }
    comp: null,
  };
  let reemplazar = null; // índice de la foto que se va a cambiar

  const roll = new window.PianoRoll($("roll"), (seg) => {
    if (Sonido.posicion() !== null) reproducir(seg);
    else { roll.posicion(seg); posicionPausa = seg; actualizarTiempo(seg); }
  });
  let posicionPausa = 0;
  let sonando = null; // la composición que se está escuchando

  // --- Términos -----------------------------------------------------------------
  $("acepto").addEventListener("change", (e) => {
    const ok = e.target.checked;
    $("paso-foto").classList.toggle("bloqueado", !ok);
    $("paso-foto").setAttribute("aria-disabled", String(!ok));
    $("archivo").disabled = !ok;
    if (!ok) { detener(); $("taller").hidden = true; }
    else if (estado.fotos.length) $("taller").hidden = false;
  });

  // --- Subir fotos ------------------------------------------------------------------
  const zona = $("zona");
  ["dragenter", "dragover"].forEach((t) => zona.addEventListener(t, (e) => {
    e.preventDefault();
    if (!$("archivo").disabled) zona.classList.add("encima");
  }));
  ["dragleave", "drop"].forEach((t) => zona.addEventListener(t, () => zona.classList.remove("encima")));
  zona.addEventListener("drop", (e) => {
    e.preventDefault();
    if (!$("archivo").disabled) agregarArchivos(e.dataTransfer.files);
  });
  $("archivo").addEventListener("change", (e) => { agregarArchivos(e.target.files); e.target.value = ""; });
  $("archivo-extra").addEventListener("change", (e) => { agregarArchivos(e.target.files); e.target.value = ""; });
  $("archivo-cambio").addEventListener("change", (e) => {
    const f = e.target.files[0];
    if (f !== undefined && reemplazar !== null) cargarImagen(f).then((foto) => { if (foto) ponerFoto(foto, reemplazar); }).catch(avisoCarga);
    e.target.value = "";
  });
  $("agregar").addEventListener("click", () => $("archivo-extra").click());

  const textoZona = $("zona").querySelector(".zona-sub").textContent;
  function avisoCarga(t) {
    const msg = typeof t === "string" ? t : "No se pudo abrir esa imagen. Prueba con otro archivo.";
    $("zona").querySelector(".zona-sub").textContent = msg;
    alertaEstado(msg);
  }

  function cargarImagen(archivo) {
    return new Promise((resolver, rechazar) => {
      if (!archivo.type.startsWith("image/")) { rechazar("Ese archivo no es una imagen. Elige un JPG, PNG o WEBP."); return; }
      const url = URL.createObjectURL(archivo);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolver(crearFoto(img, archivo.name.replace(/\.[^.]+$/, "").replace(/[^\w-]+/g, "_") || "foto"));
      };
      img.onerror = () => { URL.revokeObjectURL(url); rechazar("No se pudo abrir esa imagen. Prueba con otro archivo."); };
      img.src = url;
    });
  }

  async function agregarArchivos(lista) {
    const libres = MAX_FOTOS - estado.fotos.length;
    const archivos = [...lista];
    if (!archivos.length) return;
    if (libres <= 0) { avisoCarga(`Ya tienes ${MAX_FOTOS} fotos. Quita una para agregar otra.`); return; }
    const usar = archivos.slice(0, libres);
    try {
      const nuevas = await Promise.all(usar.map(cargarImagen));
      const primera = estado.fotos.length === 0;
      nuevas.forEach((f) => estado.fotos.push(f));
      $("zona").querySelector(".zona-sub").textContent = textoZona;
      alertaEstado(archivos.length > libres
        ? (libres === 1 ? `Solo cabía una foto más (máximo ${MAX_FOTOS}): usé la primera que elegiste.` : `Solo cabían ${libres} fotos más (máximo ${MAX_FOTOS}): usé las primeras ${libres}.`)
        : "");
      cambioDeFotos();
      if (primera) $("taller").scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (err) { avisoCarga(err); }
  }

  function ponerFoto(foto, i) {
    estado.fotos[i] = foto;
    reemplazar = null;
    cambioDeFotos();
  }

  function crearFoto(img, nombre) {
    const escala = Math.min(1, MAX_LADO / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * escala));
    const h = Math.max(1, Math.round(img.naturalHeight * escala));
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const cc = c.getContext("2d", { willReadFrequently: true });
    cc.drawImage(img, 0, 0, w, h);
    const original = cc.getImageData(0, 0, w, h);

    const g = document.createElement("canvas");
    g.width = GRILLA; g.height = GRILLA;
    const gc = g.getContext("2d", { willReadFrequently: true });
    gc.imageSmoothingQuality = "high";
    gc.drawImage(img, 0, 0, GRILLA, GRILLA);
    const grillaOriginal = gc.getImageData(0, 0, GRILLA, GRILLA);

    return { nombre, original, grillaOriginal, tono: 0, familiaOriginal: null, silenciada: false, grilla: null, analisis: null, dom: null };
  }

  function quitarFoto(i) {
    estado.fotos.splice(i, 1);
    if (!estado.fotos.length) {
      detener();
      estado.comp = null;
      $("taller").hidden = true;
      ["--c1", "--c2", "--c3", "--c4", "--tono", "--sobre-tono"].forEach((v) => raiz.removeProperty(v));
      $("paso-foto").scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    cambioDeFotos();
  }

  /** La lista de fotos cambió: rehace las tarjetas y la música desde el inicio. */
  function cambioDeFotos() {
    detener();
    posicionPausa = 0;
    $("taller").hidden = false;
    construirTarjetas();
    estado.fotos.forEach((f, i) => dibujarFoto(i));
    recomponer();
  }

  // --- Tarjetas de foto ----------------------------------------------------------
  function boton(texto, alClic) {
    const b = document.createElement("button");
    b.type = "button"; b.className = "enlace"; b.textContent = texto;
    b.addEventListener("click", alClic);
    return b;
  }

  function construirTarjetas() {
    const n = estado.fotos.length;
    const caja = $("fotos");
    caja.dataset.cantidad = n;
    caja.replaceChildren();
    estado.fotos.forEach((foto, i) => {
      const sufijoId = i === 0 ? "" : `-${i + 1}`;
      const t = document.createElement("article");
      t.className = "tarjeta";

      if (n > 1) {
        const cab = document.createElement("div");
        cab.className = "tarjeta-cabeza";
        const h = document.createElement("h3"); h.textContent = `Foto ${i + 1}`;
        const papel = document.createElement("span"); papel.className = "papel"; // se llena al componer
        cab.append(h, papel);
        t.append(cab);
      }

      const marco = document.createElement("div"); marco.className = "marco";
      const lienzo = document.createElement("canvas");
      if (i === 0) lienzo.id = "foto";
      lienzo.setAttribute("aria-label", n > 1 ? `Foto ${i + 1} con su tono aplicado` : "Tu foto con el tono aplicado");
      lienzo.width = foto.original.width; lienzo.height = foto.original.height;
      marco.append(lienzo);

      const control = document.createElement("div"); control.className = "control-tono";
      const fila = document.createElement("div"); fila.className = "fila";
      const etiqueta = document.createElement("label"); etiqueta.className = "nombre-control"; etiqueta.textContent = "Tono";
      etiqueta.htmlFor = `tono${sufijoId}`;
      const valor = document.createElement("output"); valor.className = "valor"; valor.id = `tono-valor${sufijoId}`;
      fila.append(etiqueta, valor);
      const slider = document.createElement("input");
      Object.assign(slider, { type: "range", id: `tono${sufijoId}`, min: -180, max: 180, step: 1, value: foto.tono });
      slider.addEventListener("input", () => alMoverTono(i, Number(slider.value)));
      control.append(fila, slider);
      if (n === 1) {
        const ayuda = document.createElement("p"); ayuda.className = "ayuda";
        ayuda.textContent = "Gira los colores de la foto. El sonido cambia con ellos.";
        control.append(ayuda);
      }

      const acciones = document.createElement("div"); acciones.className = "acciones-foto";
      const reset = boton(n > 1 ? "Tono original" : "Volver al tono original", () => { slider.value = 0; alMoverTono(i, 0); });
      if (i === 0) reset.id = "tono-reset";
      const cambiar = boton("Cambiar foto", () => { reemplazar = i; $("archivo-cambio").click(); });
      if (i === 0) cambiar.id = "otra";
      acciones.append(reset, cambiar);
      let silenciar = null;
      if (n > 1) {
        silenciar = boton(foto.silenciada ? "Activar" : "Silenciar", () => alternarSilencio(i));
        silenciar.setAttribute("aria-pressed", String(foto.silenciada));
        acciones.append(silenciar, boton("Quitar", () => quitarFoto(i)));
      }

      const aviso = document.createElement("p"); aviso.className = "aviso"; aviso.hidden = true;
      if (i === 0) aviso.id = "aviso-acromatico";

      t.append(marco, control, acciones, aviso);
      if (foto.silenciada) t.classList.add("silenciada");
      caja.append(t);
      // "Complementar": solo se muestra en la tarjeta que hace la contramelodía
      let complementar = null;
      if (n > 1) {
        complementar = document.createElement("button");
        complementar.type = "button";
        complementar.className = "boton complementar";
        complementar.textContent = "Complementar";
        complementar.title = "Gira esta foto al color opuesto al de la melodía";
        complementar.hidden = true;
        complementar.addEventListener("click", () => complementarFoto(i));
        t.insertBefore(complementar, acciones.nextSibling);
      }
      foto.dom = { tarjeta: t, lienzo, slider, valor, aviso, silenciar, complementar, papel: t.querySelector(".papel") };
    });

    const lleno = n >= MAX_FOTOS;
    $("agregar").hidden = lleno;
    $("agregar-ayuda").textContent = lleno
      ? `Ya tienes ${MAX_FOTOS} fotos, el máximo para una armonía.`
      : n === 1 ? "Suma hasta 3 fotos y suenan juntas, como una armonía." : `Puedes sumar ${MAX_FOTOS - n === 1 ? "una foto más" : `${MAX_FOTOS - n} fotos más`}.`;
    $("titulo-lectura").textContent = n > 1 ? "Así suena tu armonía" : "Así suena tu foto";
    $("titulo-roll").textContent = n > 1 ? "Escucha la armonía" : "Escúchala";
  }

  function dibujarFoto(i) {
    const f = estado.fotos[i];
    const vista = new ImageData(f.original.width, f.original.height);
    rotarMatiz(f.original, vista, f.tono);
    f.dom.lienzo.getContext("2d").putImageData(vista, 0, 0);
  }

  /**
   * Gira el tono de la foto i para que su color dominante quede justo al frente
   * (180°) del de la melodía. Al girar el matiz de todos los píxeles, el matiz
   * dominante gira exactamente lo mismo, así que el cálculo es directo.
   */
  function complementarFoto(i) {
    const voces = estado.comp && estado.comp.datos && estado.comp.datos.voces;
    if (!voces) return;
    const m = voces.findIndex((v) => v.papel === "melodía");
    if (m < 0 || m === i) return;
    const objetivo = estado.fotos[m].analisis.matiz + 180;
    const f = estado.fotos[i];
    const base = f.analisis.matiz - f.tono; // su matiz con el tono en 0
    const tono = Math.round(((((objetivo - base) % 360) + 540) % 360) - 180);
    f.dom.slider.value = tono;
    alMoverTono(i, tono);
    alertaEstado(`La foto ${i + 1} quedó en el color opuesto al de la melodía (tono ${tono > 0 ? "+" : ""}${tono}°).`);
  }

  function alternarSilencio(i) {
    const f = estado.fotos[i];
    f.silenciada = !f.silenciada;
    f.dom.tarjeta.classList.toggle("silenciada", f.silenciada);
    f.dom.silenciar.textContent = f.silenciada ? "Activar" : "Silenciar";
    f.dom.silenciar.setAttribute("aria-pressed", String(f.silenciada));
    roll.fijar(estado.comp, silenciadas());
    roll.posicion(Sonido.posicion() ?? posicionPausa);
    if (Sonido.posicion() !== null) reproducir(Sonido.posicion());
  }

  const silenciadas = () => new Set(estado.fotos.map((f, i) => (f.silenciada ? i : -1)).filter((i) => i >= 0));
  // lo que suena: la composición sin las fotos silenciadas
  const audible = (comp) => {
    const s = silenciadas();
    return s.size ? { ...comp, notas: comp.notas.filter((n) => !s.has(n.voz)) } : comp;
  };

  // --- Tono -------------------------------------------------------------------------
  let cuadroPendiente = new Set();
  let reinicio = null;
  function alMoverTono(i, valor) {
    estado.fotos[i].tono = valor;
    // en pausa, cambiar un color es una pieza nueva: la próxima reproducción arranca desde el inicio
    if (Sonido.posicion() === null) posicionPausa = 0;
    if (!cuadroPendiente.size) {
      requestAnimationFrame(() => {
        cuadroPendiente.forEach(dibujarFoto);
        cuadroPendiente.clear();
        recomponer();
      });
    }
    cuadroPendiente.add(i);
    // si está sonando, la pieza nueva vuelve a empezar desde el inicio. Se espera
    // un momento a que el slider se quede quieto, para no reiniciar en cada paso del arrastre.
    if (Sonido.posicion() !== null) {
      clearTimeout(reinicio);
      reinicio = setTimeout(() => {
        if (Sonido.posicion() !== null) reproducir(0);
      }, 220);
    }
  }

  // --- Núcleo: analizar y componer ---------------------------------------------
  function recomponer() {
    if (!estado.fotos.length) return;
    estado.fotos.forEach((f) => {
      f.grilla = new ImageData(GRILLA, GRILLA);
      rotarMatiz(f.grillaOriginal, f.grilla, f.tono);
      f.analisis = analizar(f.grilla);
    });
    estado.comp = componerArmonia(estado.fotos.map((f) => f.analisis));
    // la familia de color de cada foto en su tono original, para explicar los giros
    estado.fotos.forEach((f, i) => {
      if (f.tono === 0) {
        f.familiaOriginal = f.analisis.colorido >= UMBRAL_ACROMATICO ? familiaDe(f.analisis.matiz).nombre : null;
      }
      f.indice = i;
    });

    pintarColores();
    pintarLectura();
    pintarExplicacion();
    roll.fijar(estado.comp, silenciadas());
    if (Sonido.posicion() === null) roll.posicion(posicionPausa > estado.comp.duracion ? 0 : posicionPausa);
    actualizarTiempo(Sonido.posicion() ?? posicionPausa);
  }

  // --- Colores de la página: salen de las fotos ---------------------------------
  const raiz = document.documentElement.style;
  const css = (c) => `rgb(${c.map((v) => Math.round(v)).join(",")})`;
  const luminancia = (c) => {
    const l = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2];
  };
  const sobre = (c) => (luminancia(c) > 0.22 ? "#1F2022" : "#ECEDEA");

  /** Cuatro colores de una o varias grillas, de afuera hacia adentro (como los cuadrados de Albers). */
  function paleta(grillas, acromatica) {
    const n = grillas.length * GRILLA * GRILLA;
    if (acromatica) {
      const lums = [];
      grillas.forEach(({ data: d }) => { for (let i = 0; i < d.length; i += 4) lums.push(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]); });
      lums.sort((a, b) => a - b);
      return [0.85, 0.6, 0.35, 0.1].map((q) => { const v = lums[Math.floor(q * (n - 1))]; return [v, v, v]; });
    }
    // 12 cajas de matiz, cada píxel vota con su croma; aparte, el promedio de los grises
    const cajas = Array.from({ length: 12 }, () => ({ p: 0, r: 0, g: 0, b: 0 }));
    const neutro = { p: 0, r: 0, g: 0, b: 0 };
    grillas.forEach(({ data: d }) => {
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i], g = d[i + 1], b = d[i + 2];
        const croma = (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
        const destino = croma < 0.12 ? neutro : cajas[Math.floor(window.Analisis.rgbAHsv(r / 255, g / 255, b / 255)[0] / 30) % 12];
        const p = croma < 0.12 ? 1 : croma;
        destino.p += p; destino.r += r * p; destino.g += g * p; destino.b += b * p;
      }
    });
    const color = (c) => [c.r / c.p, c.g / c.p, c.b / c.p];
    const orden = cajas.filter((c) => c.p > 0).sort((a, b) => b.p - a.p).map(color);
    const fondo = neutro.p > n * 0.15 ? color(neutro) : null;
    const cuatro = [];
    if (fondo) cuatro.push(fondo);
    cuatro.push(...orden.slice(0, 4 - cuatro.length).reverse()); // del menos frecuente (afuera) al dominante (centro)
    while (cuatro.length < 4) {
      const base = cuatro[cuatro.length - 1] || [128, 128, 128];
      cuatro.unshift(base.map((v) => v + (236 - v) * 0.45));
    }
    return cuatro;
  }

  function pista(matizActual, tono, acromatica) {
    if (acromatica) return "linear-gradient(to right, #8a8b87, #8a8b87)";
    const base = matizActual - tono;
    const paradas = [];
    for (let k = -180; k <= 180; k += 30) paradas.push(`hsl(${(((base + k) % 360) + 360) % 360}, 72%, 52%)`);
    return `linear-gradient(to right, ${paradas.join(", ")})`;
  }

  function pintarColores() {
    const comp = estado.comp;
    const c = paleta(estado.fotos.map((f) => f.grilla), comp.modo === "acromatico");
    ["--c1", "--c2", "--c3", "--c4"].forEach((v, i) => raiz.setProperty(v, css(c[i])));
    raiz.setProperty("--tono", css(c[3]));
    raiz.setProperty("--sobre-tono", sobre(c[3]));
    // cada tarjeta lleva su propio color y la pista de su slider:
    // la pista muestra el color dominante que tendría esa foto en cada posición
    estado.fotos.forEach((f) => {
      const acro = f.analisis.colorido < UMBRAL_ACROMATICO;
      const propio = paleta([f.grilla], acro)[3];
      f.dom.tarjeta.style.setProperty("--tono", css(propio));
      f.dom.tarjeta.style.setProperty("--sobre-tono", sobre(propio));
      f.dom.slider.style.setProperty("--pista", pista(f.analisis.matiz, f.tono, acro));
      f.dom.valor.textContent = `${f.tono > 0 ? "+" : ""}${f.tono}°`;
      // el papel depende del color de todas las fotos (una foto sin color es "pulso")
      if (f.dom.papel && comp.datos && comp.datos.voces) {
        const papel = comp.datos.voces[estado.fotos.indexOf(f)].papel;
        f.dom.papel.textContent = papel.charAt(0).toUpperCase() + papel.slice(1);
        if (f.dom.complementar) f.dom.complementar.hidden = papel !== "contramelodía";
      }
    });
  }

  function pintarExplicacion() {
    const textos = window.Explicacion.redactar(estado.comp, estado.fotos.map((f) => ({ tono: f.tono, familiaOriginal: f.familiaOriginal })));
    $("por-que-texto").replaceChildren(...textos.map((t) => {
      const p = document.createElement("p");
      p.textContent = t;
      return p;
    }));
  }

  function describirColorido(c) {
    if (c < UMBRAL_ACROMATICO) return "casi sin color";
    if (c < 33) return "poco colorida";
    if (c < 45) return "moderadamente colorida";
    if (c < 59) return "bastante colorida";
    if (c < 82) return "muy colorida";
    return "extremadamente colorida";
  }

  function pintarLectura() {
    const comp = estado.comp;
    const varias = estado.fotos.length > 1;
    const a = estado.fotos[0].analisis;
    const lectura = comp.lectura || { colorido: a.colorido, matiz: a.matiz };
    const acromatica = comp.modo === "acromatico";

    $("m-colorido").textContent = lectura.colorido.toFixed(0);
    $("m-colorido-txt").textContent = varias
      ? `promedio de ${estado.fotos.length} fotos`
      : describirColorido(lectura.colorido);
    $("b-colorido").style.width = `${Math.min(100, lectura.colorido)}%`;
    $("m-matiz").textContent = acromatica ? "—" : `${Math.round(lectura.matiz)}°`;
    $("m-familia").textContent = acromatica ? "sin matiz" : familiaDe(lectura.matiz).nombre + (varias ? " (promedio)" : "");
    $("m-matiz-chip").style.background = acromatica ? "#8a8b87" : `hsl(${lectura.matiz}, 80%, 50%)`;
    $("b-temp").style.left = `${((comp.temperatura + 1) / 2) * 100}%`;

    $("r-mundo").textContent = comp.resumen.mundo;
    $("r-tonalidad").textContent = comp.resumen.tonalidad;
    $("r-instrumentos").textContent = comp.resumen.instrumentos;
    $("r-tempo").textContent = acromatica
      ? `Pulso fijo cada ${Math.round(comp.paso * 1000)} ms, ${Math.round(comp.duracion)} segundos`
      : `${comp.bpm} bpm, ${Math.round(comp.duracion)} segundos`;
    $("r-textura").textContent = comp.resumen.textura;

    // avisos por foto sin color
    estado.fotos.forEach((f) => {
      const sinColor = f.analisis.colorido < UMBRAL_ACROMATICO;
      f.dom.aviso.hidden = !sinColor;
      if (!sinColor) return;
      if (!varias) {
        f.dom.aviso.textContent = f.tono === 0
          ? `Tu foto casi no tiene color (colorido ${f.analisis.colorido.toFixed(0)}, por debajo de ${UMBRAL_ACROMATICO}), así que suena con senos puros y clics, sin instrumentos. Mover el tono no la cambia porque no hay matices que girar. Prueba con una foto a color para escuchar instrumentos.`
          : "Sigue casi sin color: girar el tono no crea color, solo lo mueve.";
      } else {
        f.dom.aviso.textContent = acromatica
          ? "Sin color: suena como una capa de senos puros."
          : "Sin color: en la armonía aporta un pulso de senos afinados y clics, y no vota en la tonalidad.";
      }
    });
  }

  // --- Transporte --------------------------------------------------------------
  let animacion = null;

  async function reproducir(desde = 0) {
    if (!estado.comp) return;
    const comp = estado.comp;
    if (desde >= comp.duracion) desde = 0;
    $("play").textContent = "Detener";
    alertaEstado("Cargando instrumentos…");
    sonando = comp;
    await Sonido.reproducir(audible(comp), desde);
    alertaEstado(Sonido.sinSamples.length ? "No se pudieron cargar los instrumentos: suena un sintetizador de respaldo." : "");
    cancelAnimationFrame(animacion);
    const cuadro = () => {
      const p = Sonido.posicion();
      if (p === null) return;
      const fin = sonando.duracion + 0.3;
      if (p >= fin) { detener(); posicionPausa = 0; roll.posicion(0); actualizarTiempo(0); return; }
      roll.posicion(Math.max(0, Math.min(p, sonando.duracion)));
      actualizarTiempo(p);
      animacion = requestAnimationFrame(cuadro);
    };
    animacion = requestAnimationFrame(cuadro);
  }

  function detener() {
    const p = Sonido.posicion();
    Sonido.detener();
    cancelAnimationFrame(animacion);
    if (p !== null) posicionPausa = Math.min(p, estado.comp ? estado.comp.duracion : 0);
    $("play").textContent = "Reproducir";
    if (estado.comp) roll.posicion(posicionPausa);
  }

  $("play").addEventListener("click", () => {
    if (Sonido.posicion() !== null) detener();
    else reproducir(posicionPausa);
  });
  document.addEventListener("keydown", (e) => {
    if (e.code === "Space" && !$("taller").hidden && !/INPUT|TEXTAREA|BUTTON/.test(document.activeElement.tagName)) {
      e.preventDefault(); $("play").click();
    }
  });

  function actualizarTiempo(p) {
    const d = estado.comp ? estado.comp.duracion : 0;
    $("tiempo").textContent = `${Math.max(0, Math.min(p || 0, d)).toFixed(1)} / ${d.toFixed(1)} s`;
  }

  function alertaEstado(t) { $("estado").textContent = t; }

  // --- Descargas ---------------------------------------------------------------
  function descargar(blob, nombre) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = nombre;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  const grados = (t) => `${t > 0 ? "+" : ""}${t}`;
  function nombreArchivo() {
    const f = estado.fotos;
    if (f.length === 1) return f[0].nombre + (f[0].tono ? `_tono${grados(f[0].tono)}` : "");
    const base = `armonia_${f.map((x) => x.nombre).join("+")}`.slice(0, 80);
    return f.some((x) => x.tono) ? `${base}_tonos${f.map((x) => grados(x.tono)).join("_")}` : base;
  }

  $("wav").addEventListener("click", async () => {
    if (!estado.comp) return;
    const b = $("wav");
    b.disabled = true; alertaEstado("Generando audio…");
    try {
      const buf = await Sonido.renderizar(audible(estado.comp));
      descargar(Sonido.aWav(buf), `${nombreArchivo()}.wav`);
      alertaEstado("Audio descargado.");
    } catch (err) {
      alertaEstado("No se pudo generar el audio. Intenta de nuevo.");
      console.error(err);
    } finally { b.disabled = false; }
  });

  $("mid").addEventListener("click", () => {
    if (!estado.comp) return;
    const titulo = estado.fotos.length > 1 ? "retrato sonoro: armonia" : `retrato sonoro: ${estado.fotos[0].nombre}`;
    descargar(window.Midi.exportarMidi(audible(estado.comp), titulo), `${nombreArchivo()}.mid`);
    alertaEstado("MIDI descargado.");
  });

  // Para pruebas desde la consola
  window.RetratoSonoro = { estado, recomponer, alMoverTono, quitarFoto, alternarSilencio, complementarFoto };
})();
