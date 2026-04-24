import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import PipelineBar from '../components/PipelineBar.jsx';
import StatusPill from '../components/StatusPill.jsx';
import SearchableSelect from '../components/SearchableSelect.jsx';
import CollapseToggle from '../components/CollapseToggle.jsx';
import { carpentryPath } from '../routes';
import { formatFecha, formatUnidadMedida, prioridadTexto } from '../utils/format';
import { dbLabel } from '../utils/labels';
import useToast from '../utils/useToast';

function prioridadStyle(val) {
  const v = Number(val);
  if (v === 3) {
    return {
      color: 'var(--cobalt)',
      borderColor: 'color-mix(in srgb, var(--cobalt) 40%, var(--border) 60%)',
      background: 'color-mix(in srgb, var(--cobalt) 16%, var(--surface-elevated) 84%)',
    };
  }
  if (v === 2) {
    return {
      color: 'var(--status-warn)',
      borderColor: 'color-mix(in srgb, var(--status-warn) 42%, var(--border) 58%)',
      background: 'color-mix(in srgb, var(--status-warn) 15%, var(--surface-elevated) 85%)',
    };
  }
  if (v === 1) {
    return {
      color: 'var(--status-danger)',
      borderColor: 'color-mix(in srgb, var(--status-danger) 42%, var(--border) 58%)',
      background: 'color-mix(in srgb, var(--status-danger) 15%, var(--surface-elevated) 85%)',
    };
  }
  return {};
}

const loteEstados = [
  'pendiente',
  'en_produccion',
  'empacado',
  'instalacion',
  'despachado',
  'finalizado',
  'bloqueado',
];

const kanbanColumnas = [
  ['pendiente', 'Pendiente'],
  ['en_produccion', 'En producción'],
  ['empacado', 'Empacado'],
  ['instalacion', 'Instalación'],
  ['despachado', 'Despachado'],
  ['finalizado', 'Finalizado'],
  ['bloqueado', 'Bloqueado'],
];

const initialLote = {
  id: null,
  proyecto_id: '',
  nombre: '',
  descripcion: '',
  material_ref: '',
  estado: 'pendiente',
  proceso_actual_id: '',
  fecha_inicio_prog: '',
  fecha_entrega_prog: '',
  prioridad: 2,
  notas: '',
};

const initialProcesoEdicion = {
  id: null,
  estado: 'pendiente',
  responsable_id: '',
  maquina_id: '',
  fecha_programada: '',
  fecha_inicio_real: '',
  fecha_fin_real: '',
  motivo_bloqueo: '',
  notas: '',
};

function toDateStr(value) {
  if (value == null || value === '') return '';

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? '' : value.toISOString().slice(0, 10);
  }

  if (typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
  }

  const text = String(value).trim();
  if (!text) return '';

  const isoMatch = text.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) return isoMatch[1];

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10);
}

