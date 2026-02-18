import { useEffect, useState } from 'react';
import { supabase } from '../services/supabase'; // Asumiendo que existe un cliente supabase exportado

export interface InventoryAlert {
    id: number;
    sku_id: string;
    message: string;
    stock_level: number;
    red_total: number;
    created_at: string;
}

export const useInventoryObserver = () => {
    const [alerts, setAlerts] = useState<InventoryAlert[]>([]);

    useEffect(() => {
        // Suscribirse a la tabla de alertas
        const channel = supabase
            .channel('inventory_alerts')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'sap_inventory_alerts'
                },
                (payload) => {
                    const newAlert = payload.new as InventoryAlert;
                    setAlerts(prev => [newAlert, ...prev].slice(0, 5));

                    // Mostrar notificación nativa o interna
                    if (Notification.permission === 'granted') {
                        new Notification('Alerta de Inventario Crítico', {
                            body: `SKU ${newAlert.sku_id}: ${newAlert.message}. Stock: ${newAlert.stock_level}`,
                            icon: '/favicon.ico'
                        });
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    return { alerts, setAlerts };
};
