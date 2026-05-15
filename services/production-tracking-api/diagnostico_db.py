import os
import json
from pathlib import Path
from datetime import datetime
from urllib.parse import urlparse

import psycopg2
import psycopg2.extras


ENV_PATH = r"C:\Users\starb\OneDrive\Automatizacion all star\Carpinteria\seguimiento produccion\produccion_api\.env"
OUTPUT_FOLDER = r"C:\Users\starb\OneDrive\Automatizacion all star\Carpinteria\seguimiento produccion\produccion_api\diagnosticos_db"


def cargar_env_manual(env_path: str) -> dict:
    """
    Lee un archivo .env sin depender de python-dotenv.
    Soporta líneas tipo:
    DB_HOST=...
    DB_NAME=...
    DATABASE_URL=...
    """
    env_file = Path(env_path)

    if not env_file.exists():
        raise FileNotFoundError(f"No existe el archivo .env en: {env_path}")

    variables = {}

    with env_file.open("r", encoding="utf-8") as file:
        for line in file:
            line = line.strip()

            if not line or line.startswith("#"):
                continue

            if "=" not in line:
                continue

            key, value = line.split("=", 1)

            key = key.strip()
            value = value.strip().strip('"').strip("'")

            variables[key] = value
            os.environ[key] = value

    return variables


def construir_conexion(env: dict) -> dict:
    """
    Soporta dos formas:
    1. DATABASE_URL=postgresql://usuario:password@host:puerto/db
    2. DB_HOST, DB_NAME, DB_USER, DB_PASSWORD, DB_PORT
    """
    database_url = env.get("DATABASE_URL") or env.get("database_url")

    if database_url:
        parsed = urlparse(database_url)

        return {
            "host": parsed.hostname,
            "port": parsed.port or 5432,
            "dbname": parsed.path.lstrip("/"),
            "user": parsed.username,
            "password": parsed.password,
        }

    required = ["DB_HOST", "DB_NAME", "DB_USER", "DB_PASSWORD"]
    faltantes = [key for key in required if not env.get(key)]

    if faltantes:
        raise RuntimeError(
            "Faltan variables en .env: "
            + ", ".join(faltantes)
            + ". Deben existir DB_HOST, DB_NAME, DB_USER y DB_PASSWORD, "
            + "o alternativamente DATABASE_URL."
        )

    return {
        "host": env.get("DB_HOST"),
        "port": int(env.get("DB_PORT", 5432)),
        "dbname": env.get("DB_NAME"),
        "user": env.get("DB_USER"),
        "password": env.get("DB_PASSWORD"),
    }


def conectar_db(config: dict):
    return psycopg2.connect(
        host=config["host"],
        port=config["port"],
        dbname=config["dbname"],
        user=config["user"],
        password=config["password"],
    )


def obtener_schema(env: dict) -> str:
    return (
        env.get("DB_SCHEMA")
        or env.get("POSTGRES_SCHEMA")
        or env.get("SCHEMA")
        or "carpentry"
    )


def obtener_tablas_y_columnas(conn, schema: str) -> list:
    query = """
        SELECT
            c.table_schema,
            c.table_name,
            c.ordinal_position,
            c.column_name,
            c.data_type,
            c.udt_name,
            c.character_maximum_length,
            c.numeric_precision,
            c.numeric_scale,
            c.is_nullable,
            c.column_default
        FROM information_schema.columns c
        INNER JOIN information_schema.tables t
            ON t.table_schema = c.table_schema
           AND t.table_name = c.table_name
        WHERE c.table_schema = %s
          AND t.table_type = 'BASE TABLE'
        ORDER BY
            c.table_name,
            c.ordinal_position;
    """

    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(query, (schema,))
        return list(cur.fetchall())


def obtener_conteo_filas(conn, schema: str, table_name: str) -> int | None:
    """
    Hace COUNT(*) real. Si alguna tabla falla, devuelve None.
    """
    try:
        with conn.cursor() as cur:
            cur.execute(f'SELECT COUNT(*) FROM "{schema}"."{table_name}"')
            return cur.fetchone()[0]
    except Exception:
        conn.rollback()
        return None


