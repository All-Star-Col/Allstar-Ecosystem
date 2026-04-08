import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import { formatNumero } from '../utils/format';
import { dbLabel } from '../utils/labels';
import useToast from '../utils/useToast';
import DeleteButton from '../components/DeleteButton.jsx';
import SearchableSelect from '../components/SearchableSelect.jsx';
import CollapseToggle from '../components/CollapseToggle.jsx';

const initialPersona = {
  id: null,
  nombre: '',
  area_id: '',
  proceso_id: '',
  horas_dia_disponibles: 8,
  activo: true,
};

const initialMaquina = {
  id: null,
  nombre: '',
  proceso_id: '',
  horas_dia_disponibles: 8,
  activo: true,
};

const initialArea = {
  id: null,
  nombre: '',
};

export default function RecursosPage() {
  const { showToast } = useToast();
  const [procesos, setProcesos] = useState([]);
  const [areas, setAreas] = useState([]);

  const [personas, setPersonas] = useState([]);
  const [personaForm, setPersonaForm] = useState(initialPersona);

  const [maquinas, setMaquinas] = useState([]);
  const [maquinaForm, setMaquinaForm] = useState(initialMaquina);

  const [areaForm, setAreaForm] = useState(initialArea);

  const [cargaFiltros, setCargaFiltros] = useState({ proceso: '', tipo_recurso: '' });
  const [carga, setCarga] = useState([]);
  const [showPersonas, setShowPersonas] = useState(true);
  const [showMaquinas, setShowMaquinas] = useState(true);
  const [showAreas, setShowAreas] = useState(true);
  const [showCarga, setShowCarga] = useState(true);

  const processByAreaId = useMemo(() => {
    const byName = new Map(procesos.map((p) => [String(p.nombre || '').toLowerCase(), String(p.id)]));
    return new Map(
      areas.map((a) => {
        const area = String(a.nombre || '').toLowerCase();
        let process = '';
        if (area === 'diseño' || area === 'jefatura') process = byName.get('administrativo') || '';
        if (area === 'transportistas') process = byName.get('transporte') || '';
        if (area === 'instalacion') process = byName.get('instalación') || byName.get('instalacion') || '';
        return [String(a.id), process];
      })
    );
  }, [areas, procesos]);
  const areaOptions = useMemo(
    () => areas.map((a) => ({ value: String(a.id), label: a.nombre })),
    [areas]
  );
  const procesoOptions = useMemo(
    () => procesos.map((p) => ({ value: String(p.id), label: p.nombre })),
    [procesos]
  );

  const cargarCatalogos = async () => {
    try {
      const [procesosData, areasData] = await Promise.all([api.catalogos.procesos(), api.catalogos.areas()]);
      setProcesos(procesosData);
      setAreas(areasData);
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  const cargarPersonas = async () => {
    try {
      const data = await api.recursos.listarPersonas({});
      setPersonas(data);
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  const cargarMaquinas = async () => {
    try {
      const data = await api.recursos.listarMaquinas({});
      setMaquinas(data);
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  const cargarCarga = async () => {
    try {
      const data = await api.recursos.cargaSemanal(cargaFiltros);
      setCarga(data);
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  useEffect(() => {
    cargarCatalogos();
    cargarPersonas();
    cargarMaquinas();
  }, []);

  useEffect(() => {
    cargarCarga();
  }, [cargaFiltros]);

  const guardarPersona = async (e) => {
    e.preventDefault();
    try {
      await api.recursos.guardarPersona(personaForm);
      showToast('Persona guardada.');
      setPersonaForm(initialPersona);
      await Promise.all([cargarPersonas(), cargarCarga()]);
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  const guardarMaquina = async (e) => {
    e.preventDefault();
    try {
      await api.recursos.guardarMaquina(maquinaForm);
      showToast('Máquina guardada.');
      setMaquinaForm(initialMaquina);
      await Promise.all([cargarMaquinas(), cargarCarga()]);
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  const guardarArea = async (e) => {
    e.preventDefault();
    try {
      await api.catalogos.guardarArea(areaForm);
      showToast('Área guardada.');
      setAreaForm(initialArea);
      await Promise.all([cargarCatalogos(), cargarPersonas()]);
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  const eliminarArea = async (id) => {
    if (!window.confirm('¿Eliminar área?')) return;
    try {
      await api.catalogos.eliminarArea({ id });
      showToast('Área eliminada.');
      await Promise.all([cargarCatalogos(), cargarPersonas()]);
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  const desactivarPersona = async (id) => {
    if (!window.confirm('¿Desactivar persona?')) return;
    try {
      await api.recursos.desactivarPersona({ id });
      showToast('Persona desactivada.');
      await Promise.all([cargarPersonas(), cargarCarga()]);
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  const desactivarMaquina = async (id) => {
    if (!window.confirm('¿Desactivar máquina?')) return;
    try {
      await api.recursos.desactivarMaquina({ id });
      showToast('Máquina desactivada.');
      await Promise.all([cargarMaquinas(), cargarCarga()]);
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  const onAreaChange = (areaId) => {
    setPersonaForm((prev) => ({
      ...prev,
      area_id: areaId,
      proceso_id: processByAreaId.get(String(areaId)) || prev.proceso_id,
    }));
  };

  return (
    <div className="stack">
      <section className="grid grid-2">
        <article className="panel">
          <div className="panel-header">
            <h3>Personas</h3>
            <CollapseToggle collapsed={!showPersonas} onToggle={() => setShowPersonas((v) => !v)} label="Personas" />
          </div>
          {showPersonas && (
            <>
              <form className="form-grid" onSubmit={guardarPersona}>
                <div className="field">
                  <label>{dbLabel('nombre')}</label>
                  <input
                    placeholder={dbLabel('nombre')}
                    value={personaForm.nombre}
                    onChange={(e) => setPersonaForm((p) => ({ ...p, nombre: e.target.value }))}
                    required
                  />
                </div>
                <div className="field">
                  <label>{dbLabel('area_id')}</label>
                  <SearchableSelect
                    options={areaOptions}
                    value={personaForm.area_id}
                    onChange={onAreaChange}
                    placeholder={`Buscar ${dbLabel('area_id')}...`}
                  />
                </div>
                <div className="field">
                  <label>{dbLabel('proceso_id')}</label>
                  <SearchableSelect
                    options={procesoOptions}
                    value={personaForm.proceso_id}
                    onChange={(v) => setPersonaForm((p) => ({ ...p, proceso_id: v }))}
                    placeholder={`Buscar ${dbLabel('proceso_id')}...`}
                  />
                </div>
                <div className="field">
                  <label>{dbLabel('horas_dia_disponibles')}</label>
                  <input
                    type="number"
                    min={0}
                    step="0.1"
                    value={personaForm.horas_dia_disponibles}
                    onChange={(e) => setPersonaForm((p) => ({ ...p, horas_dia_disponibles: e.target.value }))}
                  />
                </div>
                <button type="submit" className="small save-btn">
                  Guardar persona
                </button>
              </form>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Nombre</th>
                      <th>Área</th>
                      <th>Proceso</th>
                      <th>Horas/día</th>
                      <th>Activo</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {personas.map((p) => (
                      <tr key={p.id}>
                        <td>{p.nombre}</td>
                        <td>{p.area || '-'}</td>
                        <td>{p.proceso || '-'}</td>
                        <td>{p.horas_dia_disponibles}</td>
                        <td>{p.activo ? 'Sí' : 'No'}</td>
                        <td>
                          <div className="row">
                            <button className="small ghost" onClick={() => setPersonaForm(p)}>
                              Editar
                            </button>
                            <button className="small danger" onClick={() => desactivarPersona(p.id)} disabled={!p.activo}>
                              Desactivar
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
        </article>

        <article className="panel">
          <div className="panel-header">
            <h3>Máquinas</h3>
            <CollapseToggle collapsed={!showMaquinas} onToggle={() => setShowMaquinas((v) => !v)} label="Máquinas" />
          </div>
          {showMaquinas && (
            <>
              <form className="form-grid" onSubmit={guardarMaquina}>
            <div className="field">
              <label>{dbLabel('nombre')}</label>
              <input
                placeholder={dbLabel('nombre')}
                value={maquinaForm.nombre}
                onChange={(e) => setMaquinaForm((p) => ({ ...p, nombre: e.target.value }))}
                required
              />
            </div>
            <div className="field">
              <label>{dbLabel('proceso_id')}</label>
              <SearchableSelect
                options={procesoOptions}
                value={maquinaForm.proceso_id}
                onChange={(v) => setMaquinaForm((p) => ({ ...p, proceso_id: v }))}
                placeholder={`Buscar ${dbLabel('proceso_id')}...`}
              />
            </div>
            <div className="field">
              <label>{dbLabel('horas_dia_disponibles')}</label>
              <input
                type="number"
                min={0}
                step="0.1"
                value={maquinaForm.horas_dia_disponibles}
                onChange={(e) => setMaquinaForm((p) => ({ ...p, horas_dia_disponibles: e.target.value }))}
              />
            </div>
            <button type="submit" className="small save-btn">
              Guardar máquina
            </button>
              </form>

              <div className="table-wrap">
                <table>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Proceso</th>
                  <th>Horas/día</th>
                  <th>Activo</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {maquinas.map((m) => (
                  <tr key={m.id}>
                    <td>{m.nombre}</td>
                    <td>{m.proceso || '-'}</td>
                    <td>{m.horas_dia_disponibles}</td>
                    <td>{m.activo ? 'Sí' : 'No'}</td>
                    <td>
                      <div className="row">
                        <button className="small ghost" onClick={() => setMaquinaForm(m)}>
                          Editar
                        </button>
                        <button className="small danger" onClick={() => desactivarMaquina(m.id)} disabled={!m.activo}>
                          Desactivar
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
        </article>
      </section>

      <section className="grid grid-2">
        <article className="panel">
          <div className="panel-header">
            <h3>Áreas</h3>
            <CollapseToggle
              collapsed={!showAreas}
              onToggle={() => setShowAreas((v) => !v)}
              label="Áreas"
            />
          </div>
          {showAreas && (
            <>
              <form className="form-grid" onSubmit={guardarArea}>
                <div className="field">
                  <label>{dbLabel('nombre')}</label>
                  <input
                    placeholder={dbLabel('nombre')}
                    value={areaForm.nombre}
                    onChange={(e) => setAreaForm((a) => ({ ...a, nombre: e.target.value }))}
                    required
                  />
                </div>
                <button type="submit" className="small save-btn">
                  Guardar área
                </button>
              </form>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Área</th>
                      <th>Personas</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {areas.map((a) => (
                      <tr key={a.id}>
                        <td>{a.nombre}</td>
                        <td>{a.total_personas}</td>
                        <td>
                          <div className="row">
                            <button className="small ghost" onClick={() => setAreaForm(a)}>
                              Editar
                            </button>
                            <DeleteButton onClick={() => eliminarArea(a.id)} disabled={a.total_personas > 0} title="Eliminar área" />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </article>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h3>Carga semanal</h3>
          <div className="row">
            <div className="field">
              <label>{dbLabel('proceso_id')}</label>
              <SearchableSelect
                options={[{ value: '', label: 'Todos' }, ...procesos.map((p) => ({ value: p.nombre, label: p.nombre }))]}
                value={cargaFiltros.proceso}
                onChange={(val) => setCargaFiltros((f) => ({ ...f, proceso: val }))}
                placeholder="Todos"
              />
            </div>
            <div className="field">
              <label>{dbLabel('tipo_recurso')}</label>
              <select
                value={cargaFiltros.tipo_recurso}
                onChange={(e) => setCargaFiltros((f) => ({ ...f, tipo_recurso: e.target.value }))}
              >
                <option value="">Todos</option>
                <option value="persona">persona</option>
                <option value="maquina">maquina</option>
              </select>
            </div>
          </div>
          <CollapseToggle
            collapsed={!showCarga}
            onToggle={() => setShowCarga((v) => !v)}
            label="Carga semanal"
          />
        </div>

        {showCarga && <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Recurso</th>
                <th>Proceso</th>
                <th>Lotes en proceso</th>
                <th>Capacidad sem.</th>
                <th>% ocupación</th>
                <th>Horas reales</th>
              </tr>
            </thead>
            <tbody>
              {carga.map((c) => {
                const pct = Number(c.pct_ocupacion_planificada || 0);
                const cls = pct > 100 ? 'pill-red' : pct >= 80 ? 'pill-yellow' : 'pill-green';
                return (
                  <tr key={`${c.tipo_recurso}-${c.recurso_id}`}>
                    <td>{c.tipo_recurso}</td>
                    <td>{c.recurso}</td>
                    <td>{c.proceso || '-'}</td>
                    <td>{c.lotes_en_proceso}</td>
                    <td>{formatNumero(c.capacidad_semanal_horas, 1)} h</td>
                    <td>
                      <div>
                        <span className={`pill ${cls}`}>{formatNumero(pct, 1)}%</span>
                        {Number(c.pct_ocupacion_real) > 0 && (
                          <span className="muted" style={{ fontSize: '0.75rem', display: 'block' }}>
                            Real: {formatNumero(Number(c.pct_ocupacion_real), 1)}%
                          </span>
                        )}
                      </div>
                    </td>
                    <td>{formatNumero(c.horas_registradas_semana, 1)} h</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>}
      </section>
    </div>
  );
}
