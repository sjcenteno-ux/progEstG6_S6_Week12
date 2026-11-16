"""Grafos con listas de adyacencia y algoritmos escritos paso a paso."""

from collections import deque
from unicodedata import normalize


class Grafo:
    def __init__(self, dirigido=False):
        self.dirigido = dirigido
        self.adyacencia = {}

    @staticmethod
    def validar_nombre(nombre):
        if not isinstance(nombre, str):
            raise ValueError("El nombre debe ser un texto.")
        nombre = normalize("NFC", nombre.strip())
        if not nombre or len(nombre) > 60:
            raise ValueError("Escribe un nombre de entre 1 y 60 caracteres.")
        if any(ord(caracter) < 32 for caracter in nombre):
            raise ValueError("El nombre no debe contener caracteres de control.")
        return nombre

    def comprobar_vertice(self, nombre):
        nombre = self.validar_nombre(nombre)
        if nombre not in self.adyacencia:
            raise ValueError(f'No existe el vértice «{nombre}».')
        return nombre

    def agregar_vertice(self, nombre):
        nombre = self.validar_nombre(nombre)
        if any(existente.casefold() == nombre.casefold() for existente in self.adyacencia):
            raise ValueError("Ya existe un vértice con ese nombre.")
        self.adyacencia[nombre] = []

    def agregar_arista(self, origen, destino):
        origen = self.comprobar_vertice(origen)
        destino = self.comprobar_vertice(destino)
        if origen == destino:
            raise ValueError("No se permiten conexiones de un vértice consigo mismo.")
        if destino in self.adyacencia[origen]:
            raise ValueError("Esa conexión ya existe.")
        self.adyacencia[origen].append(destino)
        if not self.dirigido:
            self.adyacencia[destino].append(origen)

    def eliminar_vertice(self, nombre):
        nombre = self.comprobar_vertice(nombre)
        del self.adyacencia[nombre]
        for vecinos in self.adyacencia.values():
            if nombre in vecinos:
                vecinos.remove(nombre)

    def eliminar_arista(self, origen, destino):
        origen = self.comprobar_vertice(origen)
        destino = self.comprobar_vertice(destino)
        if destino not in self.adyacencia[origen]:
            raise ValueError("Esa conexión no existe.")
        self.adyacencia[origen].remove(destino)
        if not self.dirigido:
            self.adyacencia[destino].remove(origen)

    def obtener_adyacencia(self):
        # La copia evita que una vista modifique accidentalmente el grafo.
        return {vertice: vecinos.copy() for vertice, vecinos in self.adyacencia.items()}

    def datos(self):
        aristas = []
        for origen, vecinos in self.adyacencia.items():
            for destino in vecinos:
                if self.dirigido or [destino, origen] not in aristas:
                    aristas.append([origen, destino])
        return {
            "dirigido": self.dirigido,
            "vertices": list(self.adyacencia),
            "aristas": aristas,
            "adyacencia": self.obtener_adyacencia(),
            "total_vertices": len(self.adyacencia),
            "total_aristas": len(aristas),
        }

    def bfs(self, origen, destino):
        origen = self.comprobar_vertice(origen)
        destino = self.comprobar_vertice(destino)
        cola = deque([origen])
        visitados = {origen}
        predecesores = {origen: None}
        niveles = {origen: 0}
        explorados = []
        pasos = []

        while cola:
            actual = cola.popleft()  # FIFO: primero en entrar, primero en salir.
            explorados.append(actual)
            if actual != destino:
                for vecino in self.adyacencia[actual]:
                    if vecino not in visitados:
                        visitados.add(vecino)
                        predecesores[vecino] = actual
                        niveles[vecino] = niveles[actual] + 1
                        cola.append(vecino)
            pasos.append({"actual": actual, "frontera": list(cola), "nivel": niveles[actual]})
            if actual == destino:
                break

        ruta = []
        if destino in explorados:
            actual = destino
            while actual is not None:
                ruta.append(actual)
                actual = predecesores[actual]
            ruta.reverse()

        return {
            "algoritmo": "BFS", "origen": origen, "destino": destino,
            "encontrada": bool(ruta), "ruta": ruta,
            "conexiones": len(ruta) - 1 if ruta else None,
            "explorados": explorados, "total_visitados": len(explorados),
            "pasos": pasos, "niveles": niveles,
        }

    def dfs(self, inicio):
        inicio = self.comprobar_vertice(inicio)
        pila = [(inicio, None)]
        visitados = set()
        orden = []
        pasos = []
        aristas_arbol = []

        while pila:
            actual, padre = pila.pop()  # LIFO: último en entrar, primero en salir.
            if actual in visitados:
                continue
            visitados.add(actual)
            orden.append(actual)
            if padre is not None:
                aristas_arbol.append([padre, actual])
            # Invertimos al apilar para respetar el orden de la lista de vecinos.
            for vecino in reversed(self.adyacencia[actual]):
                if vecino not in visitados:
                    pila.append((vecino, actual))
            frontera = [vertice for vertice, _ in reversed(pila) if vertice not in visitados]
            pasos.append({"actual": actual, "frontera": frontera, "padre": padre})

        return {
            "algoritmo": "DFS", "inicio": inicio, "orden": orden,
            "explorados": orden, "total_visitados": len(orden),
            "pasos": pasos, "aristas_arbol": aristas_arbol,
        }

    def orden_topologico(self):
        """Algoritmo de Kahn: retirar asignaturas sin requisitos pendientes."""
        if not self.dirigido:
            raise ValueError("El orden topológico requiere un grafo dirigido.")
        grados = {vertice: 0 for vertice in self.adyacencia}
        for vecinos in self.adyacencia.values():
            for vecino in vecinos:
                grados[vecino] += 1
        cola = deque(vertice for vertice in grados if grados[vertice] == 0)
        orden = []
        while cola:
            actual = cola.popleft()
            orden.append(actual)
            for vecino in self.adyacencia[actual]:
                grados[vecino] -= 1
                if grados[vecino] == 0:
                    cola.append(vecino)
        hay_ciclo = len(orden) != len(self.adyacencia)
        return {
            "hay_ciclo": hay_ciclo,
            "orden": [] if hay_ciclo else orden,
            # Los bloqueados pueden incluir dependientes de un ciclo.
            "bloqueadas": [vertice for vertice in grados if grados[vertice] > 0],
            "mensaje": "Un ciclo impide generar un orden válido. Elimina una dependencia para resolverlo."
            if hay_ciclo else "Orden válido: cada prerrequisito aparece antes de su asignatura dependiente.",
        }


