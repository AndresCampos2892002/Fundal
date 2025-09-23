/* ============================================
   CALENDAR.JS - FUNCIONALIDAD COMPLETA
============================================ */

/* ============================================
   FECHAS
============================================ */
function ymdFromDateLocal(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function dateFromYMD(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function safeDateStr(value) {
  if (!value) return null;
  if (value instanceof Date) return ymdFromDateLocal(value);
  const s = String(value).trim();
  if (s.includes('T')) return s.split('T')[0];
  if (s.includes(' ')) return s.split(' ')[0];
  return s.slice(0, 10);
}

/* ============================================
   DATOS (Desde el backend)
============================================ */
const DATA_EVENTOS = RAW_EVENTOS.map(e => ({
  id: e.id,
  date: safeDateStr(e.fecha),
  title: e.titulo,
  descripcion: e.descripcion || '',
  hora: e.hora || null
}));

const DATA_NOTAS = RAW_NOTAS.map(n => ({
  id: n.id,
  date: safeDateStr(n.fecha),
  text: n.nota,
  hora: n.hora || null
}));

/* ============================================
   DOM
============================================ */
const calendarEl = document.getElementById('calendar');
const tituloMes = document.getElementById('titulo-mes');
const agendaFecha = document.getElementById('agenda-fecha');
const agendaLista = document.getElementById('agenda-lista');
const btnEvento = document.getElementById('btnAgregarEvento');
const btnNota = document.getElementById('btnAgregarNota');
const eventoFecha = document.getElementById('evento-fecha');
const eventoFechaTxt = document.getElementById('evento-fecha-texto');
const notaFecha = document.getElementById('nota-fecha');
const notaFechaTxt = document.getElementById('nota-fecha-texto');

let fechaActual = new Date();
let fechaSeleccionada = null;

/* ============================================
   NOTIFICACIONES
============================================ */
document.addEventListener('DOMContentLoaded', () => {

  // Pedir permiso para notificaciones
  if (!('Notification' in window)) {
    console.warn('Este navegador no soporta notificaciones.');
  } else if (Notification.permission === 'default') {
    Notification.requestPermission().then(permission => {
      console.log('Permiso de notificación:', permission);
    });
  } else {
    console.log('Estado actual de notificaciones:', Notification.permission);
  }

  // Renderizamos calendario al cargar
  renderizarCalendario();
});

function crearNotificacion(titulo, cuerpo) {
  if (Notification.permission === 'granted') {
    const notif = new Notification(titulo, {
      body: cuerpo,
      icon: '/img/calendar-icon.png'
    });
    notif.onclick = () => window.focus();
  }
}

function programarNotificacion(fechaStr, horaStr, titulo, texto) {
  if (!fechaStr) return;
  let [y, m, d] = fechaStr.split('-').map(Number);
  let [h, min] = (horaStr || '00:00').split(':').map(Number);
  const fechaEvento = new Date(y, m - 1, d, h, min, 0);
  const tiempoMs = fechaEvento.getTime() - Date.now();
  if (tiempoMs > 0) setTimeout(() => crearNotificacion(titulo, texto), tiempoMs);
}

/* ============================================
   CALENDARIO
============================================ */
function tieneEventos(dateStr) { return DATA_EVENTOS.some(e => e.date === dateStr); }
function tieneNotas(dateStr) { return DATA_NOTAS.some(n => n.date === dateStr); }

function renderizarCalendario() {
  calendarEl.innerHTML = '';
  const year = fechaActual.getFullYear();
  const month = fechaActual.getMonth();
  const today = new Date();
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0);
  const startDay = (monthStart.getDay() + 6) % 7; // lunes = 0

  ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].forEach(d => {
    const header = document.createElement('div');
    header.className = 'day-header';
    header.textContent = d;
    calendarEl.appendChild(header);
  });

  for (let i = 0; i < startDay; i++) calendarEl.appendChild(document.createElement('div'));

  for (let day = 1; day <= monthEnd.getDate(); day++) {
    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const cell = document.createElement('div');
    cell.className = 'day-cell';
    const span = document.createElement('span'); span.textContent = day; cell.appendChild(span);

    if (day === today.getDate() && month === today.getMonth() && year === today.getFullYear()) cell.classList.add('today');

    if (tieneEventos(dateStr) || tieneNotas(dateStr)) {
      const dotContainer = document.createElement('div'); dotContainer.className = 'day-dot';
      if (tieneEventos(dateStr)) { const eDot = document.createElement('span'); eDot.className = 'event-dot'; dotContainer.appendChild(eDot); }
      if (tieneNotas(dateStr)) { const nDot = document.createElement('span'); nDot.className = 'note-dot'; dotContainer.appendChild(nDot); }
      cell.appendChild(dotContainer);
    }

    cell.addEventListener('click', () => seleccionarDia(dateStr, cell));
    calendarEl.appendChild(cell);
  }

  tituloMes.textContent = fechaActual.toLocaleString('es-ES', { month:'long', year:'numeric' }).toUpperCase();

  const defaultStr = (today.getMonth() === month && today.getFullYear() === year) ? ymdFromDateLocal(today) : `${year}-${String(month+1).padStart(2,'0')}-01`;
  const celdas = calendarEl.querySelectorAll('.day-cell');
  const dayNum = parseInt(defaultStr.split('-')[2],10);
  const celdaCorrecta = Array.from(celdas).find(c => c.textContent == dayNum);
  if (celdaCorrecta) seleccionarDia(defaultStr, celdaCorrecta, false);
}

