"""
Selfie -> CSV (opcional) -> MIDI
--------------------------------
Convierte una imagen (selfie) en un archivo MIDI, mapeando el brillo
de cada fila de píxeles a una nota musical.

Uso:
    python selfie_a_midi.py entrada.jpg salida.mid

Requiere:
    pip install pillow numpy midiutil --break-system-packages
"""

import os
import sys
import numpy as np
from PIL import Image
from midiutil import MIDIFile
X
# Instrumentos General MIDI más comunes (número de programa 0-127).
# Lista completa: https://en.wikipedia.org/wiki/General_MIDI#Program_change_events
INSTRUMENTOS = {
    "piano": 0,
    "trompeta": 56,
    "violin": 40,
    "flauta": 73,
    "organo": 19,
    "guitarra": 24,
    "bajo": 33,
    "cuerdas": 48,
    "voces": 52,
    "saxofon": 65,
    "clarinete": 71,
    "sintetizador": 80,
}


def imagen_a_matriz(ruta_imagen, tamano=(64, 64)):
    """Carga una imagen, la pasa a escala de grises y la reduce a una matriz NxN."""
    img = Image.open(ruta_imagen).convert("L")  # L = escala de grises (0-255)
    img = img.resize(tamano)
    return np.array(img)


def crear_carpeta_si_no_existe(ruta_archivo):
    """Crea la carpeta contenedora de un archivo si todavía no existe."""
    carpeta = os.path.dirname(ruta_archivo)
    if carpeta and not os.path.exists(carpeta):
        os.makedirs(carpeta)


def guardar_csv(matriz, ruta_csv):
    """Guarda la matriz de píxeles como CSV, por si la quieren usar en TwoTone u otra herramienta."""
    crear_carpeta_si_no_existe(ruta_csv)
    np.savetxt(ruta_csv, matriz, delimiter=",", fmt="%d")


def matriz_a_midi(matriz, ruta_midi, nota_base=40, rango_notas=48, duracion_nota=0.25, tempo=120, instrumento=0):
    """
    Convierte la matriz de brillo en un archivo MIDI.
    Cada fila de la imagen se convierte en una nota:
      - el promedio de brillo de la fila define el pitch
      - la desviación estándar define la velocity (volumen/intensidad)

    instrumento: número de programa General MIDI (0-127). Ver diccionario INSTRUMENTOS.
    """
    midi = MIDIFile(1)
    pista, canal, tiempo = 0, 0, 0
    midi.addTempo(pista, tiempo, tempo)
    midi.addProgramChange(pista, canal, tiempo, instrumento)

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

    crear_carpeta_si_no_existe(ruta_midi)
    with open(ruta_midi, "wb") as f:
        midi.writeFile(f)

# jaja como vas a ser mexicano ajadfklsjfklfja


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Uso: python selfie_a_midi.py entrada.jpg salida.mid [instrumento] [salida.csv]")
        print(f"Instrumentos disponibles: {', '.join(INSTRUMENTOS.keys())}")
        sys.exit(1)

    ruta_entrada = sys.argv[1]
    ruta_midi = sys.argv[2]
    nombre_instrumento = sys.argv[3] if len(sys.argv) > 3 else "piano"
    ruta_csv = sys.argv[4] if len(sys.argv) > 4 else None

    if nombre_instrumento not in INSTRUMENTOS:
        print(f"Instrumento '{nombre_instrumento}' no reconocido.")
        print(f"Instrumentos disponibles: {', '.join(INSTRUMENTOS.keys())}")
        sys.exit(1)

    numero_instrumento = INSTRUMENTOS[nombre_instrumento]

    matriz = imagen_a_matriz(ruta_entrada)

    if ruta_csv:
        guardar_csv(matriz, ruta_csv)
        print(f"CSV guardado en: {ruta_csv}")

    matriz_a_midi(matriz, ruta_midi, instrumento=numero_instrumento)
    print(f"MIDI guardado en: {ruta_midi} (instrumento: {nombre_instrumento})")