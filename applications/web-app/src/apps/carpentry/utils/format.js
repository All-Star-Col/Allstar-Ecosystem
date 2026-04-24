export function formatFecha(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

export function formatNumero(value, decimals = 1) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '-';
  return new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(Number(value));
}

export function formatUnidadMedida(value) {
  const unidad = String(value ?? '').trim();
  if (!unidad) return unidad;
  if (/^m2$/i.test(unidad)) return 'm²';
  return unidad;
}

export function semaforoClass(alerta) {
  if (!alerta) return 'pill-gray';
  const normalized = String(alerta).toLowerCase();
  if (
    normalized.includes('al_dia')
    || normalized.includes('verde')
    || normalized.includes('finalizado')
    || normalized.includes('completado')
    || normalized.includes('empacado')
  ) {
    return 'pill-green';
  }
  if (normalized.includes('riesgo') || normalized.includes('amarillo')) return 'pill-yellow';
  if (
    normalized.includes('retrasado')
    || normalized.includes('rojo')
    || normalized.includes('bloqueado')
  ) {
    return 'pill-red';
  }
  return 'pill-gray';
}

export function prioridadTexto(prioridad) {
  if (Number(prioridad) === 1) return 'Alta';
  if (Number(prioridad) === 2) return 'Media';
  if (Number(prioridad) === 3) return 'Baja';
  return '-';
}
