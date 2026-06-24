-- Diagnostico no destructivo para validar la estructura normalizada del esquema data.
-- Ejecutar sobre la base de desarrollo antes de adaptar backend/frontend.

-- 1. Tablas del esquema data
SELECT
    table_schema,
    table_name,
    table_type
FROM information_schema.tables
WHERE table_schema = 'data'
ORDER BY table_name;

-- 2. Columnas reales de tablas principales
SELECT
    c.table_name,
    c.ordinal_position,
    c.column_name,
    c.data_type,
    c.udt_name,
    c.is_nullable,
    c.column_default,
    c.character_maximum_length,
    c.numeric_precision,
    c.numeric_scale
FROM information_schema.columns c
WHERE c.table_schema = 'data'
  AND c.table_name IN (
      'base',
      'modelo',
      'referencia',
      'tela',
      'producto',
      'cliente',
      'ordencompra',
      'item',
      'unidades',
      'area',
      'proceso',
      'ordenproceso',
      'consumomaterial'
  )
ORDER BY c.table_name, c.ordinal_position;

-- 3. Llaves foraneas y restricciones
SELECT
    con.conname AS constraint_name,
    src_ns.nspname AS source_schema,
    src.relname AS source_table,
    pg_get_constraintdef(con.oid) AS definition
FROM pg_constraint con
JOIN pg_class src ON src.oid = con.conrelid
JOIN pg_namespace src_ns ON src_ns.oid = src.relnamespace
WHERE src_ns.nspname = 'data'
  AND src.relname IN (
      'base',
      'modelo',
      'referencia',
      'tela',
      'producto',
      'cliente',
      'ordencompra',
      'item',
      'unidades',
      'area',
      'proceso',
      'ordenproceso',
      'consumomaterial'
  )
ORDER BY src.relname, con.contype, con.conname;

-- 4. Indices existentes
SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'data'
  AND tablename IN (
      'base',
      'modelo',
      'referencia',
      'tela',
      'producto',
      'cliente',
      'ordencompra',
      'item',
      'unidades',
      'area',
      'proceso',
      'ordenproceso',
      'consumomaterial'
  )
ORDER BY tablename, indexname;

-- 5. Columnas obsoletas que no deberian usarse
SELECT
    table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_schema = 'data'
  AND column_name IN ('oc_interno', 'sku_cliente', 'sku', 'notas')
ORDER BY table_name, column_name;

-- 6. Productos duplicados por configuracion normalizada
SELECT
    id_base,
    id_modelo,
    id_referencia_1,
    id_referencia_2,
    id_referencia_3,
    id_tela,
    COUNT(*) AS total,
    ARRAY_AGG(id ORDER BY id) AS producto_ids
FROM data.producto
GROUP BY
    id_base,
    id_modelo,
    id_referencia_1,
    id_referencia_2,
    id_referencia_3,
    id_tela
HAVING COUNT(*) > 1
ORDER BY total DESC;

-- 7. Productos sin tela
SELECT
    id,
    nombre,
    id_base,
    id_modelo,
    id_referencia_1,
    id_referencia_2,
    id_referencia_3,
    id_tela
FROM data.producto
WHERE id_tela IS NULL
ORDER BY id;

-- 8. Productos cuyo nombre no parece incluir la tela
SELECT
    p.id,
    p.nombre AS producto_nombre,
    t.nombre AS tela_nombre,
    t.referencia AS tela_referencia
FROM data.producto p
JOIN data.tela t ON t.id = p.id_tela
WHERE p.nombre IS NULL
   OR UPPER(p.nombre) NOT LIKE '%' || UPPER(t.nombre) || '%'
   OR (
       t.referencia IS NOT NULL
       AND BTRIM(t.referencia) <> ''
       AND UPPER(p.nombre) NOT LIKE '%' || UPPER(t.referencia) || '%'
   )
ORDER BY p.id;

-- 9. Ordenes con oc_cliente nula o vacia
SELECT
    id,
    id_cliente,
    id_producto,
    oc_cliente,
    cantidad,
    estado,
    fecha_pedido
FROM data.ordencompra
WHERE oc_cliente IS NULL
   OR BTRIM(oc_cliente::text) = ''
