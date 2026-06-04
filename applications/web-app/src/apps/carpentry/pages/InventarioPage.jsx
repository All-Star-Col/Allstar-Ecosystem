import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import { formatFecha, formatUnidadMedida } from '../utils/format';
import KpiCard from '../components/KpiCard.jsx';
import { dbLabel } from '../utils/labels';
import useToast from '../utils/useToast';
import SearchableSelect from '../components/SearchableSelect.jsx';

const initialMovimiento = {
  categoria: '',
  material_id: '',
  tipo: 'entrada',
  cantidad: '',
  fecha: new Date().toISOString().slice(0, 10),
  referencia: '',
  proyecto_id: '',
  lote_id: '',
  responsable_id: '',
  notas: '',
};

const HISTORIAL_PAGE_SIZE = 20;
const PAGE_SIZE_OPTIONS = [20, 50, 100];

function PaginationControls({
  page,
  totalPages,
  onPrevious,
  onNext,
  label,
  pageSize,
  onPageSizeChange,
  pageSizeOptions = [],
}) {
  return (
    <div className="inventory-table-controls">
      <div className="inventory-table-controls-meta">{label}</div>
      <div className="inventory-table-controls-actions">
        {pageSizeOptions.length > 0 && (
          <label className="inventory-page-size">
            <span>Por página</span>
            <select value={pageSize} onChange={(e) => onPageSizeChange(Number(e.target.value))}>
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="row wrap inventory-table-pager">
          <button type="button" onClick={onPrevious} disabled={page <= 1}>
            Anterior
          </button>
          <span className="inventory-page-indicator">
            Página {page} de {totalPages}
          </span>
          <button type="button" onClick={onNext} disabled={page >= totalPages}>
            Siguiente
          </button>
        </div>
      </div>
    </div>
  );
}

function SectionToggleButton({ collapsed, onToggle, label }) {
  return (
    <button
      type="button"
      className="inventory-section-toggle"
      data-collapsed={collapsed}
      onClick={onToggle}
      title={collapsed ? `Mostrar ${label}` : `Comprimir ${label}`}
      aria-label={collapsed ? `Mostrar ${label}` : `Comprimir ${label}`}
      aria-expanded={!collapsed}
    >
      ☰
    </button>
  );
}

export default function InventarioPage() {
  const { showToast } = useToast();
  const [stockFiltros, setStockFiltros] = useState({ categoria: '', solo_bajo: false, umbral: 10 });
  const [stock, setStock] = useState([]);
  const [stockPage, setStockPage] = useState(1);
  const [stockPageSize, setStockPageSize] = useState(20);
  const [showStockSection, setShowStockSection] = useState(true);
  const [showRegistroSection, setShowRegistroSection] = useState(true);
  const [showHistorialSection, setShowHistorialSection] = useState(false);
  const [showNecesidadesSection, setShowNecesidadesSection] = useState(true);

  const [movimiento, setMovimiento] = useState(initialMovimiento);
  const [movimientosFiltros, setMovimientosFiltros] = useState({
    material_id: '',
    tipo: '',
    proyecto_id: '',
    lote_id: '',
    desde: '',
    hasta: '',
  });
  const [movimientos, setMovimientos] = useState([]);
  const [movimientosPage, setMovimientosPage] = useState(1);

  const [necesidadesFiltros, setNecesidadesFiltros] = useState({ proyecto_id: '', lote_id: '', solo_faltantes: true });
  const [necesidades, setNecesidades] = useState([]);
  const [necesidadesPage, setNecesidadesPage] = useState(1);
  const [necesidadesPageSize, setNecesidadesPageSize] = useState(20);

  const [materiales, setMateriales] = useState([]);
  const [proyectos, setProyectos] = useState([]);
  const [lotes, setLotes] = useState([]);
  const [personas, setPersonas] = useState([]);
  const materialOptions = useMemo(
    () => materiales.map((m) => ({ value: m.id, label: m.nombre })),
    [materiales]
  );

  const registroMaterialOptions = useMemo(() => {
    const cat = movimiento.categoria;
    return materiales
      .filter((m) => (cat ? String(m.categoria) === String(cat) : true))
      .map((m) => ({ value: m.id, label: m.nombre }));
  }, [materiales, movimiento.categoria]);
  const proyectoOptions = useMemo(
    () => proyectos.map((p) => ({ value: String(p.id), label: p.nombre })),
    [proyectos]
  );
  const loteOptions = useMemo(
    () => lotes.map((l) => ({ value: String(l.id), label: l.nombre })),
    [lotes]
  );
  const personaOptions = useMemo(
    () => personas.map((p) => ({ value: String(p.id), label: p.nombre })),
    [personas]
  );

  const kpis = useMemo(() => {
    const stockTotal = stock.length;
    const bajoStock = stock.filter(
      (s) => Number(s.cantidad_disponible || 0) < Number(stockFiltros.umbral || 10)
    ).length;
    const lotesSinMaterial = new Set(
      necesidades.filter((n) => !n.material_disponible).map((n) => n.lote_id)
    ).size;
    return { stockTotal, bajoStock, lotesSinMaterial };
  }, [stock, necesidades, stockFiltros.umbral]);

  const cargarCatalogos = async () => {
    try {
      const [mat, proy, lot, per] = await Promise.all([
        api.materiales.listar({ activo: true }),
        api.catalogos.proyectosActivos(),
        api.catalogos.lotesActivos(),
        api.catalogos.personasActivas(),
      ]);
      setMateriales(mat);
      setProyectos(proy);
      setLotes(lot);
      setPersonas(per);
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  const cargarStock = async () => {
    try {
      const data = await api.inventario.stock(stockFiltros);
      setStock(data);
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  const cargarMovimientos = async () => {
    try {
      const data = await api.inventario.movimientos(movimientosFiltros);
      setMovimientos(data);
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  const cargarNecesidades = async () => {
    try {
      const data = await api.inventario.necesidades(necesidadesFiltros);
      setNecesidades(data);
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  useEffect(() => {
    cargarCatalogos();
  }, []);

  useEffect(() => {
    cargarStock();
  }, [stockFiltros]);

  useEffect(() => {
    setStockPage(1);
  }, [stockFiltros, stockPageSize]);

  useEffect(() => {
    cargarMovimientos();
  }, [movimientosFiltros]);

  useEffect(() => {
    setMovimientosPage(1);
  }, [movimientosFiltros]);

  useEffect(() => {
    cargarNecesidades();
  }, [necesidadesFiltros]);

  useEffect(() => {
    setNecesidadesPage(1);
  }, [necesidadesFiltros, necesidadesPageSize]);

  const stockTotalPages = Math.max(1, Math.ceil(stock.length / stockPageSize));
  const movimientosTotalPages = Math.max(1, Math.ceil(movimientos.length / HISTORIAL_PAGE_SIZE));
  const necesidadesTotalPages = Math.max(1, Math.ceil(necesidades.length / necesidadesPageSize));

  useEffect(() => {
    setStockPage((page) => Math.min(page, stockTotalPages));
  }, [stockTotalPages]);

  useEffect(() => {
    setMovimientosPage((page) => Math.min(page, movimientosTotalPages));
  }, [movimientosTotalPages]);

  useEffect(() => {
    setNecesidadesPage((page) => Math.min(page, necesidadesTotalPages));
  }, [necesidadesTotalPages]);

  const movimientosVisible = movimientos.slice(
    (movimientosPage - 1) * HISTORIAL_PAGE_SIZE,
    movimientosPage * HISTORIAL_PAGE_SIZE
  );
  const stockVisible = stock.slice((stockPage - 1) * stockPageSize, stockPage * stockPageSize);
  const necesidadesVisible = necesidades.slice(
    (necesidadesPage - 1) * necesidadesPageSize,
    necesidadesPage * necesidadesPageSize
  );

  const guardarMovimiento = async (e) => {
    e.preventDefault();
    try {
      if (movimiento.tipo === 'ajuste' && !movimiento.notas.trim()) {
        showToast('El ajuste requiere una nota obligatoria.', 'error');
        return;
      }
      await api.inventario.guardarMovimiento(movimiento);
      showToast('Movimiento registrado.');
      setMovimiento(initialMovimiento);
      await Promise.all([cargarStock(), cargarMovimientos(), cargarNecesidades()]);
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  return (
    <div className="stack">
      <section className="grid grid-3">
        <KpiCard icon="ST" title="Stock disponible" value={kpis.stockTotal} subtitle="Materiales con cantidad > 0" />
        <KpiCard icon="SB" title="Stock bajo" value={kpis.bajoStock} subtitle={`Menor a ${stockFiltros.umbral}`} />
        <KpiCard
          icon="LT"
          title="Lotes sin material"
          value={kpis.lotesSinMaterial}
          subtitle="Con faltantes de inventario"
          accentColor="var(--status-danger)"
        />
      </section>

      <section className={`panel inventory-panel ${showStockSection ? '' : 'inventory-panel-collapsed'}`}>
        <div className="panel-header">
          <h3>Stock actual</h3>
          <SectionToggleButton
            collapsed={!showStockSection}
            onToggle={() => setShowStockSection((v) => !v)}
            label="Stock"
          />
        </div>

        {showStockSection && (
          <div className="stack-sm">
            <div className="row wrap">
              <select
                value={stockFiltros.categoria}
                onChange={(e) => setStockFiltros((f) => ({ ...f, categoria: e.target.value }))}
              >
                <option value="">Todas las categorías</option>
                <option value="tablero">tablero</option>
                <option value="canto">canto</option>
                <option value="herraje">herraje</option>
                <option value="otro">otro</option>
              </select>
              <label className="inline-check">
                <input
                  type="checkbox"
                  checked={stockFiltros.solo_bajo}
                  onChange={(e) => setStockFiltros((f) => ({ ...f, solo_bajo: e.target.checked }))}
                />
                Solo stock bajo
              </label>
              <input
                type="number"
                min={0}
                value={stockFiltros.umbral}
                onChange={(e) => setStockFiltros((f) => ({ ...f, umbral: Number(e.target.value) }))}
              />
            </div>

            <PaginationControls
              page={stockPage}
              totalPages={stockTotalPages}
              onPrevious={() => setStockPage((page) => Math.max(1, page - 1))}
              onNext={() => setStockPage((page) => Math.min(stockTotalPages, page + 1))}
              label={`Mostrando ${stockVisible.length} de ${stock.length} materiales`}
              pageSize={stockPageSize}
              onPageSizeChange={setStockPageSize}
              pageSizeOptions={PAGE_SIZE_OPTIONS}
            />

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Material</th>
                    <th>Categoría</th>
                    <th>Unidad</th>
                    <th>Cantidad</th>
                    <th>Última actualización</th>
                    <th>Semáforo</th>
                  </tr>
                </thead>
                <tbody>
                  {stockVisible.map((s) => (
                    <tr key={s.material_id}>
                      <td>{s.material}</td>
                      <td>{s.categoria}</td>
                      <td>{formatUnidadMedida(s.unidad_medida)}</td>
                      <td>{s.cantidad_disponible}</td>
                      <td>{formatFecha(s.ultima_actualizacion)}</td>
                      <td>
                        <span className={`pill ${s.semaforo === 'amarillo' ? 'pill-yellow' : 'pill-green'}`}>
                          {s.semaforo}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {!stock.length && (
                    <tr>
                      <td colSpan={6}>No hay materiales con stock disponible para los filtros seleccionados.</td>
                    </tr>
                  )}
                </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

      <section className="grid grid-2 inventory-dual-grid">
        <article className={`panel inventory-panel ${showRegistroSection ? '' : 'inventory-panel-collapsed'}`}>
          <div className="panel-header">
            <h3>Registrar entrada / ajuste</h3>
            <SectionToggleButton
              collapsed={!showRegistroSection}
              onToggle={() => setShowRegistroSection((v) => !v)}
              label="Registro"
            />
          </div>
          {showRegistroSection && (
            <form className="form-grid touch-form inventory-movement-form" onSubmit={guardarMovimiento}>
              <div className="field field-full">
                <label>Categoria</label>
                <select
                  value={movimiento.categoria}
                  onChange={(e) => setMovimiento((prev) => ({ ...prev, categoria: e.target.value, material_id: '' }))}
                >
                  <option value="">Seleccionar categoría</option>
                  <option value="tablero">tablero</option>
                  <option value="canto">canto</option>
                  <option value="herraje">herraje</option>
                </select>
              </div>
              <div className="field field-full">
                <label>{dbLabel('material_id')}</label>
                <SearchableSelect
                  options={registroMaterialOptions}
                  value={movimiento.material_id}
                  onChange={(v) => setMovimiento((prev) => ({ ...prev, material_id: v }))}
                  placeholder="Escribe para buscar material..."
                  disabled={!registroMaterialOptions.length}
                />
              </div>
              <div className="field">
                <label>Tipo</label>
                <input type="text" value="entrada" readOnly />
              </div>
              <div className="field">
                <label>{dbLabel('cantidad')}</label>
                <input
                  type="number"
                  step="0.001"
                  min="0.001"
                  value={movimiento.cantidad}
                  onChange={(e) => setMovimiento((m) => ({ ...m, cantidad: e.target.value }))}
                  placeholder={movimiento.tipo === 'ajuste' ? dbLabel('cantidad_disponible') : dbLabel('cantidad')}
                  required
                />
              </div>
              <div className="field">
                <label>{dbLabel('fecha')}</label>
                <input
                  type="date"
                  value={movimiento.fecha}
                  onChange={(e) => setMovimiento((m) => ({ ...m, fecha: e.target.value }))}
                />
              </div>
              {/* Referencia / Proyecto / Lote removed for simplified entry-only flow */}
              <div className="field">
                <label>{dbLabel('responsable_id')}</label>
                <SearchableSelect
                  options={personaOptions}
                  value={movimiento.responsable_id}
                  onChange={(v) => setMovimiento((m) => ({ ...m, responsable_id: v }))}
                  placeholder={`Buscar ${dbLabel('responsable_id')}...`}
                />
              </div>
              <div className="field field-full">
                <label>{dbLabel('notas')}</label>
                <textarea
                  value={movimiento.notas}
                  onChange={(e) => setMovimiento((m) => ({ ...m, notas: e.target.value }))}
                  placeholder={dbLabel('notas')}
                />
              </div>
              <div className="field field-full inventory-form-actions">
                <button type="submit" className="save-btn">Guardar movimiento</button>
              </div>
            </form>
          )}
        </article>

        <article className={`panel inventory-panel ${showHistorialSection ? '' : 'inventory-panel-collapsed'}`}>
          <div className="panel-header">
            <h3>Historial de movimientos</h3>
            <button
              type="button"
              className="items-grupo-toggle"
              data-collapsed={!showHistorialSection}
              onClick={() => setShowHistorialSection((v) => !v)}
              title={showHistorialSection ? 'Comprimir historial' : 'Mostrar historial'}
              aria-label={showHistorialSection ? 'Comprimir historial' : 'Mostrar historial'}
              aria-expanded={showHistorialSection}
            >
              ☰
            </button>
          </div>
          {showHistorialSection && (
            <>
              <div className="row wrap">
                <div className="field" style={{ minWidth: 280 }}>
                  <SearchableSelect
                    options={[{ value: '', label: 'Material: todos' }, ...materialOptions]}
                    value={movimientosFiltros.material_id}
                    onChange={(v) => setMovimientosFiltros((f) => ({ ...f, material_id: v }))}
                    placeholder="Filtrar material..."
                  />
                </div>
                <select
                  value={movimientosFiltros.tipo}
                  onChange={(e) => setMovimientosFiltros((f) => ({ ...f, tipo: e.target.value }))}
                >
                  <option value="">Tipo: todos</option>
                  <option value="entrada">entrada</option>
                  <option value="salida">salida</option>
                  <option value="ajuste">ajuste</option>
                </select>
                <input
                  type="date"
                  value={movimientosFiltros.desde}
                  onChange={(e) => setMovimientosFiltros((f) => ({ ...f, desde: e.target.value }))}
                />
                <input
                  type="date"
                  value={movimientosFiltros.hasta}
                  onChange={(e) => setMovimientosFiltros((f) => ({ ...f, hasta: e.target.value }))}
                />
              </div>
              <div className="catalog-table-block">
                <PaginationControls
                  page={movimientosPage}
                  totalPages={movimientosTotalPages}
                  onPrevious={() => setMovimientosPage((page) => Math.max(1, page - 1))}
                  onNext={() => setMovimientosPage((page) => Math.min(movimientosTotalPages, page + 1))}
                  label={`Mostrando ${movimientos.length ? ((movimientosPage - 1) * HISTORIAL_PAGE_SIZE) + 1 : 0}-${Math.min(movimientosPage * HISTORIAL_PAGE_SIZE, movimientos.length)} de ${movimientos.length} movimientos`}
                />
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Material</th>
                        <th>Tipo</th>
                        <th>Cantidad</th>
                        <th>Proyecto</th>
                        <th>Lote</th>
                        <th>Referencia</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movimientosVisible.map((m) => (
                        <tr key={m.id}>
                          <td>{formatFecha(m.fecha)}</td>
                          <td>{m.material}</td>
                          <td>{m.tipo}</td>
                          <td>{m.cantidad}</td>
                          <td>{m.proyecto || '-'}</td>
                          <td>{m.lote || '-'}</td>
                          <td>{m.referencia || '-'}</td>
                        </tr>
                      ))}
                      {!movimientos.length && (
                        <tr>
                          <td colSpan={7}>Sin movimientos para los filtros seleccionados.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </article>
      </section>

      <section className={`panel inventory-panel ${showNecesidadesSection ? '' : 'inventory-panel-collapsed'}`}>
        <div className="panel-header">
          <h3>Necesidades por proyecto / lote</h3>
          <div className="row wrap">
            {showNecesidadesSection && (
              <>
                <div className="field" style={{ minWidth: 220 }}>
                  <SearchableSelect
                    options={[{ value: '', label: 'Proyecto: todos' }, ...proyectoOptions]}
                    value={necesidadesFiltros.proyecto_id}
                    onChange={(v) => setNecesidadesFiltros((f) => ({ ...f, proyecto_id: v }))}
                    placeholder="Filtrar proyecto..."
                  />
                </div>
                <div className="field" style={{ minWidth: 220 }}>
                  <SearchableSelect
                    options={[{ value: '', label: 'Lote: todos' }, ...loteOptions]}
                    value={necesidadesFiltros.lote_id}
                    onChange={(v) => setNecesidadesFiltros((f) => ({ ...f, lote_id: v }))}
                    placeholder="Filtrar lote..."
                  />
                </div>
                <label className="inline-check">
                  <input
                    type="checkbox"
                    checked={necesidadesFiltros.solo_faltantes}
                    onChange={(e) => setNecesidadesFiltros((f) => ({ ...f, solo_faltantes: e.target.checked }))}
                  />
                  Solo faltantes
                </label>
              </>
            )}
            <SectionToggleButton
              collapsed={!showNecesidadesSection}
              onToggle={() => setShowNecesidadesSection((v) => !v)}
              label="Necesidades"
            />
          </div>
        </div>
        {showNecesidadesSection && (
          <>
            <PaginationControls
              page={necesidadesPage}
              totalPages={necesidadesTotalPages}
              onPrevious={() => setNecesidadesPage((page) => Math.max(1, page - 1))}
              onNext={() => setNecesidadesPage((page) => Math.min(necesidadesTotalPages, page + 1))}
              label={`Mostrando ${necesidadesVisible.length} de ${necesidades.length} necesidades`}
              pageSize={necesidadesPageSize}
              onPageSizeChange={setNecesidadesPageSize}
              pageSizeOptions={PAGE_SIZE_OPTIONS}
            />
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Proyecto</th>
                    <th>Lote</th>
                    <th>Material</th>
                    <th>Requerida</th>
                    <th>En bodega</th>
                    <th>Pendiente</th>
                    <th>Disponible</th>
                  </tr>
                </thead>
                <tbody>
                  {necesidadesVisible.map((n) => (
                    <tr key={`${n.lote_id}-${n.material_id}`}>
                      <td>{n.proyecto}</td>
                      <td>{n.lote}</td>
                      <td>{n.material}</td>
                      <td>{n.cantidad_requerida}</td>
                      <td>{n.cantidad_en_bodega}</td>
                      <td>{n.cantidad_pendiente}</td>
                      <td>
                        <span className={`pill ${n.material_disponible ? 'pill-green' : 'pill-red'}`}>
                          {n.material_disponible ? 'Sí' : 'No'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
