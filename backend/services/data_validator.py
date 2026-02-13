"""
Validador de datos que verifica SKUs contra el Maestro de Artículos.
Incluye sugerencias usando distancia de Levenshtein.
"""

from typing import List, Tuple, Optional, Dict
from sqlalchemy.orm import Session
import Levenshtein

from database import DBMaestroArticulo


class DataValidator:
    """Validador de datos contra el Maestro de Artículos"""
    
    def __init__(self, db: Session):
        self.db = db
        self._maestro_cache: Dict[str, DBMaestroArticulo] = {}
        self._refresh_cache()
    
    def _refresh_cache(self):
        """Recarga el cache del maestro de artículos"""
        items = self.db.query(DBMaestroArticulo).all()
        self._maestro_cache = {item.codigo: item for item in items}
    
    def validate_sku(self, codigo: str) -> Tuple[bool, Optional[str], Optional[str]]:
        """
        Valida si un SKU existe en el maestro.
        
        Returns:
            Tuple de (es_valido, mensaje_error, sugerencia)
        """
        if codigo in self._maestro_cache:
            return True, None, None
        
        # Buscar sugerencia usando Levenshtein
        suggestion = self._find_similar_sku(codigo)
        
        return False, f"SKU '{codigo}' no encontrado en Maestro", suggestion
    
    def _find_similar_sku(self, codigo: str, max_distance: int = 3) -> Optional[str]:
        """
        Encuentra el SKU más similar usando distancia de Levenshtein.
        """
        if not self._maestro_cache:
            return None
        
        best_match = None
        best_distance = float('inf')
        
        for sku in self._maestro_cache.keys():
            distance = Levenshtein.distance(codigo.lower(), sku.lower())
            if distance < best_distance and distance <= max_distance:
                best_distance = distance
                best_match = sku
        
        return best_match
    
    def validate_skus_batch(self, codigos: List[str]) -> Dict[str, Tuple[bool, Optional[str], Optional[str]]]:
        """
        Valida múltiples SKUs de una vez.
        
        Returns:
            Dict con codigo -> (es_valido, error, sugerencia)
        """
        results = {}
        for codigo in set(codigos):  # Eliminar duplicados para eficiencia
            results[codigo] = self.validate_sku(codigo)
        return results
    
    def get_unmatched_skus(self, codigos: List[str]) -> List[Dict]:
        """
        Obtiene lista de SKUs no encontrados con sugerencias.
        
        Returns:
            Lista de dicts con codigo, error y sugerencia
        """
        unmatched = []
        for codigo in set(codigos):
            is_valid, error, suggestion = self.validate_sku(codigo)
            if not is_valid:
                unmatched.append({
                    "codigo": codigo,
                    "error": error,
                    "suggestion": suggestion
                })
        return unmatched
    
    def get_maestro_item(self, codigo: str) -> Optional[DBMaestroArticulo]:
        """Obtiene un artículo del maestro por código"""
        return self._maestro_cache.get(codigo)
    
    def get_unit_of_measure(self, codigo: str) -> Optional[str]:
        """Obtiene la unidad de medida de un artículo"""
        item = self.get_maestro_item(codigo)
        return item.unidad_medida if item else None


def validate_dataframe_skus(df, validator: DataValidator, codigo_column: str = "codigo") -> Tuple[List, List]:
    """
    Valida todos los SKUs en un DataFrame.
    
    Returns:
        Tuple de (lista de errores, lista de warnings)
    """
    errors = []
    warnings = []
    
    if codigo_column not in df.columns:
        errors.append(f"Columna '{codigo_column}' no encontrada")
        return errors, warnings
    
    codigos = df[codigo_column].dropna().astype(str).tolist()
    validation_results = validator.validate_skus_batch(codigos)
    
    invalid_count = sum(1 for v in validation_results.values() if not v[0])
    
    if invalid_count > 0:
        warnings.append(f"{invalid_count} SKUs no encontrados en Maestro de Artículos")
        
        # Agregar detalles de los primeros 10
        invalid_items = [(k, v) for k, v in validation_results.items() if not v[0]][:10]
        for codigo, (_, error, suggestion) in invalid_items:
            msg = f"  - {codigo}"
            if suggestion:
                msg += f" (¿Quiso decir '{suggestion}'?)"
            warnings.append(msg)
        
        if invalid_count > 10:
            warnings.append(f"  ... y {invalid_count - 10} más")
    
    return errors, warnings
