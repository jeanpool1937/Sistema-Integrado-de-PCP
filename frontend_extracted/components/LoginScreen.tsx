import React, { useState, useEffect } from 'react';

interface LoginScreenProps {
    onLogin: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
    const [password, setPassword] = useState('');
    const [error, setError] = useState(false);
    const [attempts, setAttempts] = useState(0);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (password === 'PCP2026') {
            localStorage.setItem('pcp_auth', 'true');
            onLogin();
        } else {
            setError(true);
            setAttempts(prev => prev + 1);
            setTimeout(() => setError(false), 2000);
        }
    };

    return (
        <div className="min-h-screen bg-dark-950 flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="text-center mb-10">
                    <div className="w-20 h-20 bg-primary-600 rounded-2xl mx-auto flex items-center justify-center mb-6 shadow-2xl shadow-primary-600/30">
                        <span className="material-symbols-rounded text-4xl text-white">lock</span>
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">Acceso Restringido</h1>
                    <p className="text-slate-400">Sistema Integrado de Planificación A+I</p>
                </div>

                <div className="bg-dark-900 border border-slate-800 rounded-2xl p-8 shadow-xl">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-2">
                                Contraseña de Acceso
                            </label>
                            <input
                                type="password"
                                id="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-dark-950 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                                placeholder="Ingrese su clave..."
                                autoFocus
                            />
                        </div>

                        {error && (
                            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-3 animate-shake">
                                <span className="material-symbols-rounded text-red-500">error</span>
                                <p className="text-sm text-red-400">Contraseña incorrecta</p>
                            </div>
                        )}

                        <button
                            type="submit"
                            className="w-full bg-primary-600 hover:bg-primary-500 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200 shadow-lg shadow-primary-600/20 flex items-center justify-center gap-2"
                        >
                            <span className="material-symbols-rounded">login</span>
                            Ingresar al Sistema
                        </button>
                    </form>

                    <div className="mt-6 text-center">
                        <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">
                            Secure Access v3.0
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
