/*
 * explicacion.js
 * --------------
 * Redacta, para cada foto, por qué suena como suena: qué color domina, por qué
 * eso da esa tonalidad, por qué esos instrumentos, ese tempo y esa textura.
 * Se escribe con los mismos números que usó la composición, así que el texto
 * siempre coincide con lo que se escucha. Con varias fotos explica además
 * de dónde sale la tonalidad común y qué papel cumple cada foto.
 */
(function () {
  "use strict";

  const { INSTRUMENTOS, FAMILIAS, UMBRAL_ACROMATICO } = window.Composicion;

  // tonos (masculino) y filas (femenino), en singular y plural
  const TONOS = { rojo: "rojos", naranja: "naranjas", amarillo: "amarillos", verde: "verdes", cian: "cian", azul: "azules", violeta: "violetas", magenta: "magenta" };
  const FILA = {
    rojo: ["roja", "rojas"], naranja: ["naranja", "naranjas"], amarillo: ["amarilla", "amarillas"], verde: ["verde", "verdes"],
    cian: ["cian", "cian"], azul: ["azul", "azules"], violeta: ["violeta", "violetas"], magenta: ["magenta", "magenta"],
    gris: ["casi gris", "casi grises"],
  };

  const MODOS = {
    "frigio dominante": "suena tenso y exótico, porque su segunda nota está a solo medio tono de la tónica",
    "mixolidio": "es mayor pero con la séptima rebajada, de carácter abierto y terroso",
    "mayor": "es el modo más luminoso y estable",
    "pentatónica": "usa solo cinco notas y ningún semitono, así que suena abierta y tranquila",
    "dórico": "es menor pero con la sexta alta: melancólico sin llegar a oscuro",
    "menor": "es el modo menor natural, de carácter oscuro",
    "frigio": "es menor y con la segunda nota a medio tono de la tónica: el más sombrío de todos",
    "lidio": "es mayor con la cuarta elevada, de sonido suspendido, casi de sueño",
  };

  // instrumento → familia de color que lo elige
  const FAMILIA_DE_INST = {};
  FAMILIAS.forEach((f) => { FAMILIA_DE_INST[f.instrumento] = f.nombre; });
  FAMILIA_DE_INST.piano = "gris";

  const enLista = (xs) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}`);
  const filas = (n, familia) => `${n} ${n === 1 ? "fila" : "filas"} ${FILA[familia][n === 1 ? 0 : 1]}`;
  const grados = (t) => `${t > 0 ? "+" : ""}${t}°`;

  function describirColorido(c) {
    if (c < UMBRAL_ACROMATICO) return "casi sin color";
    if (c < 33) return "poco colorida";
    if (c < 45) return "moderadamente colorida";
    if (c < 59) return "bastante colorida";
    if (c < 82) return "muy colorida";
    return "extremadamente colorida";
  }

  /**
   * Devuelve una lista de párrafos.
   * tono: grados girados con el slider; familiaOriginal: familia dominante con tono 0.
   */
  /**
   * fotos: [{ tono, familiaOriginal }] en el mismo orden que la composición.
   */
  function redactar(comp, fotos) {
    if (comp.armonia) return armonia(comp, fotos);
    const f = fotos[0] || {};
    return comp.modo === "acromatico" ? acromatico(comp, f.tono) : tonal(comp, f.tono, f.familiaOriginal);
  }

  function acromatico(comp, tono) {
    const d = comp.datos;
    const p = [];
    p.push(`Tu foto casi no tiene color: su colorido es de ${Math.round(d.colorido)}, por debajo del umbral de ${UMBRAL_ACROMATICO}. Sin matices no hay color que elija una tonalidad ni instrumentos, así que suena en un mundo aparte, el acromático.` + (tono ? " Girar el tono no cambia nada, porque no hay color que girar." : ""));
    p.push("Cada fila de la foto es un seno puro, la onda más simple que existe. Su frecuencia sale directamente del brillo de la fila, entre 55 y 3520 Hz, sin ajustarse a ninguna escala: por eso en el teclado las notas caen entre las teclas. Las filas claras suenan agudas y las oscuras, graves.");
    const partes = [];
    if (d.clics) partes.push(`${d.clics === 1 ? "La fila" : `Las ${d.clics} filas`} con más contraste ${d.clics === 1 ? "añade" : "añaden"} un clic de ruido y un destello agudo`);
    if (d.silencios) partes.push(`${d.silencios === 1 ? "la fila plana queda" : `las ${d.silencios} filas planas quedan`} en silencio`);
    p.push((partes.length ? `${enLista(partes)}. ` : "").replace(/^./, (c) => c.toUpperCase()) +
      `Todo va sobre un pulso fijo cada ${Math.round(comp.paso * 1000)} ms. Es la estética de Ryoji Ikeda: datos convertidos en sonido casi sin traducción.`);
    return p;
  }

  function tonal(comp, tono, familiaOriginal) {
    const d = comp.datos;
    const tonos = TONOS[d.familia];
    const p = [];

    // 1. Color dominante → tonalidad
    let uno = "";
    if (tono && familiaOriginal && familiaOriginal !== d.familia) {
      uno += `Con el tono girado ${grados(tono)}, los tonos ${TONOS[familiaOriginal]} de tu foto pasaron a ser ${tonos}, y la música cambió con ellos. `;
    }
    uno += d.policromatica
      ? `Tu foto tiene colores de casi todo el círculo cromático, pero al promediarlos ganan los tonos ${tonos} (matiz de ${Math.round(d.matiz)}°). `
      : `En tu foto predominan los tonos ${tonos} (matiz de ${Math.round(d.matiz)}°). `;
    uno += `Por eso suena en ${d.tonica} ${d.escala}. La tónica, ${d.tonica}, sale del círculo de colores de Scriabin, que asigna a cada color una nota recorriendo el círculo de quintas. ` +
      `${d.escala === "pentatónica" ? "La escala pentatónica" : `El modo ${d.escala}`} es ${d.escala === "pentatónica" ? "la" : "el"} que corresponde a los tonos ${tonos}: ${MODOS[d.escala]}.`;
    p.push(uno);

    // 2. Color de cada fila → instrumento
    const orden = Object.entries(d.filasPorInst).sort((a, b) => b[1] - a[1]);
    const lista = orden.map(([inst, n]) => `${INSTRUMENTOS[inst].nombre} en ${filas(n, FAMILIA_DE_INST[inst])}`);
    let dos = "Cada fila de la foto toca con el instrumento de su propio color. Los tonos cálidos van a instrumentos brillantes (rojo a trompeta, naranja a saxofón, amarillo a marimba), los fríos a cuerdas y voces (cian a cuerdas, azul a violonchelo, violeta a coro), el verde a la flauta y el magenta al vibráfono. " +
      `En tu foto suena ${enLista(lista)}.`;
    if (orden.some(([inst]) => inst === "piano")) dos += " El piano toma las filas que casi no tienen color.";
    if (d.bajo) dos += " Como la foto es bastante colorida, un violonchelo grave añade un bajo que marca la tonalidad cada ocho filas.";
    p.push(dos);

    // 3. Colorido y temperatura → tempo, acordes y articulación
    let tres = `Su colorido es de ${Math.round(d.colorido)} (${describirColorido(d.colorido)}). Más color significa más energía: la pieza va a ${d.bpm} bpm`;
    if (d.triadas || d.dobles) {
      const ac = [];
      if (d.triadas) ac.push(`${d.triadas} ${d.triadas === 1 ? "fila muy saturada toca" : "filas muy saturadas tocan"} acordes de tres notas`);
      if (d.dobles) ac.push(`${d.dobles} ${d.dobles === 1 ? "fila toca" : "filas tocan"} dos notas a la vez`);
      tres += `, y ${enLista(ac)}.`;
    } else tres += ", y como ninguna fila es lo bastante saturada para tocar acordes, la melodía va sola.";
    if (d.policromatica) tres += " Como sus colores están repartidos por todo el círculo, no cuenta ni como fría ni como cálida, y las notas quedan en un punto medio entre cortas y ligadas.";
    else if (d.temperatura > 0.35) tres += " Además es una foto cálida: lo cálido acelera el tempo y hace las notas cortas y secas, casi sin eco.";
    else if (d.temperatura < -0.35) tres += " Además es una foto fría: lo frío frena el tempo y hace las notas largas y ligadas, con más eco. Cuando una nota se repite, se sostiene en lugar de volver a sonar.";
    else tres += " Su temperatura es templada, ni fría ni cálida, así que las notas quedan en un punto medio entre cortas y ligadas.";
    p.push(tres);

    // 4. Brillo → melodía, filas planas → silencio
    let cuatro = "La melodía sigue el brillo de la foto de arriba abajo: las filas claras suenan agudas y las oscuras, graves.";
    if (d.silencios) cuatro += ` ${d.silencios === 1 ? "Una fila plana y sin color, como un fondo liso, queda" : `${d.silencios} filas planas y sin color, como un fondo liso, quedan`} en silencio.`;
    p.push(cuatro);

    return p;
  }

  // --- Armonía (2 o 3 fotos) -------------------------------------------------
  const ORDINAL = ["foto 1", "foto 2", "foto 3"];
  const Mayus = (t) => t.charAt(0).toUpperCase() + t.slice(1);

  function giros(comp, fotos) {
    const frases = [];
    fotos.forEach((f, i) => {
      if (!f.tono) return;
      const v = comp.datos.voces[i];
      if (v && v.familia && f.familiaOriginal && f.familiaOriginal !== v.familia) {
        frases.push(`Giraste el tono de la ${ORDINAL[i]} (${grados(f.tono)}): sus tonos ${TONOS[f.familiaOriginal]} ahora son ${TONOS[v.familia]}, y eso también movió la tonalidad común.`);
      } else if (v && !v.acromatica) {
        frases.push(`Giraste el tono de la ${ORDINAL[i]} (${grados(f.tono)}), lo que corre un poco el promedio de colores.`);
      }
    });
    return frases.join(" ");
  }

  function instrumentosDe(v) {
    const orden = Object.entries(v.filasPorInst).sort((a, b) => b[1] - a[1]);
    return enLista(orden.map(([inst, n]) => `${INSTRUMENTOS[inst].nombre} (${filas(n, FAMILIA_DE_INST[inst])})`));
  }

  function armonia(comp, fotos) {
    const d = comp.datos;
    const n = d.voces.length;
    const p = [];
    const g = giros(comp, fotos);

    if (comp.modo === "acromatico") {
      p.push((g ? g + " " : "") + `Ninguna de tus ${n} fotos tiene color, así que la armonía suena en el mundo acromático: no hay color que elija una tonalidad ni instrumentos.`);
      p.push(`Cada foto es una capa de senos puros cuya frecuencia sale directamente de su brillo, sin ajustarse a ninguna escala. Para que se distingan, las capas están separadas por octavas: la foto 2 suena una octava más grave${n > 2 ? " y la foto 3 una octava más aguda" : ""}. Juntas forman un acorde microtonal que cambia fila a fila.`);
      p.push(`Todo va sobre un pulso fijo cada ${Math.round(comp.paso * 1000)} ms, con clics en las filas de más contraste. Es la estética de Ryoji Ikeda: datos convertidos en sonido casi sin traducción.`);
      return p;
    }

    // 1. Tonalidad común
    const tonos = TONOS[d.familia];
    const aportes = d.voces.map((v, i) => (v.acromatica ? null : `la ${ORDINAL[i]} aporta tonos ${TONOS[v.familia]} (${Math.round(v.peso * 100)} %)`)).filter(Boolean);
    const mudas = d.voces.map((v, i) => (v.acromatica ? ORDINAL[i] : null)).filter(Boolean);
    let uno = g ? g + " " : "";
    uno += `Tu armonía junta ${n} fotos, y todas tocan en una misma tonalidad para sonar juntas sin chocar. Esa tonalidad sale del promedio de sus colores, donde cada foto pesa según qué tan colorida es: ${enLista(aportes)}.`;
    if (mudas.length) uno += ` La ${enLista(mudas)} no ${mudas.length === 1 ? "tiene" : "tienen"} color, así que no vota.`;
    uno += ` El promedio cae en los tonos ${tonos} (matiz de ${Math.round(d.matiz)}°), y por eso todo suena en ${d.tonica} ${d.escala}. La tónica sale del círculo de colores de Scriabin, y ${d.escala === "pentatónica" ? "la escala pentatónica" : `el modo ${d.escala}`} ${MODOS[d.escala]}.`;
    p.push(uno);

    // 2. Una frase por foto: su papel, su registro y sus instrumentos
    const papeles = d.voces.map((v, i) => {
      const quien = Mayus(ORDINAL[i]);
      if (v.acromatica) return `${quien} no tiene color, así que no toca instrumentos: aporta un pulso de senos agudos afinados en ${d.tonica} y clics en sus filas de más contraste, a la manera de Ryoji Ikeda.`;
      const ins = instrumentosDe(v);
      if (v.papel === "melodía") return `${quien} lleva la melodía en el registro agudo, nota a nota, con ${ins}.${v.acordes ? " En sus filas más saturadas toca acordes." : ""}`;
      if (v.papel === "contramelodía") return `${quien} hace la contramelodía en el registro medio: va más lenta, una nota cada dos filas, con ${ins}.`;
      return `${quien} sostiene el bajo y los acordes en el registro grave, una vez cada cuatro filas, con ${ins}.`;
    });
    // ¿La contramelodía está en el color opuesto a la melodía?
    const im = d.voces.findIndex((v) => v.papel === "melodía");
    const ic = d.voces.findIndex((v) => v.papel === "contramelodía");
    if (im >= 0 && ic >= 0) {
      const dif = Math.abs(((((d.voces[ic].matiz - d.voces[im].matiz) % 360) + 540) % 360) - 180);
      if (dif >= 150) {
        papeles.push(`La contramelodía está en el color opuesto al de la melodía (a ${Math.round(dif)}° en el círculo cromático). Por eso suena con otra familia de instrumentos y otro ritmo, y el oído la distingue mejor de las demás voces. Es el mismo principio del contraste complementario en la pintura: dos colores opuestos, juntos, se refuerzan.`);
      }
    }
    p.push("Cada foto toca con los instrumentos de sus propios colores, igual que cuando suena sola, pero en un registro distinto para que no se tapen. " + papeles.join(" "));

    // 3. Tempo y carácter de cada foto
    let tres = `Juntas tienen un colorido promedio de ${Math.round(d.colorido)}, así que la armonía va a ${d.bpm} bpm.`;
    const caracter = d.voces.map((v, i) => {
      if (v.acromatica) return null;
      if (v.temperatura > 0.35) return `la ${ORDINAL[i]}, cálida, toca notas cortas y secas`;
      if (v.temperatura < -0.35) return `la ${ORDINAL[i]}, fría, notas largas y ligadas`;
      return `la ${ORDINAL[i]}, templada, notas ni muy cortas ni muy ligadas`;
    }).filter(Boolean);
    if (caracter.length) tres += ` Cada foto conserva su carácter: ${caracter.join("; ")}.`;
    p.push(tres);

    p.push("Las fotos avanzan a la vez: la primera fila de todas suena al mismo tiempo, y cada melodía sigue el brillo de su foto de arriba abajo. Puedes silenciar una foto para escuchar cómo suenan las demás sin ella.");
    return p;
  }

  window.Explicacion = { redactar };
})();
