import os
import json
from datetime import datetime

# Definición de Rutas
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
MEMORY_DIR = os.path.join(os.path.dirname(__file__), "memory")
REPORTS_DIR = os.path.join(os.path.dirname(__file__), "reports")
TRACKER_FILE = os.path.join(MEMORY_DIR, "improvements_tracker.json")
KNOWLEDGE_BASE = os.path.join(MEMORY_DIR, "id_knowledge_base.json")
OUTPUT_FILE_SNAPSHOT = os.path.join(BASE_DIR, "INSIGHTS_ID_PLUS.md")

class IDOrchestrator:
    def __init__(self):
        self.state = "IDLE"
        self.memory = self._load_memory()
        self.tracker = self._load_tracker()
        
    def _load_memory(self):
        if os.path.exists(KNOWLEDGE_BASE):
            with open(KNOWLEDGE_BASE, 'r', encoding='utf-8') as f:
                return json.load(f)
        return {"decisions": [], "patterns": [], "version": "1.0"}

    def _load_tracker(self):
        if os.path.exists(TRACKER_FILE):
            with open(TRACKER_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        return {"improvements": []}

    def run_cycle(self):
        timestamp = datetime.now().strftime("%Y-%m-%d")
        report_name = f"{timestamp}_INSIGHTS.md"
        report_path = os.path.join(REPORTS_DIR, report_name)
        
        print(f"[{datetime.now()}] Iniciando Ciclo I+D Enterprise...")
        
        # Filtro de Memoria: Identificar qué ya se implementó
        implemented_ids = [imp["id"] for imp in self.tracker["improvements"] if imp["status"] == "IMPLEMENTED"]
        print(f"[{datetime.now()}] Consultando Memoria Histórica: {len(implemented_ids)} mejoras ya implementadas.")
        
        self._generate_enterprise_report(report_path)
        self._update_snapshot(report_path)
        
        self.state = "COMPLETED"
        print(f"[{datetime.now()}] Ciclo completado. Reporte histórico en {report_path}")

    def _generate_enterprise_report(self, report_path):
        """Placeholder para la generación de contenido por parte de la IA."""
        pass

    def _update_snapshot(self, latest_report_path):
        """Mantiene el archivo de la raíz como un acceso directo al último reporte."""
        with open(OUTPUT_FILE_SNAPSHOT, 'w', encoding='utf-8') as f:
            f.write(f"# ÚLTIMOS INSIGHTS I+D\n\nEl reporte más reciente se encuentra en:\n")
            f.write(f"- [Reporte del día](file:///{latest_report_path.replace(os.sep, '/')})\n\n")
            f.write(f"Consulta el historial completo en `backend/id_plus/reports/`.")

if __name__ == "__main__":
    orchestrator = IDOrchestrator()
    orchestrator.run_cycle()
