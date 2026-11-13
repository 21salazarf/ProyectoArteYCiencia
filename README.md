# Retrato sonoro

Proyecto del curso **Arte y Ciencia**, con Ryoji Ikeda como caso de estudio. La página toma una foto a color y la convierte en música. El color, el tono y la luz de la foto deciden cómo suena.

Todo ocurre en el navegador: la foto nunca se sube a un servidor.

## Cómo correrlo

```bash
python servidor.py
```

Se abre `http://127.0.0.1:8000` (o el siguiente puerto libre; la terminal dice cuál). Deja esa terminal abierta mientras usas la página. No basta con hacer doble clic en `index.html`, porque el navegador bloquea la carga de los samples desde archivos locales.

### Publicarlo en internet (gratis, con GitHub Pages)

1. Sube los cambios a GitHub (`git add .`, `git commit`, `git push`).
2. En el repositorio: **Settings → Pages → Source: Deploy from a branch → `main` / `(root)`**.
3. En un par de minutos queda en `https://21salazarf.github.io/ProyectoArteYCiencia/`.

## Qué hace

1. La persona acepta los **términos y condiciones**. Hasta entonces no puede subir nada.
2. Sube una foto. La página la reduce a 64 × 64 píxeles para analizarla.
3. Cada fila de la foto, de arriba abajo, es un instante de la música.
4. El **slider de tono** rota el matiz de la foto. Lo que se ve es exactamente lo que se analiza, así que el sonido cambia con ella.
5. El **teclado** (piano roll) muestra las notas. Cada nota se pinta con el color que la produjo y las teclas se encienden mientras suena.
6. Un texto, **Por qué suena así**, explica para cada foto de dónde salen la tonalidad, el modo, los instrumentos, el tempo y la textura, con los números de esa foto. Se actualiza al mover el tono.
7. Se puede descargar el audio (`.wav`) y la partitura (`.mid`, una pista por instrumento).

## Armonía: hasta 3 fotos juntas

Con el botón **Agregar otra foto**, o eligiendo varias de una vez, se suman hasta 3 fotos que suenan juntas:

- **Una tonalidad común.** Sale del promedio circular de los matices, y cada foto pesa según su colorido. Mover el tono de cualquier foto mueve la tonalidad de todas.
- **Un tempo común.** La fila 1 de todas las fotos suena al mismo tiempo.
- **Un papel por foto con color, cada uno en su registro:** melodía (agudo, nota a nota), contramelodía (medio, una nota cada dos filas) y bajo con acordes (grave, cada cuatro filas). Con dos fotos con color, los papeles son melodía y bajo con acordes.
- **Cada foto conserva sus instrumentos y su carácter:** sus colores eligen los instrumentos, y si es cálida toca cortado y si es fría, ligado.
- **Una foto sin color** no vota en la tonalidad: aporta un pulso de senos agudos afinados y clics. Si ninguna foto tiene color, se forman capas de senos separadas por octavas.
- **Silenciar** apaga una foto del audio y de las descargas, sin cambiar la tonalidad.
- **El MIDI** trae una pista por foto e instrumento.

## Del color al sonido

Primero se mide el **colorido** con la métrica de Hasler y Süsstrunk (2003). Según ese valor, la foto cae en uno de dos mundos que no se parecen en nada:

| | Blanco y negro (colorido < 15) | Con color |
|---|---|---|
| Timbre | senos puros y clics de ruido | instrumentos reales (samples) |
| Afinación | frecuencias continuas, sin escala | escala y tónica según el matiz |
| Ritmo | pulso fijo de 160 ms | tempo según colorido y temperatura |
| Textura | una sola voz | melodía, acordes y bajo |

En una foto con color:

| Rasgo de la foto | Qué controla |
|---|---|
| Matiz dominante | **Tónica**: el círculo de colores se recorre como el círculo de quintas, a la manera de Scriabin (rojo → Do, naranja → Sol, amarillo → Re, verde → La…). |
| Matiz dominante | **Modo**: rojo frigio dominante, naranja mixolidio, amarillo mayor, verde pentatónica, cian dórico, azul menor, violeta frigio, magenta lidio. |
| Matiz de cada fila | **Instrumento**: rojo trompeta, naranja saxofón, amarillo marimba, verde flauta, cian cuerdas, azul violonchelo, violeta coro, magenta vibráfono. Las filas grises suenan en piano. |
| Colorido | Más tempo, acordes (tercera y quinta) y una línea de bajo. |
| Temperatura (naranja ↔ azul celeste) | Lo cálido es rápido y cortado. Lo frío es lento, ligado y con más reverberación. Si la foto tiene matices de todo el círculo, se considera *policromática* y no cuenta como ni fría ni cálida. |
| Brillo de la fila | Altura de la nota (dos octavas de la escala). |
| Contraste de la fila | Intensidad. Las filas planas y grises (un fondo liso, por ejemplo) quedan en silencio. |

## Estructura

```
index.html            la página
app/analisis.js       rotación de matiz y medidas de color
app/composicion.js    reglas del color a las notas
app/explicacion.js    redacta el texto "Por qué suena así"
app/audio.js          reproducción, reverberación y exportación a WAV
app/midi.js           exportación a MIDI
app/pianoroll.js      el teclado
app/main.js           la interfaz
app/estilos.css       estilos (estudio de color a la manera de Josef Albers)
app/fuentes/          tipografías incluidas, funcionan sin internet
samples/              notas grabadas de 9 instrumentos (≈3 MB)
servidor.py           lanzador local
fotoamidi.py          versión 1: de foto en escala de grises a MIDI (terminal)
reproducir.py         versión 1: reproductor de MIDI (terminal)
```

## Pendiente

- Completar `[nombres del equipo]` y `[correo del equipo]` en los términos (en `index.html`).
- Revisar el texto de los términos con el profesor.

## Créditos

- Samples: FluidR3_GM (Frank Wen), renderizados por [midi-js-soundfonts](https://github.com/gleitz/midi-js-soundfonts) (Benjamin Gleitzman). Licencia CC BY 3.0.
- Colorido: D. Hasler y S. Süsstrunk, *Measuring colourfulness in natural images* (2003).
- Tipografías: Bricolage Grotesque y Atkinson Hyperlegible Next, licencia SIL Open Font License.
- Diseño: los cuadrados de la portada siguen la serie *Homage to the Square* de Josef Albers y se pintan con los colores de la foto.
