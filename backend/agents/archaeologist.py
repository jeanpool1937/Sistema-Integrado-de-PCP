import os
import re

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))

def scan_security_risks():
    findings = []
    # Patrón simple para detectar posibles llaves API
    api_key_pattern = re.compile(r'([s|S]upabase_[k|K]ey|[a|A]pi_[k|K]ey)\s*=\s*[\'"][a-zA-Z0-9.\-_]{20,}[\'"]')
    
    for root, dirs, files in os.walk(ROOT_DIR):
        if any(d in root for d in ['node_modules', '.git', '.agent']): continue
        for file in files:
            if file.endswith(('.py', '.ts', '.tsx')):
                path = os.path.join(root, file)
                try:
                    with open(path, 'r', encoding='utf-8') as f:
                        content = f.read()
                        if api_key_pattern.search(content):
                            findings.append(f"Posible llave expuesta en: {os.path.relpath(path, ROOT_DIR)}")
                except: pass
    return findings

if __name__ == "__main__":
    print("--- Arqueólogo de Código: Iniciando Scan de Seguridad ---")
    risks = scan_security_risks()
    if risks:
        for risk in risks: print(f"[!] {risk}")
    else:
        print("[+] No se detectaron riesgos evidentes.")
