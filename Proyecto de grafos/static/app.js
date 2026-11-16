/* JavaScript solo presenta y anima resultados calculados por Python. */
'use strict';
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const SVG_NS = 'http://www.w3.org/2000/svg';
const state = {
  section: 'campus', algorithm: 'BFS', graph: null, positions: {},
  result: null, step: 0, timer: null, zoom: 1, editor: 'vertices',
  visited: [], route: [], tree: [], current: null, selected: null,
  busy: false, loading: false,
};
const layouts = {campus: Object.create(null), dependencias: Object.create(null)};
const mobileViewport = window.matchMedia('(max-width: 580px)');
function dimensions() { return mobileViewport.matches ? {width: 530, height: 600} : {width: 820, height: 470}; }
let toastTimer;

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function icon(name) {
  const svg = svgElement('svg', {class: 'icon', 'aria-hidden': 'true'});
  svg.append(svgElement('use', {href: `#i-${name}`}));
  return svg;
}
function svgElement(tag, attributes = {}) {
  const node = document.createElementNS(SVG_NS, tag);
  Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, value));
  return node;
}
function toast(message, error = false) {
  clearTimeout(toastTimer);
  $('#toast').textContent = message;
  $('#toast').className = `toast${error ? ' error' : ''}`;
  $('#toast').hidden = false;
  toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 4500);
}
async function api(url, method = 'GET', data) {
  let response;
  try {
    response = await fetch(url, {
      method, headers: data === undefined ? {} : {'Content-Type': 'application/json'},
      body: data === undefined ? undefined : JSON.stringify(data),
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    connection(false);
    throw new Error('No se pudo conectar con Flask. Comprueba que el servidor esté ejecutándose.');
  }
  connection(true);
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'No se pudo completar la solicitud.');
  return result;
}
function connection(online) {
  $('#connection').classList.toggle('offline', !online);
  $('#connection').replaceChildren(element('span'), document.createTextNode(online ? 'Flask conectado' : 'Flask desconectado'));
}
function baseUrl() { return state.section === 'campus' ? '/api' : '/api/dependencias'; }
function graphUrl() { return state.section === 'campus' ? '/api/grafo' : '/api/dependencias'; }

async function loadGraph() {
  state.loading = true;
  try { acceptGraph(await api(graphUrl())); }
  catch (error) {
    state.graph = null;
    $('#graph').replaceChildren();
    $('#adjacency').replaceChildren();
    $('#graph-empty').hidden = false;
    $('#graph-empty').textContent = 'Sin conexión. Inicia Flask y pulsa la sección actual para reintentar.';
    $('#run-algorithm').disabled = true;
    $('#topological').disabled = true;
    toast(error.message, true);
  }
  finally { state.loading = false; }
}
function acceptGraph(graph) {
  state.graph = graph;
  resetResult();
  positionNodes();
  $('#stat-vertices').textContent = graph.total_vertices;
  $('#stat-edges').textContent = graph.total_aristas;
  $('#graph-empty').hidden = graph.vertices.length > 0;
  $('#graph-empty').textContent = 'No hay vértices todavía. Agrega uno para comenzar a conectar ideas.';
  updateSelectors();
  renderGraph();
  renderAdjacency();
  renderEditor();
  $('#run-algorithm').disabled = !graph.vertices.length;
  $('#topological').disabled = !graph.vertices.length;
}
function positionNodes(force = false) {
  const vertices = state.graph.vertices;
  const positions = layouts[state.section];
  if (force) Object.keys(positions).forEach(name => delete positions[name]);
  Object.keys(positions).filter(name => !vertices.includes(name)).forEach(name => delete positions[name]);
  const campus = mobileViewport.matches ? {
    'Administración': [140, 105], 'Auditorio': [390, 105],
    'Biblioteca': [140, 285], 'Cafetería': [390, 285],
    'Laboratorio': [140, 465], 'Aulas': [390, 465],
  } : {
    'Administración': [170, 125], 'Biblioteca': [400, 125],
    'Auditorio': [170, 333], 'Cafetería': [400, 333],
    'Laboratorio': [650, 125], 'Aulas': [650, 333],
  };
  const academic = mobileViewport.matches ? [[140, 105], [390, 105], [140, 285], [390, 285], [265, 465]] : [[130, 120], [380, 120], [620, 120], [380, 330], [620, 330]];
  vertices.forEach((name, index) => {
    if (positions[name]) return;
    let point;
    if (state.section === 'campus' && Object.hasOwn(campus, name)) point = campus[name];
    else if (state.section === 'dependencias' && index < 5) point = academic[index];
    else {
      const angle = (2 * Math.PI * index) / Math.max(vertices.length, 1) - Math.PI / 2;
      const size = dimensions();
      point = [size.width / 2 + (size.width / 2 - 100) * Math.cos(angle), size.height / 2 - 10 + (size.height / 2 - 85) * Math.sin(angle)];
    }
    positions[name] = {x: point[0], y: point[1]};
  });
  state.positions = positions;
}
function updateSelectors() {
  ['origin', 'destination', 'edge-origin', 'edge-destination'].forEach(id => {
    const select = $(`#${id}`);
    const previous = select.value;
    const initial = id === 'origin' ? 'Auditorio' : id === 'destination' ? 'Laboratorio' : null;
    select.replaceChildren();
    state.graph.vertices.forEach(name => select.add(new Option(name, name)));
    if (state.graph.vertices.includes(previous)) select.value = previous;
    else if (state.graph.vertices.includes(initial)) select.value = initial;
    else if (id.includes('destination') && select.options.length > 1) select.selectedIndex = 1;
    select.disabled = !state.graph.vertices.length;
  });
  $('#save-edge').disabled = state.graph.vertices.length < 2;
}

function renderGraph() {
  const svg = $('#graph');
  svg.replaceChildren();
  const size = dimensions();
  svg.setAttribute('viewBox', `0 0 ${size.width} ${size.height}`);
  svg.setAttribute('aria-label', state.section === 'campus' ? 'Grafo interactivo del campus' : 'Grafo dirigido de asignaturas');
  const title = svgElement('title');
  title.textContent = state.section === 'campus' ? 'Campus universitario: edificios y conexiones bidireccionales' : 'Asignaturas y dependencias dirigidas';
  const defs = svgElement('defs');
  ['normal', 'highlight'].forEach((name, index) => {
    const marker = svgElement('marker', {id: `arrow-${name}`, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse'});
    marker.append(svgElement('path', {d: 'M 0 0 L 10 5 L 0 10 z', fill: index ? '#b094ff' : '#587b99'}));
    defs.append(marker);
  });
  const centerX = size.width / 2, centerY = size.height / 2;
  const group = svgElement('g', {id: 'graph-content', transform: `translate(${centerX} ${centerY}) scale(${state.zoom}) translate(${-centerX} ${-centerY})`});
  state.graph.aristas.forEach(([a, b]) => {
    const from = state.positions[a], to = state.positions[b];
    const dx = to.x - from.x, dy = to.y - from.y, length = Math.hypot(dx, dy) || 1;
    const offset = state.graph.dirigido ? 36 : 29;
    let classes = 'edge';
    if (state.visited.includes(a) && state.visited.includes(b)) classes += ' explored';
    if (state.tree.some(([u, v]) => (u === a && v === b) || (!state.graph.dirigido && u === b && v === a))) classes += ' dfs';
    if (state.route.some((name, index) => index < state.route.length - 1 && ((name === a && state.route[index + 1] === b) || (name === b && state.route[index + 1] === a)))) classes += ' route';
    // Dos aristas opuestas usan curvas distintas para conservar ambas flechas.
    const reciprocal = state.graph.dirigido && state.graph.adyacencia[b].includes(a);
    const attrs = {class: classes, 'data-edge': `${a} → ${b}`};
    let edge;
    if (reciprocal) {
      const x1 = from.x + dx / length * offset, y1 = from.y + dy / length * offset;
      const x2 = to.x - dx / length * offset, y2 = to.y - dy / length * offset;
      edge = svgElement('path', {...attrs, d: `M ${x1} ${y1} Q ${(from.x + to.x) / 2 - dy / length * 38} ${(from.y + to.y) / 2 + dx / length * 38} ${x2} ${y2}`, fill: 'none'});
    } else {
      edge = svgElement('line', {...attrs, x1: from.x + dx / length * offset, y1: from.y + dy / length * offset, x2: to.x - dx / length * offset, y2: to.y - dy / length * offset});
    }
    if (state.graph.dirigido) edge.setAttribute('marker-end', `url(#arrow-${classes.includes('dfs') ? 'highlight' : 'normal'})`);
    group.append(edge);
  });
  state.graph.vertices.forEach((name, index) => {
    const position = state.positions[name];
    let classes = 'node';
    if (state.visited.includes(name)) classes += state.result?.algoritmo === 'DFS' || state.section === 'dependencias' ? ' dfs' : ' explored';
    if (state.route.includes(name)) classes += ' route';
    if (state.current === name) classes += ' current';
    if (state.selected === name) classes += ' selected';
    const node = svgElement('g', {class: classes, transform: `translate(${position.x} ${position.y})`, tabindex: 0, role: 'button', 'aria-label': `${name}. Seleccionar como origen`, 'data-name': name});
    const nodeTitle = svgElement('title'); nodeTitle.textContent = `${name} · Arrastra para mover; selecciona para usar como origen`;
    node.append(nodeTitle, svgElement('circle', {r: 37, class: 'node-halo'}), svgElement('circle', {r: 28, class: 'node-circle'}));
    const drawing = state.section === 'campus'
      ? ['M -12 12 H 12 M -9 12 V -5 L 0 -11 L 9 -5 V 12', 'M -4 12 V 5 H 4 V 12 M -5 -2 H -4 M 4 -2 H 5']
      : ['M 0 -8 V 12 M 0 -8 C -5 -12 -13 -10 -13 -10 V 9 C -7 8 -3 9 0 12 C 3 9 7 8 13 9 V -10 C 7 -10 5 -12 0 -8'];
    drawing.forEach(d => node.append(svgElement('path', {d, class: 'node-building'})));
    const label = svgElement('text', {class: 'node-name', y: 53});
    const words = name.split(' ');
    if (name.length > 23) {
      const middle = Math.ceil(words.length / 2);
      [words.slice(0, middle).join(' '), words.slice(middle).join(' ')].forEach((line, lineIndex) => {
        const span = svgElement('tspan', {x: 0, dy: lineIndex ? 16 : 0}); span.textContent = line; label.append(span);
      });
    } else label.textContent = name;
    const subtitle = svgElement('text', {class: 'node-order', y: name.length > 23 ? 84 : 69});
    subtitle.textContent = state.section === 'campus' ? `EDIFICIO ${String(index + 1).padStart(2, '0')}` : `ASIGNATURA ${String(index + 1).padStart(2, '0')}`;
    node.append(label, subtitle);
    const visit = state.visited.indexOf(name);
    if (visit >= 0) {
      const badge = svgElement('circle', {cx: 24, cy: -22, r: 10, class: 'step-badge'});
      const number = svgElement('text', {x: 24, y: -18, class: 'step-number'}); number.textContent = visit + 1;
      node.append(badge, number);
    }
    node.addEventListener('pointerdown', startDrag);
    node.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectNode(name); } });
    group.append(node);
  });
  svg.append(title, defs, group);
}
let drag = null;
function graphPoint(event) {
  const point = $('#graph').createSVGPoint(); point.x = event.clientX; point.y = event.clientY;
  return point.matrixTransform($('#graph-content').getScreenCTM().inverse());
}
function startDrag(event) {
  if (event.button !== 0) return;
  const name = event.currentTarget.dataset.name;
  const point = graphPoint(event);
  drag = {name, dx: point.x - state.positions[name].x, dy: point.y - state.positions[name].y, startX: event.clientX, startY: event.clientY, moved: false};
  $('#graph').setPointerCapture(event.pointerId);
}
$('#graph').addEventListener('pointermove', event => {
  if (!drag) return;
  if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 4 && !drag.moved) return;
  drag.moved = true;
  const point = graphPoint(event);
  const size = dimensions();
  state.positions[drag.name] = {x: Math.max(65, Math.min(size.width - 65, point.x - drag.dx)), y: Math.max(65, Math.min(size.height - 105, point.y - drag.dy))};
  renderGraph();
});
$('#graph').addEventListener('pointerup', () => { if (drag && !drag.moved) selectNode(drag.name); drag = null; });
$('#graph').addEventListener('pointercancel', () => { drag = null; });
function selectNode(name) {
  state.selected = name;
  if (state.section === 'campus') { $('#origin').value = name; toast(`Origen seleccionado: ${name}`); }
  else toast(`Asignatura: ${name}`);
  renderGraph();
}
function renderAdjacency() {
  const list = $('#adjacency'); list.replaceChildren();
  Object.entries(state.graph.adyacencia).forEach(([name, neighbors]) => {
    const row = element('div', 'adjacency-row');
    row.append(element('span', 'adjacency-name', name), element('span', 'adjacency-arrow', '→'), element('span', 'adjacency-neighbors', neighbors.join(' · ') || 'Sin conexiones'));
    list.append(row);
  });
  if (!state.graph.vertices.length) list.append(element('p', 'muted', 'El diccionario está vacío. Agrega el primer vértice.'));
}

