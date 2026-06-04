-- Script seguro para convertir data.item.id_orden_compra a BIGINT
-- IMPORTANTE: hacer backup antes de ejecutar.
-- 1) Revisar primero el tipo actual y constraints (ejecutar los SELECTs más abajo).
-- 2) Si no hay FKs que impidan el cambio, ejecutar el ALTER TABLE dentro de una transacción.

/*
-- Ver columnas de la tabla item
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'data' AND table_name = 'item'
ORDER BY ordinal_position;

-- Buscar constraints FK que involucren id_orden_compra
SELECT
  tc.constraint_name,
  tc.table_schema,
  tc.table_name,
  kcu.column_name,
  ccu.table_schema AS foreign_table_schema,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND (kcu.column_name = 'id_orden_compra' OR ccu.column_name = 'id_orden_compra');
*/

-- Cambio mínimo a BIGINT
BEGIN;
ALTER TABLE data.item
  ALTER COLUMN id_orden_compra TYPE bigint
  USING id_orden_compra::bigint;
COMMIT;

-- Si existen FKs referenciando/siendo referenciadas por esta columna, puede ser necesario
-- alterar también las columnas en las tablas relacionadas o dropear/recrear las constraints.
-- Recomendación: ejecutar primero los SELECTS anteriores, revisar constraints, y si todo está ok,
-- ejecutar el bloque ALTER TABLE.

-- Alternativa si prefieres almacenar códigos no-numéricos: convertir a TEXT en vez de BIGINT:
-- ALTER TABLE data.item ALTER COLUMN id_orden_compra TYPE text USING id_orden_compra::text;

-- FIN
