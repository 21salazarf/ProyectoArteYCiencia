"""
Selfie -> CSV (opcional) -> MIDI
Convierte una imagen (selfie) en un archivo MIDI, mapeando el brillo
de cada fila de píxeles a una nota musical.

Uso:
    python selfie_a_midi.py entrada.jpg salida.mid

Requiere:
    pip install pillow numpy midiutil --break-system-packages
"""

import sys
import numpy as np
from PIL import Image
from midiutil import MIDIFile


def imagen_a_matriz(ruta_imagen, tamano=(64, 64)):
    """Carga una imagen, la pasa a escala de grises y la reduce a una matriz NxN."""
    img = Image.open(ruta_imagen).convert("L")  # L = escala de grises (0-255)
    img = img.resize(tamano)
    return np.array(img)


def guardar_csv(matriz, ruta_csv):
    """Guarda la matriz de píxeles como CSV, por si la quieren usar en TwoTone u otra herramienta."""
    np.savetxt(ruta_csv, matriz, delimiter=",", fmt="%d")


def matriz_a_midi(matriz, ruta_midi, nota_base=40, rango_notas=48, duracion_nota=0.25, tempo=120):
    """
    Convierte la matriz de brillo en un archivo MIDI.
    Cada fila de la imagen se convierte en una nota:
      - el promedio de brillo de la fila define el pitch
      - la desviación estándar define la velocity (volumen/intensidad)
    """
    midi = MIDIFile(1)
    pista, canal, tiempo = 0, 0, 0
    midi.addTempo(pista, tiempo, tempo)

    for i, fila in enumerate(matriz):
        promedio = float(np.mean(fila))
        variabilidad = float(np.std(fila))

        # Mapear brillo (0-255) a un rango de notas MIDI (0-127)
        pitch = int(nota_base + (promedio / 255) * rango_notas)
        pitch = max(0, min(127, pitch))

        # Mapear variabilidad a velocity (intensidad de la nota)
        velocity = int(60 + (variabilidad / 128) * 60)
        velocity = max(1, min(127, velocity))

        momento = i * duracion_nota
        midi.addNote(pista, canal, pitch, momento, duracion_nota, velocity)

    with open(ruta_midi, "wb") as f:
        midi.writeFile(f)


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Uso: python selfie_a_midi.py entrada.jpg salida.mid [salida.csv]")
        sys.exit(1)

    ruta_entrada = sys.argv[1]
    ruta_midi = sys.argv[2]
    ruta_csv = sys.argv[3] if len(sys.argv) > 3 else None

    matriz = imagen_a_matriz(ruta_entrada)

    if ruta_csv:
        guardar_csv(matriz, ruta_csv)
        print(f"CSV guardado en: {ruta_csv}")

    matriz_a_midi(matriz, ruta_midi)
    print(f"MIDI guardado en: {ruta_midi}")