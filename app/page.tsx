'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { User } from '@supabase/supabase-js';
import { LogOut, User as UserIcon } from 'lucide-react';

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    // Escuchar cambios en la autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, [supabase.auth]);

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/` : undefined,
      },
    });
  };

  const handleGuestLogin = async () => {
    const { error } = await supabase.auth.signInAnonymously();
    if (error) console.error("Error guest login:", error);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-12 h-20 bg-emerald-500 rounded-md"></div>
          <p className="text-emerald-400 font-semibold tracking-widest">CARGANDO...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-4 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-800 to-slate-950">
      <div className="max-w-md w-full bg-slate-800/80 backdrop-blur-sm p-8 rounded-2xl shadow-2xl border border-slate-700 text-center">
        
        {/* Logo / Título */}
        <div className="mb-8">
          <div className="flex justify-center gap-2 mb-4">
            <div className="w-8 h-12 bg-white rounded-sm flex flex-col items-center justify-around py-1 shadow-lg border-2 border-slate-300">
              <div className="w-2 h-2 bg-slate-900 rounded-full"></div>
              <div className="w-full h-[1px] bg-slate-300"></div>
              <div className="w-2 h-2 bg-slate-900 rounded-full"></div>
            </div>
            <div className="w-8 h-12 bg-emerald-500 rounded-sm flex flex-col items-center justify-around py-1 shadow-lg border-2 border-emerald-400 rotate-12">
              <div className="w-2 h-2 bg-white rounded-full"></div>
              <div className="w-full h-[1px] bg-emerald-300"></div>
              <div className="w-2 h-2 bg-transparent rounded-full"></div>
            </div>
          </div>
          <h1 className="text-4xl font-black tracking-tight text-white mb-2">DOMINÓ</h1>
          <p className="text-emerald-400 font-medium tracking-widest uppercase text-sm">Edición Venezolana</p>
        </div>

        {user ? (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="p-4 bg-slate-900/50 rounded-xl mb-6 border border-slate-700">
              <p className="text-sm text-slate-400 mb-1">Conectado como</p>
              <p className="font-semibold text-lg text-white">
                {user.is_anonymous ? 'Invitado (Anónimo)' : user.user_metadata?.full_name || user.email || 'Jugador'}
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="w-full py-3 px-4 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 border border-red-500/20"
            >
              <LogOut size={20} />
              Cerrar Sesión
            </button>
            <div className="pt-6 mt-6 border-t border-slate-700/50">
              <p className="text-sm text-slate-400">¡Listo para el Sprint 2: Lobby y Salas!</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <button
              onClick={handleGoogleLogin}
              className="w-full py-3.5 px-4 bg-white text-slate-900 hover:bg-slate-100 rounded-xl font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3 shadow-lg"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continuar con Google
            </button>
            <button
              onClick={handleGuestLogin}
              className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3 shadow-lg shadow-emerald-900/50"
            >
              <UserIcon size={20} />
              Jugar como Invitado
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
