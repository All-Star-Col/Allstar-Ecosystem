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

function buildUrl(path) {
  return `${API_BASE_URL}${CARPENTRY_API_PATH}${path}`;
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

async function invoke(action, payload = {}) {
  const response = await request('/invoke', {
    method: 'POST',
    body: JSON.stringify({ action, payload }),
  });
  return response?.data;
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
    procesos: () => invoke('catalogos.procesos'),
    etapas: () => invoke('catalogos.etapas'),
    areas: () => invoke('catalogos.areas'),
    guardarArea: (payload) => invoke('catalogos.areas.guardar', payload),
    eliminarArea: (payload) => invoke('catalogos.areas.eliminar', payload),
    personasActivas: () => invoke('catalogos.personasActivas'),
    maquinasActivas: () => invoke('catalogos.maquinasActivas'),
    proyectosActivos: () => invoke('catalogos.proyectosActivos'),
    lotesActivos: () => invoke('catalogos.lotesActivos'),
  },

  proyectos: {
    listar: (filters) => invoke('proyectos.listar', filters),
    guardar: (payload) => invoke('proyectos.guardar', payload),
    archivar: (payload) => invoke('proyectos.archivar', payload),
    detalle: (payload) => invoke('proyectos.detalle', payload),
    actualizarEtapa: (payload) => invoke('proyectos.etapa.actualizar', payload),
  },

  lotes: {
    listar: (filters) => invoke('lotes.listar', filters),
    guardar: (payload) => invoke('lotes.guardar', payload),
    detalle: (payload) => invoke('lotes.detalle', payload),
    actualizarProceso: (payload) => invoke('lotes.proceso.actualizar', payload),
    iniciarProceso: (payload) => invoke('lotes.proceso.iniciar', payload),
    avanzarProceso: (payload) => invoke('lotes.proceso.avanzar', payload),
    listarItems: (payload) => invoke('lotes.listarItems', payload),
  },

  items: {
    listarPorProyecto: (payload) => invoke('items.listarPorProyecto', payload),
    crear: (payload) => invoke('items.crear', payload),
    crearBulk: (payload) => invoke('items.crearBulk', payload),
    actualizar: (payload) => invoke('items.actualizar', payload),
    eliminar: (payload) => invoke('items.eliminar', payload),
    asignarLote: (payload) => invoke('items.asignarLote', payload),
    desasignarLote: (payload) => invoke('items.desasignarLote', payload),
    copiarBom: (payload) => invoke('items.copiarBom', payload),
  },

  bom: {
    listarPorItem: (payload) => invoke('bom.listarPorItem', payload),
    guardarMaterial: (payload) => invoke('bom.guardarMaterial', payload),
    eliminarMaterial: (payload) => invoke('bom.eliminarMaterial', payload),
  },

  materiales: {
    listar: (filters) => invoke('materiales.listar', filters),
    guardar: (payload) => invoke('materiales.guardar', payload),
    desactivar: (payload) => invoke('materiales.desactivar', payload),
  },

  inventario: {
    stock: (filters) => invoke('inventario.stock', filters),
    guardarMovimiento: (payload) => invoke('inventario.movimiento.guardar', payload),
    movimientos: (filters) => invoke('inventario.movimientos', filters),
    necesidades: (filters) => invoke('inventario.necesidades', filters),
  },

  produccion: {
    lotesDisponibles: () => invoke('produccion.lotesDisponibles'),
    registrar: (payload) => invoke('produccion.registrar', payload),
    historial: (filters) => invoke('produccion.historial', filters),
    resumenDia: (payload) => invoke('produccion.resumenDia', payload),
  },

  recursos: {
    listarPersonas: (filters) => invoke('recursos.personas.listar', filters),
    guardarPersona: (payload) => invoke('recursos.personas.guardar', payload),
    desactivarPersona: (payload) => invoke('recursos.personas.desactivar', payload),
    listarMaquinas: (filters) => invoke('recursos.maquinas.listar', filters),
    guardarMaquina: (payload) => invoke('recursos.maquinas.guardar', payload),
    desactivarMaquina: (payload) => invoke('recursos.maquinas.desactivar', payload),
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
};

export const archivosApi = {
  guardarCsv: async ({ filename, csvContent }) => {
    downloadCsv(filename, csvContent);
    return { ok: true };
  },
};
