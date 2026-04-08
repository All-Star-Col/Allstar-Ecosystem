import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import StatusPill from '../components/StatusPill.jsx';
import SearchableSelect from '../components/SearchableSelect.jsx';
import CollapseToggle from '../components/CollapseToggle.jsx';
import { carpentryPath } from '../routes';
import { formatFecha, formatNumero, prioridadTexto } from '../utils/format';
import { dbLabel } from '../utils/labels';
import useToast from '../utils/useToast';

function todayIso() 
{
  return new Date().toISOString().slice(0, 10);
}

function createInitialProyecto() 
{
  return {
    id: null,
    nombre: '',
    cliente: '',
    fecha_inicio: todayIso(),
    fecha_compromiso: '',
    fecha_fin: '',
    prioridad: 2,
    responsable_id: '',
    estado: 'pendiente',
    notas: '',
  };
}

const estadoProyectoOptions = 
[
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'planificacion', label: 'Planificación' },
  { value: 'en_progreso', label: 'En progreso' },
  { value: 'finalizado', label: 'Finalizado' },
];

/*
  toDateInputValue():
  Convierte un valor de fecha (Date o string) a formato 'YYYY-MM-DD' para inputs tipo date.
  - value: Date | String | null | undefined
    Valor de fecha a convertir. Puede ser un objeto Date, una cadena de texto, o null/undefined.
  
  Retorna:
  if | String: Fecha en formato 'YYYY-MM-DD' si el valor es válido.
  if | String vacío: Si el valor es null, undefined, no es una fecha válida, o no se reconoce el formato.  
*/
function toDateInputValue(value) 
{
  if (!value) return '';
  
  if (value instanceof Date && !Number.isNaN(value.getTime())) 
  {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === 'string') 
  {
    return value.slice(0, 10);
  }
  return '';
}

function daysRemaining(date) 
{
  if (!date) return null;

  const target = new Date(date);

  if (Number.isNaN(target.getTime())) return null;

  const now = new Date();
  const one = 24 * 60 * 60 * 1000;

  return Math.floor((target.setHours(0, 0, 0, 0) - now.setHours(0, 0, 0, 0)) / one);
}

function personaLabel(persona) {
  return `${persona.nombre}-${persona.area || 'SinArea'}`;
}

function prioridadStyle(val) {
  const v = Number(val);
  if (v === 3) return { color: '#2563EB', borderColor: '#93C5FD', background: '#EFF4FF' };
  if (v === 2) return { color: '#D97706', borderColor: '#FCD34D', background: '#FFFBEB' };
  if (v === 1) return { color: '#DC2626', borderColor: '#FCA5A5', background: '#FEF2F2' };
  return {};
}

const ITEMS_POR_PAGINA = 20;

