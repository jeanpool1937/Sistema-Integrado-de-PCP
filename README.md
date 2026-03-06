# Sistema Integrado de PCP (Planeamiento y Control de la Producción)

Una plataforma avanzada impulsada por Inteligencia Artificial y metodologías DDMRP para predecir, planificar y orquestar el consumo de materiales y la producción a nivel corporativo.

---

## 🎯 Objetivo del Sistema

Revolucionar la planificación de la producción reemplazando las hojas de cálculo fragmentadas por un sistema centralizado, predictivo y reactivo. El sistema consolida la información de inventarios, consumo histórico y programas de producción (conectado a ERP/SAP), aplica Inteligencia Artificial para detectar alertas/limpiar datos, y genera cálculos precisos de Cobertura de Stock (ADU Híbrido) para asegurar que el inventario se mantenga en niveles óptimos evitando tanto el quiebre de stock cruzado como el sobre-stock.

## 🏗 Arquitectura de Alto Nivel

El proyecto emplea una arquitectura desacoplada y moderna:

- **Frontend (UI / UX)**: Desarrollado en **React + Vite** con TypeScript. Utiliza Zustand para la persistencia ágil de estado, Recharts para visualización de series de tiempo complejas, y Tailwind/Vanilla CSS para un diseño corporativo premium.
- **Backend (Agentes Analíticos y Scripts)**: Desarrollado en **Python**, estructurado de forma modular con agentes inteligentes especializados que corren en batch (cron) o bajo demanda.
- **Base de Datos**: **Supabase (PostgreSQL)** alojado en la nube que actúa como la Única Fuente de Verdad, guardando los históricos crudos, la tabla limpia por IA, los parámetros de planificación y las configuraciones DDMRP.
- **Asistente Cognitivo**: Un módulo de Procesamiento de Lenguaje Natural Integrado (NLP Engine) que interactúa con la BD a nivel Text-to-SQL para responder preguntas técnicas del usuario en la interfaz.

---

## 🤖 Motores y Agentes Principales (Backend)

La columna vertebral de los cálculos reside en los siguientes agentes/módulos, ejecutados en lote o vía tareas programadas:

1. **AI Data Cleaner (`ai_data_cleaner.py`)**: Analiza la serie de tiempo diaria cruda para limpiar estadísticamente la demanda. Emplea winsorización para aplastar picos irregulares (compras institucionales) y lógicas de imputación para reparar quiebres de stock.
2. **Motor de Pronósticos Híbrido (`forecast_engine.py`)**: Genera la proyección a 90 días tomando la demanda de ventas y de consumo de MP. Detecta la naturaleza del comportamiento de cada SKU (ABC/XYZ) para aplicar el método más preciso: **SES** (Suavización), **WMA** (Media Móvil) o **Croston** (para demanda intermitente), y finalmente lo pondera junto con el Plan Comercial.
3. **Módulo DDMRP (`ddmrp_engine.py`)**: Basado en Demand Driven MRP, establece las Zonas de Color (Rojo, Amarillo, Verde) usando perfiles de variabilidad, el Lead Time de reposición y los buffers de seguridad, para emitir alertas visuales cuando un material requiere atención urgente.
4. **Agente Cognitivo NLP (`nlp_engine.py`)**: Interfaz conversacional construida sobre modelos LLM y RAG para interactuar en lenguaje natural con el sistema (e.g., "Muéstrame el top 5 de materiales con riesgo de quiebre").

---

## 🧠 Evolución: Optimización Autónoma y Prescriptiva

El sistema integra capacidades de IA avanzada para evolucionar de un modelo predictivo a uno prescriptivo e inteligente:

- **Aprendizaje por Refuerzo (Reinforcement Learning)**: Modelos de IA que actúan como "agentes" aprendiendo a ajustar los niveles de stock de seguridad y puntos de reorden de forma continua. Equilibra dinámicamente el costo de almacenamiento versus el riesgo de quiebre de stock ante la volatilidad del tiempo de entrega (Lead Time) de los proveedores.
- **Análisis Prescriptivo de Escasez**: Si el sistema proyecta que faltará un componente o materia prima, la IA no solo lanza una alerta (alertas de DDMRP), sino que recomienda la mejor acción de mitigación (ej. reasignar material de otra orden de producción menos prioritaria, utilizar materiales sustitutos, o solicitar un envío aéreo de emergencia calculando el sobrecosto logístico).

---

## 💻 Estructura de Carpetas

```text
Sistema-Integrado-de-PCP-main/
│
├── frontend_extracted/   # Cliente Web (React + TS + Vite)
│   ├── src/
│   │   ├── components/   # Widgets y modales reusables
│   │   ├── pages/        # Vistas principales (Dashboard, Planeación, NLP)
│   │   ├── services/     # Cliente de API Supabase
│   │   ├── store/        # Zustand State Management
│   │   └── index.css     # UI Framework Premium (Tokens)
│   └── package.json
│
├── backend/              # Agentes y Motores de AI
│   ├── agents/           # Scripts core: ai_data_cleaner, forecast_engine
│   ├── cognitive/        # Generador NLP, LangChain, Traductor SQL
│   ├── modules/          # Funciones compartidas (DDMRP, Conexiones)
│   ├── run_forecast.bat  # Pipeline de ejecución orquestado
│   └── requirements.txt
│
└── GEMINI.md             # Reglas y directrices maestras del Agente IA (Memoria)
```

---

## 🚀 Despliegue y Ejecución

### Requisitos Previos
- Node.js (v18+)
- Python (3.9+)
- Proyecto de Supabase activo (Variables de entorno `SUPABASE_URL` y `SUPABASE_KEY`)

### Entorno de Desarrollo (Frontend)
```bash
cd frontend_extracted
npm install
npm run dev
```

### Ejecución de Motores de PCP (Backend)
Para lanzar el proceso end-to-end de generación y limpieza de demanda, usa el script orquestador:
```bash
cd backend
run_forecast.bat
```

### Puesta en Producción (Despliegue)
Para realizar el build estático y subir a GitHub Pages:
```bash
npm run deploy  # (Requiere de configuración gh-pages en package.json)
```

---

*Proyecto en evolución continua, optimizado mediante colaboración Agent/LLM.*
