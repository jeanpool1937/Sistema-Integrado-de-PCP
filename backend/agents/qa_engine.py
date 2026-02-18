import os
import sys
import json
import logging
from datetime import datetime
from data_validator import DataValidator

# Configuración de Rutas para ejecución desde backend/agents/
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
REPORTS_DIR = os.path.join(ROOT_DIR, "backend", "id_plus", "reports")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

class QAEngine:
    def __init__(self):
        self.validator = DataValidator()
        self.timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
        self.report_path = os.path.join(REPORTS_DIR, f"QA_AUDIT_{self.timestamp}.md")

    def run_full_cycle(self):
        logging.info("🚀 Iniciando Ciclo de Auditoría QA-Antigravity...")
        
        # 1. Auditoría de Datos
        self.validator.audit_inventory_consistency()
        self.validator.audit_monthly_consumption()
        
        # 2. Recopilar Issues
        all_issues = self.validator.get_summary()
        
        # 3. Generar Reporte
        self.generate_report(all_issues)
        logging.info(f"✅ Ciclo de QA completado. Reporte generado en {self.report_path}")

    def generate_report(self, issues):
        success_rate = 100 if not issues else max(0, 100 - (len(issues) * 5))
        
        report_content = f"""# Informe de Auditoría de Calidad (QA-Antigravity)
📅 **Fecha:** {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}
📊 **Dashboard de Calidad:** {success_rate}% de Fiabilidad Detectada

## 📑 Resumen de la Auditoría
Se ejecutó un escaneo sobre los módulos de Inventario y Suministro.

## 🚨 Lista Priorizada de Issues
"""
        if not issues:
            report_content += "\n✅ No se detectaron anomalías críticas en este ciclo.\n"
        else:
            for i, issue in enumerate(issues):
                color = "🔴" if issue['severity'] == "Crítica" else "🟠" if issue['severity'] == "Alta" else "🟡"
                report_content += f"""
### {i+1}. {color} [{issue['severity']}] {issue['category']}
- **Descripción:** {issue['description']}
- **Impacto:** {issue['impact']}
"""

        report_content += """
## 🛠️ Plan de Solución Recomendado
1. **Prioridad 1:** Corregir inconsistencias de datos en tablas maestras.
2. **Prioridad 2:** Revisar scripts de transformación para campos numéricos negativos.
3. **Prioridad 3:** Validar mapeo de rutas en el frontend.

---
*Generado automáticamente por QA-Antigravity Agent*
"""
        with open(self.report_path, "w", encoding="utf-8") as f:
            f.write(report_content)
        
        # Actualizar un último snapshot para fácil acceso en la raíz del proyecto
        snapshot_path = os.path.join(ROOT_DIR, "QA_LATEST_AUDIT.md")
        with open(snapshot_path, "w", encoding="utf-8") as f:
            f.write(report_content)

if __name__ == "__main__":
    engine = QAEngine()
    engine.run_full_cycle()
