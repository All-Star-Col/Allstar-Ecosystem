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
      backgroundColor: 'color-mix(in srgb, var(--cobalt) 16%, var(--surface-elevated) 84%)',
    };
  }
  if (v === 2) {
    return {
      color: 'var(--status-warn)',
      borderColor: 'color-mix(in srgb, var(--status-warn) 42%, var(--border) 58%)',
      backgroundColor: 'color-mix(in srgb, var(--status-warn) 15%, var(--surface-elevated) 85%)',
    };
  }
  if (v === 1) {
    return {
      color: 'var(--status-danger)',
      borderColor: 'color-mix(in srgb, var(--status-danger) 42%, var(--border) 58%)',
      backgroundColor: 'color-mix(in srgb, var(--status-danger) 15%, var(--surface-elevated) 85%)',
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

const initialOrdenCorteForm = {
  documento_id: '',
  fecha_entrega_prog: '',
  prioridad: 2,
  detalle: '',
};

const initialMaterialRequeridoForm = {
  id: null,
  lote_id: '',
  material_id: '',
  categoria: 'tablero',
  nombre: '',
  cantidad: '',
  unidad_medida: 'm2',
  notas: '',
};

const SIN_ALERTAS = [];

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
  const [documentosCorte, setDocumentosCorte] = useState([]);
  const [ordenCortePreview, setOrdenCortePreview] = useState(null);
  const [ordenCorteRows, setOrdenCorteRows] = useState([]);
  const [ordenCorteForm, setOrdenCorteForm] = useState(initialOrdenCorteForm);
  const [ordenCorteLoadingId, setOrdenCorteLoadingId] = useState(null);
  const [ordenCorteSaving, setOrdenCorteSaving] = useState(false);
  const [materialLote, setMaterialLote] = useState(null);
  const [materialesRequeridos, setMaterialesRequeridos] = useState([]);
  const [materialRequeridoForm, setMaterialRequeridoForm] = useState(initialMaterialRequeridoForm);
  const [materialesCatalogo, setMaterialesCatalogo] = useState([]);
  const [showMaterialPanel, setShowMaterialPanel] = useState(false);

  const [detalle, setDetalle] = useState(null);
  const [seleccionadoId, setSeleccionadoId] = useState(null);
  const [procesoEdit, setProcesoEdit] = useState(initialProcesoEdicion);
  const [selectedProcesoId, setSelectedProcesoId] = useState(null);
  const [showEditor, setShowEditor] = useState(true);
  const [showGestion, setShowGestion] = useState(true);
  const [showLinea, setShowLinea] = useState(true);
  const [showItems, setShowItems] = useState(true);
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

  const ordenCorteItemsOptions = useMemo(
    () => (ordenCortePreview?.items || []).map((item) => ({
      value: String(item.id),
      label: item.label,
      item,
    })),
    [ordenCortePreview]
  );

  const ordenCorteTieneAlertas = useMemo(
    () => ordenCorteRows.some((row) => row.incluir !== false && (!row.item_id || !Number(row.cantidad) || Number(row.cantidad) <= 0)),
    [ordenCorteRows]
  );

  const materialesCatalogoOptions = useMemo(
    () => materialesCatalogo
      .filter((material) => ['tablero', 'herraje'].includes(material.categoria))
      .map((material) => ({
        value: String(material.id),
        label: `${material.nombre} · ${material.categoria}`,
        material,
      })),
    [materialesCatalogo]
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

  const cargarDocumentosCorte = async () => {
    try {
      const data = await api.lotes.documentosOrdenCorte({});
      setDocumentosCorte(data || []);
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  const cargarMaterialesCatalogo = async () => {
    try {
      const data = await api.materiales.listar({ activo: 'true' });
      setMaterialesCatalogo((data || []).filter((material) => ['tablero', 'herraje'].includes(material.categoria)));
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  const cargarMaterialRequerido = async (loteId) => {
    if (!loteId) return;
    try {
      const data = await api.lotes.listarMaterialRequerido({ lote_id: loteId });
      setMaterialesRequeridos(data || []);
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
    cargarDocumentosCorte();
    cargarMaterialesCatalogo();
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

  const previsualizarOrdenCorte = async (documento) => {
    try {
      setOrdenCorteLoadingId(documento.id);
      const data = await api.lotes.previsualizarOrdenCorte({ documento_id: documento.id });
      setOrdenCortePreview(data);
      setOrdenCorteRows(data.rows || []);
      setOrdenCorteForm({
        ...initialOrdenCorteForm,
        documento_id: documento.id,
      });
      showToast('Orden de corte leida. Revisa la previsualizacion.');
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setOrdenCorteLoadingId(null);
    }
  };

  const actualizarFilaOrdenCorte = (rowId, changes) => {
    setOrdenCorteRows((rows) => rows.map((row) => {
      if (row.row_id !== rowId) return row;
      const next = { ...row, ...changes };
      const issues = [];
      if (next.incluir !== false) {
        if (!next.item_id) issues.push('ITEM_NO_ENCONTRADO');
        if (!Number(next.cantidad) || Number(next.cantidad) <= 0) issues.push('CANTIDAD_INVALIDA');
      }
      next.issues = issues;
      return next;
    }));
  };

  const seleccionarItemOrdenCorte = (rowId, value) => {
    const option = ordenCorteItemsOptions.find((item) => String(item.value) === String(value));
    actualizarFilaOrdenCorte(rowId, {
      item_id: option?.item?.id || '',
      item_nombre: option?.item?.nombre || '',
      apartamento: option?.item?.apartamento || '',
    });
  };

  const duplicarFilaOrdenCorte = (rowId) => {
    setOrdenCorteRows((rows) => {
      const source = rows.find((row) => row.row_id === rowId);
      if (!source) return rows;
      const nextId = Math.max(0, ...rows.map((row) => Number(row.row_id) || 0)) + 1;
      const index = rows.findIndex((row) => row.row_id === rowId);
      const copy = {
        ...source,
        row_id: nextId,
        apartamento: '',
        item_id: '',
        item_nombre: '',
        cantidad: '',
        issues: ['ITEM_NO_ENCONTRADO', 'CANTIDAD_INVALIDA'],
      };
      return [...rows.slice(0, index + 1), copy, ...rows.slice(index + 1)];
    });
  };

  const crearLoteOrdenCorte = async () => {
    if (!ordenCortePreview || !ordenCorteForm.documento_id) return;
    if (!ordenCorteForm.fecha_entrega_prog || !ordenCorteForm.prioridad) {
      showToast('Fecha de entrega programada y prioridad son obligatorias.', 'error');
      return;
    }
    if (ordenCorteTieneAlertas) {
      showToast('Corrige u omite las filas con alerta antes de crear el lote.', 'error');
      return;
    }

    try {
      setOrdenCorteSaving(true);
      const result = await api.lotes.crearDesdeOrdenCorte({
        ...ordenCorteForm,
        rows: ordenCorteRows,
      });
      showToast(`Lote creado con ${result.piezas_creadas || 0} piezas.`);
      setOrdenCortePreview(null);
      setOrdenCorteRows([]);
      setOrdenCorteForm(initialOrdenCorteForm);
      await Promise.all([cargarLotes(), cargarDocumentosCorte()]);
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setOrdenCorteSaving(false);
    }
  };

  const abrirMaterialLote = async (lote) => {
    setMaterialLote(lote);
    setShowMaterialPanel(true);
    setMaterialRequeridoForm({
      ...initialMaterialRequeridoForm,
      lote_id: lote.id,
    });
    await cargarMaterialRequerido(lote.id);
  };

  const seleccionarMaterialCatalogo = (value) => {
    const option = materialesCatalogoOptions.find((item) => String(item.value) === String(value));
    const material = option?.material;
    setMaterialRequeridoForm((prev) => ({
      ...prev,
      material_id: value || '',
      categoria: material?.categoria || prev.categoria,
      nombre: material?.nombre || prev.nombre,
      unidad_medida: material?.unidad_medida || prev.unidad_medida,
    }));
  };

  const cambiarCategoriaMaterialRequerido = (categoria) => {
    setMaterialRequeridoForm((prev) => ({
      ...prev,
      categoria,
      material_id: '',
      unidad_medida: categoria === 'tablero' ? 'm2' : 'unidad',
    }));
  };

  const guardarMaterialRequerido = async (e) => {
    e.preventDefault();
    if (!materialLote?.id) return;
    try {
      await api.lotes.guardarMaterialRequerido({
        ...materialRequeridoForm,
        lote_id: materialLote.id,
      });
      showToast('Material requerido guardado.');
      setMaterialRequeridoForm({
        ...initialMaterialRequeridoForm,
        lote_id: materialLote.id,
      });
      await cargarMaterialRequerido(materialLote.id);
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  const editarMaterialRequerido = (row) => {
    setMaterialRequeridoForm({
      id: row.id,
      lote_id: row.lote_id,
      material_id: row.material_id ? String(row.material_id) : '',
      categoria: row.categoria || 'tablero',
      nombre: row.nombre || '',
      cantidad: row.cantidad || '',
      unidad_medida: row.unidad_medida || (row.categoria === 'tablero' ? 'm2' : 'unidad'),
      notas: row.notas || '',
    });
  };

  const eliminarMaterialRequerido = async (id) => {
    if (!window.confirm('¿Quitar este material requerido del lote?')) return;
    try {
      await api.lotes.eliminarMaterialRequerido({ id });
      showToast('Material requerido quitado.');
      await cargarMaterialRequerido(materialLote?.id);
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

            <div className="stack" style={{ marginBottom: 20 }}>
              <div className="panel-subheader">
                <div>
                  <h4>Documentos de ordenes de corte</h4>
                  <p>Selecciona un documento para crear un lote automatico con previsualizacion de piezas.</p>
                </div>
                <button type="button" className="small ghost" onClick={cargarDocumentosCorte}>
                  Actualizar
                </button>
              </div>
              <div className="table-wrap compact-table">
                <table>
                  <thead>
                    <tr>
                      <th>Documento</th>
                      <th>Proyecto</th>
                      <th>Etapa</th>
                      <th>Fecha</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {documentosCorte.length === 0 ? (
                      <tr>
                        <td colSpan={5}>No hay documentos de ordenes de corte cargados.</td>
                      </tr>
                    ) : documentosCorte.map((doc) => (
                      <tr key={doc.id}>
                        <td>
                          <strong>{doc.nombre_archivo || doc.titulo}</strong>
                          <br />
                          <small>{doc.titulo}</small>
                        </td>
                        <td>{doc.proyecto}</td>
                        <td>{doc.etapa_nombre}</td>
                        <td>{formatFecha(doc.created_at)}</td>
                        <td>
                          <button
                            type="button"
                            className="small"
                            disabled={ordenCorteLoadingId === doc.id}
                            onClick={() => previsualizarOrdenCorte(doc)}
                          >
                            {ordenCorteLoadingId === doc.id ? 'Leyendo...' : 'Crear lote automatico'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {ordenCortePreview && (
                <div className="catalog-table-block">
                  <div className="panel-subheader">
                    <div>
                      <h4>Previsualizacion de orden de corte</h4>
                      <p>
                        {ordenCortePreview.documento?.nombre_archivo} · {ordenCorteRows.length} piezas ·{' '}
                        {(ordenCortePreview.resumen?.con_alertas || 0)} con alerta
                      </p>
                    </div>
                    <button
                      type="button"
                      className="small ghost"
                      onClick={() => {
                        setOrdenCortePreview(null);
                        setOrdenCorteRows([]);
                        setOrdenCorteForm(initialOrdenCorteForm);
                      }}
                    >
                      Cerrar
                    </button>
                  </div>

                  <div className="form-grid compact">
                    <div className="field">
                      <label>Fecha inicio prog</label>
                      <input type="date" value={ordenCortePreview.fecha_inicio_prog || ''} disabled />
                    </div>
                    <div className="field">
                      <label>Fecha entrega prog *</label>
                      <input
                        type="date"
                        value={ordenCorteForm.fecha_entrega_prog}
                        onChange={(e) => setOrdenCorteForm((p) => ({ ...p, fecha_entrega_prog: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="field">
                      <label>Prioridad *</label>
                      <select
                        value={ordenCorteForm.prioridad}
                        style={prioridadStyle(ordenCorteForm.prioridad)}
                        onChange={(e) => setOrdenCorteForm((p) => ({ ...p, prioridad: Number(e.target.value) }))}
                      >
                        <option value={1}>Alta</option>
                        <option value={2}>Media</option>
                        <option value={3}>Baja</option>
                      </select>
                    </div>
                    <div className="field">
                      <label>Detalle</label>
                      <input
                        value={ordenCorteForm.detalle}
                        onChange={(e) => setOrdenCorteForm((p) => ({ ...p, detalle: e.target.value }))}
                        placeholder="Opcional"
                      />
                    </div>
                  </div>

                  <div className="table-wrap cut-order-preview">
                    <table>
                      <thead>
                        <tr>
                          <th>Estado</th>
                          <th>Apto</th>
                          <th>Item</th>
                          <th>Pieza</th>
                          <th>Cant.</th>
                          <th>Medidas</th>
                          <th>Material</th>
                          <th>Referencia / sub item</th>
                          <th>Accion</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ordenCorteRows.map((row) => {
                          const issues = row.issues || SIN_ALERTAS;
                          return (
                            <tr key={row.row_id} className={row.incluir === false ? 'row-muted' : ''}>
                              <td>
                                {row.incluir === false ? (
                                  <span className="pill pill-gray">Omitida</span>
                                ) : issues.length ? (
                                  <span className="pill pill-yellow">Revisar</span>
                                ) : (
                                  <span className="pill pill-green">Lista</span>
                                )}
                              </td>
                              <td>
                                <input
                                  value={row.apartamento || ''}
                                  onChange={(e) => actualizarFilaOrdenCorte(row.row_id, { apartamento: e.target.value })}
                                />
                              </td>
                              <td style={{ minWidth: 260 }}>
                                <SearchableSelect
                                  options={ordenCorteItemsOptions}
                                  value={row.item_id ? String(row.item_id) : ''}
                                  onChange={(v) => seleccionarItemOrdenCorte(row.row_id, v)}
                                  placeholder="Corregir item..."
                                />
                                <small>{row.item_nombre || 'Sin item relacionado'}</small>
                              </td>
                              <td>{row.pieza}</td>
                              <td>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={row.cantidad ?? ''}
                                  onChange={(e) => actualizarFilaOrdenCorte(row.row_id, { cantidad: e.target.value })}
                                />
                              </td>
                              <td>
                                {[row.largo_mm, row.ancho_mm, row.espesor_mm].filter(Boolean).join(' x ') || '-'}
                              </td>
                              <td>{row.material || '-'}</td>
                              <td>
                                <input
                                  value={row.subitem_nombre || ''}
                                  onChange={(e) => actualizarFilaOrdenCorte(row.row_id, { subitem_nombre: e.target.value })}
                                  placeholder="Sin sub item"
                                />
                              </td>
                              <td>
                                <div className="row">
                                  <button
                                    type="button"
                                    className="small ghost"
                                    onClick={() => duplicarFilaOrdenCorte(row.row_id)}
                                  >
                                    Duplicar
                                  </button>
                                  <button
                                    type="button"
                                    className={row.incluir === false ? 'small' : 'small ghost'}
                                    onClick={() => actualizarFilaOrdenCorte(row.row_id, { incluir: row.incluir === false })}
                                  >
                                    {row.incluir === false ? 'Incluir' : 'Omitir'}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="row actions-row">
                    <button
                      type="button"
                      className="save-btn"
                      disabled={ordenCorteSaving || ordenCorteTieneAlertas}
                      onClick={crearLoteOrdenCorte}
                    >
                      {ordenCorteSaving ? 'Creando lote...' : 'Crear lote y piezas'}
                    </button>
                    {ordenCorteTieneAlertas && (
                      <span className="error">Corrige u omite las filas con alerta.</span>
                    )}
                  </div>
                </div>
              )}
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
                          onClick={() => {
                            if (detalle?.lote?.id === l.id) {
                              setDetalle(null);
                              setSeleccionadoId(null);
                            }
                            else {
                              setSeleccionadoId(l.id);
                            }
                          }}
                        >
                          {detalle?.lote?.id === l.id ? 'Cerrar' : 'Abrir'}
                        </button>
                        <button className="small ghost" onClick={() => editarLote(l)}>
                          Editar
                        </button>
                        <button className="small ghost" onClick={() => abrirMaterialLote(l)}>
                          Material
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

      {showMaterialPanel && materialLote && (
        <section className="panel">
          <div className="panel-header">
            <div>
              <h3>Material requerido · {materialLote.nombre}</h3>
              <p className="muted">Registra tableros y herrajes requeridos para este lote. Cantos se gestionara desde tablet.</p>
            </div>
            <button
              type="button"
              className="small ghost"
              onClick={() => {
                setShowMaterialPanel(false);
                setMaterialLote(null);
                setMaterialesRequeridos([]);
                setMaterialRequeridoForm(initialMaterialRequeridoForm);
              }}
            >
              Cerrar
            </button>
          </div>

          <form className="form-grid compact material-required-form" onSubmit={guardarMaterialRequerido}>
            <div className="field">
              <label>Categoria</label>
              <select
                value={materialRequeridoForm.categoria}
                onChange={(e) => cambiarCategoriaMaterialRequerido(e.target.value)}
              >
                <option value="tablero">Tablero</option>
                <option value="herraje">Herraje</option>
              </select>
            </div>
            <div className="field">
              <label>Material existente</label>
              <SearchableSelect
                options={materialesCatalogoOptions.filter((item) => item.material.categoria === materialRequeridoForm.categoria)}
                value={materialRequeridoForm.material_id}
                onChange={seleccionarMaterialCatalogo}
                placeholder="Buscar material..."
              />
            </div>
            <div className="field">
              <label>Nombre</label>
              <input
                value={materialRequeridoForm.nombre}
                onChange={(e) => setMaterialRequeridoForm((p) => ({ ...p, nombre: e.target.value, material_id: '' }))}
                placeholder="Nombre del material"
                required
              />
            </div>
            <div className="field">
              <label>Cantidad</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={materialRequeridoForm.cantidad}
                onChange={(e) => setMaterialRequeridoForm((p) => ({ ...p, cantidad: e.target.value }))}
                required
              />
            </div>
            <div className="field">
              <label>Unidad</label>
              <input
                value={materialRequeridoForm.unidad_medida}
                onChange={(e) => setMaterialRequeridoForm((p) => ({ ...p, unidad_medida: e.target.value }))}
                required
              />
            </div>
            <div className="field">
              <label>Detalle</label>
              <input
                value={materialRequeridoForm.notas}
                onChange={(e) => setMaterialRequeridoForm((p) => ({ ...p, notas: e.target.value }))}
                placeholder="Opcional"
              />
            </div>
            <div className="row actions-row">
              <button type="submit" className="save-btn">
                {materialRequeridoForm.id ? 'Actualizar material' : 'Agregar material'}
              </button>
              <button
                type="button"
                className="ghost"
                onClick={() => setMaterialRequeridoForm({ ...initialMaterialRequeridoForm, lote_id: materialLote.id })}
              >
                Limpiar
              </button>
            </div>
          </form>

          <div className="table-wrap compact-table">
            <table>
              <thead>
                <tr>
                  <th>Categoria</th>
                  <th>Material</th>
                  <th>Cantidad</th>
                  <th>Unidad</th>
                  <th>Detalle</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {materialesRequeridos.map((row) => (
                  <tr key={row.id}>
                    <td>{row.categoria}</td>
                    <td>{row.nombre}</td>
                    <td>{row.cantidad}</td>
                    <td>{formatUnidadMedida(row.unidad_medida)}</td>
                    <td>{row.notas || '-'}</td>
                    <td>
                      <div className="row">
                        <button type="button" className="small ghost" onClick={() => editarMaterialRequerido(row)}>
                          Editar
                        </button>
                        <button type="button" className="small ghost" onClick={() => eliminarMaterialRequerido(row.id)}>
                          Quitar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!materialesRequeridos.length && (
                  <tr>
                    <td colSpan={6}>No hay material requerido registrado para este lote.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

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
                      <SearchableSelect
                        options={[
                          { value: 'pendiente', label: 'pendiente' },
                          { value: 'en_proceso', label: 'en_proceso' },
                          { value: 'completado', label: 'completado' },
                          { value: 'bloqueado', label: 'bloqueado' },
                          { value: 'omitido', label: 'omitido' },
                        ]}
                        value={procesoEdit.estado}
                        onChange={(v) => setProcesoEdit((p) => ({ ...p, estado: v }))}
                        placeholder="Estado"
                      />
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

                    <div className="field field-full">
                      <label>Notas y Bloqueos</label>
                      <div className="grid grid-2">
                        <input
                          placeholder={dbLabel('motivo_bloqueo')}
                          value={procesoEdit.motivo_bloqueo}
                          onChange={(e) => setProcesoEdit((p) => ({ ...p, motivo_bloqueo: e.target.value }))}
                        />
                        <button type="button" className="save-btn" onClick={guardarProceso} style={{ margin: 0, height: '100%' }}>
                          Guardar cambios
                        </button>
                      </div>
                      <p className="muted" style={{ fontSize: '11px', marginTop: '6px' }}>
                        {maquinaProcesoRequerida
                          ? 'Máquina obligatoria para Seccionado, Enchape, Mecanizado y Armado.'
                          : 'Máquina opcional para Transporte e Instalación.'}
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}
          </article>

          <section>
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
                        <th>Tipología</th>
                        <th>Apartamento</th>
                        <th>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detalle.items.map((it) => (
                        <tr key={it.id}>
                          <td>{it.nombre}</td>
                          <td>{it.tipologia ?? it.piso ?? '-'}</td>
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

          </section>
        </section>
      )}
    </div>
  );
}