function normalizarTexto(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function requiereMaquinaProceso(nombreProceso) {
  const nombre = normalizarTexto(nombreProceso);
  return ['seccionado', 'enchape', 'mecanizado', 'armado'].some((item) => nombre.includes(item));
}

function buscarProcesoId(procesos, predicado) {
  const proceso = procesos.find((p) => predicado(normalizarTexto(p.nombre)));
  return proceso ? String(proceso.id) : '';
}

export default function LotesPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [filtros, setFiltros] = useState({ estado: '', proyecto_id: '', proceso_actual_id: '' });
  const [vista, setVista] = useState('tabla');
  const [proyectos, setProyectos] = useState([]);
  const [procesos, setProcesos] = useState([]);
  const [personas, setPersonas] = useState([]);
  const [maquinas, setMaquinas] = useState([]);
  const [lotes, setLotes] = useState([]);
  const [loteForm, setLoteForm] = useState(initialLote);

  const [detalle, setDetalle] = useState(null);
  const [seleccionadoId, setSeleccionadoId] = useState(null);
  const [procesoEdit, setProcesoEdit] = useState(initialProcesoEdicion);
  const [selectedProcesoId, setSelectedProcesoId] = useState(null);
  const [showEditor, setShowEditor] = useState(true);
  const [showGestion, setShowGestion] = useState(true);
  const [showLinea, setShowLinea] = useState(true);
  const [showItems, setShowItems] = useState(true);
  const [showVerificacion, setShowVerificacion] = useState(true);
  const [procesoCambiando, setProcesoCambiando] = useState(false);
  const [editandoLote, setEditandoLote] = useState(false);
  const animTimeout = useRef(null);

  const procesosLinea = useMemo(
    () => procesos.filter((p) => p.orden_linea !== null && p.orden_linea !== undefined),
    [procesos]
  );
  const proyectoOptions = useMemo(
    () => proyectos.map((p) => ({ value: String(p.id), label: p.nombre })),
    [proyectos]
  );
  const procesoLineaOptions = useMemo(
    () => procesosLinea.map((p) => ({ value: String(p.id), label: p.nombre })),
    [procesosLinea]
  );

  const procesoSeleccionado = useMemo(
    () => detalle?.procesos?.find((lp) => String(lp.id) === String(selectedProcesoId)) || null,
    [detalle, selectedProcesoId]
  );

  const responsablesProceso = useMemo(() => {
    if (!procesoSeleccionado?.proceso) return [];
    const nombreProceso = normalizarTexto(procesoSeleccionado.proceso);
    let area = 'Operarios';
    if (nombreProceso.includes('transporte')) area = 'Transportistas';
    if (nombreProceso.includes('instal')) area = 'Instalacion';
    return personas.filter((p) => p.area === area);
  }, [personas, procesoSeleccionado]);
  const responsablesProcesoOptions = useMemo(
    () => responsablesProceso.map((p) => ({ value: String(p.id), label: `${p.nombre}-${p.area}` })),
    [responsablesProceso]
  );

  const maquinasProceso = useMemo(() => {
    if (!procesoSeleccionado?.proceso_id) return [];
    return maquinas.filter((m) => String(m.proceso_id) === String(procesoSeleccionado.proceso_id));
  }, [maquinas, procesoSeleccionado?.proceso_id]);

  const maquinaProcesoRequerida = useMemo(
    () => requiereMaquinaProceso(procesoSeleccionado?.proceso),
    [procesoSeleccionado?.proceso]
  );

  const maquinasProcesoOptions = useMemo(
    () => maquinasProceso.map((m) => ({ value: String(m.id), label: m.nombre })),
    [maquinasProceso]
  );

  const cargarCatalogos = async () => {
    try {
      const [proyectosData, procesosData, personasData, maquinasData] = await Promise.all([
        api.catalogos.proyectosActivos(),
        api.catalogos.procesos(),
        api.catalogos.personasActivas(),
        api.catalogos.maquinasActivas(),
      ]);
      setProyectos(proyectosData);
      setProcesos(procesosData);
      setPersonas(personasData);
      setMaquinas(maquinasData);
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  const cargarLotes = async () => {
    try {
      const data = await api.lotes.listar(filtros);
      setLotes(data);
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  const cargarDetalle = async (id) => {
    if (!id) {
      setDetalle(null);
      return;
    }
    try {
      const data = await api.lotes.detalle({ id });
      setDetalle(data);
      setSelectedProcesoId((prev) => {
        if (prev) return prev;
        const current = data.procesos.find((lp) => String(lp.proceso_id) === String(data.lote.proceso_actual_id));
        return current?.id || data.procesos[0]?.id || null;
      });
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  useEffect(() => {
    cargarCatalogos();
  }, []);

  useEffect(() => {
    cargarLotes();
  }, [filtros]);

  useEffect(() => {
    setSelectedProcesoId(null);
    cargarDetalle(seleccionadoId);
  }, [seleccionadoId]);

  useEffect(() => {
    if (!detalle?.procesos?.length || !selectedProcesoId) return;
    const lp = detalle.procesos.find((row) => String(row.id) === String(selectedProcesoId));
    if (!lp) return;
    setProcesoEdit({
      id: lp.id,
      estado: lp.estado,
      responsable_id: lp.responsable_id || '',
      maquina_id: lp.maquina_id ? String(lp.maquina_id) : '',
      fecha_programada: toDateStr(lp.fecha_programada),
      fecha_inicio_real: toDateStr(lp.fecha_inicio_real),
      fecha_fin_real: toDateStr(lp.fecha_fin_real),
      motivo_bloqueo: lp.motivo_bloqueo || '',
      notas: lp.notas || '',
    });
  }, [detalle, selectedProcesoId]);

  useEffect(() => {
    if (!procesoEdit.id || !maquinaProcesoRequerida) return;
    if (procesoEdit.maquina_id) return;
    if (maquinasProcesoOptions.length !== 1) return;

    setProcesoEdit((prev) => ({
      ...prev,
      maquina_id: maquinasProcesoOptions[0].value,
    }));
  }, [maquinaProcesoRequerida, maquinasProcesoOptions, procesoEdit.id, procesoEdit.maquina_id]);

  const guardarLote = async (e) => {
    e.preventDefault();
    try {
      if (!loteForm.proyecto_id || !loteForm.nombre.trim()) {
        showToast('Proyecto y nombre son obligatorios.', 'error');
        return;
      }
      await api.lotes.guardar(loteForm);
      showToast('Lote guardado.');
      setLoteForm(initialLote);
      await cargarLotes();
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  const editarLote = (lote) => {
    setLoteForm({
      id: lote.id,
      proyecto_id: lote.proyecto_id,
      nombre: lote.nombre || '',
      descripcion: lote.descripcion || '',
      material_ref: lote.material_ref || '',
      estado: lote.estado || 'pendiente',
      proceso_actual_id: lote.proceso_actual_id || '',
      fecha_inicio_prog: toDateStr(lote.fecha_inicio_prog),
      fecha_entrega_prog: toDateStr(lote.fecha_entrega_prog),
      prioridad: lote.prioridad || 2,
      notas: lote.notas || '',
    });
    setEditandoLote(true);
    setTimeout(() => setEditandoLote(false), 1000);
  };

  const seleccionarProceso = (lp) => {
    setSelectedProcesoId(lp.id);
    // Dispara animación de subrayado por 1.2 s
    if (animTimeout.current) clearTimeout(animTimeout.current);
    setProcesoCambiando(true);
    animTimeout.current = setTimeout(() => setProcesoCambiando(false), 1200);
  };

  const guardarProceso = async () => {
    if (maquinaProcesoRequerida && !procesoEdit.maquina_id && maquinasProcesoOptions.length !== 1) {
      showToast('Debes seleccionar una máquina para este proceso.', 'error');
      return;
    }

    try {
      await api.lotes.actualizarProceso(procesoEdit);
      showToast('Proceso actualizado.');
      await cargarDetalle(seleccionadoId);
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  const avanzarProceso = async () => {
    if (!detalle?.lote?.id) return;
    if (!window.confirm('¿Avanzar lote al siguiente proceso?')) return;
    try {
      await api.lotes.avanzarProceso({ lote_id: detalle.lote.id });
      showToast('Lote avanzado de proceso.');
      await cargarDetalle(seleccionadoId);
      await cargarLotes();
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  const iniciarProduccion = async () => {
    if (!detalle?.lote?.id) return;
    if (!window.confirm('¿Iniciar producción de este lote?')) return;
    try {
      await api.lotes.iniciarProceso({ lote_id: detalle.lote.id });
      showToast('Producción iniciada.');
      await Promise.all([cargarDetalle(seleccionadoId), cargarLotes()]);
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  const kanban = useMemo(() => {
    const out = {
      pendiente: [],
      en_produccion: [],
      empacado: [],
      instalacion: [],
      despachado: [],
      finalizado: [],
      bloqueado: [],
    };
    lotes.forEach((l) => {
      out[l.estado]?.push(l);
    });
    return out;
  }, [lotes]);

  const shouldShowProceso = ['en_produccion', 'bloqueado', 'empacado', 'despachado', 'instalacion'].includes(loteForm.estado);
  const procesoAutoSet = ['empacado', 'despachado', 'instalacion'].includes(loteForm.estado);

  const handleEstadoChange = (value) => {
    if (value === 'pendiente' || value === 'finalizado') {
      setLoteForm((prev) => ({ ...prev, estado: value, proceso_actual_id: '' }));
    } else if (value === 'empacado' || value === 'despachado') {
      const transporteId = buscarProcesoId(procesos, (nombre) => nombre.includes('transporte'));
      setLoteForm((prev) => ({ ...prev, estado: value, proceso_actual_id: transporteId }));
    } else if (value === 'instalacion') {
      const instalacionId = buscarProcesoId(procesos, (nombre) => nombre.includes('instalacion'));
      setLoteForm((prev) => ({ ...prev, estado: value, proceso_actual_id: instalacionId }));
    } else {
      setLoteForm((prev) => ({ ...prev, estado: value }));
    }
  };

  return (
    <div className="stack">
      <section className={`panel${editandoLote ? ' panel--editando' : ''}`}>
        <div className="panel-header">
          <h3>{loteForm.id ? `Editar Lote · ${loteForm.nombre}` : 'Nuevo lote'}</h3>
          <CollapseToggle collapsed={!showEditor} onToggle={() => setShowEditor((v) => !v)} label="Editor" />
        </div>
        {showEditor && (
          <form className="form-grid" onSubmit={guardarLote}>
            <div className="field">
              <label>{dbLabel('proyecto_id')}</label>
              <SearchableSelect
                options={proyectoOptions}
                value={loteForm.proyecto_id}
                onChange={(v) => setLoteForm((p) => ({ ...p, proyecto_id: v }))}
                placeholder={`Buscar ${dbLabel('proyecto_id')}...`}
              />
            </div>
          <div className="field">
            <label>{dbLabel('nombre')}</label>
            <input
              placeholder={dbLabel('nombre')}
              value={loteForm.nombre}
              onChange={(e) => setLoteForm((p) => ({ ...p, nombre: e.target.value }))}
              required
            />
          </div>
          <div className="field">
            <label>{dbLabel('material_ref')}</label>
            <input
              placeholder={dbLabel('material_ref')}
              value={loteForm.material_ref}
              onChange={(e) => setLoteForm((p) => ({ ...p, material_ref: e.target.value }))}
            />
          </div>
          <div className="field">
            <label>{dbLabel('estado')}</label>
            <select value={loteForm.estado} onChange={(e) => handleEstadoChange(e.target.value)}>
              {loteEstados.map((estado) => (
                <option key={estado} value={estado}>
                  {estado}
                </option>
              ))}
            </select>
          </div>
          {shouldShowProceso && (
            <div className="field">
              <label>{dbLabel('proceso_actual_id')}</label>
              <SearchableSelect
                options={procesoLineaOptions}
                value={loteForm.proceso_actual_id}
                onChange={(v) => setLoteForm((p) => ({ ...p, proceso_actual_id: v }))}
                disabled={procesoAutoSet}
                placeholder={`Buscar ${dbLabel('proceso_actual_id')}...`}
              />
            </div>
          )}
          <div className="field">
            <label>{dbLabel('fecha_inicio_prog')}</label>
            <input
              type="date"
              value={loteForm.fecha_inicio_prog}
              onChange={(e) => setLoteForm((p) => ({ ...p, fecha_inicio_prog: e.target.value }))}
            />
          </div>
          <div className="field">
            <label>{dbLabel('fecha_entrega_prog')}</label>
            <input
              type="date"
              value={loteForm.fecha_entrega_prog}
              onChange={(e) => setLoteForm((p) => ({ ...p, fecha_entrega_prog: e.target.value }))}
            />
          </div>
          <div className="field">
            <label>{dbLabel('prioridad')}</label>
            <select
              value={loteForm.prioridad}
              style={prioridadStyle(loteForm.prioridad)}
              onChange={(e) => setLoteForm((p) => ({ ...p, prioridad: Number(e.target.value) }))}
            >
              <option value={1}>Alta</option>
              <option value={2}>Media</option>
              <option value={3}>Baja</option>
            </select>
          </div>
          <div className="field field-full">
            <label>{dbLabel('descripcion')}</label>
            <textarea
              placeholder={dbLabel('descripcion')}
              value={loteForm.descripcion}
              onChange={(e) => setLoteForm((p) => ({ ...p, descripcion: e.target.value }))}
            />
          </div>
          <div className="row actions-row">
            <button type="submit" className="save-btn">{loteForm.id ? 'Actualizar lote' : 'Crear lote'}</button>
            <button type="button" className="ghost" onClick={() => setLoteForm(initialLote)}>
              Limpiar
            </button>
          </div>
          </form>
        )}
      </section>

      <section className="panel">
        <div className="panel-header">
          <h3>Gestión de lotes</h3>
          <CollapseToggle collapsed={!showGestion} onToggle={() => setShowGestion((v) => !v)} label="Gestión" />
        </div>
        {showGestion && (
          <>
            <div className="row wrap" style={{ marginBottom: '20px', paddingBottom: '12px', borderBottom: '1px solid var(--border)' }}>
              <button className={vista === 'tabla' ? 'small' : 'small ghost'} onClick={() => setVista('tabla')}>
                Tabla
              </button>
              <button className={vista === 'kanban' ? 'small' : 'small ghost'} onClick={() => setVista('kanban')}>
                Kanban
              </button>
              <select value={filtros.estado} onChange={(e) => setFiltros((f) => ({ ...f, estado: e.target.value }))}>
                <option value="">Estado: todos</option>
                {loteEstados.map((estado) => (
                  <option key={estado} value={estado}>
                    {estado}
                  </option>
                ))}
              </select>
              <div className="field" style={{ minWidth: 220 }}>
                <SearchableSelect
                  options={[{ value: '', label: 'Proyecto: todos' }, ...proyectoOptions]}
                  value={filtros.proyecto_id}
                  onChange={(v) => setFiltros((f) => ({ ...f, proyecto_id: v }))}
                  placeholder="Filtrar proyecto..."
                />
              </div>
              <div className="field" style={{ minWidth: 220 }}>
                <SearchableSelect
                  options={[{ value: '', label: 'Proceso: todos' }, ...procesoLineaOptions]}
                  value={filtros.proceso_actual_id}
                  onChange={(v) => setFiltros((f) => ({ ...f, proceso_actual_id: v }))}
                  placeholder="Filtrar proceso..."
                />
              </div>
            </div>
          </>
        )}
        {showGestion && (vista === 'tabla' ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Proyecto</th>
                  <th>Material</th>
                  <th>Estado</th>
                  <th>Proceso</th>
                  <th>Prioridad</th>
                  <th>Entrega</th>
                  <th>Días restantes</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {lotes.map((l) => (
                  <tr key={l.id} className={seleccionadoId === l.id ? 'selected-row' : ''}>
                    <td>{l.nombre}</td>
                    <td>{l.proyecto}</td>
                    <td>{l.material_ref || '-'}</td>
                    <td>
                      <StatusPill value={l.estado} />
                    </td>
                    <td>{l.proceso_actual || '-'}</td>
                    <td>{prioridadTexto(l.prioridad)}</td>
                    <td>{formatFecha(l.fecha_entrega_prog)}</td>
                    <td>{l.dias_restantes ?? '-'}</td>
                    <td>
                      <div className="row">
                        <button
                          type="button"
                          className="small"
                          onClick={() =>
                          {
                            if (detalle?.lote?.id === l.id)
                            {
                              setDetalle(null);
                              setSeleccionadoId(null);
                            }
                            else
                            {
                              setSeleccionadoId(l.id);
                            }
                          }}
                        >
                          {detalle?.lote?.id === l.id ? 'Cerrar' : 'Abrir'}
                        </button>
                        <button className="small ghost" onClick={() => editarLote(l)}>
                          Editar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="kanban seven-cols">
            {kanbanColumnas.map(([estado, label]) => (
              <div className="kanban-col" key={estado}>
                <h4>{label}</h4>
                {(kanban[estado] || []).map((l) => (
                  <button key={l.id} className="kanban-card" onClick={() => setSeleccionadoId(l.id)}>
                    <strong>{l.nombre}</strong>
                    <span>{l.proyecto}</span>
                    <span>{l.proceso_actual || '-'}</span>
                    <small>Entrega: {formatFecha(l.fecha_entrega_prog)}</small>
                  </button>
                ))}
              </div>
            ))}
          </div>
        ))}
      </section>

      {detalle && (
        <section className="stack">
          <article className="panel">
            <div className="panel-header">
              <h3>Línea de ensamblaje · {detalle.lote.nombre}</h3>
              <div className="row">
                {detalle.lote.fecha_inicio_real ? (
                  <button className="small" onClick={avanzarProceso}>
                    Avanzar al siguiente proceso
                  </button>
                ) : (
                  <button className="small" onClick={iniciarProduccion}>
                    Iniciar producción
                  </button>
                )}
                <CollapseToggle collapsed={!showLinea} onToggle={() => setShowLinea((v) => !v)} label="Línea" />
              </div>
            </div>

            {showLinea && (
              <>
                <PipelineBar
                  procesos={detalle.procesos}
                  procesoActualId={detalle.lote.proceso_actual_id}
                  onSelectProceso={seleccionarProceso}
                />

                {procesoSeleccionado && (
                  <div className={`proceso-titulo-activo${procesoCambiando ? ' proceso-titulo-animando' : ''}`}>
                    {procesoSeleccionado.proceso}
                  </div>
                )}

                {procesoEdit.id && (
                  <div className="form-grid mt">
                    <div className="field">
                      <label>{dbLabel('estado')}</label>
                      <select
                        value={procesoEdit.estado}
                        onChange={(e) => setProcesoEdit((p) => ({ ...p, estado: e.target.value }))}
                      >
                        <option value="pendiente">pendiente</option>
                        <option value="en_proceso">en_proceso</option>
                        <option value="completado">completado</option>
                        <option value="bloqueado">bloqueado</option>
                        <option value="omitido">omitido</option>
                      </select>
                    </div>
                    <div className="field">
                      <label>{dbLabel('responsable_id')}</label>
                      <SearchableSelect
                        options={responsablesProcesoOptions}
                        value={procesoEdit.responsable_id}
                        onChange={(v) => setProcesoEdit((p) => ({ ...p, responsable_id: v }))}
                        placeholder="Buscar responsable..."
                      />
                    </div>
                    <div className="field">
                      <label>{dbLabel('maquina_id')}</label>
                      <SearchableSelect
                        options={maquinasProcesoOptions}
                        value={procesoEdit.maquina_id}
                        onChange={(v) => setProcesoEdit((p) => ({ ...p, maquina_id: v }))}
                        placeholder={maquinaProcesoRequerida ? 'Selecciona máquina...' : 'Opcional para este proceso'}
                      />
                      <span className="muted">
                        {maquinaProcesoRequerida
                          ? 'Obligatoria para Seccionado, Enchape, Mecanizado y Armado.'
                          : 'Opcional para Transporte e Instalación.'}
                      </span>
                    </div>
                    <div className="field">
                      <label>{dbLabel('fecha_programada')}</label>
                      <input
                        type="date"
                        value={procesoEdit.fecha_programada}
                        onChange={(e) => setProcesoEdit((p) => ({ ...p, fecha_programada: e.target.value }))}
                      />
                    </div>
                    <div className="field">
                      <label>{dbLabel('fecha_inicio_real')}</label>
                      <input
                        type="date"
                        value={procesoEdit.fecha_inicio_real}
                        onChange={(e) => setProcesoEdit((p) => ({ ...p, fecha_inicio_real: e.target.value }))}
                      />
                    </div>
                    <div className="field">
                      <label>{dbLabel('fecha_fin_real')}</label>
                      <input
                        type="date"
                        value={procesoEdit.fecha_fin_real}
                        onChange={(e) => setProcesoEdit((p) => ({ ...p, fecha_fin_real: e.target.value }))}
                      />
                    </div>
                    <div className="field">
                      <label>{dbLabel('motivo_bloqueo')}</label>
                      <input
                        placeholder={dbLabel('motivo_bloqueo')}
                        value={procesoEdit.motivo_bloqueo}
                        onChange={(e) => setProcesoEdit((p) => ({ ...p, motivo_bloqueo: e.target.value }))}
                      />
                    </div>
                    <button type="button" className="small save-btn" onClick={guardarProceso}>
                      Guardar proceso
                    </button>
                  </div>
                )}
              </>
            )}
          </article>

          <section className="grid grid-2">
            <article className="panel">
              <div className="panel-header">
                <h3>Ítems del lote</h3>
                <div className="row">
                  <button className="small ghost" onClick={() => navigate(carpentryPath('bom'))}>
                    Ir a BOM
                  </button>
                  <CollapseToggle collapsed={!showItems} onToggle={() => setShowItems((v) => !v)} label="Ítems" />
                </div>
              </div>

              {showItems && (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Nombre</th>
                        <th>Piso</th>
                        <th>Apartamento</th>
                        <th>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detalle.items.map((it) => (
                        <tr key={it.id}>
                          <td>{it.nombre}</td>
                          <td>{it.piso ?? '-'}</td>
                          <td>{it.apartamento || '-'}</td>
                          <td><StatusPill value={it.estado} /></td>
                        </tr>
                      ))}
                      {!detalle.items.length && (
                        <tr>
                          <td colSpan={4}>No hay ítems cargados todavía.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </article>

            <article className="panel">
              <div className="panel-header">
                <h3>Verificación de materiales</h3>
                <CollapseToggle collapsed={!showVerificacion} onToggle={() => setShowVerificacion((v) => !v)} label="Materiales" />
              </div>
              {showVerificacion && (
                <>
                  <p className={detalle.materialCompleto ? 'ok' : 'error'}>
                    {detalle.materialCompleto
                      ? 'Material completo - lote puede iniciar producción'
                      : 'Faltan materiales para este lote'}
                  </p>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Material</th>
                          <th>Categoría</th>
                          <th>Unidad</th>
                          <th>Requerida</th>
                          <th>En bodega</th>
                          <th>Pendiente</th>
                          <th>Disponible</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detalle.necesidadesMateriales.map((m) => (
                          <tr key={`${m.material}-${m.categoria}`}>
                            <td>{m.material}</td>
                            <td>{m.categoria}</td>
                            <td>{formatUnidadMedida(m.unidad_medida)}</td>
                            <td>{m.cantidad_requerida}</td>
                            <td>{m.cantidad_en_bodega}</td>
                            <td>{m.cantidad_pendiente}</td>
                            <td>
                              <span className={`pill ${m.material_disponible ? 'pill-green' : 'pill-red'}`}>
                                {m.material_disponible ? 'Sí' : 'No'}
                              </span>
                            </td>
                          </tr>
                        ))}
                        {!detalle.necesidadesMateriales.length && (
                          <tr>
                            <td colSpan={7}>Aún no hay BOM para calcular necesidades.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </article>
          </section>
        </section>
      )}
    </div>
  );
}
