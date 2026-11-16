"""Servidor de CampusGraph. Los datos viven únicamente en memoria."""

from threading import RLock

from flask import Flask, g, jsonify, render_template, request
from werkzeug.exceptions import HTTPException

from grafo import crear_campus, crear_dependencias


def create_app():
    app = Flask(__name__)
    app.json.ensure_ascii = False
    app.json.sort_keys = False
    app.config["MAX_CONTENT_LENGTH"] = 16 * 1024
    grafos = {"campus": crear_campus(), "dependencias": crear_dependencias()}
    bloqueo = RLock()

    # Una solicitud modifica o consulta el grafo completo sin intercalarse con otra.
    @app.before_request
    def proteger_datos():
        if request.path.startswith("/api/"):
            bloqueo.acquire()
            g.bloqueo_adquirido = True

    @app.teardown_request
    def liberar_datos(error=None):
        if g.pop("bloqueo_adquirido", False):
            bloqueo.release()

    @app.errorhandler(ValueError)
    def error_validacion(error):
        return jsonify(error=str(error)), 400

    @app.errorhandler(HTTPException)
    def error_http(error):
        mensajes = {
            400: "La solicitud contiene un JSON inválido.",
            404: "La dirección solicitada no existe.",
            405: "El método HTTP no está permitido para esta dirección.",
            413: "La solicitud es demasiado grande.",
            415: "Envía los datos como application/json.",
        }
        return jsonify(error=mensajes.get(error.code, "No se pudo procesar la solicitud.")), error.code

    def datos_json():
        datos = request.get_json()
        if not isinstance(datos, dict):
            raise ValueError("Envía un objeto JSON con los campos solicitados.")
        return datos

    def gestionar_vertices(tipo):
        datos = datos_json()
        grafo = grafos[tipo]
        if request.method == "POST":
            grafo.agregar_vertice(datos.get("nombre"))
        else:
            grafo.eliminar_vertice(datos.get("nombre"))
        return jsonify(grafo.datos()), 201 if request.method == "POST" else 200

    def gestionar_aristas(tipo):
        datos = datos_json()
        grafo = grafos[tipo]
        if request.method == "POST":
            grafo.agregar_arista(datos.get("origen"), datos.get("destino"))
        else:
            grafo.eliminar_arista(datos.get("origen"), datos.get("destino"))
        return jsonify(grafo.datos()), 201 if request.method == "POST" else 200

    @app.get("/")
    def index():
        return render_template("index.html")

    @app.get("/api/grafo")
    def consultar_grafo():
        return jsonify(grafos["campus"].datos())

    @app.route("/api/vertices", methods=["POST", "DELETE"])
    def vertices():
        return gestionar_vertices("campus")

    @app.route("/api/conexiones", methods=["POST", "DELETE"])
    def conexiones():
        return gestionar_aristas("campus")

    @app.get("/api/ruta")
    def ruta_bfs():
        return jsonify(grafos["campus"].bfs(request.args.get("origen"), request.args.get("destino")))

    @app.get("/api/recorrido")
    def recorrido_dfs():
        return jsonify(grafos["campus"].dfs(request.args.get("inicio")))

    @app.post("/api/restaurar")
    def restaurar_campus():
        grafos["campus"] = crear_campus()
        return jsonify(grafos["campus"].datos())

    @app.get("/api/dependencias")
    def consultar_dependencias():
        return jsonify(grafos["dependencias"].datos())

    @app.route("/api/dependencias/asignaturas", methods=["POST", "DELETE"])
    def asignaturas():
        return gestionar_vertices("dependencias")

    @app.route("/api/dependencias/conexiones", methods=["POST", "DELETE"])
    def dependencias():
        return gestionar_aristas("dependencias")

    @app.get("/api/dependencias/orden")
    def orden_academico():
        return jsonify(grafos["dependencias"].orden_topologico())

    @app.post("/api/dependencias/restaurar")
    def restaurar_dependencias():
        grafos["dependencias"] = crear_dependencias()
        return jsonify(grafos["dependencias"].datos())

    return app


app = create_app()

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=False)
