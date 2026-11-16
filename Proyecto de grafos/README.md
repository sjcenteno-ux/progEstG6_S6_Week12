# CampusGraph

Sistema interactivo de grafos para Programación Estructurada. Representa edificios de un campus, permite modificar sus conexiones y muestra cómo Python ejecuta BFS y DFS. Incluye un segundo grafo independiente de prerrequisitos académicos con detección de ciclos y ordenamiento topológico.

## Tecnologías

- Python 3.12 o posterior compatible; verificado en este entorno con Python 3.14.3.
- Flask 3.1, HTML5, Tailwind CSS mediante Play CDN y estilos propios.
- JavaScript vanilla, `fetch` y SVG para eventos, dibujo, arrastre y animación.
- `collections.deque`, diccionarios, listas, conjuntos y una pila de Python.
- `unittest`, incluido en Python, para las pruebas.

No requiere Node.js, base de datos ni compilación. Los algoritmos se ejecutan en Python; el navegador solamente presenta sus resultados. Los grafos viven en memoria, se comparten entre pestañas conectadas al mismo servidor y se reinician al detener Flask. El ejemplo de dependencias y el campus no comparten datos. Se usa un único proceso local; no hay persistencia ni sesiones de usuario.

El [Play CDN de Tailwind](https://tailwindcss.com/docs/installation/play-cdn) requiere internet y está pensado para demostraciones, no para producción. Las fuentes de Google también requieren internet. El CSS local contiene el diseño completo y fuentes alternativas, de modo que la aplicación sigue siendo utilizable si esos recursos no cargan. Flask y sus dependencias se descargan durante la instalación inicial; después el servidor y los algoritmos funcionan sin internet.

## Estructura

```text
Proyecto de grafos/
├── app.py                 # Endpoints Flask y validación HTTP
├── grafo.py               # Clase Grafo, BFS, DFS, Kahn y ejemplos
├── requirements.txt       # Única dependencia directa: Flask
├── iniciar.bat            # Iniciar en Windows con el entorno virtual
├── README.md
├── .gitignore
├── templates/
│   └── index.html         # Interfaz en español y ventanas de edición
├── static/
│   ├── styles.css         # Diseño oscuro y adaptación a pantallas pequeñas
│   └── app.js             # fetch, SVG y animaciones; sin BFS/DFS duplicados
└── tests/
    ├── test_grafo.py       # Estructuras y algoritmos
    └── test_app.py         # Endpoints mediante el cliente de pruebas Flask
```

## Instalación y ejecución

Abre PowerShell en la carpeta del proyecto. Para una instalación nueva:

```powershell
python --version
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe app.py
```

Si tu instalación de Python es MSYS/MinGW, como la de este entorno, el ejecutable se encuentra en `bin`:

```powershell
.\.venv\bin\python.exe -m pip install -r requirements.txt
.\.venv\bin\python.exe app.py
```

**En este entorno ya está creado `.venv` con Flask instalado.** Basta ejecutar `iniciar.bat` o `./iniciar.bat` desde PowerShell. El archivo detecta ambas ubicaciones y no instala dependencias automáticamente.

En Linux o macOS:

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python app.py
```

Abre **http://127.0.0.1:5000** en el navegador. No abras `index.html` directamente: la interfaz necesita los endpoints del servidor. El indicador superior confirma una solicitud HTTP a Flask. Si el servidor no estaba disponible al cargar, vuelve a pulsar la sección actual para reintentar. Detén Flask con `Ctrl+C` en la terminal. El servidor escucha únicamente en el equipo local; no se ha realizado ningún despliegue.

Como alternativa para cambiar de puerto, usa el Python de tu entorno:

```powershell
.\.venv\Scripts\python.exe -m flask --app app run --host 127.0.0.1 --port 5001
```

## Conceptos para explicar en clase

### Vértices, aristas y lista de adyacencia

Un **vértice** representa un edificio o una asignatura. Una **arista** representa una conexión. El campus es un grafo **no dirigido y sin peso**: cada conexión se puede recorrer en ambos sentidos y no almacena kilómetros, costos ni tiempos.

El diccionario `adyacencia` asocia cada nombre con una lista de vecinos. Las listas conservan el orden de inserción, por lo que los recorridos son reproducibles:

```python
{
    "Administración": ["Biblioteca", "Auditorio"],
    "Biblioteca": ["Administración", "Laboratorio", "Cafetería", "Aulas"],
    "Auditorio": ["Administración", "Cafetería"],
    "Cafetería": ["Biblioteca", "Auditorio", "Aulas"],
    "Laboratorio": ["Biblioteca", "Aulas"],
    "Aulas": ["Biblioteca", "Cafetería", "Laboratorio"]
}
```

El ejemplo contiene exactamente **6 vértices y 8 aristas**. Una conexión aparece dos veces en el diccionario por ser bidireccional, pero se cuenta y dibuja una sola vez. Al eliminar un vértice se eliminan también sus referencias en todas las listas de vecinos.

Se rechazan nombres vacíos, repetidos sin distinguir mayúsculas/minúsculas, de más de 60 caracteres y con caracteres de control. También se rechazan lazos y aristas repetidas. Los acentos se normalizan a Unicode NFC; no se eliminan.

### BFS: búsqueda en anchura

`Grafo.bfs` usa una **cola FIFO**, un conjunto de visitados y un diccionario de predecesores:

1. Agrega el origen a `deque` y lo marca como descubierto.
2. Extrae el primero con `popleft()`.
3. Agrega al final sus vecinos no descubiertos y recuerda de dónde llegaron.
4. Continúa por niveles hasta extraer el destino o vaciar la cola.
5. Reconstruye la ruta siguiendo los predecesores desde el destino y luego invierte la lista.

FIFO significa **primero en entrar, primero en salir**. Como todos los pasos tienen el mismo valor, BFS explora todos los vértices a una conexión antes de los que están a dos. Por eso la primera ruta descubierta hacia el destino tiene el menor número de aristas. Esto no calcula la menor distancia física.

Ejemplo: **Auditorio → Administración → Biblioteca → Laboratorio**, con **3 conexiones**. Si origen y destino son iguales, la ruta contiene ese único edificio y usa **0 conexiones**. Si no hay ruta, `ruta` es `[]`, `encontrada` es `false` y `conexiones` es `null`.

En la animación, turquesa indica exploración y amarillo indica la ruta mínima final. La cola visible refleja el estado después de cada expansión. Si se alcanza el destino, BFS puede terminar aunque queden vértices en la cola: ya no necesita explorarlos.

### DFS: búsqueda en profundidad

`Grafo.dfs` usa una lista como **pila LIFO** y un conjunto de visitados:

1. Coloca el inicio en la pila.
2. Extrae el último con `pop()`.
3. Si ya se visitó, lo omite; de lo contrario, lo registra.
4. Apila vecinos en orden inverso para visitar primero al primer vecino de la lista.
5. Repite hasta vaciar la pila.

LIFO significa **último en entrar, primero en salir**. DFS profundiza antes de explorar otra rama. También se podría escribir con recursividad, usando la pila de llamadas de Python; aquí se usa una pila explícita para evitar el límite de recursión.

Desde **Laboratorio**: **Laboratorio → Biblioteca → Administración → Auditorio → Cafetería → Aulas**, con **6 vértices visitados**. DFS solo visita el componente alcanzable desde el inicio y no repite vértices. El orden de visita **no necesariamente es una ruta directa entre todos los nodos sin retrocesos**. Las aristas violetas muestran el árbol real de descubrimiento, no conexiones inventadas entre posiciones consecutivas del listado. La pila puede contener candidatos repetidos: se descartan cuando ya están visitados.

El recorrido básico de BFS y DFS tiene costo O(V + E). Esta versión también guarda instantáneas de cola/pila para enseñar cada paso, lo cual agrega tiempo y memoria; está pensada para grafos académicos pequeños. El número mostrado como «explorados» cuenta los vértices extraídos y procesados, no todos los que llegaron a descubrirse.

### Dependencias, ciclos y orden topológico

El segundo grafo es **dirigido**: `A → B` significa que A es requisito de B. Al agregar esa arista no se agrega `B → A` automáticamente.

El ejemplo conecta Introducción a la Programación → Programación Estructurada → Estructuras de Datos. Estructuras de Datos permite cursar Bases de Datos y Desarrollo Web; Bases de Datos también es requisito de Desarrollo Web.

El algoritmo de **Kahn** cuenta las aristas entrantes, pone en cola las asignaturas sin requisitos pendientes, las retira y disminuye el conteo de sus dependientes. Si puede retirar todas, el orden es válido. Si quedan vértices, existe un ciclo y se devuelve un mensaje sin presentar un orden parcial como válido. La lista de bloqueadas puede incluir asignaturas que dependan del ciclo, además de las que lo forman. El editor permite crear ciclos para poder estudiarlos y corregirlos.

## Uso de la interfaz

- **Edificio / Asignatura** abre el editor para agregar y eliminar vértices. El botón de papelera pide confirmación antes de eliminar.
- **Conexión / Dependencia** abre los selectores y la lista de aristas; la papelera permite eliminarlas.
- Selecciona un nodo para utilizarlo como origen. Puedes arrastrarlo, acercar, alejar o pulsar centrar para reorganizar. Las posiciones son solo visuales y no cambian los algoritmos.
- Selecciona **Ruta BFS** o **Recorrido DFS**, completa los selectores y ejecuta. Con «paso a paso» activado, el algoritmo queda preparado: pulsa **Iniciar** o **Siguiente paso**. Puedes pausar o reiniciar la animación sin modificar el grafo.
- Sin «paso a paso», el resultado completo se muestra inmediatamente.
- Cambiar de algoritmo, editar el grafo o cambiar de sección limpia los resultados anteriores, evitando resaltar rutas que ya no corresponden a los datos.
- **Restaurar ejemplo** recupera únicamente el grafo de la sección actual, previa confirmación.
- La lista de adyacencia y las estadísticas se actualizan tras cada modificación.

## Endpoints

Todos los endpoints `/api` devuelven JSON. Las altas devuelven `201`, consultas y eliminaciones `200`, validaciones `400`, tipo de contenido incorrecto `415` y solicitudes demasiado grandes `413`. Una ruta inexistente es un resultado válido `200` con `encontrada: false`; un ciclo también es un resultado válido `200` con `hay_ciclo: true`.

| Método | Dirección | Entrada / finalidad |
|---|---|---|
| GET | `/api/grafo` | Campus: adyacencia, vértices, aristas y totales |
| POST | `/api/vertices` | JSON `{"nombre":"Gimnasio"}` |
| DELETE | `/api/vertices` | JSON `{"nombre":"Gimnasio"}` |
| POST | `/api/conexiones` | JSON `{"origen":"Aulas","destino":"Auditorio"}` |
| DELETE | `/api/conexiones` | Mismos campos; elimina en ambos sentidos |
| GET | `/api/ruta?origen=Auditorio&destino=Laboratorio` | BFS, ruta mínima y pasos de exploración |
| GET | `/api/recorrido?inicio=Laboratorio` | DFS, orden, árbol y pasos |
| POST | `/api/restaurar` | Restaurar campus; sin cuerpo |
| GET | `/api/dependencias` | Grafo dirigido y adyacencia |
| POST / DELETE | `/api/dependencias/asignaturas` | JSON con `nombre` |
| POST / DELETE | `/api/dependencias/conexiones` | JSON con `origen` y `destino`; respeta dirección |
| GET | `/api/dependencias/orden` | Kahn: ciclo, orden válido y asignaturas bloqueadas |
| POST | `/api/dependencias/restaurar` | Restaurar asignaturas; sin cuerpo |

Ejemplo desde PowerShell, con el servidor en ejecución:

```powershell
Invoke-RestMethod 'http://127.0.0.1:5000/api/ruta?origen=Auditorio&destino=Laboratorio'
Invoke-RestMethod 'http://127.0.0.1:5000/api/recorrido?inicio=Laboratorio'
Invoke-RestMethod -Uri 'http://127.0.0.1:5000/api/vertices' -Method Post -ContentType 'application/json; charset=utf-8' -Body '{"nombre":"Gimnasio"}'
```

Flujo: interacción → `fetch` → endpoint Flask → método de `Grafo` en Python → JSON → actualización de SVG y resultados. `create_app()` crea grafos nuevos por aplicación, lo que permite que cada prueba arranque con datos independientes. Los errores HTTP y de validación se presentan en español. Las consultas y modificaciones del grafo usan un bloqueo para que dos solicitudes no intercalen cambios.

## Pruebas y validación

No requieren iniciar el servidor. En Python estándar para Windows:

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
```

En este entorno MSYS/MinGW:

```powershell
.\.venv\bin\python.exe -m unittest discover -s tests -v
```

La suite contiene **35 pruebas**: altas y bajas de vértices y aristas, bidireccionalidad, duplicados, nombres inválidos, Unicode, copia de adyacencia, ejemplo exacto, BFS mínimo/sin ruta/origen igual a destino, DFS sin repeticiones y desconectado, cadena larga sin recursividad, direccionalidad, ciclos, recuperación del orden al eliminar el ciclo, grafos vacíos, endpoints, JSON inválido, límite de tamaño, restauración y aislamiento de aplicaciones.

Validación realizada: **35/35 pruebas aprobadas** y comprobación de sintaxis de `static/app.js` con `node --check` como herramienta de desarrollo opcional. La revisión visual y la interacción en un navegador real no pudieron automatizarse porque la herramienta de navegador de esta sesión no estaba disponible; deben comprobarse manualmente antes de las capturas.

## Guion de demostración al profesor

1. Abre el campus y restaura el ejemplo: muestra **6 edificios y 8 conexiones**, y cómo cada arista aparece en ambas listas de vecinos.
2. En **Ruta BFS**, selecciona **Auditorio** y **Laboratorio**. Ejecuta, pulsa **Siguiente paso** y explica la cola FIFO y los niveles. Al terminar, muestra **Auditorio → Administración → Biblioteca → Laboratorio**, **3 conexiones**, resaltadas en amarillo.
3. En **Recorrido DFS**, selecciona **Laboratorio** y ejecuta. Pulsa **Iniciar**: verás **Laboratorio → Biblioteca → Administración → Auditorio → Cafetería → Aulas**, **6 vértices**, con árbol violeta. Explica la pila y los retrocesos.
4. Agrega **Gimnasio** sin conexiones. BFS desde un edificio del campus hacia Gimnasio debe indicar que no existe ruta. DFS desde Gimnasio visita un solo vértice. Conéctalo a Aulas y repite.
5. Prueba BFS con el mismo origen y destino: **0 conexiones**. Intenta duplicar una arista y observa la validación.
6. En **Dependencias académicas**, pulsa **Comprobar y ordenar**. Luego crea **Desarrollo Web → Introducción a la Programación** y vuelve a comprobar: se detecta un ciclo y se impide generar el orden. Elimina esa dependencia para recuperar el orden válido.
7. Ejecuta las pruebas y abre `grafo.py` para explicar `deque`, `popleft`, `append`, `pop`, `visitados` y `predecesores`.

Para las capturas, deja abierto el mapa con el resultado final de BFS, otra vista con DFS completado y otra con la lista de adyacencia. La captura del segundo módulo puede mostrar el orden válido y el mensaje de ciclo.

Referencias: [documentación oficial de Flask](https://flask.palletsprojects.com/en/stable/api/) y [Play CDN de Tailwind](https://tailwindcss.com/docs/installation/play-cdn).
