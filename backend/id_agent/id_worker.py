import os
import time
import schedule
from datetime import datetime

# Configuración de Rutas
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
MASTER_PROMPT_PATH = os.path.join(os.path.dirname(__file__), "master_prompt.txt")
OUTPUT_FILE = os.path.join(BASE_DIR, "INSIGHTS_ID.md")

def leer_contexto():
    """
    Escanea recursivamente los archivos del proyecto para generar un contexto técnico profundo.
    Prioriza archivos fuente (.py, .ts, .tsx, .md) e ignora directorios irrelevantes.
    """
    contexto = ""
    extensiones_validas = {'.py', '.ts', '.tsx', '.md', '.json', '.sql'}
    directorios_ignorados = {'node_modules', '__pycache__', '.git', '.agent', 'dist', 'build'}
    
    # 1. Leer la "Misión" del proyecto desde GEMINI.md
    gemini_path = os.path.join(BASE_DIR, "GEMINI.md")
    if os.path.exists(gemini_path):
        with open(gemini_path, 'r', encoding='utf-8') as f:
            contexto += f"\n=== MISION Y REGLAS DEL PROYECTO (GEMINI.md) ===\n{f.read()}\n==============================================\n"

    # 2. Escaneo Recursivo
    print(f"[{datetime.now()}] Iniciando escaneo profundo de: {BASE_DIR}")
    files_scanned = 0
    
    for root, dirs, files in os.walk(BASE_DIR):
        # Filtrar directorios ignorados
        dirs[:] = [d for d in dirs if d not in directorios_ignorados]
        
        for file in files:
            ext = os.path.splitext(file)[1].lower()
            if ext in extensiones_validas:
                # Ignorar archivos muy grandes o generados automáticamente (paquete-lock, etc)
                if file == 'package-lock.json' or file.endswith('.min.js'):
                    continue
                    
                full_path = os.path.join(root, file)
                rel_path = os.path.relpath(full_path, BASE_DIR)
                
                try:
                    with open(full_path, 'r', encoding='utf-8') as f:
                        # Leer solo los primeros 1500 caracteres para mantener el contexto manejable
                        # En una implementación real con ventana de contexto grande (Gemini 1.5 Pro) leeríamos más
                        contenido = f.read(1500)
                        if len(contenido) >= 1500:
                            contenido += "\n... [TRUNCADO POR LIMITE DE CONTEXTO] ..."
                            
                        contexto += f"\n--- ARCHIVO: {rel_path} ---\n{contenido}\n"
                        files_scanned += 1
                except Exception as e:
                    print(f"Error leyendo {rel_path}: {e}")
                    
    print(f"[{datetime.now()}] Escaneo completado. Archivos analizados: {files_scanned}")
    return contexto

def ejecutar_agente_id():
    print(f"[{datetime.now()}] Iniciando ciclo de Investigación y Desarrollo...")
    
    try:
        # 1. Leer Master Prompt
        with open(MASTER_PROMPT_PATH, 'r', encoding='utf-8') as f:
            master_prompt = f.read()
            
        # 2. Obtener Contexto del Proyecto
        contexto_proyecto = leer_contexto()
        
        # 3. Simulación de Llamada a LLM (Template para integración real)
        # Nota: Aquí se integraría la API Key y la llamada a Gemini/OpenAI
        prompt_final = f"{master_prompt}\n\nCONTEXTO ACTUAL DEL PROYECTO:\n{contexto_proyecto}"
        
        # Generar salida (Por ahora un placeholder estructurado)
        fecha_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        reporte = f"""# INSIGHTS I+D ANTIGRAVITY - {fecha_str}

## 1. Estado del Arte
La industria de PCP está migrando hacia modelos predictivos basados en Graph Neural Networks para la optimización de inventarios multieslabón.

## 2. Análisis de Brecha (Gap Analysis)
- El sistema actual usa reglas deterministas (DDMRP). Falta una capa de predicción de demanda estocástica.
- La interfaz de usuario es funcional pero podría beneficiarse de un asistente de voz para operarios en planta.

## 3. Hoja de Ruta de Mejoras
1. [PROXIMAMENTE] Integrar módulo de Machine Learning para predicción de ADU.
2. [UI] Implementar visualización 3D del almacén.

## 4. Propuesta de Script
```python
# Sugerencia de mejora en procesamiento paralelo para sync_utils.py
import concurrent.futures
# ... (Código optimizado)
```

> [!NOTE]
> Este reporte fue generado automáticamente por el Agente I+D Antigravity.
"""
        
        with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
            f.write(reporte)
            
        print(f"[{datetime.now()}] Sugerencias de mejora generadas exitosamente en {OUTPUT_FILE}")
        
    except Exception as e:
        print(f"Error en el Agente I+D: {e}")

if __name__ == "__main__":
    # Ejecución inmediata para prueba inicial
    ejecutar_agente_id()
    
    # Configurar para que se ejecute todos los días a las 08:00 AM
    schedule.every().day.at("08:00").do(ejecutar_agente_id)
    
    print("Worker I+D Antigravity iniciado y programado (Daily 08:00 AM)...")
    while True:
        schedule.run_pending()
        time.sleep(60)
