import unittest

from grafo import Grafo, crear_campus, crear_dependencias


class PruebasGrafo(unittest.TestCase):
    def setUp(self):
        self.grafo = crear_campus()

    def test_ejemplo_exacto(self):
        self.assertEqual(self.grafo.datos()["total_vertices"], 6)
        self.assertEqual(self.grafo.datos()["total_aristas"], 8)
        self.assertEqual(self.grafo.adyacencia["Biblioteca"], ["Administración", "Laboratorio", "Cafetería", "Aulas"])

    def test_agregar_vertice(self):
        self.grafo.agregar_vertice("  Gimnasio  ")
        self.assertEqual(self.grafo.adyacencia["Gimnasio"], [])

    def test_rechazar_nombres_invalidos(self):
        for nombre in [None, 12, "", "  ", "a" * 61, "Hola\nMundo", "administración", "ADMINISTRACIÓN"]:
            with self.subTest(nombre=nombre), self.assertRaises(ValueError):
                self.grafo.agregar_vertice(nombre)

    def test_normalizar_unicode(self):
        with self.assertRaises(ValueError):
            self.grafo.agregar_vertice("Administracio\u0301n")

    def test_arista_bidireccional(self):
        self.grafo.agregar_arista("Auditorio", "Laboratorio")
        self.assertIn("Laboratorio", self.grafo.adyacencia["Auditorio"])
        self.assertIn("Auditorio", self.grafo.adyacencia["Laboratorio"])

    def test_rechazar_duplicados_y_lazos(self):
        for origen, destino in [("Administración", "Biblioteca"), ("Biblioteca", "Administración"), ("Aulas", "Aulas"), ("No existe", "Aulas")]:
            with self.subTest(origen=origen, destino=destino), self.assertRaises(ValueError):
                self.grafo.agregar_arista(origen, destino)
        self.assertEqual(self.grafo.datos()["total_aristas"], 8)

    def test_eliminar_vertice_y_conexiones(self):
        self.grafo.eliminar_vertice("Biblioteca")
        self.assertNotIn("Biblioteca", self.grafo.adyacencia)
        for vecinos in self.grafo.adyacencia.values():
            self.assertNotIn("Biblioteca", vecinos)
        self.assertEqual(self.grafo.datos()["total_aristas"], 4)

    def test_eliminar_arista(self):
        self.grafo.eliminar_arista("Administración", "Biblioteca")
        self.assertNotIn("Biblioteca", self.grafo.adyacencia["Administración"])
        self.assertNotIn("Administración", self.grafo.adyacencia["Biblioteca"])
        with self.assertRaises(ValueError):
            self.grafo.eliminar_arista("Administración", "Biblioteca")

    def test_copia_adyacencia(self):
        copia = self.grafo.obtener_adyacencia()
        copia["Biblioteca"].clear()
        self.assertEqual(len(self.grafo.adyacencia["Biblioteca"]), 4)

    def test_bfs_ejemplo(self):
        resultado = self.grafo.bfs("Auditorio", "Laboratorio")
        self.assertEqual(resultado["ruta"], ["Auditorio", "Administración", "Biblioteca", "Laboratorio"])
        self.assertEqual(resultado["conexiones"], 3)
        self.assertEqual(len(resultado["pasos"]), resultado["total_visitados"])

    def test_bfs_prefiere_ruta_minima(self):
        self.grafo.agregar_arista("Auditorio", "Laboratorio")
        self.assertEqual(self.grafo.bfs("Auditorio", "Laboratorio")["conexiones"], 1)

    def test_bfs_sin_ruta(self):
        self.grafo.agregar_vertice("Aislado")
        resultado = self.grafo.bfs("Auditorio", "Aislado")
        self.assertFalse(resultado["encontrada"])
        self.assertEqual(resultado["ruta"], [])
        self.assertIsNone(resultado["conexiones"])

    def test_bfs_origen_igual_destino(self):
        resultado = self.grafo.bfs("Aulas", "Aulas")
        self.assertEqual(resultado["ruta"], ["Aulas"])
        self.assertEqual(resultado["conexiones"], 0)
        self.assertEqual(resultado["explorados"], ["Aulas"])

    def test_dfs_orden_sin_repeticiones(self):
        resultado = self.grafo.dfs("Laboratorio")
        self.assertEqual(resultado["orden"], ["Laboratorio", "Biblioteca", "Administración", "Auditorio", "Cafetería", "Aulas"])
        self.assertEqual(len(set(resultado["orden"])), resultado["total_visitados"])
        for padre, hijo in resultado["aristas_arbol"]:
            self.assertIn(hijo, self.grafo.adyacencia[padre])

    def test_dfs_desconectado(self):
        self.grafo.agregar_vertice("Aislado")
        self.assertEqual(self.grafo.dfs("Aislado")["orden"], ["Aislado"])
        self.assertNotIn("Aislado", self.grafo.dfs("Aulas")["orden"])

    def test_grafo_vacio(self):
        grafo = Grafo()
        self.assertEqual(grafo.datos()["aristas"], [])
        with self.assertRaises(ValueError):
            grafo.bfs("A", "B")
        with self.assertRaises(ValueError):
            grafo.dfs("A")

    def test_dfs_cadena_larga_sin_recursion(self):
        grafo = Grafo()
        for numero in range(1100):
            grafo.agregar_vertice(str(numero))
        for numero in range(1099):
            grafo.agregar_arista(str(numero), str(numero + 1))
        self.assertEqual(grafo.dfs("0")["total_visitados"], 1100)

    def test_dependencias_dirigidas(self):
        grafo = crear_dependencias()
        self.assertIn("Programación Estructurada", grafo.adyacencia["Introducción a la Programación"])
        self.assertNotIn("Introducción a la Programación", grafo.adyacencia["Programación Estructurada"])

    def test_orden_topologico(self):
        grafo = crear_dependencias()
        resultado = grafo.orden_topologico()
        self.assertFalse(resultado["hay_ciclo"])
        self.assertEqual(len(resultado["orden"]), 5)
        for origen, destino in grafo.datos()["aristas"]:
            self.assertLess(resultado["orden"].index(origen), resultado["orden"].index(destino))

    def test_ciclo_bloquea_orden(self):
        grafo = crear_dependencias()
        grafo.agregar_arista("Desarrollo Web", "Introducción a la Programación")
        self.assertTrue(grafo.orden_topologico()["hay_ciclo"])
        self.assertEqual(grafo.orden_topologico()["orden"], [])

    def test_eliminar_ciclo_recupera_orden(self):
        grafo = crear_dependencias()
        grafo.agregar_arista("Desarrollo Web", "Introducción a la Programación")
        grafo.eliminar_arista("Desarrollo Web", "Introducción a la Programación")
        self.assertFalse(grafo.orden_topologico()["hay_ciclo"])

    def test_orden_topologico_vacio_y_desconectado(self):
        grafo = Grafo(dirigido=True)
        self.assertEqual(grafo.orden_topologico()["orden"], [])
        grafo.agregar_vertice("A")
        grafo.agregar_vertice("B")
        self.assertEqual(grafo.orden_topologico()["orden"], ["A", "B"])

    def test_borrar_vertice_dirigido(self):
        grafo = crear_dependencias()
        grafo.eliminar_vertice("Estructuras de Datos")
        for vecinos in grafo.adyacencia.values():
            self.assertNotIn("Estructuras de Datos", vecinos)


if __name__ == "__main__":
    unittest.main()
