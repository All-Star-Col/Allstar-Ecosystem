import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import StatusPill from '../components/StatusPill.jsx';
import KpiCard from '../components/KpiCard.jsx';
import CollapseToggle from '../components/CollapseToggle.jsx';
import { carpentryPath } from '../routes';
import { formatFecha, formatNumero, formatUnidadMedida } from '../utils/format';
import useToast from '../utils/useToast';

const ALERTA_OPTIONS = [
  { value: 'todos', label: 'Todo el tablero' },
  { value: 'RETRASADO', label: 'Retrasados' },
];

const PROJECT_AUTOPLAY_MS = 4200;

const IconProjects = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4 6.5h16" />
    <path d="M4 12h16" />
    <path d="M4 17.5h10" />
    <path d="M18 17.5h2" />
  </svg>
);

const IconLots = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 3 4 7l8 4 8-4-8-4Z" />
    <path d="M4 12l8 4 8-4" />
    <path d="M4 17l8 4 8-4" />
  </svg>
);

const IconMaterials = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M5 5h14v14H5z" />
    <path d="M9 9h6" />
    <path d="M9 13h6" />
    <path d="M12 17h.01" />
  </svg>
);

const IconCapacity = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M5 17a7 7 0 1 1 14 0" />
    <path d="M12 10v4l3 2" />
  </svg>
);

function CarouselArrowButton({ direction = 'next', onClick, ariaLabel }) {
  return (
    <button
      type="button"
      className={`carousel-arrow carousel-arrow-${direction} ${direction === 'prev' ? 'is-prev' : 'is-next'}`}
      onClick={onClick}
      aria-label={ariaLabel}
    >
      <span className="carousel-arrow-box" aria-hidden="true">
        <span className="carousel-arrow-elem">
          <svg viewBox="0 0 46 40" xmlns="http://www.w3.org/2000/svg">
            <path d="M46 20.038c0-.7-.3-1.5-.8-2.1l-16-17c-1.1-1-3.2-1.4-4.4-.3-1.2 1.1-1.2 3.3 0 4.4l11.3 11.9H3c-1.7 0-3 1.3-3 3s1.3 3 3 3h33.1l-11.3 11.9c-1 1-1.2 3.3 0 4.4 1.2 1.1 3.3.8 4.4-.3l16-17c.5-.5.8-1.1.8-1.9z" />
          </svg>
        </span>
        <span className="carousel-arrow-elem">
          <svg viewBox="0 0 46 40" xmlns="http://www.w3.org/2000/svg">
            <path d="M46 20.038c0-.7-.3-1.5-.8-2.1l-16-17c-1.1-1-3.2-1.4-4.4-.3-1.2 1.1-1.2 3.3 0 4.4l11.3 11.9H3c-1.7 0-3 1.3-3 3s1.3 3 3 3h33.1l-11.3 11.9c-1 1-1.2 3.3 0 4.4 1.2 1.1 3.3.8 4.4-.3l16-17c.5-.5.8-1.1.8-1.9z" />
          </svg>
        </span>
      </span>
    </button>
  );
}

function diasTexto(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '-';
  const n = Number(value);
  if (n < 0) return `Hace ${Math.abs(n)} días`;
  return `${n} días`;
}

function tipoRecursoLabel(tipo = '') {
  const key = String(tipo || '').toLowerCase();
  if (!key) return 'Sin área';
  if (key.includes('persona')) return 'Equipo humano';
  if (key.includes('maquina') || key.includes('máquina')) return 'Maquinaria';
  if (key.includes('herramienta')) return 'Herramientas';
  return key.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
}

function initialLetters(nombre = '') {
  const clean = String(nombre || '').trim();
  if (!clean) return 'NA';
  return clean
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() || '')
    .join('');
}

function clampPercent(value) {
  const pct = Number(value || 0);
  if (Number.isNaN(pct)) return 0;
  return Math.min(Math.max(pct, 0), 100);
}

function occupancyState(pct) {
  if (pct > 100) return { cls: 'bar-red', label: 'Sobrecarga' };
  if (pct >= 85) return { cls: 'bar-yellow', label: 'Alta' };
  return { cls: 'bar-green', label: 'Estable' };
}

