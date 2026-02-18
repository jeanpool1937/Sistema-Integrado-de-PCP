import React, { useState, useRef, useEffect } from 'react';

interface Option {
    value: string;
    label: string;
}

interface SearchableSelectProps {
    options: string[];
    labelMap: Record<string, string>;
    value: string | string[];
    onChange: (value: any) => void;
    placeholder: string;
    emptyLabel: string;
    multiple?: boolean;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
    options,
    labelMap,
    value,
    onChange,
    placeholder,
    emptyLabel,
    multiple = false
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Sync search term with selected value label when closing or initializing (only for single select)
    useEffect(() => {
        if (!isOpen && !multiple && typeof value === 'string') {
            setSearchTerm(value ? (labelMap[value] || value) : '');
        }
        if (!isOpen && multiple) {
            setSearchTerm('');
        }
    }, [value, isOpen, labelMap, multiple]);

    // Handle click outside to close
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setSearchTerm('');
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredOptions = options.filter(opt => {
        const label = (labelMap[opt] || opt).toLowerCase();
        const code = opt.toLowerCase();
        const search = searchTerm.toLowerCase();
        return label.includes(search) || code.includes(search);
    });

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (filteredOptions.length > 0) {
                handleSelect(filteredOptions[0]);
            }
        } else if (e.key === 'Escape') {
            setIsOpen(false);
        } else if (e.key === 'Backspace' && searchTerm === '' && multiple && Array.isArray(value) && value.length > 0) {
            // Remove last item on backspace if search is empty
            const newValue = [...value];
            newValue.pop();
            onChange(newValue);
        }
    };

    const handleSelect = (opt: string) => {
        if (multiple) {
            const currentValues = Array.isArray(value) ? value : [];
            const newValue = currentValues.includes(opt)
                ? currentValues.filter(v => v !== opt)
                : [...currentValues, opt];
            onChange(newValue);
            setSearchTerm(''); // Clear search after select in multi mode
            inputRef.current?.focus();
        } else {
            onChange(opt);
            setIsOpen(false);
        }
    };

    const removeValue = (optToRemove: string) => {
        if (multiple && Array.isArray(value)) {
            onChange(value.filter(v => v !== optToRemove));
        } else {
            onChange('');
            setSearchTerm('');
        }
    };

    return (
        <div className="relative" ref={containerRef}>
            <div
                className={`flex items-center flex-wrap gap-1 bg-slate-800 border ${isOpen ? 'border-primary-500 ring-2 ring-primary-500/20' : 'border-slate-700'} text-sm text-white rounded-lg transition-all duration-200 cursor-text overflow-hidden min-h-[38px] p-1`}
                onClick={() => {
                    setIsOpen(true);
                    inputRef.current?.focus();
                }}
            >
                {multiple && Array.isArray(value) && value.map(val => (
                    <span key={val} className="flex items-center gap-1 bg-primary-900/50 border border-primary-700/50 text-white text-xs px-2 py-0.5 rounded-md">
                        {labelMap[val] || val}
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                removeValue(val);
                            }}
                            className="hover:text-red-400 focus:outline-none"
                        >
                            <span className="material-symbols-rounded text-[14px]">close</span>
                        </button>
                    </span>
                ))}

                <input
                    ref={inputRef}
                    type="text"
                    className="bg-transparent border-none text-sm text-white pl-2 py-1 flex-1 outline-none placeholder-slate-500 min-w-[60px]"
                    placeholder={multiple && Array.isArray(value) && value.length > 0 ? '' : placeholder}
                    value={searchTerm}
                    onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setIsOpen(true);
                    }}
                    onFocus={() => setIsOpen(true)}
                    onKeyDown={handleKeyDown}
                />

                <div className="pr-2 flex items-center text-slate-500 ml-auto">
                    {!multiple && value && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                removeValue(value as string);
                            }}
                            className="hover:text-red-400 p-0.5 rounded-full transition-colors mr-1"
                        >
                            <span className="material-symbols-rounded text-sm">close</span>
                        </button>
                    )}
                    <span className={`material-symbols-rounded text-lg transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
                        expand_more
                    </span>
                </div>
            </div>

            {isOpen && (
                <div className="absolute z-50 w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-2xl overflow-hidden max-h-60 overflow-y-auto backdrop-blur-md">
                    {!multiple && (
                        <div
                            className={`px-3 py-2 text-sm cursor-pointer transition-colors ${!value ? 'bg-primary-600/20 text-primary-400 font-bold' : 'text-slate-300 hover:bg-slate-700 hover:text-white'}`}
                            onClick={() => {
                                onChange('');
                                setIsOpen(false);
                            }}
                        >
                            {emptyLabel}
                        </div>
                    )}
                    {filteredOptions.length > 0 ? (
                        filteredOptions.map(opt => {
                            const label = labelMap[opt] || opt;
                            const isSelected = multiple ? (Array.isArray(value) && value.includes(opt)) : value === opt;
                            const showBadge = opt !== label && !label.includes(opt);

                            return (
                                <div
                                    key={opt}
                                    className={`px-3 py-2 text-sm cursor-pointer transition-colors ${isSelected ? 'bg-primary-600 text-white font-bold' : 'text-slate-300 hover:bg-slate-700 hover:text-white'}`}
                                    onClick={() => handleSelect(opt)}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            {multiple && (
                                                <div className={`w-4 h-4 rounded border flex items-center justify-center ${isSelected ? 'bg-white border-white' : 'border-slate-500'}`}>
                                                    {isSelected && <span className="material-symbols-rounded text-primary-600 text-xs font-bold">check</span>}
                                                </div>
                                            )}
                                            <span>{label}</span>
                                        </div>
                                        {showBadge && (
                                            <span className="text-[10px] bg-slate-900/50 px-1.5 py-0.5 rounded text-slate-500 font-mono">
                                                {opt}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="px-3 py-4 text-xs text-slate-500 text-center italic">
                            No se encontraron resultados
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