function cambiarMes(valor) {
  fechaActual.setMonth(fechaActual.getMonth() + valor);
  renderizarCalendario();
}

function seleccionarDia(dateStr, cellEl, focusButtons = true) {
  calendarEl.querySelectorAll('.day-cell.day-selected').forEach(c => c.classList.remove('day-selected'));
  cellEl.classList.add('day-selected');
  fechaSeleccionada = dateStr;
  renderAgenda(dateStr);
  btnEvento.disabled = false; btnNota.disabled = false;
  eventoFecha.value = dateStr; eventoFechaTxt.textContent = dateStr;
  notaFecha.value = dateStr; notaFechaTxt.textContent = dateStr;
  if (focusButtons) btnEvento.focus();
}

/* ============================================
   AGENDA
============================================ */
function renderAgenda(dateStr) {
  agendaFecha.textContent = dateFromYMD(dateStr).toLocaleDateString('es-ES', { weekday:'long', year:'numeric', month:'long', day:'numeric' });

  const eventosDelDia = DATA_EVENTOS.filter(e => e.date === dateStr);
  const notasDelDia = DATA_NOTAS.filter(n => n.date === dateStr);

  agendaLista.innerHTML = '';
  if (!eventosDelDia.length && !notasDelDia.length) {
    agendaLista.innerHTML = '<p class="agenda-empty m-0">No hay nada para este día.</p>';
    return;
  }

  if (eventosDelDia.length) {
    const h = document.createElement('h6'); h.textContent = 'Eventos'; agendaLista.appendChild(h);
    eventosDelDia.forEach(ev => {
      const item = document.createElement('div'); item.className = 'agenda-item';
      item.innerHTML = `<div class="d-flex justify-content-between align-items-start">
        <div>
          <div class="fw-semibold event-title">${ev.title}</div>
          ${ev.descripcion ? `<div class="small text-muted">${ev.descripcion}</div>` : ''}
        </div>
        <div class="btn-group btn-group-sm">
          <button class="btn btn-outline-primary" onclick="editarEvento(${ev.id},'${ev.title}','${ev.descripcion || ''}','${ev.hora || ''}')">✏️</button>
          <form action="/calendar/evento/eliminar" method="POST" style="display:inline;">
            <input type="hidden" name="id" value="${ev.id}">
            <button class="btn btn-outline-danger" type="submit">🗑️</button>
          </form>
        </div>
      </div>`;
      agendaLista.appendChild(item);
    });
  }

  if (notasDelDia.length) {
    const h2 = document.createElement('h6'); h2.className = 'mt-3'; h2.textContent = 'Notas personales'; agendaLista.appendChild(h2);
    notasDelDia.sort((a,b) => (a.hora||'00:00').localeCompare(b.hora||'00:00'));
    notasDelDia.forEach(nt => {
      const item = document.createElement('div'); item.className = 'agenda-item';
      item.innerHTML = `<div class="d-flex justify-content-between align-items-start">
        <div>
          <div class="note-text">${nt.text}</div>
          ${nt.hora ? `<div class="agenda-time">⏰ ${nt.hora}</div>` : ''}
        </div>
        <div class="btn-group btn-group-sm">
          <button class="btn btn-outline-primary" onclick="editarNota(${nt.id},'${nt.text}','${nt.hora || ''}')">✏️</button>
          <form action="/calendar/nota/eliminar" method="POST" style="display:inline;">
            <input type="hidden" name="id" value="${nt.id}">
            <button class="btn btn-outline-danger" type="submit">🗑️</button>
          </form>
        </div>
      </div>`;
      agendaLista.appendChild(item);

      if (nt.hora) programarNotificacion(dateStr, nt.hora, 'Recordatorio de Nota', nt.text);
    });
  }
}

/* ============================================
   FUNCIONES EDITAR
============================================ */
function editarEvento(id, titulo, descripcion, hora) {
  const modal = new bootstrap.Modal(document.getElementById('modalEvento'));
  modal.show();
  const form = document.querySelector('#modalEvento form');
  form.action = '/calendar/evento/editar';
  form.querySelector('input[name="titulo"]').value = titulo;
  form.querySelector('textarea[name="descripcion"]').value = descripcion;
  form.querySelector('input[name="hora"]').value = hora || '';
  let inputId = form.querySelector('input[name="id"]');
  if (!inputId) { inputId = document.createElement('input'); inputId.type = 'hidden'; inputId.name = 'id'; form.appendChild(inputId); }
  inputId.value = id;
}

function editarNota(id, nota, hora) {
  const modal = new bootstrap.Modal(document.getElementById('modalNota'));
  modal.show();
  const form = document.getElementById('notaForm');
  form.action = '/calendar/nota/editar';
  form.querySelector('textarea[name="nota"]').value = nota;
  form.querySelector('input[name="hora"]').value = hora || '';
  let inputId = form.querySelector('input[name="id"]');
  if (!inputId) { inputId = document.createElement('input'); inputId.type = 'hidden'; inputId.name = 'id'; form.appendChild(inputId); }
  inputId.value = id;
}
