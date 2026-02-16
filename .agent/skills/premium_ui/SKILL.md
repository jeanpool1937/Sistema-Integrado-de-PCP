---
name: Premium UI Framework
description: Estándares de diseño y desarrollo frontend para crear interfaces "WOW factor" con React y CSS.
---

# Premium UI Framework Skill

Esta habilidad garantiza que la interfaz de usuario del sistema de PCP sea profesional, moderna y visualmente impactante, siguiendo las reglas globales de estética premium.

## Principios Estéticos

1. **Paleta de Colores Dinámica**:
   - Evitar colores primarios básicos (rojo puro, azul puro).
   - Usar HSL para generar variantes armoniosas.
   - **Ejemplo**: `hsl(220, 15%, 20%)` para fondos oscuros sofisticados.
2. **Tipografía Moderna**:
   - Usar fuentes Sans-Serif limpias (Inter, Outfit, Roboto).
   - Jerarquía clara mediante pesos (`font-weight`) y tamaños variables.
3. **Efectos de Capa (Glassmorphism)**:
   - Uso de `backdrop-filter: blur(10px)` con bordes semi-transparentes para paneles.
   - Sombras suaves (`box-shadow`) para dar profundidad.

## Componentes y Layouts

- **Dashboards de Datos**:
  - Uso de tarjetas con micro-interacciones al hacer hover.
  - Gráficos minimalistas pero informativos.
  - Tablas con celdas de colores (ej: semáforos de DDMRP) bien balanceados.
- **Feedback Visual**:
  - Skeletons para estados de carga.
  - Animaciones de entrada suaves (`fade-in`, `slide-up`).

## Estructura de Código Sostenible

1. **Tokens de Diseño**: Centralizar colores y espaciados en variables CSS o un archivo `constants.ts`.
2. **Componentes Atómicos**: Crear pequeños componentes reutilizables (Botones, Inputs, Badges) antes de armar páginas complejas.
3. **Responsive first**: Asegurar que las tablas de planificación sean legibles en diferentes tamaños de pantalla.

## Ejemplo de Estilo Premium (CSS)

```css
.card-premium {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 1.5rem;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.card-premium:hover {
  transform: translateY(-4px);
  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.2);
}
```

> [!TIP]
> Un buen diseño premium se nota en los detalles: un borde ligeramente redondeado, un espaciado consistente y una transición suave hacen la diferencia.
