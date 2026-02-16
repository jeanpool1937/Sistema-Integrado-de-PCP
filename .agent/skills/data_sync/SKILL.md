---
name: Data Sync Pilot
description: Especialización en procesos ETL (Extract, Transform, Load) usando Python para sincronizar datos de SAP/Excel con Supabase de forma robusta e idempotente.
---

# Data Sync Pilot Skill

Esta habilidad asegura que todos los procesos de movimiento de datos en el backend sean resilientes, trazables y libres de duplicados.

## Principios de Sincronización Robustos

### 1. Idempotencia con Signatures
Para evitar duplicados en cada carga:
- Generar una "Firma" (Signature) única para cada fila: `hash(sku_id + fecha + cantidad)`.
- Usar `ON CONFLICT (signature) DO UPDATE` o `UPSERT` en Supabase.

### 2. Validación de Esquema Pre-Carga
Antes de insertar en la base de datos:
- Verificar que las columnas requeridas existen en el Excel.
- Validar tipos de datos (p.ej. que la columna "Cantidad" sea numérica).
- Normalización de IDs: Asegurar que los SKUs tengan el formato correcto (ej: quitar ceros a la izquierda si es necesario).

### 3. Gestión de Errores y Logging
- No detener el proceso por un solo registro fallido (Try-Except por fila).
- Guardar un reporte de "Registros Ignorados" o "Registros con Error".
- Registrar el tiempo de ejecución y la cantidad de registros nuevos vs actualizados.

## Estándares del Proyecto (`/backend`)

- **Utilidades**: Usar funciones de `sync_utils.py` para operaciones comunes.
- **Entorno**: Cargar variables desde `.env` (nunca hardcodear credenciales).
- **Batching**: Para cargas grandes (>1000 filas), usar inserts por lotes para no saturar la conexión.

## Ejemplo de Lógica de Sincronización

```python
def sync_data(df, table_name):
    # 1. Normalizar
    df['sku_id'] = df['sku_id'].astype(str).str.strip()
    
    # 2. Generar Signatures
    df['signature'] = df.apply(lambda r: generate_sig(r), axis=1)
    
    # 3. UPSERT batch
    records = df.to_dict('records')
    supabase.table(table_name).upsert(records).execute()
```

> [!CAUTION]
> Siempre verificar la zona horaria (`TIMESTAMPTZ`) al sincronizar fechas de producción o ventas para evitar desfases de un día.
