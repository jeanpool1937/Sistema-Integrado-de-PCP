---
name: PCP Intelligence
description: Habilidad especializada en la lógica de planeación y control de la producción (PCP) y DDMRP. Permite realizar cálculos de ADU, gestión de buffers y análisis de quiebres de inventario.
---

# PCP Intelligence Skill

Esta habilidad capacita al agente para entender y aplicar la metodología **DDMRP (Demand Driven Material Requirements Planning)** y tácticas avanzadas de gestión de inventarios.

## Fórmulas y Lógica de Negocio

### 1. Consumo Diario Promedio (ADU - Average Daily Usage)
El ADU es el motor del cálculo de buffers. Debe calcularse usando ventanas móviles:
- **ADU Histórico**: Promedio de consumo de los últimos 30, 60 o 90 días.
- **ADU Proyectado**: Basado en la demanda futura (pronósticos).
- **ADU Mixto**: `(Histórico * 0.5) + (Proyectado * 0.5)`.

### 2. Ecuación de Flujo Neto (Net Flow Position)
Determina cuándo pedir. **NUNCA** basarse solo en el stock físico.
`Net Flow = Stock Físico + Pedidos en Tránsito - Demanda Calificada (Pedidos de Venta acumulados)`

### 3. Zonas de Buffer
- **Zona Verde**: Determina el tamaño del pedido. `Verde = Ciclo de pedido * ADU * Factor de Servicio`.
- **Zona Amarillo**: Cobertura del Lead Time. `Amarilla = Lead Time * ADU`.
- **Zona Roja**: Seguridad. `RojaBase = Amarilla * Factor de Variabilidad`. `RojaSeguridad = RojaBase * Factor de Seguridad`.

## Mejores Prácticas de Implementación

1. **Segmentación ABC/XYZ**:
   - **ABC**: Basado en volumen o valor (A=80%, B=15%, C=5%).
   - **XYZ**: Basado en variabilidad (X=Estable, Y=Variable, Z=Intermitente).
2. **Puntos de Desacople**:
   - Identificar SKUs críticos que deben tener stock para romper la propagación de la varianza.
3. **Alertas de Gestión**:
   - **Alerta de Quiebre**: Cuando el Stock Físico < 0.
   - **Alerta de Exceso**: Cuando el Net Flow > Top de zona verde.

## Ejemplo de Cálculo en Código (Pseudo)

```typescript
function calculateBuffers(adu, leadTime, variability) {
  const yellow = adu * leadTime;
  const redBase = yellow * variability;
  const redSafety = redBase * 0.5; // Factor de ejemplo
  const red = redBase + redSafety;
  const green = yellow * 0.2; // Factor de ciclo de pedido
  
  return {
    topOfRed: red,
    topOfYellow: red + yellow,
    topOfGreen: red + yellow + green
  };
}
```

> [!IMPORTANT]
> Siempre que se modifique una pantalla de "Supply Planning" o "Dashboard", verificar que los colores de las gráficas correspondan a estas zonas (Rojo, Amarillo, Verde).
