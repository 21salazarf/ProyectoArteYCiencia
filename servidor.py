"""
Abre Retrato sonoro en el navegador.

Uso (desde la carpeta del proyecto):
    python servidor.py

La página necesita un servidor local (no basta con abrir index.html con doble
clic) porque carga los samples de instrumentos con fetch(). Este script sirve
la carpeta del proyecto y abre el navegador.

IMPORTANTE: deja esta terminal abierta mientras usas la página.
Para detenerlo: Ctrl+C.
"""

import errno
import http.server
import os
import threading
import webbrowser

HOST = "127.0.0.1"   # dirección IPv4 explícita (evita problemas con "localhost" e IPv6)
PUERTOS = range(8000, 8011)

CARPETA = os.path.dirname(os.path.abspath(__file__))


class Manejador(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=CARPETA, **kwargs)

    def log_message(self, *args):
        pass  # sin ruido en la terminal


def abrir_servidor():
    """Usa el primer puerto libre entre 8000 y 8010."""
    for puerto in PUERTOS:
        try:
            return http.server.ThreadingHTTPServer((HOST, puerto), Manejador), puerto
        except OSError as e:
            if e.errno in (errno.EADDRINUSE, 10048, 10013):  # 10048/10013: puerto ocupado en Windows
                print(f"El puerto {puerto} está ocupado, pruebo el siguiente…")
                continue
            raise
    raise SystemExit("No encontré un puerto libre entre 8000 y 8010. Cierra otros servidores e intenta de nuevo.")


if __name__ == "__main__":
    if not os.path.exists(os.path.join(CARPETA, "index.html")):
        raise SystemExit(f"No encuentro index.html en {CARPETA}. ¿Está servidor.py dentro de la carpeta del proyecto?")

    servidor, puerto = abrir_servidor()
    url = f"http://{HOST}:{puerto}/"
    print()
    print(f"  Retrato sonoro está corriendo en  {url}")
    print("  Si el navegador no se abre solo, copia esa dirección.")
    print("  Deja esta terminal abierta. Para detenerlo: Ctrl+C")
    print()
    threading.Timer(0.8, lambda: webbrowser.open(url)).start()
    try:
        servidor.serve_forever()
    except KeyboardInterrupt:
        print("\nDetenido.")
    finally:
        servidor.server_close()
