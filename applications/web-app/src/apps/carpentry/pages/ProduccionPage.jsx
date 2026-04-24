import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import { formatFecha, formatNumero } from '../utils/format';
import { dbLabel } from '../utils/labels';
import useToast from '../utils/useToast';
import SearchableSelect from '../components/SearchableSelect.jsx';
import CollapseToggle from '../components/CollapseToggle.jsx';
import PipelineBar from '../components/PipelineBar.jsx';
import StatusPill from '../components/StatusPill.jsx';

function todayIso()
{
  return new Date().toISOString().slice(0, 10);
}

// Convierte cualquier valor de fecha (string, Date, timestamp, null) a string YYYY-MM-DD.
function toDateStr(value)
{
  if (value == null || value === '') return '';

  if (value instanceof Date)
  {
    return Number.isNaN(value.getTime()) ? '' : value.toISOString().slice(0, 10);
  }

  if (typeof value === 'number')
  {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
  }

  const text = String(value).trim();
  if (!text) return '';

  const isoMatch = text.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) return isoMatch[1];

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime()))
  {
    return parsed.toISOString().slice(0, 10);
  }

  return '';
}

const initialForm = {
  fecha: todayIso(),
  lote_id: '',
  proceso_id: '',
  persona_ids: [],
  maquina_ids: [],
  piezas_procesadas: '',
  horas_reales: '',
  material_consumido: '',
  material_id: '',
  novedad: '',
  tiene_bloqueo: false,
  motivo_bloqueo: '',
};

const initialProcesoEdicion = {
  id: null,
  estado: 'pendiente',
  responsable_id: '',
  fecha_programada: '',
  fecha_inicio_real: '',
  fecha_fin_real: '',
  motivo_bloqueo: '',
  notas: '',
};

// Genera la etiqueta de display para una persona en los dropdowns.
// Operarios de procesos de línea muestran nombre-proceso; otros muestran nombre-area.
const PROCESOS_LINEA = ['seccionado', 'enchape', 'mecanizado', 'armado'];

function normalizarTexto(value)
{
  return String(value || '').trim().toLowerCase();
}

function personaLabel(persona)
{
  const nombre = persona?.nombre || '';
  const proceso = persona?.proceso_nombre || persona?.proceso || '';
  const area = persona?.area || '';
  const nombreProceso = normalizarTexto(proceso);
  const esProceso = PROCESOS_LINEA.some((p) => nombreProceso.includes(p));
  const sufijo = esProceso ? proceso : area;
  return sufijo ? `${nombre}-${sufijo}` : nombre;
}

function MultiResourcePicker({
  title,
  options,
  allOptions = options,
  selectedValues,
  onToggle,
  placeholder,
  emptyText,
  helperText,
})
{
  const [query, setQuery] = useState('');

  const selectedOptions = useMemo(
    () => allOptions.filter((option) => selectedValues.includes(String(option.value))),
    [allOptions, selectedValues]
  );

  const filteredOptions = useMemo(() =>
  {
    const term = query.trim().toLowerCase();
    if (!term) return options;
    return options.filter((option) => String(option.label || '').toLowerCase().includes(term));
  }, [options, query]);

  return (
    <div className="multi-picker">
      <div className="multi-picker-header">
        <span className="multi-picker-title">{title}</span>
        <span className="muted">{selectedOptions.length} seleccionados</span>
      </div>

      {selectedOptions.length > 0 && (
        <div className="multi-picker-chips">
          {selectedOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              className="multi-picker-chip"
              onClick={() => onToggle(String(option.value))}
              title="Quitar"
            >
              {option.label}
              <span aria-hidden="true">×</span>
            </button>
          ))}
        </div>
      )}

      <input
        type="text"
        className="multi-picker-search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={placeholder}
        autoComplete="off"
      />

      <div className="multi-picker-list">
        {filteredOptions.length > 0 ? (
          filteredOptions.map((option) =>
          {
            const selected = selectedValues.includes(String(option.value));
            return (
              <label key={option.value} className={`multi-picker-option${selected ? ' is-selected' : ''}`}>
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => onToggle(String(option.value))}
                />
                <span>{option.label}</span>
              </label>
            );
          })
        ) : (
          <div className="multi-picker-empty">{emptyText}</div>
        )}
      </div>

      {helperText && <p className="muted multi-picker-helper">{helperText}</p>}
    </div>
  );
}

