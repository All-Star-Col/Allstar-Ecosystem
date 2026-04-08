export function dbLabel(fieldName) {
  if (!fieldName) return '';
  const cleaned = String(fieldName).trim().replace(/_id$/i, '');
  return cleaned
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

