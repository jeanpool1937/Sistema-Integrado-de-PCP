def calculate_ddmrp_buffers(adu, lead_time, cov):
    """
    Calcula las zonas DDMRP basadas en la lógica experta de Aceros Arequipa.
    """
    # Lead Time Factor (LTF) - Estándar Aceros
    ltf = 0.2
    
    # Variability Factor (VF) - Tiers Expertos basados en CoV
    if cov <= 0.5: vf = 0.2
    elif cov < 0.8: vf = 0.4
    else: vf = 0.7
    
    yellow_zone = adu * lead_time
    red_base = adu * lead_time * ltf
    red_alert = adu * lead_time * vf
    red_total = red_base + red_alert
    
    return {
        "yellow": round(yellow_zone, 2),
        "red_base": round(red_base, 2),
        "red_alert": round(red_alert, 2),
        "red_total": round(red_total, 2)
    }
