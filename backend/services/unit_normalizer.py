"""
Normalizador de unidades de medida.
Convierte cantidades a la unidad base definida en el Maestro.
"""

from typing import Dict, Optional, Tuple, List
from sqlalchemy.orm import Session

from database import DBMaestroArticulo


# Factores de conversión comunes
UNIT_CONVERSIONS = {
    # Peso
    ("kg", "g"): 1000,
    ("kg", "mg"): 1000000,
    ("ton", "kg"): 1000,
    ("lb", "kg"): 0.453592,
    
    # Volumen
    ("l", "ml"): 1000,
    ("gal", "l"): 3.78541,
    
    # Unidades
    ("docena", "unidad"): 12,
    ("caja", "unidad"): None,  # Requiere factor del maestro
    ("paquete", "unidad"): None,
    
    # Longitud
    ("m", "cm"): 100,
    ("m", "mm"): 1000,
    ("km", "m"): 1000,
}


class UnitNormalizer:
    """Normalizador de unidades de medida"""
    
    def __init__(self, db: Session = None):
        self.db = db
        self._unit_cache: Dict[str, str] = {}
        if db:
            self._load_unit_cache()
    
    def _load_unit_cache(self):
        """Carga las unidades del maestro en cache"""
        if not self.db:
            return
        items = self.db.query(DBMaestroArticulo.codigo, DBMaestroArticulo.unidad_medida).all()
        self._unit_cache = {item.codigo: item.unidad_medida for item in items}
    
    def normalize_unit_name(self, unit: str) -> str:
        """Normaliza el nombre de una unidad de medida"""
        if not unit:
            return ""
        
        unit = unit.strip().lower()
        
        # Mapeo de variaciones comunes
        normalizations = {
            "kilogramos": "kg",
            "kilogramo": "kg",
            "kilos": "kg",
            "kilo": "kg",
            "gramos": "g",
            "gramo": "g",
            "gr": "g",
            "litros": "l",
            "litro": "l",
            "lt": "l",
            "lts": "l",
            "mililitros": "ml",
            "mililitro": "ml",
            "unidades": "unidad",
            "unid": "unidad",
            "und": "unidad",
            "un": "unidad",
            "pza": "unidad",
            "pieza": "unidad",
            "piezas": "unidad",
            "cajas": "caja",
            "cj": "caja",
            "paquetes": "paquete",
            "paq": "paquete",
            "pk": "paquete",
            "docenas": "docena",
            "doc": "docena",
            "metros": "m",
            "metro": "m",
            "mts": "m",
        }
        
        return normalizations.get(unit, unit)
    
    def get_base_unit(self, codigo: str) -> Optional[str]:
        """Obtiene la unidad base de un artículo del maestro"""
        return self._unit_cache.get(codigo)
    
    def convert_quantity(self, quantity: float, from_unit: str, to_unit: str) -> Tuple[float, bool]:
        """
        Convierte una cantidad de una unidad a otra.
        
        Returns:
            Tuple de (cantidad_convertida, conversion_exitosa)
        """
        from_unit = self.normalize_unit_name(from_unit)
        to_unit = self.normalize_unit_name(to_unit)
        
        if from_unit == to_unit:
            return quantity, True
        
        # Buscar factor de conversión directo
        factor = UNIT_CONVERSIONS.get((from_unit, to_unit))
        if factor is not None:
            return quantity * factor, True
        
        # Buscar factor inverso
        inverse_factor = UNIT_CONVERSIONS.get((to_unit, from_unit))
        if inverse_factor is not None:
            return quantity / inverse_factor, True
        
        # No se encontró conversión
        return quantity, False
    
    def normalize_to_base(self, codigo: str, quantity: float, 
                          current_unit: str) -> Tuple[float, str, bool, str]:
        """
        Normaliza una cantidad a la unidad base del maestro.
        
        Returns:
            Tuple de (cantidad_normalizada, unidad_base, conversion_exitosa, mensaje)
        """
        base_unit = self.get_base_unit(codigo)
        
        if not base_unit:
            return quantity, current_unit, False, f"SKU '{codigo}' no encontrado en maestro"
        
        current_unit = self.normalize_unit_name(current_unit)
        base_unit_normalized = self.normalize_unit_name(base_unit)
        
        if current_unit == base_unit_normalized:
            return quantity, base_unit, True, "Sin conversión necesaria"
        
        converted_qty, success = self.convert_quantity(quantity, current_unit, base_unit_normalized)
        
        if success:
            return converted_qty, base_unit, True, f"Convertido de {current_unit} a {base_unit}"
        else:
            return quantity, current_unit, False, f"No se pudo convertir de {current_unit} a {base_unit}"


def normalize_units_in_dataframe(df, normalizer: UnitNormalizer, 
                                  codigo_col: str = "codigo",
                                  quantity_col: str = "cantidad",
                                  unit_col: str = "unidad_medida") -> Tuple[any, List[str]]:
    """
    Normaliza las unidades en un DataFrame completo.
    
    Returns:
        Tuple de (DataFrame modificado, warnings)
    """
    import pandas as pd
    warnings = []
    df = df.copy()
    
    if unit_col not in df.columns:
        warnings.append(f"Columna '{unit_col}' no encontrada, no se normalizaron unidades")
        return df, warnings
    
    conversions_made = 0
    conversions_failed = 0
    
    for idx, row in df.iterrows():
        codigo = row.get(codigo_col)
        cantidad = row.get(quantity_col)
        unidad = row.get(unit_col)
        
        if codigo and cantidad and unidad:
            new_qty, new_unit, success, msg = normalizer.normalize_to_base(
                str(codigo), float(cantidad), str(unidad)
            )
            
            if success and new_qty != cantidad:
                df.at[idx, quantity_col] = new_qty
                df.at[idx, unit_col] = new_unit
                conversions_made += 1
            elif not success:
                conversions_failed += 1
    
    if conversions_made > 0:
        warnings.append(f"{conversions_made} cantidades convertidas a unidad base")
    if conversions_failed > 0:
        warnings.append(f"{conversions_failed} conversiones fallidas (unidades incompatibles)")
    
    return df, warnings