function pauseAnimation() { clearInterval(state.timer); state.timer = null; $('#animation-start').replaceChildren(icon('play'), document.createTextNode('Iniciar')); }
function resetResult() {
  pauseAnimation(); state.result = null; state.step = 0; state.visited = []; state.route = []; state.tree = []; state.current = null;
  $('#stat-visited').replaceChildren(document.createTextNode('— '), element('small', '', 'vértices'));
  $('#stat-algorithm').textContent = 'Listo para explorar';
  $('#result-dot').classList.remove('ready');
  const empty = element('div', 'empty-result'); const badge = element('span', 'empty-result-icon'); badge.append(icon('route'));
  empty.append(badge, element('p', '', state.section === 'campus' ? 'El próximo camino empieza aquí' : 'Tu aprendizaje, en orden'), element('small', '', state.section === 'campus' ? 'Selecciona tus edificios y ejecuta un algoritmo para ver el resultado.' : 'Comprueba las dependencias para obtener un orden de asignaturas válido.'));
  $('#result').replaceChildren(empty);
  $('#animation-status').textContent = state.section === 'campus' ? 'Ejecuta un algoritmo para comenzar' : 'BFS y DFS están disponibles en el campus';
  $('#frontier').hidden = true;
  ['animation-start', 'animation-next', 'animation-reset'].forEach(id => { $(`#${id}`).disabled = true; });
}
function switchAlgorithm(algorithm) {
  if (state.busy) return;
  state.algorithm = algorithm;
  const bfs = algorithm === 'BFS';
  $$('.algorithm-tabs button').forEach(button => { const active = button.dataset.algorithm === algorithm; button.classList.toggle('active', active); button.setAttribute('aria-selected', active); });
  $('#algorithm-form').setAttribute('aria-labelledby', bfs ? 'tab-bfs' : 'tab-dfs');
  $('#destination-field').hidden = !bfs; $('#destination').required = bfs;
  $('#origin-label').textContent = bfs ? 'Edificio de origen' : 'Edificio inicial';
  $('#algorithm-badge').textContent = bfs ? 'BÚSQUEDA EN ANCHURA' : 'BÚSQUEDA EN PROFUNDIDAD';
  $('#algorithm-badge').classList.toggle('violet-text', !bfs);
  $('#algorithm-description').textContent = bfs ? 'Encuentra la ruta con menos conexiones entre dos edificios.' : 'Explora cada ramificación antes de retroceder y continuar.';
  $('#run-label').textContent = bfs ? 'Encontrar ruta mínima' : 'Recorrer en profundidad';
  $('#run-algorithm').classList.toggle('violet-button', !bfs);
  $('#learning-title').textContent = bfs ? 'Primero cerca. Después, más lejos.' : 'Una rama a la vez.';
  $('#learning-copy').textContent = bfs ? 'BFS explora por niveles: primero los vecinos, después los vecinos de esos vecinos. Así encuentra la ruta con menos aristas en un grafo sin peso.' : 'DFS utiliza una pila LIFO: el último en entrar es el primero en salir. Profundiza en una rama y retrocede cuando ya no hay vecinos nuevos. Su orden de visita no es una ruta directa sin retrocesos.';
  $('#learning-visual').replaceChildren();
  (bfs ? ['Origen', 'Vecinos', 'Más lejos'] : ['Apilar', 'Profundizar', 'Retroceder']).forEach((label, index) => {
    if (index) $('#learning-visual').append(element('b', '', '→'));
    const box = element('span', '', label); box.append(element('small', '', bfs ? `Nivel ${index}` : 'Pila LIFO')); $('#learning-visual').append(box);
  });
  resetResult(); if (state.graph) renderGraph();
}
$$('[data-algorithm]').forEach(button => button.addEventListener('click', () => switchAlgorithm(button.dataset.algorithm)));
$('.algorithm-tabs').addEventListener('keydown', event => {
  if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
  event.preventDefault(); switchAlgorithm(state.algorithm === 'BFS' ? 'DFS' : 'BFS');
  $(`[data-algorithm="${state.algorithm}"]`).focus();
});
$('#algorithm-form').addEventListener('submit', async event => {
  event.preventDefault(); if (state.busy || state.loading) return;
  state.busy = true; $('#run-algorithm').disabled = true;
  try {
    const query = new URLSearchParams(state.algorithm === 'BFS' ? {origen: $('#origin').value, destino: $('#destination').value} : {inicio: $('#origin').value});
    const result = await api(`/api/${state.algorithm === 'BFS' ? 'ruta' : 'recorrido'}?${query}`);
    resetResult(); state.result = result;
    $('#stat-algorithm').textContent = `${result.algoritmo} · exploración en curso`;
    $('#animation-reset').disabled = false;
    if ($('#step-mode').checked) prepareAnimation();
    else { state.step = result.pasos.length; applyStep(); }
  } catch (error) { toast(error.message, true); }
  finally { state.busy = false; $('#run-algorithm').disabled = !state.graph?.vertices.length; }
});
function prepareAnimation() {
  pauseAnimation(); state.step = 0; state.visited = []; state.route = []; state.tree = []; state.current = null;
  const pending = element('div', 'pending-result');
  pending.append(element('strong', '', `${state.result.algoritmo} está listo para explorar`), document.createTextNode('Pulsa Iniciar para reproducir o Siguiente paso para avanzar a tu ritmo. La ruta final se mostrará al terminar.'));
  $('#result').replaceChildren(pending); $('#result-dot').classList.remove('ready');
  $('#stat-visited').replaceChildren(document.createTextNode('0 '), element('small', '', 'vértices'));
  $('#stat-algorithm').textContent = `${state.result.algoritmo} · preparado`;
  $('#animation-status').textContent = `Paso 0 de ${state.result.pasos.length}`;
  $('#frontier').textContent = `${state.result.algoritmo === 'BFS' ? 'Cola FIFO' : 'Pila LIFO (próximo primero)'}: ${state.result.explorados[0]}`;
  $('#frontier').hidden = false;
  $('#animation-start').disabled = false; $('#animation-next').disabled = false;
  renderGraph();
}
function applyStep() {
  const result = state.result; if (!result) return;
  state.visited = result.explorados.slice(0, state.step);
  state.current = state.visited.at(-1);
  if (result.algoritmo === 'DFS') state.tree = result.aristas_arbol.filter(([, child]) => state.visited.includes(child));
  const done = state.step >= result.pasos.length;
  $('#stat-visited').replaceChildren(document.createTextNode(`${state.visited.length} `), element('small', '', 'vértices'));
  $('#animation-status').textContent = `Paso ${state.step} de ${result.pasos.length}${done ? ' · Completado' : ` · ${state.current}`}`;
  const step = result.pasos[state.step - 1];
  $('#frontier').hidden = false;
  $('#frontier').textContent = `${result.algoritmo === 'BFS' ? 'Cola FIFO' : 'Pila LIFO (próximo primero)'}: ${step?.frontera.join(' → ') || 'vacía'}${step?.nivel !== undefined ? ` · Nivel actual: ${step.nivel}` : ''}`;
  if (done) {
    pauseAnimation(); state.current = null;
    if (result.algoritmo === 'BFS') state.route = result.ruta;
    $('#animation-start').disabled = true; $('#animation-next').disabled = true;
    $('#stat-algorithm').textContent = `${result.algoritmo} · recorrido completado`;
    renderResult();
  } else {
    const pending = element('div', 'pending-result');
    pending.append(element('strong', '', `Explorando: ${state.current}`), document.createTextNode(state.visited.join(' → ')));
    $('#result').replaceChildren(pending);
  }
  renderGraph();
}
function nextStep() { if (!state.result || state.step >= state.result.pasos.length) return; state.step++; applyStep(); }
$('#animation-next').addEventListener('click', () => { pauseAnimation(); nextStep(); });
$('#animation-start').addEventListener('click', () => {
  if (state.timer) { pauseAnimation(); return; }
  nextStep();
  if (state.step < state.result.pasos.length) {
    $('#animation-start').replaceChildren(document.createTextNode('Ⅱ Pausar'));
    state.timer = setInterval(nextStep, 850);
  }
});
$('#animation-reset').addEventListener('click', () => { if (state.result) prepareAnimation(); });
function renderResult() {
  const result = state.result, bfs = result.algoritmo === 'BFS';
  $('#result-dot').classList.add('ready');
  const content = element('div', 'result-content');
  const tag = element('div', `result-tag${bfs ? '' : ' violet'}`);
  tag.append(icon(bfs && !result.encontrada ? 'info' : 'check'), document.createTextNode(bfs ? (result.encontrada ? 'Ruta mínima encontrada' : 'No existe una ruta') : 'Recorrido completado'));
  content.append(tag);
  const route = element('div', 'result-route');
  (bfs ? result.ruta : result.orden).forEach((name, index) => {
    if (index) route.append(element('span', 'route-arrow', '→'));
    route.append(element('span', `route-chip${bfs ? '' : ' violet'}`, name));
  });
  content.append(route);
  const metrics = element('div', 'result-metrics');
  const metric = element('span'); metric.append(element('strong', '', result.total_visitados), document.createTextNode('explorados'));
  metrics.append(metric);
  if (bfs && result.encontrada) {
    const connections = element('span'); connections.append(element('strong', '', result.conexiones), document.createTextNode('conexiones')); metrics.append(connections);
  }
  content.append(metrics, element('p', 'result-note', bfs ? (result.encontrada ? 'BFS encuentra la menor cantidad de conexiones, no una distancia física.' : 'Los edificios están en componentes desconectados. Agrega una conexión para unirlos.') : 'Este es el orden de visita. DFS puede retroceder; dos visitas consecutivas no siempre tienen una arista directa.'));
  $('#result').replaceChildren(content);
}

