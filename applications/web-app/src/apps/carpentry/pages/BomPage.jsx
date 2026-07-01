import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import { dbLabel } from '../utils/labels';
import { formatUnidadMedida } from '../utils/format';
import useToast from '../utils/useToast';
import DeleteButton from '../components/DeleteButton.jsx';
import SearchableSelect from '../components/SearchableSelect.jsx';
import CollapseToggle from '../components/CollapseToggle.jsx';
import StatusPill from '../components/StatusPill.jsx';

const initialBomForm = {
  item_id: '',
  material_id: '',
  cantidad_requerida: '',
  notas: '',
};

const ITEMS_GROUP_PAGE_SIZE = 20;

export default function BomPage()
{
  const { showToast } = useToast();

  // Catálogos
  const [proyectos, setProyectos] = useState([]);
  const [lotes, setLotes] = useState([]);
  const [materiales, setMateriales] = useState([]);

  // Selección encadenada
  const [proyectoId, setProyectoId] = useState('');
  const [itemId, setItemId] = useState('');

  // Datos cargados
  const [items, setItems] = useState([]);
  const [bomRows, setBomRows] = useState([]);
  const [piezasRows, setPiezasRows] = useState([]);
  const [subitems, setSubitems] = useState([]);

  // Formulario BOM
  const [bomForm, setBomForm] = useState(initialBomForm);
  const [viewMode, setViewMode] = useState('bom');
  const [subitemId, setSubitemId] = useState('');
  const [subitemNombre, setSubitemNombre] = useState('');

  // Colapsar secciones
  const [showItemsSection, setShowItemsSection] = useState(true);
  const [showBomSection, setShowBomSection] = useState(true);

  // Copiar BOM
  const [showCopiarBom, setShowCopiarBom] = useState(false);
  const [seleccionCopia, setSeleccionCopia] = useState([]);
  const [itemsGroupCollapsed, setItemsGroupCollapsed] = useState({});
  const [itemsGroupPages, setItemsGroupPages] = useState({});

  const materialesActivos = useMemo(() => materiales.filter((m) => m.activo), [materiales]);

  const proyectoOptions = useMemo(
    () => proyectos.map((p) => ({ value: String(p.id), label: `${p.nombre}${p.cliente ? ` — ${p.cliente}` : ''}` })),
    [proyectos]
  );

  const loteOptions = useMemo(
    () => lotes.map((l) => ({ value: String(l.id), label: `${l.nombre} · ${l.proyecto}` })),
    [lotes]
  );

  const materialOptions = useMemo(
    () => materialesActivos.map((m) => ({ value: String(m.id), label: m.nombre })),
    [materialesActivos]
  );

  const itemSeleccionado = useMemo(
    () => items.find((it) => String(it.id) === String(itemId)) || null,
    [items, itemId]
  );

  const itemsAgrupados = useMemo(
    () =>
      items.reduce((acc, it) =>
      {
        const nombreGrupo = (it.nombre || '').trim() || 'Sin nombre';
        if (!acc[nombreGrupo]) acc[nombreGrupo] = [];
        acc[nombreGrupo].push(it);
        return acc;
      }, {}),
    [items]
  );

  const gruposItems = useMemo(
    () =>
      Object.entries(itemsAgrupados).map(([nombre, grupoItems]) =>
      {
        const totalPaginas = Math.max(1, Math.ceil(grupoItems.length / ITEMS_GROUP_PAGE_SIZE));
        return {
          nombre,
          items: grupoItems,
          totalPaginas,
        };
      }),
    [itemsAgrupados]
  );

  // Ítems del mismo nombre en el mismo lote (para copiar BOM)
  const itemsHermanos = useMemo(
  () =>
  {
    if (!itemSeleccionado || !itemSeleccionado.lote_id) return [];
    return items.filter(
      (it) =>
        String(it.id) !== String(itemId) &&
        it.nombre === itemSeleccionado.nombre &&
        it.lote_id === itemSeleccionado.lote_id
    );
  },
  [items, itemId, itemSeleccionado]
  );

  const toggleGrupoItems = (nombre) =>
  {
    setItemsGroupCollapsed((prev) => ({
      ...prev,
      [nombre]: !prev[nombre],
    }));
  };

  const cambiarPaginaGrupo = (nombre, pagina) =>
  {
    setItemsGroupPages((prev) => ({
      ...prev,
      [nombre]: pagina,
    }));
  };

  const cargarCatalogos = async () =>
  {
    try
    {
      const [proy, mats] = await Promise.all([
        api.catalogos.proyectosActivos(),
        api.materiales.listar({ activo: 'true' }),
      ]);
      setProyectos(proy);
      setMateriales(mats);
    }
    catch (error)
    {
      showToast(error.message, 'error');
    }
  };

  const cargarLotesProyecto = async (idProyecto) =>
  {
    if (!idProyecto)
    {
      setLotes([]);
      return;
    }

    try
    {
      const data = await api.lotes.listar({ proyecto_id: idProyecto });
      setLotes(data);
    }
    catch (error)
    {
      showToast(error.message, 'error');
    }
  };

  const cargarItems = async (idProyecto) =>
  {
    if (!idProyecto) { setItems([]); return; }
    try
    {
      const data = await api.items.listarPorProyecto({ proyecto_id: idProyecto });
      setItems(data);
    }
    catch (error)
    {
      showToast(error.message, 'error');
    }
  };

  const cargarBom = async (idItem) =>
  {
    if (!idItem) { setBomRows([]); return; }
    try
    {
      const data = await api.bom.listarPorItem({ item_id: idItem });
      setBomRows(data);
    }
    catch (error)
    {
      showToast(error.message, 'error');
    }
  };

  const cargarSubitems = async (idItem) =>
  {
    if (!idItem)
    {
      setSubitems([]);
      setSubitemId('');
      return;
    }
    try
    {
      const data = await api.bom.listarSubitems({ item_id: idItem });
      setSubitems(data);
      setSubitemId((prev) =>
      {
        if (!prev) return '';
        if (prev === '__sin_sub_item__') return prev;
        return data.some((row) => String(row.id) === String(prev)) ? prev : '';
      });
    }
    catch (error)
    {
      showToast(error.message, 'error');
    }
  };

  const cargarPiezas = async (idItem, idSubitem = '') =>
  {
    if (!idItem)
    {
      setPiezasRows([]);
      return;
    }
    try
    {
      const data = await api.bom.listarPiezas({
        item_id: idItem,
        sub_item_id: idSubitem && idSubitem !== '__sin_sub_item__' ? idSubitem : null,
        sin_sub_item: idSubitem === '__sin_sub_item__',
      });
      setPiezasRows(data);
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
    cargarItems(proyectoId);
    cargarLotesProyecto(proyectoId);
    setItemId('');
    setBomRows([]);
    setShowCopiarBom(false);
  }, [proyectoId]);

  useEffect(() =>
  {
    setBomForm((prev) => ({ ...initialBomForm, item_id: itemId }));
    setShowCopiarBom(false);
    setSeleccionCopia([]);
    setSubitemId('');
    setPiezasRows([]);
    if (viewMode === 'bom') {
      cargarBom(itemId);
    } else {
      cargarSubitems(itemId);
      cargarPiezas(itemId);
    }
  }, [itemId, viewMode]);

  useEffect(() =>
  {
    if (viewMode !== 'piezas') return;
    cargarPiezas(itemId, subitemId);
  }, [subitemId]);

  useEffect(() =>
  {
    setItemsGroupCollapsed((prev) =>
    {
      const next = {};
      gruposItems.forEach((grupo) =>
      {
        next[grupo.nombre] = prev[grupo.nombre] ?? true;
      });
      return next;
    });
    setItemsGroupPages((prev) =>
    {
      const next = {};
      gruposItems.forEach((grupo) =>
      {
        const previa = prev[grupo.nombre] ?? 1;
        next[grupo.nombre] = Math.min(Math.max(1, previa), grupo.totalPaginas);
      });
      return next;
    });
  }, [gruposItems]);

  useEffect(() =>
  {
    if (!itemSeleccionado) return;

    const nombreGrupo = (itemSeleccionado.nombre || '').trim() || 'Sin nombre';
    const grupo = gruposItems.find((g) => g.nombre === nombreGrupo);
    if (!grupo) return;

    const indice = grupo.items.findIndex((it) => String(it.id) === String(itemSeleccionado.id));
    if (indice === -1) return;

    const paginaObjetivo = Math.floor(indice / ITEMS_GROUP_PAGE_SIZE) + 1;

    setItemsGroupCollapsed((prev) =>
      prev[nombreGrupo] === false ? prev : { ...prev, [nombreGrupo]: false }
    );
    setItemsGroupPages((prev) =>
      prev[nombreGrupo] === paginaObjetivo ? prev : { ...prev, [nombreGrupo]: paginaObjetivo }
    );
  }, [gruposItems, itemSeleccionado]);

  const asignarLote = async (item, lote_id) =>
  {
    try
    {
      if (!lote_id)
      {
        await api.items.desasignarLote({ id: item.id });
        showToast('Lote desasignado.');
      }
      else
      {
        await api.items.asignarLote({ id: item.id, lote_id });
        showToast('Lote asignado.');
      }
      await cargarItems(proyectoId);
    }
    catch (error)
    {
      showToast(error.message, 'error');
    }
  };

  const guardarBom = async (e) =>
  {
    e.preventDefault();
    try
    {
      if (!itemId || !bomForm.material_id)
      {
        showToast('Selecciona ítem y material para continuar.', 'error');
        return;
      }
      await api.bom.guardarMaterial(bomForm);
      showToast('Material BOM guardado.');
      setBomForm((prev) => ({ ...initialBomForm, item_id: itemId }));
      await cargarBom(itemId);
    }
    catch (error)
    {
      showToast(error.message, 'error');
    }
  };

  const eliminarBom = async (id) =>
  {
    if (!window.confirm('¿Eliminar material del BOM del ítem?')) return;
    try
    {
      await api.bom.eliminarMaterial({ id });
      showToast('Material BOM eliminado.');
      await cargarBom(itemId);
    }
    catch (error)
    {
      showToast(error.message, 'error');
    }
  };

  const copiarBom = async () =>
  {
    if (!seleccionCopia.length)
    {
      showToast('Selecciona al menos un ítem destino.', 'error');
      return;
    }
    try
    {
      await api.items.copiarBom({ item_origen_id: itemId, item_destinos_ids: seleccionCopia });
      showToast(`BOM copiado a ${seleccionCopia.length} ítem(s).`);
      setShowCopiarBom(false);
      setSeleccionCopia([]);
    }
    catch (error)
    {
      showToast(error.message, 'error');
    }
  };

  const toggleCopiaItem = (id) =>
  {
    setSeleccionCopia((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const seleccionarItemModo = (id, mode) =>
  {
    setItemId(String(id));
    setViewMode(mode);
  };

  const crearSubitem = async (event) =>
  {
    event.preventDefault();
    if (!itemId)
    {
      showToast('Selecciona un ítem para crear sub items.', 'error');
      return;
    }
    if (!subitemNombre.trim())
    {
      showToast('Escribe el nombre del sub item.', 'error');
      return;
    }

    try
    {
      const created = await api.bom.crearSubitem({ item_id: itemId, nombre: subitemNombre });
      setSubitemNombre('');
      await cargarSubitems(itemId);
      setSubitemId(String(created.id));
      showToast('Sub item creado.');
    }
    catch (error)
    {
      showToast(error.message, 'error');
    }
  };

  const asignarPiezaSubitem = async (piezaId, nextSubitemId) =>
  {
    if (!itemId) return;
    try
    {
      await api.bom.asignarSubitemPieza({
        pieza_mueble_id: piezaId,
        item_id: itemId,
        sub_item_id: nextSubitemId || null,
      });
      await cargarSubitems(itemId);
      await cargarPiezas(itemId, subitemId);
      showToast('Pieza actualizada.');
    }
    catch (error)
    {
      showToast(error.message, 'error');
    }
  };

  return (
    <div className="stack">
      <section className="grid grid-2">

        {/* Panel izquierdo — Ítems del proyecto */}
        <article className="panel">
          <div className="panel-header">
            <h3>Ítems del proyecto</h3>
            <CollapseToggle
              collapsed={!showItemsSection}
              onToggle={() => setShowItemsSection((v) => !v)}
              label="Ítems"
            />
          </div>
          {showItemsSection && (
            <>
              <div className="field bom-proyecto-field">
                <label>Proyecto</label>
                <SearchableSelect
                  options={proyectoOptions}
                  value={proyectoId}
                  onChange={(v) => setProyectoId(v)}
                  placeholder="Selecciona un proyecto..."
                />
              </div>

              <div className="stack-sm">
                {gruposItems.length ? (
                  gruposItems.map((grupo) =>
                  {
                    const paginaActual = itemsGroupPages[grupo.nombre] ?? 1;
                    const inicio = (paginaActual - 1) * ITEMS_GROUP_PAGE_SIZE;
                    const itemsPagina = grupo.items.slice(inicio, inicio + ITEMS_GROUP_PAGE_SIZE);
                    const estaColapsado = Boolean(itemsGroupCollapsed[grupo.nombre]);

                    return (
                      <div key={grupo.nombre} className={`items-grupo ${estaColapsado ? 'items-grupo-collapsed' : ''}`}>
                        <div className="panel-header items-grupo-header">
                          <h4 className="items-grupo-titulo" style={{ margin: 0 }}>
                            {grupo.nombre}
                            <span className="muted" style={{ marginLeft: '8px', fontWeight: 400 }}>
                              ({grupo.items.length})
                            </span>
                          </h4>
                          <button
                            type="button"
                            className="items-grupo-toggle"
                            data-collapsed={estaColapsado}
                            onClick={() => toggleGrupoItems(grupo.nombre)}
                            title={estaColapsado ? `Mostrar ${grupo.nombre}` : `Comprimir ${grupo.nombre}`}
                            aria-label={estaColapsado ? `Mostrar ${grupo.nombre}` : `Comprimir ${grupo.nombre}`}
                            aria-expanded={!estaColapsado}
                          >
                            ☰
                          </button>
                        </div>

                        {!estaColapsado && (
                          <>
                            <div
                              className="row wrap"
                              style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}
                            >
                              <span className="muted">
                                Página {paginaActual} de {grupo.totalPaginas}
                                {' '}
                                · Mostrando {inicio + 1}-{Math.min(inicio + ITEMS_GROUP_PAGE_SIZE, grupo.items.length)} de {grupo.items.length}
                              </span>
                              <div className="row">
                                <button
                                  type="button"
                                  className="small ghost"
                                  onClick={() => cambiarPaginaGrupo(grupo.nombre, Math.max(1, paginaActual - 1))}
                                  disabled={paginaActual <= 1}
                                >
                                  Anterior
                                </button>
                                <button
                                  type="button"
                                  className="small ghost"
                                  onClick={() => cambiarPaginaGrupo(grupo.nombre, Math.min(grupo.totalPaginas, paginaActual + 1))}
                                  disabled={paginaActual >= grupo.totalPaginas}
                                >
                                  Siguiente
                                </button>
                              </div>
                            </div>

                            <div className="table-wrap">
                              <table>
                                <thead>
                                  <tr>
                                    <th>Ítem</th>
                                    <th>Tipología / Apto</th>
                                    <th>Estado</th>
                                    <th>Lote asignado</th>
                                    <th>BOM</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {itemsPagina.map((it) => (
                                    <tr key={it.id} className={String(itemId) === String(it.id) ? 'selected-row' : ''}>
                                      <td>{it.nombre}</td>
                                      <td>
                                        {(it.tipologia ?? it.piso) ? `${it.tipologia ?? it.piso}` : ''}
                                        {(it.tipologia ?? it.piso) && it.apartamento ? ' · ' : ''}
                                        {it.apartamento || (!(it.tipologia ?? it.piso) ? '-' : '')}
                                      </td>
                                      <td>
                                        <StatusPill value={it.estado} />
                                      </td>
                                      <td>
                                        <SearchableSelect
                                          options={[{ value: '', label: 'Sin lote' }, ...loteOptions]}
                                          value={it.lote_id ? String(it.lote_id) : ''}
                                          onChange={(v) => asignarLote(it, v || null)}
                                          placeholder="Asignar lote..."
                                        />
                                      </td>
                                      <td>
                                        <div className="row wrap">
                                          <button
                                            type="button"
                                            className="small ghost"
                                            onClick={() => seleccionarItemModo(it.id, 'bom')}
                                            disabled={!proyectoId}
                                          >
                                            Ver BOM
                                          </button>
                                          <button
                                            type="button"
                                            className="small ghost"
                                            onClick={() => seleccionarItemModo(it.id, 'piezas')}
                                            disabled={!proyectoId}
                                          >
                                            Ver piezas del mueble
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                  {!itemsPagina.length && (
                                    <tr>
                                      <td colSpan={5}>
                                        No hay ítems en esta página.
                                      </td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <table>
                    <tbody>
                      <tr>
                        <td colSpan={5}>
                          {proyectoId
                            ? 'No hay ítems para este proyecto. Créalos en la sección Proyectos.'
                            : 'Selecciona un proyecto para ver sus ítems.'}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}
        </article>

        {/* Panel derecho — BOM del ítem seleccionado */}
        <article className="panel">
          <div className="panel-header">
            <h3>
              {itemSeleccionado
                ? `${viewMode === 'piezas' ? 'Piezas' : 'BOM'} · ${itemSeleccionado.nombre}`
                : viewMode === 'piezas' ? 'Piezas del mueble' : 'Materiales del BOM'}
            </h3>
            <CollapseToggle
              collapsed={!showBomSection}
              onToggle={() => setShowBomSection((v) => !v)}
              label={viewMode === 'piezas' ? 'Piezas' : 'Materiales'}
            />
          </div>
          {showBomSection && (
            <>
              {viewMode === 'bom' ? (
              <>
              <form className="form-grid compact bom-material-form" onSubmit={guardarBom}>
                <div className="field" style={{ minWidth: 0 }}>
                  <label>{dbLabel('material_id')}</label>
                  <SearchableSelect
                    options={materialOptions}
                    value={bomForm.material_id}
                    onChange={(v) => setBomForm((p) => ({ ...p, material_id: v }))}
                    disabled={!itemId}
                    placeholder={`Buscar ${dbLabel('material_id')}...`}
                  />
                </div>
                <div className="field" style={{ minWidth: 0 }}>
                  <label>{dbLabel('cantidad_requerida')}</label>
                  <input
                    type="number"
                    step="0.001"
                    min="0.001"
                    value={bomForm.cantidad_requerida}
                    onChange={(e) => setBomForm((p) => ({ ...p, cantidad_requerida: e.target.value }))}
                    placeholder={dbLabel('cantidad_requerida')}
                    required
                    disabled={!itemId}
                    style={{ width: '100%', minWidth: 0 }}
                  />
                </div>
                <div className="field" style={{ minWidth: 0 }}>
                  <label>{dbLabel('notas')}</label>
                  <input
                    value={bomForm.notas}
                    onChange={(e) => setBomForm((p) => ({ ...p, notas: e.target.value }))}
                    placeholder={dbLabel('notas')}
                    disabled={!itemId}
                    style={{ width: '100%', minWidth: 0 }}
                  />
                </div>
                <div className="field bom-material-submit" style={{ alignSelf: 'end', minWidth: 0 }}>
                  <button type="submit" className="small" disabled={!itemId}>
                    Agregar/actualizar
                  </button>
                </div>
              </form>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Material</th>
                      <th>Categoría</th>
                      <th>Unidad</th>
                      <th>Cantidad</th>
                      <th>Notas</th>
                      <th>Eliminar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bomRows.map((row) => (
                      <tr key={row.id}>
                        <td>{row.material}</td>
                        <td>{row.categoria}</td>
                        <td>{formatUnidadMedida(row.unidad_medida)}</td>
                        <td>{row.cantidad_requerida}</td>
                        <td>{row.notas || '-'}</td>
                        <td>
                          <DeleteButton onClick={() => eliminarBom(row.id)} />
                        </td>
                      </tr>
                    ))}
                    {!bomRows.length && (
                      <tr>
                        <td colSpan={6}>
                          {itemId ? 'Sin materiales en el BOM.' : 'Selecciona un ítem para ver su BOM.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Sección copiar BOM */}
              {itemSeleccionado && itemsHermanos.length > 0 && (
                <div style={{ marginTop: '12px' }}>
                  <button
                    type="button"
                    className="small ghost"
                    onClick={() => setShowCopiarBom((v) => !v)}
                  >
                    {showCopiarBom ? 'Cancelar copia' : 'Copiar BOM a otros ítems del mismo tipo'}
                  </button>

                  {showCopiarBom && (
                    <div style={{ marginTop: '8px' }}>
                      <p className="muted" style={{ marginBottom: '6px' }}>
                        Ítems con el mismo nombre en el mismo lote:
                      </p>
                      {itemsHermanos.map((it) => (
                        <label key={it.id} style={{ display: 'flex', gap: '8px', marginBottom: '4px', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={seleccionCopia.includes(String(it.id))}
                            onChange={() => toggleCopiaItem(String(it.id))}
                          />
                          {it.nombre}
                          {(it.tipologia ?? it.piso) ? ` · ${it.tipologia ?? it.piso}` : ''}
                          {it.apartamento ? ` · ${it.apartamento}` : ''}
                        </label>
                      ))}
                      <button
                        type="button"
                        className="small"
                        style={{ marginTop: '8px' }}
                        onClick={copiarBom}
                        disabled={!seleccionCopia.length}
                      >
                        Copiar BOM a seleccionados
                      </button>
                    </div>
                  )}
                </div>
              )}
              </>
              ) : (
              <>
                <form
                  className="form-grid compact"
                  style={{ gridTemplateColumns: 'minmax(0, 1fr)', gap: 8, marginBottom: 10 }}
                  onSubmit={crearSubitem}
                >
                  <div className="field" style={{ minWidth: 0 }}>
                    <label>Sub item</label>
                    <input
                      value={subitemNombre}
                      onChange={(e) => setSubitemNombre(e.target.value)}
                      placeholder="Nombre del sub item"
                      disabled={!itemId}
                    />
                  </div>
                  <div className="row" style={{ justifyContent: 'flex-start' }}>
                    <button type="submit" className="small" disabled={!itemId}>
                      Crear sub item
                    </button>
                  </div>
                </form>

                <div className="row wrap" style={{ margin: '10px 0' }}>
                  <button
                    type="button"
                    className={`small ${!subitemId ? '' : 'ghost'}`}
                    onClick={() => setSubitemId('')}
                    disabled={!itemId}
                  >
                    Todas las piezas
                  </button>
                  <button
                    type="button"
                    className={`small ${subitemId === '__sin_sub_item__' ? '' : 'ghost'}`}
                    onClick={() => setSubitemId('__sin_sub_item__')}
                    disabled={!itemId}
                  >
                    Sin sub item
                  </button>
                  {subitems.map((subitem) => (
                    <button
                      key={subitem.id}
                      type="button"
                      className={`small ${String(subitemId) === String(subitem.id) ? '' : 'ghost'}`}
                      onClick={() => setSubitemId(String(subitem.id))}
                    >
                      {subitem.nombre}
                    </button>
                  ))}
                </div>

                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Sub item</th>
                        <th>Pieza</th>
                        <th>Cantidad</th>
                        <th>Material</th>
                        <th>Largo</th>
                        <th>Ancho</th>
                        <th>Espesor</th>
                        <th>Llegada</th>
                      </tr>
                    </thead>
                    <tbody>
                        {piezasRows.map((row) => (
                          <tr key={row.id}>
                          <td>
                            <select
                              className="select-light"
                              value={row.sub_item_id ? String(row.sub_item_id) : ''}
                              onChange={(e) => asignarPiezaSubitem(row.id, e.target.value)}
                            >
                              <option value="">Sin sub item</option>
                              {subitems.map((subitem) => (
                                <option key={subitem.id} value={String(subitem.id)}>
                                  {subitem.nombre}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>{row.pieza || row.nombre || `Pieza ${row.id}`}</td>
                          <td>{row.cantidad ?? '-'}</td>
                          <td>{row.material || '-'}</td>
                          <td>{row.largo_mm ?? '-'}</td>
                          <td>{row.ancho_mm ?? '-'}</td>
                          <td>{row.espesor_mm ?? '-'}</td>
                          <td>{row.llegada ? 'Sí' : 'No'}</td>
                        </tr>
                      ))}
                      {!piezasRows.length && (
                        <tr>
                          <td colSpan={8}>
                            {itemId ? 'Sin piezas registradas para este ítem.' : 'Selecciona un ítem para ver sus piezas.'}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
              )}
            </>
          )}
        </article>

      </section>
    </div>
  );
}