export default function ProduccionPage()
{
  const { showToast } = useToast();
  const [form, setForm] = useState(initialForm);
  const [lotes, setLotes] = useState([]);
  const [procesos, setProcesos] = useState([]);
  const [personas, setPersonas] = useState([]);
  const [maquinas, setMaquinas] = useState([]);
  const [materiales, setMateriales] = useState([]);

  const [historialFiltros, setHistorialFiltros] = useState({ desde: '', hasta: '', lote_id: '', proceso_id: '' });
  const [historial, setHistorial] = useState([]);
  const [resumen, setResumen] = useState(null);

  // Estado de la línea de ensamblaje (pipeline)
  const [lotePipelineId, setLotePipelineId] = useState(null);
  const [detallePipeline, setDetallePipeline] = useState(null);
  const [selectedProcesoId, setSelectedProcesoId] = useState(null);
  const [procesoEdit, setProcesoEdit] = useState(initialProcesoEdicion);
  const [showRegistro, setShowRegistro] = useState(true);
  const [showLinea, setShowLinea] = useState(true);
  const [showHistorial, setShowHistorial] = useState(true);
  const [showResumen, setShowResumen] = useState(true);

  const loteSeleccionado = useMemo(
    () => lotes.find((l) => String(l.id) === String(form.lote_id)),
    [lotes, form.lote_id]
  );

  const procesoSeleccionado = useMemo(
    () => procesos.find((p) => String(p.id) === String(form.proceso_id)),
    [procesos, form.proceso_id]
  );

  const personasFiltradas = useMemo(
    () => personas.filter((p) => !form.proceso_id || String(p.proceso_id) === String(form.proceso_id)),
    [personas, form.proceso_id]
  );

  const maquinasFiltradas = useMemo(
    () => maquinas.filter((m) => !form.proceso_id || String(m.proceso_id) === String(form.proceso_id)),
    [maquinas, form.proceso_id]
  );

  const loteOptions = useMemo(
    () => lotes.map((l) => ({ value: String(l.id), label: `${l.nombre} · ${l.proyecto}` })),
    [lotes]
  );

  const procesoOptions = useMemo(
    () => procesos.map((p) => ({ value: String(p.id), label: p.nombre })),
    [procesos]
  );

  const personaOptions = useMemo(
    () => personasFiltradas.map((p) => ({ value: String(p.id), label: personaLabel(p) })),
    [personasFiltradas]
  );

  const personaOptionsAll = useMemo(
    () => personas.map((p) => ({ value: String(p.id), label: personaLabel(p) })),
    [personas]
  );

  const maquinaOptions = useMemo(
    () => maquinasFiltradas.map((m) => ({ value: String(m.id), label: m.nombre })),
    [maquinasFiltradas]
  );

  const maquinaOptionsAll = useMemo(
    () => maquinas.map((m) => ({ value: String(m.id), label: m.nombre })),
    [maquinas]
  );

  const materialOptions = useMemo(
    () => materiales.map((m) => ({ value: String(m.id), label: m.nombre })),
    [materiales]
  );

  const procesoEsSeccionado = useMemo(
    () => Boolean(procesoSeleccionado?.nombre?.toLowerCase().includes('seccionado')),
    [procesoSeleccionado]
  );

  // Fila lote_proceso actualmente seleccionada en el formulario pipeline
  const procesoSeleccionadoPipeline = useMemo(
    () => detallePipeline?.procesos?.find((lp) => String(lp.id) === String(selectedProcesoId)) || null,
    [detallePipeline, selectedProcesoId]
  );

  const procesoNombrePipeline = useMemo(
    () => procesoSeleccionadoPipeline?.proceso || procesoSeleccionadoPipeline?.proceso_nombre || null,
    [procesoSeleccionadoPipeline]
  );

  //_______________________________________________
  // Carga de datos
  //_______________________________________________

  const cargarCatalogos = async () =>
  {
    try
    {
      const [lotesData, procesosData, personasData, maquinasData, materialesData] = await Promise.all([
        api.produccion.lotesDisponibles(),
        api.catalogos.procesos(),
        api.catalogos.personasActivas(),
        api.catalogos.maquinasActivas(),
        api.materiales.listar({ activo: true }),
      ]);
      setLotes(lotesData);
      setProcesos(procesosData);
      setPersonas(personasData);
      setMaquinas(maquinasData);
      setMateriales(materialesData);
    }
    catch (error)
    {
      showToast(error.message, 'error');
    }
  };

  const cargarHistorial = async () =>
  {
    try
    {
      const data = await api.produccion.historial(historialFiltros);
      setHistorial(data);
    }
    catch (error)
    {
      showToast(error.message, 'error');
    }
  };

  const cargarResumen = async () =>
  {
    try
    {
      const data = await api.produccion.resumenDia({ fecha: form.fecha || todayIso() });
      setResumen(data);
    }
    catch (error)
    {
      showToast(error.message, 'error');
    }
  };

  const cargarDetallePipeline = async (id) =>
  {
    if (!id)
    {
      setDetallePipeline(null);
      return;
    }
    try
    {
      const data = await api.lotes.detalle({ id });
      setDetallePipeline(data);
      setSelectedProcesoId((prev) =>
      {
        if (prev) return prev;
        const current = data.procesos.find(
          (lp) => String(lp.proceso_id) === String(data.lote.proceso_actual_id)
        );
        return current?.id || data.procesos[0]?.id || null;
      });
    }
    catch (error)
    {
      showToast(error.message, 'error');
    }
  };

  useEffect(() =>
  {
    cargarCatalogos();
  }, []);

  useEffect(() =>
  {
    cargarHistorial();
  }, [historialFiltros]);

  useEffect(() =>
  {
    cargarResumen();
  }, [form.fecha]);

  useEffect(() =>
  {
    if (loteSeleccionado?.proceso_actual_id)
    {
      setForm((prev) => ({ ...prev, proceso_id: String(loteSeleccionado.proceso_actual_id) }));
    }
  }, [loteSeleccionado?.id]);

  // Recarga el detalle del pipeline cuando se selecciona un lote diferente
  useEffect(() =>
  {
    setSelectedProcesoId(null);
    cargarDetallePipeline(lotePipelineId);
  }, [lotePipelineId]);

  // Sincroniza el formulario de edición de proceso cuando cambia la selección del paso del pipeline
  useEffect(() =>
  {
    if (!detallePipeline?.procesos?.length || !selectedProcesoId) return;
    const lp = detallePipeline.procesos.find((row) => String(row.id) === String(selectedProcesoId));
    if (!lp) return;
    setProcesoEdit(
    {
      id: lp.id,
      estado: lp.estado,
      responsable_id: lp.responsable_id ? String(lp.responsable_id) : '',
      fecha_programada: toDateStr(lp.fecha_programada),
      fecha_inicio_real: toDateStr(lp.fecha_inicio_real),
      fecha_fin_real: toDateStr(lp.fecha_fin_real),
      motivo_bloqueo: lp.motivo_bloqueo || '',
      notas: lp.notas || '',
    });
  }, [detallePipeline, selectedProcesoId]);

  //_______________________________________________
  // Acciones
  //_______________________________________________

  const guardarRegistro = async (e) =>
  {
    e.preventDefault();

    if (!form.lote_id || !form.proceso_id)
    {
      showToast('Selecciona lote y proceso para registrar producción.', 'error');
      return;
    }

    if (form.tiene_bloqueo && !form.motivo_bloqueo.trim())
    {
      showToast('Debes registrar el motivo del bloqueo.', 'error');
      return;
    }

    if (!form.persona_ids.length && !form.maquina_ids.length)
    {
      showToast('Selecciona al menos una persona o una máquina.', 'error');
      return;
    }

    try
    {
      await api.produccion.registrar(form);
      showToast('Registro de producción guardado.');
      setForm((prev) => (
      {
        ...initialForm,
        fecha: prev.fecha,
        lote_id: prev.lote_id,
        proceso_id: prev.proceso_id,
      }));

      // Sincroniza historial, resumen y pipeline en paralelo
      await Promise.all([
        cargarHistorial(),
        cargarResumen(),
        lotePipelineId ? cargarDetallePipeline(lotePipelineId) : Promise.resolve(),
      ]);
    }
    catch (error)
    {
      showToast(error.message, 'error');
    }
  };

  const guardarProcesoPipeline = async () =>
  {
    try
    {
      await api.lotes.actualizarProceso(procesoEdit);
      showToast('Proceso actualizado.');
      await cargarDetallePipeline(lotePipelineId);
    }
    catch (error)
    {
      showToast(error.message, 'error');
    }
  };

  const iniciarProduccionPipeline = async () =>
  {
    if (!detallePipeline?.lote?.id) return;
    if (!window.confirm('¿Iniciar producción de este lote?')) return;
    try
    {
      await api.lotes.iniciarProceso({ lote_id: detallePipeline.lote.id });
      showToast('Producción iniciada.');
      await cargarDetallePipeline(lotePipelineId);
    }
    catch (error)
    {
      showToast(error.message, 'error');
    }
  };

  const avanzarProcesoPipeline = async () =>
  {
    if (!detallePipeline?.lote?.id) return;
    if (!window.confirm('¿Avanzar lote al siguiente proceso?')) return;
    try
    {
      await api.lotes.avanzarProceso({ lote_id: detallePipeline.lote.id });
      showToast('Lote avanzado de proceso.');
      await cargarDetallePipeline(lotePipelineId);
    }
    catch (error)
    {
      showToast(error.message, 'error');
    }
  };

  const loteNombrePipeline = detallePipeline?.lote?.nombre || '';

  const togglePersona = (value) =>
  {
    setForm((prev) =>
    {
      const current = new Set(prev.persona_ids);
      if (current.has(value))
      {
        current.delete(value);
      }
      else
      {
        current.add(value);
      }
      return { ...prev, persona_ids: [...current] };
    });
  };

  const toggleMaquina = (value) =>
  {
    setForm((prev) =>
    {
      const current = new Set(prev.maquina_ids);
      if (current.has(value))
      {
        current.delete(value);
      }
      else
      {
        current.add(value);
      }
      return { ...prev, maquina_ids: [...current] };
    });
  };

  //_______________________________________________
  // Render
  //_______________________________________________

  return (
    <div className="stack">

      {/* ── Registro rápido ─────────────────────────── */}
      <section className="panel">
        <div className="panel-header">
          <h3>Registro rápido de producción diaria</h3>
          <CollapseToggle collapsed={!showRegistro} onToggle={() => setShowRegistro((v) => !v)} label="Registro" />
        </div>

        {showRegistro && (
          <>
            {loteSeleccionado && !loteSeleccionado.material_completo && (
              <p className="error">Advertencia: el lote seleccionado tiene materiales faltantes.</p>
            )}
            {procesoEsSeccionado && (
              <p className="muted">En Seccionado registra el material consumido (tableros cortados), no piezas.</p>
            )}

            <form className="form-grid touch-form" onSubmit={guardarRegistro}>
              <div className="field">
                <label>{dbLabel('fecha')}</label>
                <input
                  type="date"
                  value={form.fecha}
                  onChange={(e) => setForm((p) => ({ ...p, fecha: e.target.value }))}
                />
              </div>

              <div className="field">
                <label>{dbLabel('lote_id')}</label>
                <SearchableSelect
                  options={loteOptions}
                  value={form.lote_id}
                  onChange={(v) => setForm((p) => ({ ...p, lote_id: v }))}
                  placeholder={`Buscar ${dbLabel('lote_id')}...`}
                />
              </div>

              <div className="field">
                <label>{dbLabel('proceso_id')}</label>
                <SearchableSelect
                  options={procesoOptions}
                  value={form.proceso_id}
                  onChange={(v) => setForm((p) => ({ ...p, proceso_id: v }))}
                  placeholder={`Buscar ${dbLabel('proceso_id')}...`}
                />
              </div>

              <div className="field field-full">
                <label>Operarios</label>
                <MultiResourcePicker
                  title="Operarios asignados"
                  options={personaOptions}
                  allOptions={personaOptionsAll}
                  selectedValues={form.persona_ids}
                  onToggle={togglePersona}
                  placeholder="Filtrar operarios..."
                  emptyText="No hay operarios para este proceso."
                  helperText="Puedes seleccionar varios operarios para un mismo registro."
                />
              </div>

              <div className="field field-full">
                <label>Máquinas</label>
                <MultiResourcePicker
                  title="Máquinas asignadas"
                  options={maquinaOptions}
                  allOptions={maquinaOptionsAll}
                  selectedValues={form.maquina_ids}
                  onToggle={toggleMaquina}
                  placeholder="Filtrar máquinas..."
                  emptyText="No hay máquinas para este proceso."
                  helperText={procesoEsSeccionado
                    ? 'Si no eliges ninguna máquina en Seccionado, el backend intentará usar la única máquina activa disponible.'
                    : 'Puedes seleccionar varias máquinas si el proceso las usa en paralelo.'}
                />
              </div>

              <div className="field">
                <label>{dbLabel('piezas_procesadas')}</label>
                <input
                  type="number"
                  min={0}
                  value={form.piezas_procesadas}
                  onChange={(e) => setForm((p) => ({ ...p, piezas_procesadas: e.target.value }))}
                  placeholder={dbLabel('piezas_procesadas')}
                />
              </div>

              <div className="field">
                <label>{dbLabel('horas_reales')}</label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={form.horas_reales}
                  onChange={(e) => setForm((p) => ({ ...p, horas_reales: e.target.value }))}
                  placeholder={dbLabel('horas_reales')}
                />
              </div>

              <div className="field">
                <label>{dbLabel('material_id')}</label>
                <SearchableSelect
                  options={materialOptions}
                  value={form.material_id}
                  onChange={(v) => setForm((p) => ({ ...p, material_id: v }))}
                  placeholder={`Buscar ${dbLabel('material_id')}...`}
                />
              </div>

              <div className="field">
                <label>{dbLabel('material_consumido')}</label>
                <input
                  type="number"
                  min="0"
                  step="0.001"
                  value={form.material_consumido}
                  onChange={(e) => setForm((p) => ({ ...p, material_consumido: e.target.value }))}
                  placeholder={dbLabel('material_consumido')}
                />
              </div>

              <div className="field field-full">
                <label>{dbLabel('novedad')}</label>
                <textarea
                  value={form.novedad}
                  onChange={(e) => setForm((p) => ({ ...p, novedad: e.target.value }))}
                  placeholder={dbLabel('novedad')}
                />
              </div>

              <div className="field">
                <label>{dbLabel('tiene_bloqueo')}</label>
                <label className="inline-check">
                  <input
                    type="checkbox"
                    checked={form.tiene_bloqueo}
                    onChange={(e) => setForm((p) => ({ ...p, tiene_bloqueo: e.target.checked }))}
                  />
                  Tiene bloqueo
                </label>
              </div>

              {form.tiene_bloqueo && (
                <div className="field">
                  <label>{dbLabel('motivo_bloqueo')}</label>
                  <input
                    value={form.motivo_bloqueo}
                    onChange={(e) => setForm((p) => ({ ...p, motivo_bloqueo: e.target.value }))}
                    placeholder={dbLabel('motivo_bloqueo')}
                    required
                  />
                </div>
              )}

              <button type="submit" className="save-btn">Registrar producción</button>
            </form>
          </>
        )}
      </section>

      {/* ── Línea de ensamblaje ─────────────────────── */}
      <section className="panel">
        <div className="panel-header">
          <h3>Línea de ensamblaje</h3>
          <CollapseToggle collapsed={!showLinea} onToggle={() => setShowLinea((v) => !v)} label="Línea" />
        </div>

        {showLinea && (
          <>
            <div className="row wrap">
              <div className="field" style={{ minWidth: 260 }}>
                <label>{dbLabel('lote_id')}</label>
                <SearchableSelect
                  options={loteOptions}
                  value={lotePipelineId ? String(lotePipelineId) : ''}
                  onChange={(v) => setLotePipelineId(v ? Number(v) : null)}
                  placeholder="Buscar lote..."
                />
              </div>
            </div>

            {detallePipeline && (
              <div className="stack mt">
                <div className="panel-header">
                  <h4>
                    Línea de ensamblaje — {loteNombrePipeline}
                    {procesoNombrePipeline ? ` | ${procesoNombrePipeline}` : ''}
                  </h4>
                  {detallePipeline.lote.fecha_inicio_real
                    ? (
                      <button className="small" onClick={avanzarProcesoPipeline}>
                        Avanzar al siguiente proceso
                      </button>
                    )
                    : (
                      <button className="small" onClick={iniciarProduccionPipeline}>
                        Iniciar producción
                      </button>
                    )
                  }
                </div>

                {/* Pipeline visual usando PipelineBar */}
                <PipelineBar
                  procesos={detallePipeline.procesos}
                  procesoActualId={detallePipeline.lote.proceso_actual_id}
                  onSelectProceso={(lp) => setSelectedProcesoId(lp.id)}
                />

                {procesoEdit.id && (
                  <div className="form-grid mt">
                    <div className="field">
                      <label>Estado</label>
                      <SearchableSelect
                        options={[
                          { value: 'pendiente', label: 'Pendiente' },
                          { value: 'en_proceso', label: 'En proceso' },
                          { value: 'completado', label: 'Completado' },
                          { value: 'bloqueado', label: 'Bloqueado' },
                          { value: 'omitido', label: 'Omitido' },
                        ]}
                        value={procesoEdit.estado}
                        onChange={(v) => setProcesoEdit((p) => ({ ...p, estado: v }))}
                        placeholder="Estado"
                      />
                    </div>

                    <div className="field">
                      <label>Responsable</label>
                      <SearchableSelect
                        options={[{ value: '', label: 'Sin asignar' }, ...personaOptionsAll]}
                        value={procesoEdit.responsable_id}
                        onChange={(v) => setProcesoEdit((p) => ({ ...p, responsable_id: v }))}
                        placeholder="Buscar responsable..."
                      />
                    </div>

                    <div className="field">
                      <label>Fecha Programada</label>
                      <input
                        type="date"
                        value={procesoEdit.fecha_programada}
                        onChange={(e) => setProcesoEdit((p) => ({ ...p, fecha_programada: e.target.value }))}
                      />
                    </div>

                    <div className="field">
                      <label>Fecha Inicio Real</label>
                      <input
                        type="date"
                        value={procesoEdit.fecha_inicio_real}
                        onChange={(e) => setProcesoEdit((p) => ({ ...p, fecha_inicio_real: e.target.value }))}
                      />
                    </div>

                    <div className="field">
                      <label>Fecha Fin Real</label>
                      <input
                        type="date"
                        value={procesoEdit.fecha_fin_real}
                        onChange={(e) => setProcesoEdit((p) => ({ ...p, fecha_fin_real: e.target.value }))}
                      />
                    </div>

                    <div className="field field-full">
                      <label>Notas y Bloqueos</label>
                      <div className="grid grid-3">
                        <input
                          value={procesoEdit.notas}
                          onChange={(e) => setProcesoEdit((p) => ({ ...p, notas: e.target.value }))}
                          placeholder="Notas generales..."
                        />
                        <input
                          value={procesoEdit.motivo_bloqueo}
                          onChange={(e) => setProcesoEdit((p) => ({ ...p, motivo_bloqueo: e.target.value }))}
                          placeholder="Motivo del bloqueo (si aplica)"
                        />
                        <button type="button" className="save-btn" onClick={guardarProcesoPipeline} style={{ margin: 0, height: '100%' }}>
                          Guardar cambios del proceso
                        </button>
                      </div>
                      <span className="muted" style={{ fontSize: '11px', marginTop: '6px', display: 'block' }}>
                        Usa el estado para marcar el proceso como bloqueado cuando aplique.
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </section>

      {/* ── Historial y Resumen ─────────────────────── */}
      <section className="grid grid-2">
        <article className="panel">
          <div className="panel-header">
            <h3>Historial de producción</h3>
            <CollapseToggle collapsed={!showHistorial} onToggle={() => setShowHistorial((v) => !v)} label="Historial" />
          </div>

          {showHistorial && (
            <>
              <div className="row wrap">
                <input
                  type="date"
                  value={historialFiltros.desde}
                  onChange={(e) => setHistorialFiltros((f) => ({ ...f, desde: e.target.value }))}
                />
                <input
                  type="date"
                  value={historialFiltros.hasta}
                  onChange={(e) => setHistorialFiltros((f) => ({ ...f, hasta: e.target.value }))}
                />
                <div className="field" style={{ minWidth: 220 }}>
                  <SearchableSelect
                    options={[{ value: '', label: 'Lote: todos' }, ...loteOptions]}
                    value={historialFiltros.lote_id}
                    onChange={(v) => setHistorialFiltros((f) => ({ ...f, lote_id: v }))}
                    placeholder="Filtrar por lote..."
                  />
                </div>
                <div className="field" style={{ minWidth: 220 }}>
                  <SearchableSelect
                    options={[{ value: '', label: 'Proceso: todos' }, ...procesoOptions]}
                    value={historialFiltros.proceso_id}
                    onChange={(v) => setHistorialFiltros((f) => ({ ...f, proceso_id: v }))}
                    placeholder="Filtrar por proceso..."
                  />
                </div>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Lote</th>
                      <th>Proceso</th>
                      <th>Persona</th>
                      <th>Máquina</th>
                      <th>Piezas</th>
                      <th>Horas</th>
                      <th>Bloqueo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historial.map((h) => (
                      <tr key={h.id} className={h.tiene_bloqueo ? 'row-danger' : ''}>
                        <td>{formatFecha(h.fecha)}</td>
                        <td>{h.lote}</td>
                        <td>{h.proceso}</td>
                        <td>{h.persona || '-'}</td>
                        <td>{h.maquina || '-'}</td>
                        <td>{formatNumero(h.piezas_procesadas, 0)}</td>
                        <td>{formatNumero(h.horas_reales, 1)}</td>
                        <td>
                          {h.tiene_bloqueo
                            ? <StatusPill value="bloqueado" />
                            : '-'
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </article>

        <article className="panel">
          <div className="panel-header">
            <h3>Resumen del día</h3>
            <CollapseToggle collapsed={!showResumen} onToggle={() => setShowResumen((v) => !v)} label="Resumen" />
          </div>

          {showResumen && (
            <>
              {!resumen
                ? <p>Sin datos para la fecha seleccionada.</p>
                : (
                  <>
                    <p>
                      <strong>Fecha:</strong> {formatFecha(resumen.fecha)}
                    </p>
                    <p>
                      <strong>Lotes activos:</strong> {resumen.lotesActivos}
                      {' · '}
                      <strong>Bloqueos:</strong> {resumen.bloqueosDelDia}
                    </p>

                    <h4>Piezas por proceso</h4>
                    <ul className="list">
                      {resumen.piezasPorProceso.map((p) => (
                        <li key={p.proceso}>
                          {p.proceso}: {formatNumero(p.piezas, 0)}
                        </li>
                      ))}
                      {!resumen.piezasPorProceso.length && <li>Sin registros hoy.</li>}
                    </ul>

                    <h4>Horas por persona</h4>
                    <ul className="list">
                      {resumen.horasPorPersona.map((p) => (
                        <li key={p.persona}>
                          {p.persona}: {formatNumero(p.horas, 1)}
                        </li>
                      ))}
                      {!resumen.horasPorPersona.length && <li>Sin horas registradas hoy.</li>}
                    </ul>
                  </>
                )
              }
            </>
          )}
        </article>
      </section>
    </div>
  );
}
