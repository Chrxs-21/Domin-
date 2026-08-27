'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { User } from '@supabase/supabase-js';
import { Users, CheckCircle2, CircleDashed, Copy, ArrowLeft } from 'lucide-react';

type PlayerState = {
  id: string;
  name: string;
  isReady: boolean;
  joinedAt: string;
};

export default function RoomPage({ params }: { params: Promise<{ id: string }> }) {
  // En Next.js 15, params es una Promesa y debe desenvolverse usando React.use()
  const resolvedParams = use(params);
  const roomCode = resolvedParams.id;
  
  const router = useRouter();
  const supabase = createClient();
  
  const [user, setUser] = useState<User | null>(null);
  const [players, setPlayers] = useState<PlayerState[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [channel, setChannel] = useState<any>(null);

  useEffect(() => {
    let roomChannel: any = null;

    const initRoom = async () => {
      // 1. Validar que el usuario esté logueado
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.push('/');
        return;
      }
      setUser(data.user);
      
      // 2. Configurar la metadata del jugador
      // Le damos un nombre distinguible a los invitados usando los primeros 4 caracteres de su ID
      const shortId = data.user.id.substring(0, 4).toUpperCase();
      const userName = data.user.is_anonymous ? `Invitado-${shortId}` : (data.user.user_metadata?.full_name || 'Jugador');
      const uid = data.user.id;
      
      // 3. Conectarse al canal Realtime de Supabase
      roomChannel = supabase.channel(`room:${roomCode}`, {
        config: { presence: { key: uid } }
      });

      roomChannel
        // Escuchar cuando el estado del Lobby (Presence) se sincronice
        .on('presence', { event: 'sync' }, () => {
          const state = roomChannel.presenceState();
          const currentPlayers: PlayerState[] = [];
          
          for (const key in state) {
            // Cada key es un jugador, extraemos su payload
            const presenceData = state[key][0] as PlayerState;
            currentPlayers.push(presenceData);
          }
          
          // Ordenar por fecha de ingreso para que los slots no salten
          currentPlayers.sort((a, b) => new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime());
          setPlayers(currentPlayers);
        })
        .subscribe(async (status: string) => {
          if (status === 'SUBSCRIBED') {
            // Anunciamos nuestra llegada al Lobby
            await roomChannel.track({
              id: uid,
              name: userName,
              isReady: false,
              joinedAt: new Date().toISOString(),
            });
          }
        });

      setChannel(roomChannel);
    };

    initRoom();

    // Limpieza al desmontar el componente (salir de la sala)
    return () => {
      if (roomChannel) supabase.removeChannel(roomChannel);
    };
  }, [roomCode, router, supabase]);

  const toggleReady = async () => {
    if (!channel || !user) return;
    const newReadyState = !isReady;
    setIsReady(newReadyState);
    
    // Obtenemos nuestro estado actual para no pisar la fecha de ingreso
    const currentUserState = players.find(p => p.id === user.id);
    
    // Emitimos la actualización de nuestro estado a toda la sala
    await channel.track({
      ...currentUserState,
      isReady: newReadyState,
    });
  };

  const copyCode = () => {
    navigator.clipboard.writeText(roomCode);
    // Nota: Evitamos window.alert agresivo usando un feedback visual temporal o silente por ahora.
  };

  const maxPlayers = 4;
  const allReady = players.length === maxPlayers && players.every(p => p.isReady);

  return (
    <main className="min-h-screen bg-slate-900 text-white flex flex-col p-4 md:p-8 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-800 to-slate-950">
      <div className="max-w-4xl w-full mx-auto">
        
        {/* Cabecera de la Sala */}
        <div className="flex items-center justify-between mb-8 bg-slate-800/50 p-4 rounded-2xl border border-slate-700 backdrop-blur-sm">
          <button onClick={() => router.push('/')} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-xl transition-colors">
            <ArrowLeft size={24} />
          </button>
          
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-xs text-emerald-400 font-bold uppercase tracking-widest">Sala Privada</p>
              <p className="text-2xl font-black font-mono tracking-widest">{roomCode}</p>
            </div>
            <button onClick={copyCode} className="p-3 bg-slate-700 text-white hover:bg-emerald-600 rounded-xl transition-colors" title="Copiar Código">
              <Copy size={20} />
            </button>
          </div>
        </div>

        {/* Grid de Jugadores */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4 px-2">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Users className="text-emerald-500" />
              Lobby
            </h2>
            <span className="bg-slate-800 text-emerald-400 px-4 py-1.5 rounded-full text-sm font-bold border border-emerald-900/50">
              {players.length} / {maxPlayers} JUGADORES
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: maxPlayers }).map((_, index) => {
              const player = players[index];
              
              if (player) {
                const isMe = player.id === user?.id;
                return (
                  <div key={player.id} className={`p-6 rounded-2xl border-2 transition-all duration-300 ${isMe ? 'border-emerald-500 bg-emerald-500/10' : 'border-slate-700 bg-slate-800/80'} flex items-center justify-between shadow-lg`}>
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg shadow-inner ${player.isReady ? 'bg-emerald-500 text-slate-900' : 'bg-slate-700 text-slate-300'}`}>
                        {player.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-bold text-lg flex items-center gap-2">
                          {player.name} {isMe && <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-md uppercase tracking-wider">Tú</span>}
                        </p>
                        <p className={`text-sm font-medium ${player.isReady ? 'text-emerald-400' : 'text-slate-400'}`}>
                          {player.isReady ? '¡Listo para jugar!' : 'Esperando...'}
                        </p>
                      </div>
                    </div>
                    {player.isReady ? <CheckCircle2 className="text-emerald-500" size={32} /> : <CircleDashed className="text-slate-600 animate-spin-slow" size={32} />}
                  </div>
                );
              }

              // Slot Vacío
              return (
                <div key={`empty-${index}`} className="p-6 rounded-2xl border-2 border-dashed border-slate-700 bg-slate-900/30 flex items-center justify-center text-slate-600 h-[100px] shadow-inner">
                  <p className="font-medium tracking-wide">Esperando jugador...</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Área de Acción (Botón de Listo) */}
        <div className="bg-slate-800/80 p-8 rounded-2xl border border-slate-700 text-center shadow-xl backdrop-blur-sm">
          {allReady ? (
            <div className="animate-in zoom-in duration-300">
              <p className="text-3xl font-black text-emerald-400 mb-2 tracking-tight">¡Todos están listos!</p>
              <p className="text-slate-400 font-medium">Preparando el Sprint 3 (Selección de equipos)...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-5">
              <p className="text-slate-400 font-medium">
                {players.length < 4 ? 'Faltan jugadores para poder iniciar la partida.' : 'Esperando a que todos presionen el botón de Listo.'}
              </p>
              <button 
                onClick={toggleReady}
                className={`w-full max-w-sm py-4 rounded-xl font-black tracking-widest transition-all duration-300 hover:scale-105 active:scale-95 text-lg shadow-2xl ${isReady ? 'bg-slate-700 text-white hover:bg-slate-600 border border-slate-600' : 'bg-emerald-500 text-slate-900 hover:bg-emerald-400 shadow-emerald-900/50'}`}
              >
                {isReady ? 'CANCELAR LISTO' : '¡ESTOY LISTO!'}
              </button>
            </div>
          )}
        </div>

      </div>
    </main>
  );
}