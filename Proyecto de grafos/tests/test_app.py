import json
import unittest

from app import create_app


class PruebasAPI(unittest.TestCase):
    def setUp(self):
        self.app = create_app()
        self.app.testing = True
        self.client = self.app.test_client()

    def test_pagina_y_archivos(self):
        for url in ["/", "/static/app.js", "/static/styles.css"]:
            with self.subTest(url=url):
                with self.client.get(url) as respuesta:
                    self.assertEqual(respuesta.status_code, 200)
        self.assertIn("CampusGraph", self.client.get("/").get_data(as_text=True))

    def test_consultar_grafo(self):
        respuesta = self.client.get("/api/grafo")
        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.json["total_vertices"], 6)
        self.assertEqual(respuesta.json["total_aristas"], 8)

    def test_crud_campus(self):
        self.assertEqual(self.client.post("/api/vertices", json={"nombre": "Gimnasio"}).status_code, 201)
        datos = {"origen": "Gimnasio", "destino": "Aulas"}
        respuesta = self.client.post("/api/conexiones", json=datos)
        self.assertEqual(respuesta.status_code, 201)
        self.assertIn("Gimnasio", respuesta.json["adyacencia"]["Aulas"])
        self.assertEqual(self.client.post("/api/conexiones", json=datos).status_code, 400)
        self.assertEqual(self.client.delete("/api/conexiones", json=datos).status_code, 200)
        self.assertEqual(self.client.delete("/api/vertices", json={"nombre": "Gimnasio"}).status_code, 200)

    def test_algoritmos(self):
        ruta = self.client.get("/api/ruta", query_string={"origen": "Auditorio", "destino": "Laboratorio"})
        self.assertEqual(ruta.status_code, 200)
        self.assertEqual(ruta.json["conexiones"], 3)
        dfs = self.client.get("/api/recorrido", query_string={"inicio": "Laboratorio"})
        self.assertEqual(dfs.status_code, 200)
        self.assertEqual(dfs.json["total_visitados"], 6)

    def test_rutas_casos_limite(self):
        misma = self.client.get("/api/ruta", query_string={"origen": "Aulas", "destino": "Aulas"})
        self.assertEqual(misma.json["conexiones"], 0)
        self.client.post("/api/vertices", json={"nombre": "Aislado"})
        sin_ruta = self.client.get("/api/ruta", query_string={"origen": "Aulas", "destino": "Aislado"})
        self.assertEqual(sin_ruta.status_code, 200)
        self.assertFalse(sin_ruta.json["encontrada"])
        self.assertEqual(self.client.get("/api/recorrido?inicio=Aislado").json["orden"], ["Aislado"])

    def test_parametros_invalidos(self):
        for url in ["/api/ruta", "/api/recorrido", "/api/ruta?origen=A&destino=B"]:
            with self.subTest(url=url):
                respuesta = self.client.get(url)
                self.assertEqual(respuesta.status_code, 400)
                self.assertIn("error", respuesta.json)

    def test_json_invalido(self):
        for datos in [[], None, 5, {"nombre": ""}, {}, {"nombre": ["A"]}]:
            with self.subTest(datos=datos):
                respuesta = self.client.post("/api/vertices", data=json.dumps(datos), content_type="application/json")
                self.assertEqual(respuesta.status_code, 400)
                self.assertIn("error", respuesta.json)
        self.assertEqual(self.client.post("/api/vertices", data="{", content_type="application/json").status_code, 400)
        self.assertEqual(self.client.post("/api/vertices", data="A").status_code, 415)

    def test_errores_json_y_limite(self):
        self.assertEqual(self.client.get("/api/no-existe").status_code, 404)
        self.assertEqual(self.client.get("/api/vertices").status_code, 405)
        respuesta = self.client.post("/api/vertices", json={"nombre": "x" * 17000})
        self.assertEqual(respuesta.status_code, 413)
        self.assertIn("error", respuesta.json)

    def test_restaurar(self):
        self.client.delete("/api/vertices", json={"nombre": "Biblioteca"})
        resultado = self.client.post("/api/restaurar").json
        self.assertEqual(resultado["total_vertices"], 6)
        self.assertEqual(resultado["total_aristas"], 8)

    def test_dependencias_ciclo_y_separacion(self):
        self.assertFalse(self.client.get("/api/dependencias/orden").json["hay_ciclo"])
        datos = {"origen": "Desarrollo Web", "destino": "Introducción a la Programación"}
        self.assertEqual(self.client.post("/api/dependencias/conexiones", json=datos).status_code, 201)
        respuesta = self.client.get("/api/dependencias/orden")
        self.assertTrue(respuesta.json["hay_ciclo"])
        self.assertEqual(respuesta.json["orden"], [])
        self.assertEqual(self.client.get("/api/grafo").json["total_aristas"], 8)
        self.assertEqual(self.client.delete("/api/dependencias/conexiones", json=datos).status_code, 200)
        self.assertFalse(self.client.get("/api/dependencias/orden").json["hay_ciclo"])

    def test_crud_asignaturas_y_restaurar(self):
        self.assertEqual(self.client.post("/api/dependencias/asignaturas", json={"nombre": "Álgebra"}).status_code, 201)
        self.assertEqual(self.client.get("/api/dependencias").json["total_vertices"], 6)
        self.assertEqual(self.client.delete("/api/dependencias/asignaturas", json={"nombre": "Álgebra"}).status_code, 200)
        self.client.delete("/api/dependencias/asignaturas", json={"nombre": "Bases de Datos"})
        self.assertEqual(self.client.post("/api/dependencias/restaurar").json["total_vertices"], 5)

    def test_apps_no_comparten_estado(self):
        self.client.post("/api/vertices", json={"nombre": "Extra"})
        otra = create_app().test_client()
        self.assertEqual(otra.get("/api/grafo").json["total_vertices"], 6)


if __name__ == "__main__":
    unittest.main()
