'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { User } from '@supabase/supabase-js';
import { LogOut, User as UserIcon, Users, Play, Hash } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [roomCode, setRoomCode] = useState('');
  
  const supabase = createClient();
  const router = useRouter();

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

  const handleCreateRoom = () => {
    // Generar un código aleatorio de 5 caracteres alfanuméricos
    const code = Math.random().toString(36).substring(2, 7).toUpperCase();
    router.push(`/room/${code}`);
  };

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (roomCode.trim().length >= 3) {
      router.push(`/room/${roomCode.trim().toUpperCase()}`);
    }
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
          // --- DASHBOARD PRINCIPAL SPRINT 2 ---
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 w-full">
            
            {/* Perfil del Usuario */}
            <div className="flex items-center justify-between p-4 bg-slate-900/50 rounded-xl border border-slate-700">
              <div className="text-left">
                <p className="text-xs text-slate-400 uppercase tracking-wider font-bold">Jugador Actual</p>
                <p className="font-semibold text-white">
                  {user.is_anonymous ? 'Invitado (Anónimo)' : user.user_metadata?.full_name || 'Jugador'}
                </p>
              </div>
              <button 
                onClick={handleLogout} 
                className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors border border-transparent hover:border-red-500/20"
                title="Cerrar Sesión"
              >
                <LogOut size={20} />
              </button>
            </div>

            <div className="grid gap-4 pt-2">
              <button 
                onClick={handleCreateRoom}
                className="w-full py-4 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold tracking-wide transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3 shadow-lg shadow-emerald-900/50"
              >
                <Play size={24} fill="currentColor" />
                CREAR SALA NUEVA
              </button>
              
              <div className="relative flex items-center justify-center py-2">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-700"></div></div>
                <span className="relative bg-slate-800 px-4 text-xs text-slate-500 font-bold uppercase tracking-widest">O únete a una</span>
              </div>

              <form onSubmit={handleJoinRoom} className="flex gap-2">
                <div className="relative flex-1">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                  <input 
                    type="text" 
                    placeholder="CÓDIGO" 
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                    maxLength={5}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-white placeholder:text-slate-500 font-mono font-bold focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all uppercase"
                  />
                </div>
                <button 
                  type="submit" 
                  disabled={roomCode.length < 3} 
                  className="px-6 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:hover:bg-slate-700 text-white rounded-xl font-bold transition-colors"
                >
                  UNIRSE
                </button>
              </form>
            </div>
          </div>
        ) : (
          // --- PANTALLA DE LOGIN SPRINT 1 ---
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