async function changeSection(section) {
  if (state.busy || state.loading) return;
  if (state.section === section) { if (!state.graph) await loadGraph(); return; }
  state.section = section; state.selected = null; state.zoom = 1;
  $('#zoom-value').textContent = '100%'; resetResult();
  const campus = section === 'campus';
  $$('[data-section]').forEach(button => { button.classList.toggle('active', button.dataset.section === section); if (button.dataset.section === section) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current'); });
  $('#breadcrumb-section').textContent = campus ? 'Campus universitario' : 'Dependencias académicas';
  $('#page-title').replaceChildren(document.createTextNode(campus ? 'Tu campus, conectado' : 'Conocimiento que conecta'), element('span', '', '.'));
  $('#page-description').textContent = campus ? 'Descubre cómo los grafos conectan lugares y encuentra el camino entre ellos.' : 'Explora prerrequisitos, detecta ciclos y construye un orden para aprender.';
  $('#vertices-label').textContent = campus ? 'Edificios' : 'Asignaturas';
  $('#edges-label').textContent = campus ? 'Conexiones' : 'Dependencias';
  $('#edge-caption').textContent = campus ? 'En ambos sentidos' : 'Con dirección';
  $('#graph-title').textContent = campus ? 'Mapa del campus' : 'Mapa de asignaturas';
  $('#graph-subtitle').textContent = campus ? 'Un lugar para cada vértice. Un camino para cada conexión.' : 'Cada flecha une un prerrequisito con la asignatura que depende de él.';
  $('#graph-type').replaceChildren(element('span'), document.createTextNode(campus ? 'No dirigido' : 'Dirigido'));
  $('#add-vertex-label').textContent = campus ? 'Edificio' : 'Asignatura';
  $('#add-edge-label').textContent = campus ? 'Conexión' : 'Dependencia';
  $('#canvas-label').textContent = campus ? 'CAMPUS UNIVERSITARIO' : 'DEPENDENCIAS ACADÉMICAS';
  $('#campus-tools').hidden = !campus; $('#dependency-tools').hidden = campus;
  $('#adjacency-note').textContent = campus ? 'Cada conexión aparece en ambos sentidos porque el grafo no es dirigido.' : 'Los vecinos son las asignaturas dependientes: las aristas solo se guardan en su dirección.';
  if (campus) switchAlgorithm(state.algorithm);
  else {
    $('#learning-title').textContent = 'Aprender tiene su orden.';
    $('#learning-copy').textContent = 'Kahn cuenta los prerrequisitos de cada asignatura. Retira las que no tienen requisitos pendientes y actualiza las demás. Si quedan asignaturas sin poder retirar, existe un ciclo.';
    $('#learning-visual').replaceChildren();
    ['Sin requisitos', 'Retirar', 'Repetir'].forEach((text, i) => { if (i) $('#learning-visual').append(element('b', '', '→')); $('#learning-visual').append(element('span', '', text)); });
  }
  await loadGraph();
}
$$('[data-section]').forEach(button => button.addEventListener('click', () => changeSection(button.dataset.section)));
$('#topological').addEventListener('click', async () => {
  if (state.busy || state.loading) return; state.busy = true; $('#topological').disabled = true;
  try {
    const result = await api('/api/dependencias/orden'); resetResult();
    const content = element('div', 'result-content');
    content.append(element('div', 'result-tag violet', result.hay_ciclo ? 'Se detectó un ciclo' : 'Orden topológico válido'), element('p', 'result-note', result.mensaje));
    if (!result.hay_ciclo) {
      const list = element('ol', 'topo-list'); result.orden.forEach(name => list.append(element('li', '', name))); content.append(list);
      state.visited = result.orden; state.tree = state.graph.aristas;
      $('#stat-visited').replaceChildren(document.createTextNode(`${result.orden.length} `), element('small', '', 'vértices'));
    } else content.append(element('p', 'result-note', `Asignaturas bloqueadas por el ciclo (incluye sus dependientes): ${result.bloqueadas.join(', ')}.`));
    $('#stat-algorithm').textContent = result.hay_ciclo ? 'Kahn · ciclo detectado' : 'Kahn · orden generado';
    $('#result').replaceChildren(content); $('#result-dot').classList.add('ready'); renderGraph();
  } catch (error) { toast(error.message, true); }
  finally { state.busy = false; $('#topological').disabled = !state.graph?.vertices.length; }
});

function confirmAction(message, acceptText = 'Eliminar') {
  $('#confirm-message').textContent = message; $('#confirm-accept').textContent = acceptText;
  const dialog = $('#confirm-dialog'); dialog.showModal();
  return new Promise(resolve => {
    let answered = false;
    const finish = value => { if (answered) return; answered = true; dialog.close(); $('#confirm-accept').onclick = null; $('#confirm-cancel').onclick = null; dialog.removeEventListener('cancel', cancel); resolve(value); };
    const cancel = event => { event.preventDefault(); finish(false); };
    $('#confirm-accept').onclick = () => finish(true); $('#confirm-cancel').onclick = () => finish(false);
    dialog.addEventListener('cancel', cancel); $('#confirm-cancel').focus();
  });
}
function openEditor(tab) {
  if (!state.graph || state.busy || state.loading) return;
  pauseAnimation(); state.editor = tab; $('#editor-error').hidden = true;
  const campus = state.section === 'campus';
  $('#vertex-name-label').textContent = campus ? 'Nombre del edificio' : 'Nombre de la asignatura';
  $('#vertex-name').placeholder = campus ? 'Ej. Centro deportivo' : 'Ej. Matemática Discreta';
  $('#edge-origin-label').textContent = campus ? 'Desde el edificio' : 'Prerrequisito';
  $('#edge-destination-label').textContent = campus ? 'Hasta el edificio' : 'Asignatura dependiente';
  $('#save-edge').textContent = campus ? 'Crear conexión' : 'Crear dependencia';
  $('#edge-direction-hint').textContent = campus ? 'La conexión se agregará en ambos sentidos.' : 'Dirección: prerrequisito → asignatura dependiente. Se permiten ciclos para estudiarlos y detectarlos.';
  renderEditor(); $('#editor-dialog').showModal();
  (tab === 'vertices' ? $('#vertex-name') : $('#edge-origin')).focus();
}
$('#add-vertex').addEventListener('click', () => openEditor('vertices'));
$('#add-edge').addEventListener('click', () => openEditor('edges'));
$('#close-editor').addEventListener('click', () => $('#editor-dialog').close());
$$('[data-editor]').forEach(button => button.addEventListener('click', () => { state.editor = button.dataset.editor; $('#editor-error').hidden = true; renderEditor(); }));
function renderEditor() {
  if (!state.graph) return;
  const vertices = state.editor === 'vertices', campus = state.section === 'campus';
  $('#editor-title').textContent = vertices ? (campus ? 'Administrar edificios' : 'Administrar asignaturas') : (campus ? 'Administrar conexiones' : 'Administrar dependencias');
  $$('[data-editor]').forEach(button => button.classList.toggle('active', (button.dataset.editor === 'vertices') === vertices));
  $('#vertex-form').hidden = !vertices; $('#edge-form').hidden = vertices;
  const list = $('#editor-list'); list.replaceChildren();
  const items = vertices ? state.graph.vertices : state.graph.aristas;
  items.forEach(item => {
    const text = vertices ? item : item.join(state.graph.dirigido ? ' → ' : ' ↔ ');
    const row = element('div', 'editor-row'); const remove = element('button', 'icon-button'); remove.type = 'button'; remove.setAttribute('aria-label', `Eliminar ${text}`); remove.append(icon('trash'));
    remove.addEventListener('click', async () => {
      if (state.busy) return;
      if (!await confirmAction(vertices ? `Se eliminará «${text}» y todas sus conexiones. Esta acción no se puede deshacer.` : `Se eliminará la conexión ${text}.`)) return;
      const endpoint = vertices ? (campus ? '/vertices' : '/asignaturas') : '/conexiones';
      await mutate(`${baseUrl()}${endpoint}`, 'DELETE', vertices ? {nombre: item} : {origen: item[0], destino: item[1]}, 'Elemento eliminado.');
    });
    row.append(element('span', '', text), remove); list.append(row);
  });
  if (!items.length) list.append(element('p', 'muted', vertices ? 'Aún no hay vértices.' : 'Aún no hay conexiones.'));
}
async function mutate(url, method, data, message) {
  if (state.busy || state.loading) return false;
  state.busy = true;
  $$('#editor-dialog button[type=submit]').forEach(button => { button.disabled = true; });
  try {
    const graph = await api(url, method, data); acceptGraph(graph); $('#editor-error').hidden = true; toast(message); return true;
  } catch (error) {
    if ($('#editor-dialog').open) { $('#editor-error').textContent = error.message; $('#editor-error').hidden = false; }
    else toast(error.message, true);
    return false;
  } finally {
    state.busy = false;
    $('#vertex-form button').disabled = false;
    $('#save-edge').disabled = !state.graph || state.graph.vertices.length < 2;
  }
}
$('#vertex-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (await mutate(`${baseUrl()}/${state.section === 'campus' ? 'vertices' : 'asignaturas'}`, 'POST', {nombre: $('#vertex-name').value}, 'Vértice agregado.')) { $('#vertex-name').value = ''; $('#vertex-name').focus(); }
});
$('#edge-form').addEventListener('submit', async event => {
  event.preventDefault();
  await mutate(`${baseUrl()}/conexiones`, 'POST', {origen: $('#edge-origin').value, destino: $('#edge-destination').value}, 'Conexión agregada.');
});
$('#restore').addEventListener('click', async () => {
  if (state.busy || state.loading) return;
  if (!await confirmAction('Se recuperará el ejemplo original de esta sección. Los cambios actuales se perderán.', 'Restaurar ejemplo')) return;
  if (await mutate(`${baseUrl()}/restaurar`, 'POST', undefined, 'Ejemplo original restaurado.')) {
    state.selected = null; positionNodes(true); state.zoom = 1; $('#zoom-value').textContent = '100%'; renderGraph();
  }
});
function zoom(delta) { if (!state.graph) return; state.zoom = Math.max(.65, Math.min(1.65, state.zoom + delta)); $('#zoom-value').textContent = `${Math.round(state.zoom * 100)}%`; renderGraph(); }
$('#zoom-in').addEventListener('click', () => zoom(.1));
$('#zoom-out').addEventListener('click', () => zoom(-.1));
$('#fit').addEventListener('click', () => { if (!state.graph) return; state.zoom = 1; $('#zoom-value').textContent = '100%'; positionNodes(true); renderGraph(); });
window.addEventListener('pagehide', pauseAnimation);
mobileViewport.addEventListener('change', () => {
  layouts.campus = Object.create(null); layouts.dependencias = Object.create(null);
  if (state.graph) { positionNodes(); renderGraph(); }
});
loadGraph();
