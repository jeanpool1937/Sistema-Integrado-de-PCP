# 📊 Sincronización SAP → Supabase

Guía de referencia para el flujo de datos automatizado entre archivos Excel (SAP) y la base de datos Supabase.

**Proyecto Supabase:** `nvrcsheavwwrcukhtvcw` — [Dashboard](https://supabase.com/dashboard/project/nvrcsheavwwrcukhtvcw)  
**Directorio de Scripts:** `D:\Base de datos\`

---

## 🗂️ Mapa de Tablas y Fuentes de Datos

### Sincronización Diaria (`daily_sync.py`)

| Tabla Supabase | Archivo Excel | Hoja | Estrategia |
|---|---|---|---|
| `sap_consumo_movimientos` | `.../Movimientos/ConsumoMes.xlsx` | (auto) | Deduplicación |
| `sap_produccion` | `.../Produccion/ProduccionMes.xlsx` | (auto) | Deduplicación |
| `sap_stock_mb52` | `.../COBERTURAS/MB52.XLSX` | Sheet1 | **Truncate + Replace** |
| `sap_programa_produccion` | `.../COBERTURAS/Planes 2025.xlsm` | BASE DATOS | **Truncate + Replace** |

### Sincronización Mensual (`monthly_sync.py`)

| Tabla Supabase | Archivo Excel | Hoja | Estrategia |
|---|---|---|---|
| `sap_consumo_movimientos` | `.../Movimientos/Consumo 2020-2025.xlsx` | (auto) | Deduplicación |
| `sap_produccion` | `.../Produccion/Reporte de Prod. 2020-2025.xlsx` | (auto) | Deduplicación |
| `sap_maestro_articulos` | `.../COBERTURAS/Maestro de Articulos.xlsx` | Articulos | Upsert (PK: `codigo`) |
| `sap_clase_proceso` | `.../COBERTURAS/Maestro de Articulos.xlsx` | Procesos | Upsert (PK: `clase_proceso`) |
| `sap_centro_pais` | `.../COBERTURAS/Maestro de Articulos.xlsx` | Centro | Upsert (PK: `centro_id`) |
| `sap_almacenes_comerciales` | `.../COBERTURAS/Maestro de Articulos.xlsx` | Centro | Upsert (PK: `centro`, `id`) |

### Sincronización de Demanda (`monthly_sync_demanda.py`)

| Tabla Supabase | Archivo Excel | Hoja | Estrategia |
|---|---|---|---|
| `sap_demanda_proyectada` | `.../PO Histórico.xlsx` | (auto) | **Truncate + Replace** |

---

## 🗃️ Inventario Detallado de Tablas (Supabase)

| Tabla | Descripción | Origen / Proceso | Registros |
|---|---|---|---|
| `sap_maestro_articulos` | Maestro central de materiales y parámetros. | `monthly_sync.py` | 5,644 |
| `sap_consumo_sku_mensual` | Resumen mensual agregado por SKU. | Motor de Inventario | 34,793 |
| `sap_plan_inventario_hibrido` | Resultados de planificación (SS, ROP, ABC). | `inventory_engine.py` | 5,644 |
| `sap_stock_mb52` | Stock actual por material/centro/almacén. | `daily_sync.py` | 10,446 |
| `sap_consumo_diario_resumen` | Resumen diario agregado por SKU. | Motor de Inventario | 45,925 |
| `sap_demanda_proyectada` | Demanda comercial proyectada (PO). | `monthly_sync_demanda.py` | 3,674 |
| `sap_sku_procesos` | Relación SKU <-> Proceso productivo. | Interno / Vistas | 3,861 |
| `sap_programa_produccion` | Plan de producción (Órdenes de proceso). | `daily_sync.py` | 2,335 |
| `sap_produccion` | Histórico de producción detallado. | `daily/monthly_sync` | ~254k |
| `sap_consumo_movimientos` | Histórico de consumos detallado. | `daily/monthly_sync` | Variable |
| `sap_config_reglas_stock` | Configuración de almacenes permitidos. | Frontend / Manual | - |
| `sap_clase_proceso` | Catálogo de procesos y áreas. | `monthly_sync.py` | 108 |
| `sap_almacenes_comerciales` | Filtro de almacenes para disponibilidad. | `monthly_sync.py` | 177 |
| `sap_centro_pais` | Catálogo de centros y países. | `monthly_sync.py` | 48 |

> **Nota:** Las rutas base de los archivos Excel se encuentran en:  
> `D:\OneDrive - CORPORACIÓN ACEROS AREQUIPA SA\PCP - General\2. CONTROL\`

---

## ⏰ Tareas Programadas de Windows

| Nombre | Frecuencia | Hora | Script |
|---|---|---|---|
| `Supabase_Daily_Sync` | Diaria | 06:00 AM | `run_daily.bat` |
| `Supabase_Monthly_Sync` | Mensual (día 1) | 07:00 AM | `run_monthly.bat` |
| `Supabase_Demanda_Sync` | Mensual (variable)| - | `run_monthly_demanda.bat` |

---

## 📁 Estructura del Proyecto

- `sync_utils.py`: Núcleo de funciones de limpieza y carga.
- `daily_sync.py`: Orquestador de sincronización diaria.
- `monthly_sync.py`: Orquestador de datos maestros y mensuales.
- `monthly_sync_demanda.py`: Sincronización específica de la demanda comercial.
- `inventory_engine.py`: Motor de cálculo para parámetros DDMRP y ABC/XYZ.
- `sync_log.txt`: Historial de ejecuciones y errores.

---

## 🔧 Estrategias de Carga

1. **Deduplicación**: Sube solo registros nuevos comparando una firma única (Hash).
2. **Upsert**: Inserta nuevos o actualiza existentes basados en la Llave Primaria (PK).
3. **Truncate + Replace**: Limpia la tabla por completo y carga todo el contenido del Excel.
