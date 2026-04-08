import { API_SERVER } from "@/config/api";
import { getToken } from "@/core/auth/auth.service";

function normalizeBaseUrl(value) {
  return String(value || '')
    .trim()
    .replace('://0.0.0.0', '://127.0.0.1')
    .replace(/\/+$/, '');
}

const API_BASE_URL = normalizeBaseUrl(API_SERVER);
const CARPENTRY_API_PATH = '/workspace/carpentry';
const SHORT_CACHE_TTL_MS = 5000;
const VERY_SHORT_CACHE_TTL_MS = 2500;
const requestCache = new Map();
const inflightRequests = new Map();

function buildUrl(path) {
  return `${API_BASE_URL}${CARPENTRY_API_PATH}${path}`;
}

function stableStringify(value) {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  if (typeof value === 'object') {
    const entries = Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value);
}

function cacheKey(action, payload) {
  return `${action}|${stableStringify(payload || {})}`;
}

function readCache(key) {
  const entry = requestCache.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    requestCache.delete(key);
    return undefined;
  }
  return entry.data;
}

function writeCache(key, data, ttlMs) {
  if (!Number.isFinite(ttlMs) || ttlMs <= 0) return;
  requestCache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

function clearCarpentryCache() {
  requestCache.clear();
  inflightRequests.clear();
}

async function request(path, options = {}) {
  const token = getToken();
  const normalizedToken = token && token.startsWith('Bearer ') ? token : token ? `Bearer ${token}` : '';
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
    ...(normalizedToken ? { Authorization: normalizedToken } : {}),
  };

  const response = await fetch(buildUrl(path), {
    credentials: 'include',
    ...options,
    headers,
  });

  const contentType = response.headers.get('content-type') || '';
  const body = contentType.includes('application/json') ? await response.json() : await response.text();

  if (!response.ok) {
    const detail = body?.detail || {};
    const message = detail.message || body?.message || response.statusText || 'Error en solicitud HTTP';
    const error = new Error(message);
    error.code = detail.code || body?.code || `HTTP_${response.status}`;
    error.status = response.status;
    throw error;
  }

  return body;
}

async function invoke(action, payload = {}, options = {}) {
  const ttlMs = Number(options.ttlMs || 0);
  const useCache = ttlMs > 0;
  const key = cacheKey(action, payload);

  if (useCache) {
    const cached = readCache(key);
    if (cached !== undefined) return cached;
    const inflight = inflightRequests.get(key);
    if (inflight) return inflight;
  }

  const execution = request('/invoke', {
    method: 'POST',
    body: JSON.stringify({ action, payload }),
    signal: options.signal,
  }).then((response) => response?.data);

  if (useCache) inflightRequests.set(key, execution);

  try {
    const data = await execution;
    if (useCache) writeCache(key, data, ttlMs);
    return data;
  } finally {
    if (useCache) inflightRequests.delete(key);
  }
}

async function mutate(action, payload = {}, options = {}) {
  const data = await invoke(action, payload, options);
  clearCarpentryCache();
  return data;
}