export default function ProyectosPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [filtros, setFiltros] = useState({ estado: '', prioridad: '', q: '' });
  const [personas, setPersonas] = useState([]);
  const [proyectos, setProyectos] = useState([]);
  const [form, setForm] = useState(createInitialProyecto());
  const [detalle, setDetalle] = useState(null);
  const [seleccionadoId, setSeleccionadoId] = useState(null);
  const [showEditorPanel, setShowEditorPanel] = useState(true);
  const [showListPanel, setShowListPanel] = useState(true);
  const [showEtapas, setShowEtapas] = useState(true);
  const [showLotes, setShowLotes] = useState(true);
  const [showItems, setShowItems] = useState(true);
  const [items, setItems] = useState([]);
  const [itemForm, setItemForm] = useState({ id: null, nombre: '', piso: '', apartamento: '', cantidad: 1 });
  const [editandoItemId, setEditandoItemId] = useState(null);
  const [editandoProyecto, setEditandoProyecto] = useState(false);
  const [colapsadosPorGrupo, setColapsadosPorGrupo] = useState({});
  const [paginaPorGrupo, setPaginaPorGrupo] = useState({});

  const personasResponsables = useMemo(
    () => personas.filter((p) => ['Jefatura', 'Diseño'].includes(p.area)),
    [personas]
  );

  // Agrupa los ítems del contrato por nombre de mueble
  const itemsAgrupados = useMemo(
    () => items.reduce(
      (acc, it) =>
      {
        const grupo = it.nombre || 'Sin nombre';
        if (!acc[grupo]) acc[grupo] = [];
        acc[grupo].push(it);
        return acc;
      },
      {}
    ),
    [items]
  );

  const totalPaginasPorGrupo = useMemo(
    () => Object.fromEntries(
      Object.entries(itemsAgrupados).map(([nombreGrupo, grupoItems]) => [
        nombreGrupo,
        Math.max(1, Math.ceil(grupoItems.length / ITEMS_POR_PAGINA)),
      ])
    ),
    [itemsAgrupados]
  );

  const proyectosFiltrados = useMemo(
    () => proyectos.filter((p) => p.nombre?.toLowerCase().includes(filtros.q.toLowerCase())),
    [proyectos, filtros.q]
  );

  const cargarCatalogos = async () => {
    try {
      const personasData = await api.catalogos.personasActivas();
      setPersonas(personasData);
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  const cargarProyectos = async () => {
    try {
      const data = await api.proyectos.listar({ estado: filtros.estado, prioridad: filtros.prioridad });
      setProyectos(data);
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  const cargarDetalle = async (id) => {
    if (!id) return;
    try {
      const data = await api.proyectos.detalle({ id });
      setDetalle(data);
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  const cargarItems = async (proyecto_id) => {
    if (!proyecto_id) { setItems([]); return; }
    try {
      const data = await api.items.listarPorProyecto({ proyecto_id });
      setItems(data);
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  useEffect(() => {
    cargarCatalogos();
  }, []);

  useEffect(() => {
    cargarProyectos();
  }, [filtros.estado, filtros.prioridad]);

  useEffect(() => {
    cargarDetalle(seleccionadoId);
    cargarItems(seleccionadoId);
  }, [seleccionadoId]);

  useEffect(() => {
    setColapsadosPorGrupo((prev) =>
    {
      const siguiente = { ...prev };
      let cambio = false;

      Object.keys(itemsAgrupados).forEach((nombreGrupo) =>
      {
        if (siguiente[nombreGrupo] === undefined)
        {
          siguiente[nombreGrupo] = true;
          cambio = true;
        }
      });

      return cambio ? siguiente : prev;
    });
  }, [itemsAgrupados]);

  useEffect(() => {
    setPaginaPorGrupo((prev) =>
    {
      const siguiente = { ...prev };
      let cambio = false;

      Object.entries(itemsAgrupados).forEach(([nombreGrupo, grupoItems]) =>
      {
        const totalPaginas = Math.max(1, Math.ceil(grupoItems.length / ITEMS_POR_PAGINA));
        const paginaActual = siguiente[nombreGrupo] || 1;
        const paginaSegura = Math.min(Math.max(paginaActual, 1), totalPaginas);

        if (paginaSegura !== paginaActual) cambio = true;
        siguiente[nombreGrupo] = paginaSegura;
      });

      return cambio ? siguiente : prev;
    });
  }, [itemsAgrupados]);

  const detailLayoutClass = useMemo(() => {
    if (showEtapas && showLotes) return 'project-detail-split';
    if (showEtapas && !showLotes) return 'project-detail-etapas-expanded';
    if (!showEtapas && showLotes) return 'project-detail-lotes-expanded';
    return 'project-detail-both-collapsed';
  }, [showEtapas, showLotes]);

  const guardarProyecto = async (e) => {
    e.preventDefault();
    try {
      await api.proyectos.guardar(form);
      showToast('Proyecto guardado.');
      setForm(createInitialProyecto());
      await cargarProyectos();
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  const editarProyecto = (p) => {
    setForm({
      id: p.id,
      nombre: p.nombre || '',
      cliente: p.cliente || '',
      fecha_inicio: toDateInputValue(p.fecha_inicio),
      fecha_compromiso: toDateInputValue(p.fecha_compromiso),
      fecha_fin: toDateInputValue(p.fecha_fin),
      prioridad: p.prioridad || 2,
      responsable_id: p.responsable_id || '',
      estado: p.estado || 'pendiente',
      notas: p.notas || '',
    });
    setEditandoProyecto(true);
    setTimeout(() => setEditandoProyecto(false), 1000);
  };

  const finalizarProyecto = async (id) => {
    if (!window.confirm('¿Marcar este proyecto como finalizado?')) return;
    try {
      await api.proyectos.archivar({ id });
      showToast('Proyecto finalizado.');
      await cargarProyectos();
      if (seleccionadoId === id) {
        await cargarDetalle(id);
      }
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  const updateEtapaLocal = (etapaId, field, value) => {
    setDetalle((prev) => {
      if (!prev?.etapas) return prev;
      return {
        ...prev,
        etapas: prev.etapas.map((et) => (et.id === etapaId ? { ...et, [field]: value } : et)),
      };
    });
  };

  const guardarEtapa = async (etapa) => {
    try {
      const responsableId = etapa.responsable_id ? String(etapa.responsable_id) : '';
      const esOmitida = etapa.estado === 'omitida';

      if (!esOmitida && responsableId && !personas.some((p) => String(p.id) === responsableId)) {
        showToast('Selecciona un responsable válido desde la lista.', 'error');
        return;
      }
      await api.proyectos.actualizarEtapa({
        id: etapa.id,
        estado: etapa.estado,
        fecha_programada: esOmitida ? null : (toDateInputValue(etapa.fecha_programada) || null),
        fecha_real: esOmitida ? null : (toDateInputValue(etapa.fecha_real) || null),
        responsable_id: esOmitida ? null : (responsableId || null),
        motivo_bloqueo: esOmitida ? null : (etapa.motivo_bloqueo || null),
        notas: etapa.notas || null,
      });
      showToast('Etapa actualizada.');
      await cargarDetalle(seleccionadoId);
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  const guardarItem = async (e) => {
    e.preventDefault();
    try {
      if (itemForm.id) {
        // Edición individual — actualiza piso/apartamento/nombre del ítem
        await api.items.actualizar(itemForm);
        showToast('Ítem actualizado.');
      } else {
        // Creación bulk — crea N ítems con el mismo nombre
        const cantidad = parseInt(itemForm.cantidad, 10) || 1;
        await api.items.crearBulk({ proyecto_id: seleccionadoId, nombre: itemForm.nombre, cantidad });
        showToast(`${cantidad} ítem(s) creado(s).`);
      }
      setItemForm({ id: null, nombre: '', piso: '', apartamento: '', cantidad: 1 });
      setEditandoItemId(null);
      await cargarItems(seleccionadoId);
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  const editarItem = (it) => {
    setEditandoItemId(it.id);
    setItemForm({ id: it.id, nombre: it.nombre, piso: it.piso ?? '', apartamento: it.apartamento ?? '' });
  };

  const toggleGrupoItem = (nombreGrupo) =>
  {
    setColapsadosPorGrupo((prev) => ({ ...prev, [nombreGrupo]: !prev[nombreGrupo] }));
  };

  const eliminarItem = async (id) => {
    if (!window.confirm('¿Eliminar este ítem del contrato?')) return;
    try {
      await api.items.eliminar({ id });
      showToast('Ítem eliminado.');
      await cargarItems(seleccionadoId);
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  return (
    <div className="stack">
      <section className={`panel${editandoProyecto ? ' panel--editando' : ''}${showEditorPanel ? '' : ' panel-collapsed'}`}>
        <div className="panel-header">
          <h3>{form.id ? `Editar Proyecto · ${form.nombre}` : 'Nuevo Proyecto'}</h3>
          <CollapseToggle
            collapsed={!showEditorPanel}
            onToggle={() => setShowEditorPanel((v) => !v)}
            label="Editor de proyecto"
          />
        </div>
        {showEditorPanel && (
        <form className="form-grid" onSubmit={guardarProyecto}>
          <div className="field">
            <label>{dbLabel('nombre')}</label>
            <input
              placeholder={dbLabel('nombre')}
              value={form.nombre}
              onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))}
              required
            />
          </div>
          <div className="field">
            <label>{dbLabel('cliente')}</label>
            <input
              placeholder={dbLabel('cliente')}
              value={form.cliente}
              onChange={(e) => setForm((p) => ({ ...p, cliente: e.target.value }))}
              required
            />
          </div>
          <div className="field">
            <label>{dbLabel('fecha_inicio')}</label>
            <input
              type="date"
              value={form.fecha_inicio}
              onChange={(e) => setForm((p) => ({ ...p, fecha_inicio: e.target.value }))}
            />
          </div>
          <div className="field">
            <label>{dbLabel('fecha_compromiso')}</label>
            <input
              type="date"
              value={form.fecha_compromiso}
              onChange={(e) => setForm((p) => ({ ...p, fecha_compromiso: e.target.value }))}
              required
            />
          </div>
          {form.id && (
            <div className="field">
              <label>{dbLabel('fecha_fin')}</label>
              <input
                type="date"
                value={form.fecha_fin}
                onChange={(e) => setForm((p) => ({ ...p, fecha_fin: e.target.value }))}
              />
            </div>
          )}
          <div className="field">
            <label>{dbLabel('prioridad')}</label>
            <select
              value={form.prioridad}
              className="priority-select"
              style={prioridadStyle(form.prioridad)}
              onChange={(e) => setForm((p) => ({ ...p, prioridad: Number(e.target.value) }))}
            >
              <option value={1}>Alta</option>
              <option value={2}>Media</option>
              <option value={3}>Baja</option>
            </select>
          </div>
          <div className="field">
            <label>{dbLabel('responsable_id')}</label>
            <SearchableSelect
              options={personasResponsables.map((p) => ({ value: p.id, label: `${p.nombre} — ${p.area}` }))}
              value={form.responsable_id}
              onChange={(v) => setForm((prev) => ({ ...prev, responsable_id: v }))}
              placeholder="Buscar responsable..."
            />
          </div>
          <div className="field">
            <label>{dbLabel('estado')}</label>
            <select value={form.estado} onChange={(e) => setForm((p) => ({ ...p, estado: e.target.value }))}>
              {estadoProyectoOptions.map((estado) => (
                <option key={estado.value} value={estado.value}>
                  {estado.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field field-full">
            <label>{dbLabel('notas')}</label>
            <textarea
              placeholder={dbLabel('notas')}
              value={form.notas}
              onChange={(e) => setForm((p) => ({ ...p, notas: e.target.value }))}
            />
          </div>
          <div className="row actions-row">
            <button type="submit">{form.id ? 'Actualizar proyecto' : 'Crear proyecto'}</button>
            <button type="button" className="ghost" onClick={() => setForm(createInitialProyecto())}>
              Limpiar
            </button>
          </div>
        </form>
        )}
      </section>

      <section className={`panel${showListPanel ? '' : ' panel-collapsed'}`}>
        <div className="panel-header">
          <h3>Lista de proyectos</h3>
          <CollapseToggle
            collapsed={!showListPanel}
            onToggle={() => setShowListPanel((v) => !v)}
            label="Lista de proyectos"
          />
        </div>

        {showListPanel && (
        <div className="row wrap" style={{ marginBottom: 12 }}>
          <div className="field">
            <label>{dbLabel('estado')}</label>
            <select value={filtros.estado} onChange={(e) => setFiltros((f) => ({ ...f, estado: e.target.value }))}>
              <option value="">Todos</option>
              {estadoProyectoOptions.map((estado) => (
                <option key={estado.value} value={estado.value}>
                  {estado.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>{dbLabel('prioridad')}</label>
            <select
              value={filtros.prioridad}
              className="priority-select"
              style={prioridadStyle(filtros.prioridad)}
              onChange={(e) => setFiltros((f) => ({ ...f, prioridad: e.target.value }))}
            >
              <option value="">Todas</option>
              <option value="1">Alta</option>
              <option value="2">Media</option>
              <option value="3">Baja</option>
            </select>
          </div>
          <div className="field">
            <label>{dbLabel('nombre')}</label>
            <input
              placeholder={`Buscar por ${dbLabel('nombre')}`}
              value={filtros.q}
              onChange={(e) => setFiltros((f) => ({ ...f, q: e.target.value }))}
            />
          </div>
        </div>
        )}

        {showListPanel && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Cliente</th>
                <th>Estado</th>
                <th>Prioridad</th>
                <th>Compromiso</th>
                <th>Días</th>
                <th>% avance</th>
                <th>Alerta</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {proyectosFiltrados.map((p) => {
                const dias = daysRemaining(p.fecha_compromiso);
                return (
                  <tr key={p.id} className={seleccionadoId === p.id ? 'selected-row' : ''}>
                    <td>{p.nombre}</td>
                    <td>{p.cliente}</td>
                    <td><StatusPill value={p.estado} /></td>
                    <td>{prioridadTexto(p.prioridad)}</td>
                    <td>{formatFecha(p.fecha_compromiso)}</td>
                    <td className={dias !== null && dias < 0 ? 'error' : ''}>{dias === null ? '-' : dias}</td>
                    <td>{formatNumero(p.pct_avance, 1)}%</td>
                    <td>
                      <StatusPill value={p.alerta} />
                    </td>
                    <td>
                      <div className="row">
                        <button
                          type="button"
                          className="small"
                          onClick={() => seleccionadoId === p.id
                            ? (setSeleccionadoId(null), setDetalle(null))
                            : setSeleccionadoId(p.id)
                          }
                        >
                          {seleccionadoId === p.id ? 'Cerrar' : 'Abrir'}
                        </button>
                        <button type="button" className="small ghost" onClick={() => editarProyecto(p)}>
                          Editar
                        </button>
                        <button
                          type="button"
                          className="small success"
                          onClick={() => finalizarProyecto(p.id)}
                        >
                          Finalizar
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!proyectosFiltrados.length && (
                <tr>
                  <td colSpan={9}>No hay proyectos para mostrar.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        )}
      </section>

      {detalle && (
        <>
          <section className="panel">
            <div className="panel-header">
              <h3>Ítems del contrato · {detalle.proyecto.nombre}</h3>
              <CollapseToggle
                collapsed={!showItems}
                onToggle={() => setShowItems((v) => !v)}
                label="Ítems"
              />
            </div>
            {showItems && (
              <>
                <form className="form-grid" onSubmit={guardarItem}>
                  <div className="field">
                    <label>{dbLabel('nombre')}</label>
                    <input
                      placeholder="Ej: Mueble de baño, Guardaescobas..."
                      value={itemForm.nombre}
                      onChange={(e) => setItemForm((p) => ({ ...p, nombre: e.target.value }))}
                      required
                    />
                  </div>
                  {!itemForm.id && (
                    <div className="field">
                      <label>Cantidad</label>
                      <input
                        type="number"
                        min={1}
                        max={500}
                        value={itemForm.cantidad}
                        onChange={(e) => setItemForm((p) => ({ ...p, cantidad: e.target.value }))}
                      />
                    </div>
                  )}
                  {itemForm.id && (
                    <>
                      <div className="field">
                        <label>Piso</label>
                        <input
                          type="number"
                          min={1}
                          placeholder="Ej: 3"
                          value={itemForm.piso}
                          onChange={(e) => setItemForm((p) => ({ ...p, piso: e.target.value }))}
                        />
                      </div>
                      <div className="field">
                        <label>Apartamento</label>
                        <input
                          placeholder="Ej: 305, Apto A..."
                          value={itemForm.apartamento}
                          onChange={(e) => setItemForm((p) => ({ ...p, apartamento: e.target.value }))}
                        />
                      </div>
                    </>
                  )}
                  <div className="row actions-row">
                    <button type="submit">
                      {itemForm.id ? 'Actualizar ítem' : 'Agregar ítems'}
                    </button>
                    <button
                      type="button"
                      className="ghost"
                      onClick={() =>
                      {
                        setItemForm({ id: null, nombre: '', piso: '', apartamento: '', cantidad: 1 });
                        setEditandoItemId(null);
                      }}
                    >
                      Limpiar
                    </button>
                  </div>
                </form>

                {!items.length && (
                  <p className="muted">No hay ítems registrados para este proyecto.</p>
                )}

                {Object.entries(itemsAgrupados).map(([nombreGrupo, grupoItems]) =>
                {
                  const colapsado = !!colapsadosPorGrupo[nombreGrupo];
                  const totalPaginas = totalPaginasPorGrupo[nombreGrupo] || 1;
                  const paginaActual = paginaPorGrupo[nombreGrupo] || 1;
                  const inicio = (paginaActual - 1) * ITEMS_POR_PAGINA;
                  const itemsPagina = grupoItems.slice(inicio, inicio + ITEMS_POR_PAGINA);
                  const mostrandoDesde = grupoItems.length ? inicio + 1 : 0;
                  const mostrandoHasta = Math.min(inicio + ITEMS_POR_PAGINA, grupoItems.length);

                  const cambiarPagina = (delta) =>
                  {
                    setPaginaPorGrupo((prev) =>
                    {
                      const paginaAnterior = prev[nombreGrupo] || 1;
                      const paginaNueva = Math.min(Math.max(paginaAnterior + delta, 1), totalPaginas);

                      if (paginaNueva === paginaAnterior) return prev;
                      return { ...prev, [nombreGrupo]: paginaNueva };
                    });
                  };

                  return (
                    <div key={nombreGrupo} className={`items-grupo ${colapsado ? 'items-grupo-collapsed' : ''}`}>
                      <div className="panel-header items-grupo-header">
                        <span className="items-grupo-titulo">
                          {nombreGrupo}
                          <span className="items-grupo-count"> ({grupoItems.length} ítem{grupoItems.length !== 1 ? 's' : ''})</span>
                        </span>
                        <button
                          type="button"
                          className="items-grupo-toggle"
                          data-collapsed={colapsado}
                          onClick={() => toggleGrupoItem(nombreGrupo)}
                          title={colapsado ? `Mostrar ${nombreGrupo}` : `Comprimir ${nombreGrupo}`}
                          aria-label={colapsado ? `Mostrar ${nombreGrupo}` : `Comprimir ${nombreGrupo}`}
                          aria-expanded={!colapsado}
                        >
                          ☰
                        </button>
                      </div>
                      {!colapsado && (
                        <>
                          <div className="row wrap" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
                            <span className="muted">
                              Página {paginaActual} de {totalPaginas}
                              {' '}
                              · Mostrando {mostrandoDesde}-{mostrandoHasta} de {grupoItems.length}
                            </span>
                            <div className="row">
                              <button
                                type="button"
                                className="small ghost"
                                onClick={() => cambiarPagina(-1)}
                                disabled={paginaActual <= 1}
                              >
                                Anterior
                              </button>
                              <button
                                type="button"
                                className="small ghost"
                                onClick={() => cambiarPagina(1)}
                                disabled={paginaActual >= totalPaginas}
                              >
                                Siguiente
                              </button>
                            </div>
                          </div>
                          <div className="table-wrap">
                            <table>
                              <thead>
                                <tr>
                                  <th>Piso</th>
                                  <th>Apartamento</th>
                                  <th>Estado</th>
                                  <th>Lote asignado</th>
                                  <th>Acciones</th>
                                </tr>
                              </thead>
                              <tbody>
                                {itemsPagina.map((it) => (
                                  <tr key={it.id}>
                                    <td>{it.piso ?? '-'}</td>
                                    <td>{it.apartamento || '-'}</td>
                                    <td>
                                      <StatusPill value={it.estado} />
                                    </td>
                                    <td>{it.lote || '-'}</td>
                                    <td>
                                      <div className="row">
                                        <button type="button" className="small ghost" onClick={() => editarItem(it)}>
                                          Editar
                                        </button>
                                        <button
                                          type="button"
                                          className="small danger"
                                          onClick={() => eliminarItem(it.id)}
                                          disabled={it.estado !== 'pendiente'}
                                          title={it.estado !== 'pendiente' ? 'Solo se pueden eliminar ítems pendientes sin lote' : ''}
                                        >
                                          Eliminar
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </section>

          <section className={`grid project-detail ${detailLayoutClass}`}>
            <article className={`panel project-detail-panel ${!showEtapas ? 'project-detail-panel-collapsed' : ''}`}>
              <div className="panel-header">
                <h3>Etapas administrativas · {detalle.proyecto.nombre}</h3>
                <CollapseToggle
                  collapsed={!showEtapas}
                  onToggle={() => setShowEtapas((v) => !v)}
                  label="Etapas"
                />
              </div>
              {showEtapas && (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Etapa</th>
                        <th>Estado</th>
                        <th>Programada</th>
                        <th>Real</th>
                        <th>Responsable</th>
                        <th>Bloqueo</th>
                        <th>Guardar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detalle.etapas.map((et) => (
                        <tr key={et.id}>
                          <td>{et.etapa}</td>
                          <td>
                            <select
                              className="select-light"
                              value={et.estado}
                              onChange={(e) => updateEtapaLocal(et.id, 'estado', e.target.value)}
                            >
                              <option value="pendiente">pendiente</option>
                              <option value="en_proceso">en_proceso</option>
                              <option value="completado">completado</option>
                              <option value="bloqueado">bloqueado</option>
                              <option value="omitida">omitida</option>
                            </select>
                          </td>
                          <td>
                            {et.estado === 'omitida' ? (
                              <span className="muted">—</span>
                            ) : (
                              <input
                                type="date"
                                value={toDateInputValue(et.fecha_programada)}
                                onChange={(e) => updateEtapaLocal(et.id, 'fecha_programada', e.target.value)}
                              />
                            )}
                          </td>
                          <td>
                            {et.estado === 'omitida' ? (
                              <span className="muted">—</span>
                            ) : (
                              <input
                                type="date"
                                value={toDateInputValue(et.fecha_real)}
                                onChange={(e) => updateEtapaLocal(et.id, 'fecha_real', e.target.value)}
                              />
                            )}
                          </td>
                          <td>
                            {et.estado === 'omitida' ? (
                              <span className="muted">—</span>
                            ) : (
                              <SearchableSelect
                                options={personas.map((persona) => ({ value: persona.id, label: personaLabel(persona) }))}
                                value={et.responsable_id || ''}
                                onChange={(value) => updateEtapaLocal(et.id, 'responsable_id', value)}
                                placeholder="Selecciona responsable"
                              />
                            )}
                          </td>
                          <td>
                            {et.estado === 'bloqueado' ? (
                              <input
                                value={et.motivo_bloqueo || ''}
                                onChange={(e) => updateEtapaLocal(et.id, 'motivo_bloqueo', e.target.value)}
                                placeholder={dbLabel('motivo_bloqueo')}
                              />
                            ) : (
                              <span className="muted">-</span>
                            )}
                          </td>
                          <td>
                            <button type="button" className="small" onClick={() => guardarEtapa(et)}>
                              Guardar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </article>

            <article className={`panel project-detail-panel ${!showLotes ? 'project-detail-panel-collapsed' : ''}`}>
              <div className="panel-header">
                <h3>Lotes del proyecto</h3>
                <CollapseToggle
                  collapsed={!showLotes}
                  onToggle={() => setShowLotes((v) => !v)}
                  label="Lotes"
                />
              </div>
              {showLotes && (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Lote</th>
                        <th>Material ref</th>
                        <th>Estado</th>
                        <th>Proceso actual</th>
                        <th>Entrega</th>
                        <th>Ir</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detalle.lotes.map((lote) => (
                        <tr key={lote.id}>
                          <td>{lote.nombre}</td>
                          <td>{lote.material_ref || '-'}</td>
                          <td>
                            <StatusPill value={lote.estado} />
                          </td>
                          <td>{lote.estado === 'pendiente' ? '-' : (lote.proceso_actual || '-')}</td>
                          <td>{formatFecha(lote.fecha_entrega_prog)}</td>
                          <td>
                            <button type="button" className="small" onClick={() => navigate(carpentryPath('lotes'))}>
                              Abrir en lotes
                            </button>
                          </td>
                        </tr>
                      ))}
                      {!detalle.lotes.length && (
                        <tr>
                          <td colSpan={6}>No hay lotes todavía para este proyecto.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </article>
          </section>
        </>
      )}
    </div>
  );
}
