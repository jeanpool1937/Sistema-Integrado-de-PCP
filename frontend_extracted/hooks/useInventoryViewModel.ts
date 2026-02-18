import { useState, useMemo } from 'react';
import { SKU } from '../types';
import { useData } from '../contexts/DataContext';

export type DDMRPStatus = 'ALL' | 'RED' | 'YELLOW' | 'GREEN';

export const useInventoryViewModel = (filteredSkus: SKU[]) => {
    const { isLoading } = useData();
    const [simLTF, setSimLTF] = useState(0.2);
    const [selectedSegment, setSelectedSegment] = useState<string | null>(null);
    const [matrixType, setMatrixType] = useState<'ABC-XYZ' | 'ABC-Rot' | 'ABC-Per'>('ABC-XYZ');
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<DDMRPStatus>('ALL');

    const getSkuStatus = (sku: SKU) => {
        const redBase = sku.adu * sku.leadTime * simLTF;
        const redAlert = sku.adu * sku.leadTime * sku.variabilityFactor;
        const redTotal = redBase + redAlert;
        const yellowZone = sku.adu * sku.leadTime;

        if (sku.stockLevel < redTotal) return 'RED';
        if (sku.stockLevel < (redTotal + yellowZone)) return 'YELLOW';
        return 'GREEN';
    };

    const matrixData = useMemo(() => {
        const counts: Record<string, number> = {};
        const rowClasses = ['A', 'B', 'C'];
        const colClasses = matrixType === 'ABC-XYZ' ? ['X', 'Y', 'Z'] : ['High', 'Medium', 'Low'];

        rowClasses.forEach(r => {
            colClasses.forEach(c => {
                counts[`${r}${c}`] = filteredSkus.filter(s => {
                    if (matrixType === 'ABC-XYZ') return s.abc === r && s.xyz === c;
                    if (matrixType === 'ABC-Rot') return s.abc === r && s.rotationSegment === c;
                    if (matrixType === 'ABC-Per') return s.abc === r && s.periodicitySegment === c;
                    return false;
                }).length;
            });
        });
        return counts;
    }, [filteredSkus, matrixType]);

    const sortedSkus = useMemo(() => {
        const filtered = filteredSkus.filter(s => {
            let matchesSegment = true;
            if (selectedSegment) {
                if (matrixType === 'ABC-XYZ') matchesSegment = `${s.abc}${s.xyz}` === selectedSegment;
                else if (matrixType === 'ABC-Rot') matchesSegment = `${s.abc}${s.rotationSegment}` === selectedSegment;
                else if (matrixType === 'ABC-Per') matchesSegment = `${s.abc}${s.periodicitySegment}` === selectedSegment;
            }
            const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) || s.id.toLowerCase().includes(searchTerm.toLowerCase());
            const status = getSkuStatus(s);
            const matchesStatus = filterStatus === 'ALL' || status === filterStatus;

            return matchesSegment && matchesSearch && matchesStatus;
        });

        return [...filtered].sort((a, b) => {
            const getStatusPriority = (sku: SKU) => {
                const status = getSkuStatus(sku);
                if (status === 'RED') return 0;
                if (status === 'YELLOW') return 1;
                return 2;
            };
            return getStatusPriority(a) - getStatusPriority(b);
        });
    }, [filteredSkus, selectedSegment, matrixType, searchTerm, filterStatus, simLTF]);

    return {
        isLoading,
        simLTF,
        setSimLTF,
        selectedSegment,
        setSelectedSegment,
        matrixType,
        setMatrixType,
        searchTerm,
        setSearchTerm,
        filterStatus,
        setFilterStatus,
        matrixData,
        sortedSkus,
        getSkuStatus
    };
};