function downloadCsv(filename, csvContent) {
  const blob = new Blob([csvContent || ''], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename || `reporte_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export const api = {
  ping: () => request('/ping'),

  dashboard: {
    obtener: (payload) => invoke('dashboard.obtener', payload),
  },

  catalogos: {
    procesos: () => invoke('catalogos.procesos', {}, { ttlMs: SHORT_CACHE_TTL_MS }),
    etapas: () => invoke('catalogos.etapas', {}, { ttlMs: SHORT_CACHE_TTL_MS }),
    areas: () => invoke('catalogos.areas', {}, { ttlMs: SHORT_CACHE_TTL_MS }),
    guardarArea: (payload) => mutate('catalogos.areas.guardar', payload),
    eliminarArea: (payload) => mutate('catalogos.areas.eliminar', payload),
    personasActivas: () => invoke('catalogos.personasActivas', {}, { ttlMs: SHORT_CACHE_TTL_MS }),
    maquinasActivas: () => invoke('catalogos.maquinasActivas', {}, { ttlMs: SHORT_CACHE_TTL_MS }),
    proyectosActivos: () => invoke('catalogos.proyectosActivos', {}, { ttlMs: SHORT_CACHE_TTL_MS }),
    lotesActivos: () => invoke('catalogos.lotesActivos', {}, { ttlMs: SHORT_CACHE_TTL_MS }),
  },

  proyectos: {
    listar: (filters) => invoke('proyectos.listar', filters),
    guardar: (payload) => mutate('proyectos.guardar', payload),
    archivar: (payload) => mutate('proyectos.archivar', payload),
    detalle: (payload) => invoke('proyectos.detalle', payload),
    actualizarEtapa: (payload) => mutate('proyectos.etapa.actualizar', payload),
  },

  lotes: {
    listar: (filters) => invoke('lotes.listar', filters),
    guardar: (payload) => mutate('lotes.guardar', payload),
    detalle: (payload) => invoke('lotes.detalle', payload),
    actualizarProceso: (payload) => mutate('lotes.proceso.actualizar', payload),
    iniciarProceso: (payload) => mutate('lotes.proceso.iniciar', payload),
    avanzarProceso: (payload) => mutate('lotes.proceso.avanzar', payload),
    listarItems: (payload) => invoke('lotes.listarItems', payload),
  },

  items: {
    listarPorProyecto: (payload) => invoke('items.listarPorProyecto', payload),
    crear: (payload) => mutate('items.crear', payload),
    crearBulk: (payload) => mutate('items.crearBulk', payload),
    actualizar: (payload) => mutate('items.actualizar', payload),
    eliminar: (payload) => mutate('items.eliminar', payload),
    asignarLote: (payload) => mutate('items.asignarLote', payload),
    desasignarLote: (payload) => mutate('items.desasignarLote', payload),
    copiarBom: (payload) => mutate('items.copiarBom', payload),
  },

  bom: {
    listarPorItem: (payload) => invoke('bom.listarPorItem', payload),
    guardarMaterial: (payload) => mutate('bom.guardarMaterial', payload),
    eliminarMaterial: (payload) => mutate('bom.eliminarMaterial', payload),
  },

  materiales: {
    listar: (filters) => invoke('materiales.listar', filters, { ttlMs: VERY_SHORT_CACHE_TTL_MS }),
    guardar: (payload) => mutate('materiales.guardar', payload),
    desactivar: (payload) => mutate('materiales.desactivar', payload),
  },

  inventario: {
    stock: (filters) => invoke('inventario.stock', filters),
    guardarMovimiento: (payload) => mutate('inventario.movimiento.guardar', payload),
    movimientos: (filters) => invoke('inventario.movimientos', filters),
    necesidades: (filters) => invoke('inventario.necesidades', filters),
  },

  produccion: {
    lotesDisponibles: () => invoke('produccion.lotesDisponibles', {}, { ttlMs: VERY_SHORT_CACHE_TTL_MS }),
    registrar: (payload) => mutate('produccion.registrar', payload),
    historial: (filters) => invoke('produccion.historial', filters),
    resumenDia: (payload) => invoke('produccion.resumenDia', payload),
  },

  recursos: {
    listarPersonas: (filters) => invoke('recursos.personas.listar', filters),
    guardarPersona: (payload) => mutate('recursos.personas.guardar', payload),
    desactivarPersona: (payload) => mutate('recursos.personas.desactivar', payload),
    listarMaquinas: (filters) => invoke('recursos.maquinas.listar', filters),
    guardarMaquina: (payload) => mutate('recursos.maquinas.guardar', payload),
    desactivarMaquina: (payload) => mutate('recursos.maquinas.desactivar', payload),
    cargaSemanal: (filters) => invoke('recursos.cargaSemanal', filters),
  },

  reportes: {
    productividad: (filters) => invoke('reportes.productividad', filters),
    cumplimiento: (filters) => invoke('reportes.cumplimiento', filters),
    consumo: (filters) => invoke('reportes.consumo', filters),
    bloqueos: (filters) => invoke('reportes.bloqueos', filters),
    avance: (filters) => invoke('reportes.avance', filters),
    exportarCsv: (payload) => invoke('reportes.exportarCsv', payload),
  },

  cache: {
    clear: clearCarpentryCache,
  },
};

export const archivosApi = {
  guardarCsv: async ({ filename, csvContent }) => {
    downloadCsv(filename, csvContent);
    return { ok: true };
  },
};