def crear_campus():
    grafo = Grafo()
    for nombre in ["Administración", "Biblioteca", "Auditorio", "Cafetería", "Laboratorio", "Aulas"]:
        grafo.agregar_vertice(nombre)
    for origen, destino in [
        ("Administración", "Biblioteca"), ("Administración", "Auditorio"),
        ("Biblioteca", "Laboratorio"), ("Biblioteca", "Cafetería"),
        ("Biblioteca", "Aulas"), ("Auditorio", "Cafetería"),
        ("Cafetería", "Aulas"), ("Laboratorio", "Aulas"),
    ]:
        grafo.agregar_arista(origen, destino)
    return grafo


def crear_dependencias():
    grafo = Grafo(dirigido=True)
    for nombre in ["Introducción a la Programación", "Programación Estructurada",
                   "Estructuras de Datos", "Bases de Datos", "Desarrollo Web"]:
        grafo.agregar_vertice(nombre)
    for origen, destino in [
        ("Introducción a la Programación", "Programación Estructurada"),
        ("Programación Estructurada", "Estructuras de Datos"),
        ("Estructuras de Datos", "Bases de Datos"),
        ("Estructuras de Datos", "Desarrollo Web"),
        ("Bases de Datos", "Desarrollo Web"),
    ]:
        grafo.agregar_arista(origen, destino)
    return grafo