ORDER BY id;

-- 10. Ordenes con estado fuera de los permitidos
SELECT
    id,
    estado,
    id_cliente,
    id_producto,
    oc_cliente,
    fecha_pedido
FROM data.ordencompra
WHERE estado IS NULL
   OR LOWER(BTRIM(estado::text)) NOT IN (
       'pendiente',
       'en proceso',
       'finalizado',
       'retrasado'
   )
ORDER BY id;

-- 11. Items sin cliente
SELECT
    id,
    item_legado,
    id_orden_compra,
    id_cliente,
    fecha_produccion,
    fecha_entrega
FROM data.item
WHERE id_cliente IS NULL
ORDER BY id;

-- 12. Items donde item.id_cliente no coincide con ordencompra.id_cliente
SELECT
    i.id,
    i.item_legado,
    i.id_orden_compra,
    i.id_cliente AS item_id_cliente,
    oc.id_cliente AS orden_id_cliente
FROM data.item i
JOIN data.ordencompra oc ON oc.id = i.id_orden_compra
WHERE i.id_cliente IS DISTINCT FROM oc.id_cliente
ORDER BY i.id;

-- 13. Items sin fechas productivas
SELECT
    id,
    item_legado,
    id_orden_compra,
    id_cliente,
    fecha_produccion,
    fecha_entrega
FROM data.item
WHERE fecha_produccion IS NULL
   OR fecha_entrega IS NULL
ORDER BY id;

-- 14. Items con fecha_produccion diferente a ordencompra.fecha_pedido
SELECT
    i.id,
    i.item_legado,
    i.fecha_produccion,
    oc.fecha_pedido
FROM data.item i
JOIN data.ordencompra oc ON oc.id = i.id_orden_compra
WHERE i.fecha_produccion IS DISTINCT FROM oc.fecha_pedido
ORDER BY i.id;

-- 15. Items con fecha_entrega diferente a fecha_produccion + 15 dias
SELECT
    id,
    item_legado,
    fecha_produccion,
    fecha_entrega,
    fecha_produccion + INTERVAL '15 days' AS fecha_entrega_esperada
FROM data.item
WHERE fecha_produccion IS NOT NULL
  AND fecha_entrega IS DISTINCT FROM (fecha_produccion + INTERVAL '15 days')::date
ORDER BY id;

-- 16. Items duplicados por item_legado
SELECT
    item_legado,
    COUNT(*) AS total,
    ARRAY_AGG(id ORDER BY id) AS item_ids
FROM data.item
WHERE item_legado IS NOT NULL
GROUP BY item_legado
HAVING COUNT(*) > 1
ORDER BY total DESC, item_legado;

-- 17. Procesos y areas actuales
SELECT
    p.id AS proceso_id,
    p.nombre AS proceso_nombre,
    a.id AS area_id,
    a.nombre AS area_nombre
FROM data.proceso p
LEFT JOIN data.area a ON a.id = p.id_area
ORDER BY p.id;

-- 18. Validacion esperada de procesos 1..5
WITH expected(id, proceso_nombre, area_nombre) AS (
    VALUES
        (1, 'CORTE MADERA', 'MADERA'),
        (2, 'CORTE TELA', 'TELA'),
        (3, 'COSTURA', 'TELA'),
        (4, 'TAPICERIA', 'ARMADO'),
        (5, 'ALISTAMIENTO', 'DESPACHO')
)
SELECT
    e.id,
    e.proceso_nombre AS esperado_proceso,
    p.nombre AS actual_proceso,
    e.area_nombre AS esperado_area,
    a.nombre AS actual_area,
    CASE
        WHEN p.id IS NULL THEN 'FALTA_PROCESO'
        WHEN UPPER(p.nombre) <> e.proceso_nombre THEN 'NOMBRE_PROCESO_DIFERENTE'
        WHEN UPPER(a.nombre) <> e.area_nombre THEN 'AREA_DIFERENTE'
        ELSE 'OK'
    END AS validacion
FROM expected e
LEFT JOIN data.proceso p ON p.id = e.id
LEFT JOIN data.area a ON a.id = p.id_area
ORDER BY e.id;