function getCarouselStep(node, fallback = 320) {
  if (!node) return fallback;
  const firstCard = node.firstElementChild;
  if (!firstCard) return fallback;

  const width = firstCard.getBoundingClientRect().width || 0;
  const css = window.getComputedStyle(node);
  const gap = parseFloat(css.columnGap || css.gap || '0') || 0;
  const step = width + gap;

  return step > 0 ? step : fallback;
}

function getCarouselMetrics(node, fallback = 320) {
  const step = getCarouselStep(node, fallback);
  const maxScroll = Math.max((node?.scrollWidth || 0) - (node?.clientWidth || 0), 0);
  const maxIndex = step > 0 ? Math.round(maxScroll / step) : 0;
  const currentIndex = step > 0 ? Math.round(node.scrollLeft / step) : 0;

  return { step, maxIndex, currentIndex };
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [alerta, setAlerta] = useState('todos');
  const [loading, setLoading] = useState(true);
  const [showProyectosPanel, setShowProyectosPanel] = useState(true);
  const [showCargaPanel, setShowCargaPanel] = useState(true);
  const [showProduccionPanel, setShowProduccionPanel] = useState(true);
  const [showBloqueosPanel, setShowBloqueosPanel] = useState(true);
  const [proyectosCanNavigate, setProyectosCanNavigate] = useState(false);
  const [recursosCanNavigate, setRecursosCanNavigate] = useState(false);
  const proyectosCarouselRef = useRef(null);
  const recursosCarouselRef = useRef(null);
  const pauseProyectoAutoplayRef = useRef(false);
  const [data, setData] = useState({
    kpis: {
      proyectos_activos: 0,
      lotes_activos: 0,
      lotes_bloqueados: 0,
      lotes_con_faltantes: 0,
    },
    proyectos: [],
    lotesBloqueados: [],
    alertasMateriales: [],
    cargaActiva: [],
    produccionSemanal: [],
  });

  const proyectosDestacados = useMemo(
    () => (Array.isArray(data.proyectos) ? data.proyectos.slice(0, 12) : []),
    [data.proyectos]
  );

  const recursosDestacados = useMemo(
    () => (
      Array.isArray(data.cargaActiva)
        ? [...data.cargaActiva]
            .sort(
              (a, b) =>
                Number(b.pct_ocupacion_planificada || 0) - Number(a.pct_ocupacion_planificada || 0)
            )
            .slice(0, 12)
        : []
    ),
    [data.cargaActiva]
  );

  const moverCarruselCircular = (ref, direction = 1, fallbackStep = 320) => {
    const node = ref?.current;
    if (!node) return;

    const { step, maxIndex, currentIndex } = getCarouselMetrics(node, fallbackStep);
    if (maxIndex <= 0) return;

    const atStart = currentIndex <= 0;
    const atEnd = currentIndex >= maxIndex;

    let targetIndex = currentIndex + direction;
    if (direction > 0 && atEnd) targetIndex = 0;
    if (direction < 0 && atStart) targetIndex = maxIndex;

    targetIndex = Math.max(0, Math.min(maxIndex, targetIndex));
    node.scrollTo({ left: targetIndex * step, behavior: 'smooth' });
  };

  const desplazarProyectos = (direction) => {
    moverCarruselCircular(proyectosCarouselRef, direction, 320);
  };

  const desplazarRecursos = (direction) => {
    moverCarruselCircular(recursosCarouselRef, direction, 320);
  };

  const cargar = async () => {
    try {
      setLoading(true);
      const res = await api.dashboard.obtener({ alerta });
      setData(res);
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar();
  }, [alerta]);

  useEffect(() => {
    const node = proyectosCarouselRef.current;
    if (!node) return undefined;
    node.scrollLeft = 0;
    return undefined;
  }, [proyectosDestacados.length]);

  useEffect(() => {
    const node = recursosCarouselRef.current;
    if (!node) return undefined;
    node.scrollLeft = 0;
    return undefined;
  }, [recursosDestacados.length]);

  useEffect(() => {
    const updateNavigationState = () => {
      const proyectosNode = proyectosCarouselRef.current;
      const recursosNode = recursosCarouselRef.current;

      if (proyectosNode) {
        const hasOverflow = (proyectosNode.scrollWidth - proyectosNode.clientWidth) > 2;
        setProyectosCanNavigate(hasOverflow);
      } else {
        setProyectosCanNavigate(false);
      }

      if (recursosNode) {
        const hasOverflow = (recursosNode.scrollWidth - recursosNode.clientWidth) > 2;
        setRecursosCanNavigate(hasOverflow);
      } else {
        setRecursosCanNavigate(false);
      }
    };

    const onResize = () => {
      requestAnimationFrame(updateNavigationState);
    };

    const raf = requestAnimationFrame(updateNavigationState);
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
    };
  }, [loading, showProyectosPanel, showCargaPanel, proyectosDestacados.length, recursosDestacados.length]);

  useEffect(() => {
    if (proyectosDestacados.length <= 1 || !proyectosCanNavigate) return undefined;

    const interval = setInterval(() => {
      if (pauseProyectoAutoplayRef.current) return;
      moverCarruselCircular(proyectosCarouselRef, 1, 320);
    }, PROJECT_AUTOPLAY_MS);

    return () => clearInterval(interval);
  }, [proyectosDestacados.length, proyectosCanNavigate]);

  const produccionAgrupada = useMemo(() => {
    const byWeek = {};
    data.produccionSemanal.forEach((row) => {
      const semana = row.semana_inicio;
      byWeek[semana] ??= { semana, procesos: [] };
      byWeek[semana].procesos.push({
        proceso: row.proceso,
        piezas: Number(row.piezas_totales || 0),
      });
    });

    return Object.values(byWeek)
      .sort((a, b) => String(b.semana).localeCompare(String(a.semana)))
      .slice(0, 4);
  }, [data.produccionSemanal]);

  const resumenOperativo = useMemo(() => {
    const proyectos = data.proyectos || [];
    const cargaActiva = data.cargaActiva || [];
    const alertasMateriales = data.alertasMateriales || [];
    const bloqueados = data.lotesBloqueados || [];
    const produccion = data.produccionSemanal || [];

    const proyectosCriticos = proyectos.filter((row) => {
      const alertaActual = String(row.alerta || '').toLowerCase();
      return alertaActual.includes('riesgo') || alertaActual.includes('retrasado');
    }).length;

    const ocupacionPromedio = cargaActiva.length
      ? cargaActiva.reduce((acc, row) => acc + Number(row.pct_ocupacion_planificada || 0), 0) / cargaActiva.length
      : 0;

    const recursosSaturados = cargaActiva.filter(
      (row) => Number(row.pct_ocupacion_planificada || 0) >= 85
    ).length;

    const produccionTotal = produccion.reduce((acc, row) => acc + Number(row.piezas_totales || 0), 0);
    const materialesPendientes = alertasMateriales.reduce(
      (acc, row) => acc + (Array.isArray(row.faltantes) ? row.faltantes.length : 0),
      0
    );

    const siguienteCompromiso = [...proyectos]
      .filter((row) => row.fecha_compromiso)
      .sort((a, b) => new Date(a.fecha_compromiso) - new Date(b.fecha_compromiso))[0] || null;

    return {
      proyectosCriticos,
      ocupacionPromedio,
      recursosSaturados,
      produccionTotal,
      materialesPendientes,
      siguienteCompromiso,
      bloqueos: bloqueados.length,
    };
  }, [data]);

  const filtroActivo = ALERTA_OPTIONS.find((option) => option.value === alerta) || ALERTA_OPTIONS[0];

  return (
    <div className="stack dashboard-shell">
      <section className="dashboard-hero">
        <div className="dashboard-hero-main">
          <p className="dashboard-kicker">Centro de operaciones</p>
          <div className="dashboard-hero-heading">
            <div>
              <h3>Radar operativo de producción</h3>
              <p>
                Vista compacta para leer capacidad, compromisos y cuellos de botella antes de bajar al detalle
                por módulo.
              </p>
            </div>
            <div className="dashboard-hero-badges">
              <span className="hero-badge hero-badge-accent">{filtroActivo.label}</span>
              <span className="hero-badge">
                {formatNumero(resumenOperativo.produccionTotal, 0)} piezas en las últimas 4 semanas
              </span>
            </div>
          </div>

          <div className="dashboard-insight-grid">
            <article className="dashboard-insight-card">
              <span className="dashboard-insight-label">Compromiso más próximo</span>
              {resumenOperativo.siguienteCompromiso ? (
                <>
                  <strong>{resumenOperativo.siguienteCompromiso.proyecto}</strong>
                  <p>
                    {formatFecha(resumenOperativo.siguienteCompromiso.fecha_compromiso)} ·{' '}
                    {diasTexto(resumenOperativo.siguienteCompromiso.dias_a_compromiso)}
                  </p>
                </>
              ) : (
                <>
                  <strong>Sin fechas próximas</strong>
                  <p>No hay compromisos cargados en el filtro actual.</p>
                </>
              )}
            </article>

            <article className="dashboard-insight-card">
              <span className="dashboard-insight-label">Capacidad comprometida</span>
              <strong>{formatNumero(resumenOperativo.ocupacionPromedio, 1)}%</strong>
              <p>{formatNumero(resumenOperativo.recursosSaturados, 0)} recursos están por encima del 85%.</p>
            </article>

            <article className="dashboard-insight-card">
              <span className="dashboard-insight-label">Abastecimiento en alerta</span>
              <strong>{formatNumero(resumenOperativo.materialesPendientes, 0)} faltantes</strong>
              <p>{formatNumero(data.alertasMateriales.length, 0)} lotes requieren seguimiento de compra.</p>
            </article>
          </div>
        </div>

        <aside className="dashboard-hero-aside">
          <p className="dashboard-kicker">Foco del tablero</p>
          <div className="dashboard-filter-group" role="tablist" aria-label="Filtro de alertas del dashboard">
            {ALERTA_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`dashboard-filter-chip ${alerta === option.value ? 'active' : ''}`}
                onClick={() => setAlerta(option.value)}
                aria-pressed={alerta === option.value}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="dashboard-aside-metrics">
            <div className="dashboard-aside-row">
              <span>Proyectos críticos</span>
              <strong>{formatNumero(resumenOperativo.proyectosCriticos, 0)}</strong>
            </div>
            <div className="dashboard-aside-row">
              <span>Lotes bloqueados</span>
              <strong>{formatNumero(resumenOperativo.bloqueos, 0)}</strong>
            </div>
            <div className="dashboard-aside-row">
              <span>Lotes con faltantes</span>
              <strong>{formatNumero(data.kpis?.lotes_con_faltantes || 0, 0)}</strong>
            </div>
          </div>

          <div className="dashboard-aside-note">
            <span className="dashboard-insight-label">Lectura recomendada</span>
            <p>
              Prioriza los proyectos retrasados con fecha próxima y revisa primero los recursos con ocupación
              superior al 85%.
            </p>
          </div>
        </aside>
      </section>

      <section className="grid grid-4 dashboard-kpi-grid">
        <KpiCard
          icon={<IconProjects />}
          title="Proyectos activos"
          value={formatNumero(data.kpis?.proyectos_activos || 0, 0)}
          subtitle={`${formatNumero(resumenOperativo.proyectosCriticos, 0)} en riesgo operativo`}
          accentColor="var(--accent)"
        />
        <KpiCard
          icon={<IconLots />}
          title="Lotes activos"
          value={formatNumero(data.kpis?.lotes_activos || 0, 0)}
          subtitle={`${formatNumero(data.kpis?.lotes_bloqueados || 0, 0)} con bloqueo reportado`}
          accentColor="var(--proceso-armado)"
        />
        <KpiCard
          icon={<IconMaterials />}
          title="Material faltante"
          value={formatNumero(data.kpis?.lotes_con_faltantes || 0, 0)}
          subtitle={`${formatNumero(resumenOperativo.materialesPendientes, 0)} referencias pendientes`}
          accentColor="var(--status-warn)"
        />
        <KpiCard
          icon={<IconCapacity />}
          title="Capacidad planificada"
          value={`${formatNumero(resumenOperativo.ocupacionPromedio, 1)}%`}
          subtitle={`${formatNumero(resumenOperativo.recursosSaturados, 0)} recursos por encima de 85%`}
          accentColor="var(--status-ok)"
        />
      </section>

      <section className="stack dashboard-carousel-stack">
        <article className={`panel panel-dashboard${showProyectosPanel ? '' : ' panel-collapsed'}`}>
          <div className="panel-header">
            <div>
              <h3>Proyectos activos</h3>
              <p className="panel-subtitle">Lectura por cards: avance, compromiso, días pendientes y estado.</p>
            </div>
            <div className="row wrap">
              <span className="count-chip">{formatNumero(data.proyectos.length, 0)} visibles</span>
              <button type="button" className="small ghost" onClick={() => navigate(carpentryPath('proyectos'))}>
                Ver todos
              </button>
              <CollapseToggle
                collapsed={!showProyectosPanel}
                onToggle={() => setShowProyectosPanel((v) => !v)}
                label="Proyectos activos"
              />
            </div>
          </div>

          {showProyectosPanel && (loading ? (
            <div className="skeleton-block" />
          ) : (
            <div
              className={`dashboard-carousel-shell dashboard-carousel-shell-project ${
                proyectosCanNavigate ? 'has-nav' : 'no-nav'
              }`}
            >
              {proyectosCanNavigate && (
                <div className="dashboard-carousel-nav dashboard-carousel-nav-prev">
                  <CarouselArrowButton
                    direction="prev"
                    onClick={() => desplazarProyectos(-1)}
                    ariaLabel="Mover proyectos a la izquierda"
                  />
                </div>
              )}
              <div
                className={`dashboard-carousel-track dashboard-carousel-track-project ${
                  proyectosCanNavigate ? '' : 'is-centered'
                }`}
                ref={proyectosCarouselRef}
                onMouseEnter={() => { pauseProyectoAutoplayRef.current = true; }}
                onMouseLeave={() => { pauseProyectoAutoplayRef.current = false; }}
                onFocusCapture={() => { pauseProyectoAutoplayRef.current = true; }}
                onBlurCapture={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget)) {
                    pauseProyectoAutoplayRef.current = false;
                  }
                }}
              >
                {proyectosDestacados.map((row, idx) => {
                  const avance = Number(row.pct_avance_granular ?? row.pct_avance ?? 0);
                  const avanceSafe = clampPercent(avance);

                  return (
                    <article key={`project-${row.proyecto_id}-${idx}`} className="project-spot-card">
                      <div className="project-spot-top">
                        <div>
                          <p className="project-spot-client">{row.cliente || 'Sin cliente'}</p>
                          <strong>{row.proyecto}</strong>
                        </div>
                        <StatusPill value={row.alerta} />
                      </div>

                      <div className="project-spot-metrics">
                        <div>
                          <span>Avance</span>
                          <strong>{formatNumero(avance, 1)}%</strong>
                        </div>
                        <div>
                          <span>Días</span>
                          <strong className={Number(row.dias_a_compromiso) < 0 ? 'error' : ''}>
                            {diasTexto(row.dias_a_compromiso)}
                          </strong>
                        </div>
                      </div>

                      <div className="project-spot-progress">
                        <div className="progress-label">
                          <span className="muted">Cumplimiento actual</span>
                          <strong className="font-mono">{formatNumero(avanceSafe, 1)}%</strong>
                        </div>
                        <div className="progress-track">
                          <div className="progress-fill bar-green" style={{ width: `${avanceSafe}%` }} />
                        </div>
                      </div>

                      <div className="project-spot-footer">
                        <span>
                          Compromiso: <strong>{formatFecha(row.fecha_compromiso) || 'Sin fecha'}</strong>
                        </span>
                        <span>
                          Responsable: <strong>{row.responsable || 'Sin asignar'}</strong>
                        </span>
                      </div>

                      <div className="project-spot-actions">
                        <button type="button" className="small" onClick={() => navigate(carpentryPath('proyectos'))}>
                          Abrir proyecto
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
              {proyectosCanNavigate && (
                <div className="dashboard-carousel-nav dashboard-carousel-nav-next">
                  <CarouselArrowButton
                    direction="next"
                    onClick={() => desplazarProyectos(1)}
                    ariaLabel="Mover proyectos a la derecha"
                  />
                </div>
              )}
            </div>
          ))}
          {showProyectosPanel && !loading && !proyectosDestacados.length && (
            <p>Sin proyectos para el filtro seleccionado.</p>
          )}
        </article>

        <article className={`panel panel-dashboard${showCargaPanel ? '' : ' panel-collapsed'}`}>
          <div className="panel-header">
            <div>
              <h3>Carga semanal</h3>
              <p className="panel-subtitle">Cards por recurso con área, proceso y ocupación planificada/real.</p>
            </div>
            <div className="row wrap">
              <span className="count-chip">{formatNumero(resumenOperativo.ocupacionPromedio, 1)}% promedio</span>
              <span className="count-chip count-chip-warn">
                {formatNumero(resumenOperativo.recursosSaturados, 0)} saturados
              </span>
              <CollapseToggle
                collapsed={!showCargaPanel}
                onToggle={() => setShowCargaPanel((v) => !v)}
                label="Carga semanal"
              />
            </div>
          </div>

          {showCargaPanel && (
            <div
              className={`dashboard-carousel-shell dashboard-carousel-shell-worker ${
                recursosCanNavigate ? 'has-nav' : 'no-nav'
              }`}
            >
              {recursosCanNavigate && (
                <div className="dashboard-carousel-nav dashboard-carousel-nav-prev">
                  <CarouselArrowButton
                    direction="prev"
                    onClick={() => desplazarRecursos(-1)}
                    ariaLabel="Mover recursos a la izquierda"
                  />
                </div>
              )}
              <div
                className={`dashboard-carousel-track dashboard-carousel-track-worker ${
                  recursosCanNavigate ? '' : 'is-centered'
                }`}
                ref={recursosCarouselRef}
              >
                {recursosDestacados.map((row, idx) => {
                  const pctPlan = Number(row.pct_ocupacion_planificada || 0);
                  const pctReal = Number(row.pct_ocupacion_real || 0);
                  const state = occupancyState(pctPlan);
                  const pctPlanSafe = clampPercent(pctPlan);
                  const areaLabel = tipoRecursoLabel(row.tipo_recurso);
                  const initials = initialLetters(row.recurso);
                  const isMachinery = String(row.tipo_recurso || '').toLowerCase().includes('maquina')
                    || String(row.tipo_recurso || '').toLowerCase().includes('máquina');

                  return (
                    <article
                      key={`worker-${row.tipo_recurso}-${row.recurso_id}-${idx}`}
                      className={`worker-spot-card ${isMachinery ? 'worker-spot-card-machinery' : ''}`}
                    >
                      <div className="worker-spot-head">
                        <span className="worker-spot-avatar">{initials}</span>
                        <div>
                          <strong>{row.recurso}</strong>
                          <p>{row.proceso || 'Sin proceso asignado'}</p>
                        </div>
                      </div>

                      <div className="worker-spot-tags">
                        <span className={`count-chip ${isMachinery ? 'count-chip-machinery' : ''}`}>{areaLabel}</span>
                        <span className={`count-chip ${pctPlan >= 85 ? 'count-chip-warn' : 'count-chip-ok'}`}>
                          {state.label}
                        </span>
                      </div>

                      <div className="worker-spot-metrics">
                        <div>
                          <span>Ocupación plan</span>
                          <strong>{formatNumero(pctPlan, 1)}%</strong>
                        </div>
                        <div>
                          <span>Ocupación real</span>
                          <strong>{formatNumero(pctReal, 1)}%</strong>
                        </div>
                        <div>
                          <span>Lotes en proceso</span>
                          <strong>{formatNumero(row.lotes_en_proceso || 0, 0)}</strong>
                        </div>
                        <div>
                          <span>Capacidad semanal</span>
                          <strong>{formatNumero(row.capacidad_semanal_horas || 0, 1)} h</strong>
                        </div>
                      </div>

                      <div className="worker-spot-progress">
                        <div className="progress-track">
                          <div className={`progress-fill ${state.cls}`} style={{ width: `${pctPlanSafe}%` }} />
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
              {recursosCanNavigate && (
                <div className="dashboard-carousel-nav dashboard-carousel-nav-next">
                  <CarouselArrowButton
                    direction="next"
                    onClick={() => desplazarRecursos(1)}
                    ariaLabel="Mover recursos a la derecha"
                  />
                </div>
              )}
            </div>
          )}
          {showCargaPanel && !recursosDestacados.length && <p>Sin datos esta semana.</p>}
        </article>
      </section>

      <section className="grid grid-2 wide-left">
        <article className={`panel panel-dashboard${showProduccionPanel ? '' : ' panel-collapsed'}`}>
          <div className="panel-header">
            <div>
              <h3>Producción semanal</h3>
              <p className="panel-subtitle">Últimas 4 semanas agrupadas por proceso para lectura rápida.</p>
            </div>
            <div className="row wrap">
              <span className="count-chip count-chip-ok">
                {formatNumero(resumenOperativo.produccionTotal, 0)} piezas
              </span>
              <CollapseToggle
                collapsed={!showProduccionPanel}
                onToggle={() => setShowProduccionPanel((v) => !v)}
                label="Producción semanal"
              />
            </div>
          </div>
          {showProduccionPanel && (
          <div className="stack-sm">
            {produccionAgrupada.map((row) => (
              <div key={row.semana} className="week-block">
                <strong>{formatFecha(row.semana)}</strong>
                {row.procesos.map((p) => (
                  <div key={`${row.semana}-${p.proceso}`} className="progress-row">
                    <span>{p.proceso}</span>
                    <div className="progress-track">
                      <div className="progress-fill bar-green" style={{ width: `${Math.min(p.piezas, 100)}%` }} />
                    </div>
                    <small className="font-mono">{formatNumero(p.piezas, 0)}</small>
                  </div>
                ))}
              </div>
            ))}
            {!produccionAgrupada.length && <p>No hay producción reportada.</p>}
          </div>
          )}
        </article>

        <article className={`panel panel-dashboard${showBloqueosPanel ? '' : ' panel-collapsed'}`}>
          <div className="panel-header">
            <div>
              <h3>Bloqueos y abastecimiento</h3>
              <p className="panel-subtitle">Lotes detenidos y faltantes de material con mayor impacto operativo.</p>
            </div>
            <CollapseToggle
              collapsed={!showBloqueosPanel}
              onToggle={() => setShowBloqueosPanel((v) => !v)}
              label="Bloqueos y abastecimiento"
            />
          </div>

          {showBloqueosPanel && (
          <div className="dashboard-issues-grid">
            <div className="dashboard-issue-group">
              <div className="dashboard-issue-group-head">
                <span className="count-chip count-chip-danger">
                  {formatNumero(data.lotesBloqueados.length, 0)} bloqueos
                </span>
              </div>

              {!data.lotesBloqueados.length ? (
                <p className="ok">Sin bloqueos activos.</p>
              ) : (
                <div className="stack-sm">
                  {data.lotesBloqueados.slice(0, 4).map((row) => (
                    <article key={row.lote_id} className="dashboard-issue-card">
                      <strong>{row.lote}</strong>
                      <span className="muted">{row.proyecto}</span>
                      <p>{row.proceso_actual || 'Sin proceso'} · {row.motivo_bloqueo}</p>
                    </article>
                  ))}
                </div>
              )}
            </div>

            <div className="dashboard-issue-group">
              <div className="dashboard-issue-group-head">
                <span className="count-chip count-chip-warn">
                  {formatNumero(data.alertasMateriales.length, 0)} alertas de materiales
                </span>
              </div>

              {!data.alertasMateriales.length ? (
                <p className="ok">Sin faltantes reportados.</p>
              ) : (
                <div className="stack-sm">
                  {data.alertasMateriales.slice(0, 4).map((row) => (
                    <article key={row.lote_id} className="dashboard-issue-card">
                      <strong>{row.lote}</strong>
                      <span className="muted">{row.proyecto}</span>
                      <p>
                        {(row.faltantes || [])
                          .slice(0, 2)
                          .map((faltante) => `${faltante.material} (${formatNumero(faltante.cantidad_pendiente, 0)} ${formatUnidadMedida(faltante.unidad_medida)})`)
                          .join(' · ')}
                      </p>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>
          )}
        </article>
      </section>
    </div>
  );
}