def obtener_resumen_tablas(conn, schema: str) -> list:
    query = """
        SELECT
            table_schema,
            table_name
        FROM information_schema.tables
        WHERE table_schema = %s
          AND table_type = 'BASE TABLE'
        ORDER BY table_name;
    """

    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(query, (schema,))
        tablas = list(cur.fetchall())

    resumen = []

    for tabla in tablas:
        table_name = tabla["table_name"]
        total_filas = obtener_conteo_filas(conn, schema, table_name)

        resumen.append(
            {
                "schema": schema,
                "table_name": table_name,
                "row_count": total_filas,
            }
        )

    return resumen


def agrupar_por_tabla(columnas: list, resumen_tablas: list) -> dict:
    row_counts = {
        item["table_name"]: item["row_count"]
        for item in resumen_tablas
    }

    resultado = {}

    for col in columnas:
        table_name = col["table_name"]

        if table_name not in resultado:
            resultado[table_name] = {
                "schema": col["table_schema"],
                "table_name": table_name,
                "row_count": row_counts.get(table_name),
                "columns": [],
            }

        resultado[table_name]["columns"].append(
            {
                "position": col["ordinal_position"],
                "name": col["column_name"],
                "data_type": col["data_type"],
                "udt_name": col["udt_name"],
                "max_length": col["character_maximum_length"],
                "numeric_precision": col["numeric_precision"],
                "numeric_scale": col["numeric_scale"],
                "nullable": col["is_nullable"],
                "default": col["column_default"],
            }
        )

    return resultado


def guardar_resultados(resultado: dict, resumen_tablas: list, output_folder: str):
    output_path = Path(output_folder)
    output_path.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    json_path = output_path / f"estructura_db_{timestamp}.json"
    txt_path = output_path / f"estructura_db_{timestamp}.txt"

    with json_path.open("w", encoding="utf-8") as file:
        json.dump(resultado, file, indent=4, ensure_ascii=False, default=str)

    with txt_path.open("w", encoding="utf-8") as file:
        file.write("DIAGNÓSTICO DE ESTRUCTURA DE BASE DE DATOS\n")
        file.write("=" * 70 + "\n\n")

        for tabla in resumen_tablas:
            table_name = tabla["table_name"]
            table_data = resultado.get(table_name, {})

            file.write(f"TABLA: {table_name}\n")
            file.write(f"FILAS: {tabla['row_count']}\n")
            file.write("-" * 70 + "\n")

            for col in table_data.get("columns", []):
                file.write(
                    f"{col['position']:>3}. "
                    f"{col['name']} | "
                    f"{col['data_type']} | "
                    f"nullable={col['nullable']} | "
                    f"default={col['default']}\n"
                )

            file.write("\n")

    return json_path, txt_path


def imprimir_resumen(resultado: dict):
    print("\n========== RESUMEN DE TABLAS Y COLUMNAS ==========\n")

    for table_name, table_data in resultado.items():
        print(f"TABLA: {table_name}")
        print(f"FILAS: {table_data.get('row_count')}")
        print("COLUMNAS:")

        for col in table_data.get("columns", []):
            print(
                f"  - {col['name']} "
                f"({col['data_type']}) "
                f"nullable={col['nullable']}"
            )

        print("-" * 60)


def main():
    print("Leyendo .env...")
    env = cargar_env_manual(ENV_PATH)

    schema = obtener_schema(env)
    print(f"Schema detectado: {schema}")

    print("Construyendo conexión...")
    config = construir_conexion(env)

    print(
        f"Conectando a PostgreSQL: "
        f"host={config['host']} port={config['port']} db={config['dbname']} user={config['user']}"
    )

    conn = conectar_db(config)

    try:
        print("Consultando tablas...")
        resumen_tablas = obtener_resumen_tablas(conn, schema)

        print("Consultando columnas...")
        columnas = obtener_tablas_y_columnas(conn, schema)

        resultado = agrupar_por_tabla(columnas, resumen_tablas)

        imprimir_resumen(resultado)

        json_path, txt_path = guardar_resultados(
            resultado=resultado,
            resumen_tablas=resumen_tablas,
            output_folder=OUTPUT_FOLDER,
        )

        print("\n========== ARCHIVOS GENERADOS ==========")
        print(f"JSON: {json_path}")
        print(f"TXT : {txt_path}")

    finally:
        conn.close()
        print("\nConexión cerrada.")


if __name__ == "__main__":
    main()