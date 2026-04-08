import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import { dbLabel } from '../utils/labels';
import useToast from '../utils/useToast';
import CollapseToggle from '../components/CollapseToggle.jsx';

const initialMaterialForm = {
  id: null,
  nombre: '',
  categoria: 'tablero',
  unidad_medida: 'm2',
  descripcion: '',
  activo: true,
  material: '',
  sustrato: '',
  formato: '',
  calibre: '',
  referencia: '',
  proveedor: '',
  costo: '',
};

const MATERIALES_POR_PAGINA = 20;

export default function CatalogoMaterialesPage()
{
  const { showToast } = useToast();
  const [materiales, setMateriales] = useState([]);
  const [materialForm, setMaterialForm] = useState(initialMaterialForm);
  const [materialFilters, setMaterialFilters] = useState({ q: '', activo: '' });
  const [catalogTab, setCatalogTab] = useState('tablero');
  const [paginaMateriales, setPaginaMateriales] = useState(1);
  const [showFiltersPanel, setShowFiltersPanel] = useState(true);
  const [showCatalogPanel, setShowCatalogPanel] = useState(true);

  const materialesCategoria = useMemo(
    () => materiales.filter((m) => m.categoria === catalogTab),
    [materiales, catalogTab]
  );

  const totalPaginasMateriales = useMemo(
    () => Math.max(1, Math.ceil(materialesCategoria.length / MATERIALES_POR_PAGINA)),
    [materialesCategoria.length]
  );

  const materialesPagina = useMemo(() =>
  {
    const inicio = (paginaMateriales - 1) * MATERIALES_POR_PAGINA;
    return materialesCategoria.slice(inicio, inicio + MATERIALES_POR_PAGINA);
  }, [materialesCategoria, paginaMateriales]);

  const cargarMateriales = async () =>
  {
    try
    {
      const data = await api.materiales.listar({ ...materialFilters, categoria: catalogTab });
      setMateriales(data);
    }
    catch (error)
    {
      showToast(error.message, 'error');
    }
  };

  useEffect(() =>
  {
    cargarMateriales();
  }, [catalogTab]);

  useEffect(() =>
  {
    setPaginaMateriales(1);
  }, [catalogTab]);

  useEffect(() =>
  {
    setPaginaMateriales((prev) => Math.min(prev, totalPaginasMateriales));
  }, [totalPaginasMateriales]);

  const guardarMaterial = async (e) =>
  {
    e.preventDefault();
    try
    {
      await api.materiales.guardar(materialForm);
      showToast('Material guardado.');
      setMaterialForm({ ...initialMaterialForm, categoria: catalogTab });
      await cargarMateriales();
    }
    catch (error)
    {
      showToast(error.message, 'error');
    }
  };

  const desactivarMaterial = async (id) =>
  {
    if (!window.confirm('¿Desactivar material? (no se elimina)')) return;
    try
    {
      await api.materiales.desactivar({ id });
      showToast('Material desactivado.');
      await cargarMateriales();
    }
    catch (error)
    {
      showToast(error.message, 'error');
    }
  };

  const cambiarTab = (tab) =>
  {
    setCatalogTab(tab);
    setMaterialForm({ ...initialMaterialForm, categoria: tab });
  };

  return (
    <div className="stack">
      {/* Filtros globales */}
      <section className={`panel${showFiltersPanel ? '' : ' panel-collapsed'}`}>
        <div className="panel-header">
          <h3>Filtros globales</h3>
          <CollapseToggle
            collapsed={!showFiltersPanel}
            onToggle={() => setShowFiltersPanel((v) => !v)}
            label="Filtros globales"
          />
        </div>

        {showFiltersPanel && (
        <div className="row wrap" style={{ alignItems: 'end' }}>
          <div className="field" style={{ minWidth: 220, flex: '1 1 220px' }}>
            <label>{dbLabel('nombre')}</label>
            <input
              placeholder={`Buscar por ${dbLabel('nombre')}`}
              value={materialFilters.q}
              onChange={(e) => setMaterialFilters((f) => ({ ...f, q: e.target.value }))}
              style={{ width: '100%' }}
            />
          </div>
          <div className="field" style={{ minWidth: 170, flex: '1 1 170px' }}>
            <label>{dbLabel('activo')}</label>
            <select
              value={materialFilters.activo}
              onChange={(e) => setMaterialFilters((f) => ({ ...f, activo: e.target.value }))}
              style={{ width: '100%' }}
            >
              <option value="">Activos e inactivos</option>
              <option value="true">Solo activos</option>
              <option value="false">Solo inactivos</option>
            </select>
          </div>
          <div className="field" style={{ minWidth: 130, flex: '0 0 auto', alignSelf: 'end' }}>
            <label aria-hidden="true">&nbsp;</label>
            <button
              type="button"
              className="small"
              onClick={() =>
              {
                setPaginaMateriales(1);
                cargarMateriales();
              }}
            >
              Buscar
            </button>
          </div>
        </div>
        )}
      </section>

      {/* Pestañas por categoría */}
      <section className={`panel${showCatalogPanel ? '' : ' panel-collapsed'}`}>
        <div className="panel-header">
          <h3>Catálogo de materiales</h3>
          <CollapseToggle
            collapsed={!showCatalogPanel}
            onToggle={() => setShowCatalogPanel((v) => !v)}
            label="Catálogo de materiales"
          />
        </div>

        {showCatalogPanel && (
        <div className="catalog-tabs">
          <div className="row wrap catalog-tab-nav">
            <button
              type="button"
              className={catalogTab === 'tablero' ? 'small' : 'small ghost'}
              onClick={() => cambiarTab('tablero')}
            >
              Tableros
            </button>
            <button
              type="button"
              className={catalogTab === 'canto' ? 'small' : 'small ghost'}
              onClick={() => cambiarTab('canto')}
            >
              Cantos
            </button>
            <button
              type="button"
              className={catalogTab === 'herraje' ? 'small' : 'small ghost'}
              onClick={() => cambiarTab('herraje')}
            >
              Herrajes
            </button>
          </div>

          <div className="catalog-tab-content">
            {/* Formulario — campos varían por categoría */}
            <form className="form-grid catalog-material-form" onSubmit={guardarMaterial}>

              {catalogTab === 'tablero' && (
                <>
                  <div className="field">
                    <label>{dbLabel('material')}</label>
                    <input
                      placeholder={dbLabel('material')}
                      value={materialForm.material}
                      onChange={(e) => setMaterialForm((p) => ({ ...p, material: e.target.value, nombre: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="field">
                    <label>{dbLabel('sustrato')}</label>
                    <input
                      placeholder={dbLabel('sustrato')}
                      value={materialForm.sustrato}
                      onChange={(e) => setMaterialForm((p) => ({ ...p, sustrato: e.target.value }))}
                    />
                  </div>
                  <div className="field">
                    <label>{dbLabel('formato')}</label>
                    <input
                      placeholder={dbLabel('formato')}
                      value={materialForm.formato}
                      onChange={(e) => setMaterialForm((p) => ({ ...p, formato: e.target.value }))}
                    />
                  </div>
                  <div className="field">
                    <label>{dbLabel('calibre')}</label>
                    <input
                      placeholder={dbLabel('calibre')}
                      value={materialForm.calibre}
                      onChange={(e) => setMaterialForm((p) => ({ ...p, calibre: e.target.value }))}
                    />
                  </div>
                </>
              )}

              {catalogTab === 'canto' && (
                <>
                  <div className="field">
                    <label>{dbLabel('sustrato')}</label>
                    <input
                      placeholder={dbLabel('sustrato')}
                      value={materialForm.sustrato}
                      onChange={(e) => setMaterialForm((p) => ({ ...p, sustrato: e.target.value, nombre: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="field">
                    <label>{dbLabel('calibre')}</label>
                    <input
                      placeholder={dbLabel('calibre')}
                      value={materialForm.calibre}
                      onChange={(e) => setMaterialForm((p) => ({ ...p, calibre: e.target.value }))}
                    />
                  </div>
                </>
              )}

              {catalogTab === 'herraje' && (
                <div className="field">
                  <label>{dbLabel('referencia')}</label>
                  <input
                    placeholder={dbLabel('referencia')}
                    value={materialForm.referencia}
                    onChange={(e) => setMaterialForm((p) => ({ ...p, referencia: e.target.value, nombre: e.target.value }))}
                    required
                  />
                </div>
              )}

              <div className="field">
                <label>{dbLabel('proveedor')}</label>
                <input
                  placeholder={dbLabel('proveedor')}
                  value={materialForm.proveedor}
                  onChange={(e) => setMaterialForm((p) => ({ ...p, proveedor: e.target.value }))}
                />
              </div>
              <div className="field">
                <label>{dbLabel('costo')}</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder={dbLabel('costo')}
                  value={materialForm.costo}
                  onChange={(e) => setMaterialForm((p) => ({ ...p, costo: e.target.value }))}
                />
              </div>
              <div className="field">
                <label>{dbLabel('unidad_medida')}</label>
                <select
                  value={materialForm.unidad_medida}
                  onChange={(e) => setMaterialForm((p) => ({ ...p, unidad_medida: e.target.value }))}
                >
                  <option value="m2">m2</option>
                  <option value="ml">ml</option>
                  <option value="unidad">unidad</option>
                  <option value="kg">kg</option>
                  <option value="par">par</option>
                  <option value="juego">juego</option>
                </select>
              </div>
              <div className="field field-full">
                <label>{dbLabel('descripcion')}</label>
                <textarea
                  placeholder={dbLabel('descripcion')}
                  value={materialForm.descripcion}
                  onChange={(e) => setMaterialForm((p) => ({ ...p, descripcion: e.target.value }))}
                />
              </div>
              <button type="submit" className="small save-btn">
                {materialForm.id ? 'Actualizar material' : 'Guardar material'}
              </button>
              {materialForm.id && (
                <button
                  type="button"
                  className="small ghost"
                  onClick={() => setMaterialForm({ ...initialMaterialForm, categoria: catalogTab })}
                >
                  Cancelar edición
                </button>
              )}
            </form>

            {/* Tabla filtrada por pestaña activa */}
            <div className="catalog-table-block">
              <div className="row wrap" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
                <span className="muted">
                  Página {paginaMateriales} de {totalPaginasMateriales}
                  {' '}
                  · Mostrando {materialesCategoria.length ? ((paginaMateriales - 1) * MATERIALES_POR_PAGINA) + 1 : 0}
                  -
                  {Math.min(paginaMateriales * MATERIALES_POR_PAGINA, materialesCategoria.length)}
                  {' '}
                  de {materialesCategoria.length}
                </span>
                <div className="row">
                  <button
                    type="button"
                    className="small ghost"
                    onClick={() => setPaginaMateriales((prev) => Math.max(1, prev - 1))}
                    disabled={paginaMateriales <= 1}
                  >
                    Anterior
                  </button>
                  <button
                    type="button"
                    className="small ghost"
                    onClick={() => setPaginaMateriales((prev) => Math.min(totalPaginasMateriales, prev + 1))}
                    disabled={paginaMateriales >= totalPaginasMateriales}
                  >
                    Siguiente
                  </button>
                </div>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Nombre</th>
                      <th>Unidad</th>
                      <th>Proveedor</th>
                      <th>Costo</th>
                      <th>Activo</th>
                      <th>Refs BOM</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {materialesPagina.map((m) => (
                        <tr key={m.id}>
                          <td>{m.nombre}</td>
                          <td>{m.unidad_medida}</td>
                          <td>{m.tablero_proveedor || m.canto_proveedor || m.herraje_proveedor || '-'}</td>
                          <td>{m.tablero_costo || m.canto_costo || m.herraje_costo || '-'}</td>
                          <td>{m.activo ? 'Sí' : 'No'}</td>
                          <td>{m.referencias_bom}</td>
                          <td>
                            <div className="row">
                              <button
                                className="small ghost"
                                onClick={() =>
                                {
                                  setCatalogTab(m.categoria || 'tablero');
                                  setMaterialForm({
                                    id: m.id,
                                    nombre: m.nombre || '',
                                    categoria: m.categoria || 'tablero',
                                    unidad_medida: m.unidad_medida || 'unidad',
                                    descripcion: m.descripcion || '',
                                    activo: m.activo,
                                    material: m.material || m.nombre || '',
                                    sustrato: m.tablero_sustrato || m.canto_sustrato || '',
                                    formato: m.tablero_formato || '',
                                    calibre: m.tablero_calibre || m.canto_calibre || '',
                                    referencia: m.herraje_referencia || '',
                                    proveedor: m.tablero_proveedor || m.canto_proveedor || m.herraje_proveedor || '',
                                    costo: m.tablero_costo || m.canto_costo || m.herraje_costo || '',
                                  });
                                }}
                              >
                                Editar
                              </button>
                              <button
                                className="small danger"
                                onClick={() => desactivarMaterial(m.id)}
                                disabled={!m.activo}
                              >
                                Desactivar
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    {!materialesCategoria.length && (
                      <tr>
                        <td colSpan={7}>Sin materiales en esta categoría.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
        )}
      </section>
    </div>
  );
}
