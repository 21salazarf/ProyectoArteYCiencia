"""
Reproductor simple de archivos MIDI
------------------------------------
Usa el sintetizador MIDI del sistema (en Windows: Microsoft GS Wavetable
Synth), así que no necesita soundfonts ni instalar nada adicional.

Uso:
    python reproducir.py midis/perrubi1.mid

Requiere:
    pip install pygame --break-system-packages
"""

import sys
import pygame


def reproducir_midi(ruta_midi):
    pygame.mixer.init()
    pygame.mixer.music.load(ruta_midi)
    pygame.mixer.music.play()

    print(f"Reproduciendo: {ruta_midi}  (Ctrl+C para detener)")

    try:
        while pygame.mixer.music.get_busy():
            pygame.time.Clock().tick(10)
    except KeyboardInterrupt:
        pygame.mixer.music.stop()
        print("\nDetenido.")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso: python reproducir.py ruta/al/archivo.mid")
        sys.exit(1)

    reproducir_midi(sys.argv[1])