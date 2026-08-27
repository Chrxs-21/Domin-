'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { User } from '@supabase/supabase-js';
import { Users, CheckCircle2, CircleDashed, Copy, ArrowLeft, Timer, Swords, Shield } from 'lucide-react';
import GameBoard from '@/components/GameBoard';

type PlayerState = {
  id: string;
  name: string;
  isReady: boolean;
  joinedAt: string;
  team: 1 | 2 | null;
  vote?: 'DOUBLE_6' | 'HIGHEST' | null;
};

export default function RoomPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const roomCode = resolvedParams.id;
  
  const router = useRouter();
  const supabase = createClient();
  
  const [user, setUser] = useState<User | null>(null);
  const [players, setPlayers] = useState<PlayerState[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [channel, setChannel] = useState<any>(null);
  
  // Estados del Sprint 3 (Selección de Equipos)
  const [phase, setPhase] = useState<'LOBBY' | 'TEAMS' | 'GAME'>('LOBBY');
  const [timeLeft, setTimeLeft] = useState(30);
  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => {
    let roomChannel: any = null;

    const initRoom = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.push('/');
        return;
      }
      setUser(data.user);
      
      const shortId = data.user.id.substring(0, 4).toUpperCase();
      const userName = data.user.is_anonymous ? `Invitado-${shortId}` : (data.user.user_metadata?.full_name || 'Jugador');
      const uid = data.user.id;
      
        // Limpiar el canal previo si existe (previene error de Strict Mode en React)
        supabase.getChannels().forEach(c => {
          if (c.topic === `realtime:room:${roomCode}`) {
            supabase.removeChannel(c);
          }
        });

        roomChannel = supabase.channel(`room:${roomCode}`, {
          config: { presence: { key: uid } }
        });

      roomChannel
        .on('presence', { event: 'sync' }, () => {
          const state = roomChannel.presenceState();
          const currentPlayers: PlayerState[] = [];
          
          for (const key in state) {
            const presences = state[key] as PlayerState[];
            // Evitamos "fantasmas" de Strict Mode tomando siempre la presencia más avanzada
            const activePresence = presences.find(p => p.vote) 
                                || presences.find(p => p.team !== null) 
                                || presences.find(p => p.isReady) 
                                || presences[0];
            currentPlayers.push(activePresence);
          }
          
          currentPlayers.sort((a, b) => new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime());
          setPlayers(currentPlayers);
        })
        .subscribe(async (status: string) => {
          if (status === 'SUBSCRIBED') {
            await roomChannel.track({
              id: uid,
              name: userName,
              isReady: false,
              joinedAt: new Date().toISOString(),
              team: null,
            });
          }
        });

      setChannel(roomChannel);
    };

    initRoom();

    return () => {
      if (roomChannel) supabase.removeChannel(roomChannel);
    };
  }, [roomCode, router, supabase]);

  // Efecto para transicionar entre LOBBY y TEAMS
  const maxPlayers = 4;
  const allReady = players.length === maxPlayers && players.every(p => p.isReady);

  useEffect(() => {
    if (allReady && phase === 'LOBBY') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPhase('TEAMS');
      setTimeLeft(30);
      setCountdown(null);
    } else if (!allReady && phase !== 'LOBBY') {
      // Si alguien se desconecta o quita el 'Listo', volvemos al Lobby
      setPhase('LOBBY');
    }
  }, [allReady, phase]);

  // Lógica de temporizadores para TEAMS
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (phase === 'TEAMS') {
      const team1Count = players.filter(p => p.team === 1).length;
      const team2Count = players.filter(p => p.team === 2).length;
      const teamsFull = team1Count === 2 && team2Count === 2;

      if (teamsFull) {
        // Conteo regresivo final de 5s
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (countdown === null) setCountdown(5);
        interval = setInterval(() => {
          setCountdown(prev => {
            if (prev !== null && prev > 1) return prev - 1;
            if (prev === 1) setPhase('GAME'); // Transición al Sprint 4
            return 0;
          });
        }, 1000);
      } else {
        // Temporizador de selección de 30s
        setCountdown(null);
        interval = setInterval(() => {
          setTimeLeft(prev => {
            if (prev > 1) return prev - 1;
            return 0; // Cuando llega a 0, se activa la auto-asignación
          });
        }, 1000);
      }
    }
    
    return () => clearInterval(interval);
  }, [phase, players, countdown]);

  // Auto-asignación si el tiempo de 30s se acaba
  useEffect(() => {
    if (phase === 'TEAMS' && timeLeft === 0 && user && channel) {
      const myIndex = players.findIndex(p => p.id === user.id);
      const assignedTeam = myIndex < 2 ? 1 : 2; // Jugador 0 y 1 al Equipo 1, Jugador 2 y 3 al Equipo 2
      const myState = players.find(p => p.id === user.id);
      
      if (myState && myState.team !== assignedTeam) {
        channel.track({ ...myState, team: assignedTeam });
      }
    }
  }, [timeLeft, phase, players, user, channel]);

  const toggleReady = async () => {
    if (!channel || !user) return;
    const newReadyState = !isReady;
    setIsReady(newReadyState);
    const currentUserState = players.find(p => p.id === user.id);
    await channel.track({ ...currentUserState, isReady: newReadyState });
  };

  const selectTeam = async (teamNumber: 1 | 2) => {
    if (!channel || !user || phase !== 'TEAMS') return;
    
    // Evitar unirse si el equipo ya tiene 2 personas
    const teamCount = players.filter(p => p.team === teamNumber).length;
    if (teamCount >= 2) return;

    const currentUserState = players.find(p => p.id === user.id);
    await channel.track({ ...currentUserState, team: teamNumber });
  };

  const copyCode = () => {
    navigator.clipboard.writeText(roomCode);
  };

  // --- RENDERIZADO DEL JUEGO (SPRINT 4) ---
  if (phase === 'GAME') {
    if (!channel || !user) return null;
    return (
      <main className="min-h-screen bg-slate-950 flex flex-col p-4 md:p-8">
        {/* Cabecera Pequeña */}
        <div className="flex items-center justify-between mb-4 px-4">
          <button onClick={() => router.push('/')} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div className="text-right">
            <p className="text-xs text-emerald-400 font-bold uppercase tracking-widest">Sala Activa</p>
            <p className="text-lg font-black font-mono tracking-widest text-slate-300">{roomCode}</p>
          </div>
        </div>
        
        {/* Mesa de Juego */}
        <GameBoard channel={channel} user={user} players={players} roomCode={roomCode} />
      </main>
    );
  }

  // --- RENDERIZADO DEL LOBBY / TEAMS ---
  return (
    <main className="min-h-screen bg-slate-900 text-white flex flex-col p-4 md:p-8 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-800 to-slate-950">
      <div className="max-w-4xl w-full mx-auto">
        
        {/* Cabecera Compartida */}
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

        {/* --- PANTALLA: LOBBY --- */}
        {phase === 'LOBBY' && (
          <div className="animate-in fade-in duration-500">
            <div className="flex items-center justify-between mb-4 px-2">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Users className="text-emerald-500" />
                Lobby
              </h2>
              <span className="bg-slate-800 text-emerald-400 px-4 py-1.5 rounded-full text-sm font-bold border border-emerald-900/50">
                {players.length} / {maxPlayers} JUGADORES
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
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
                return (
                  <div key={`empty-${index}`} className="p-6 rounded-2xl border-2 border-dashed border-slate-700 bg-slate-900/30 flex items-center justify-center text-slate-600 h-[100px] shadow-inner">
                    <p className="font-medium tracking-wide">Esperando jugador...</p>
                  </div>
                );
              })}
            </div>

            <div className="bg-slate-800/80 p-8 rounded-2xl border border-slate-700 text-center shadow-xl backdrop-blur-sm">
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
            </div>
          </div>
        )}

        {/* --- PANTALLA: SELECCIÓN DE EQUIPOS --- */}
        {phase === 'TEAMS' && (
          <div className="animate-in slide-in-from-bottom-8 duration-500">
            
            {/* Temporizador Central */}
            <div className="flex flex-col items-center mb-8">
              <div className="bg-slate-800 border-2 border-slate-600 rounded-full px-6 py-2 flex items-center gap-3 shadow-lg">
                <Timer className={timeLeft <= 10 ? 'text-red-500 animate-pulse' : 'text-emerald-500'} size={24} />
                <span className="text-xl font-mono font-bold tracking-widest">
                  {countdown !== null ? 'INICIANDO...' : `00:${timeLeft.toString().padStart(2, '0')}`}
                </span>
              </div>
              <p className="text-slate-400 text-sm mt-3 uppercase tracking-widest font-bold">Formen sus Equipos</p>
            </div>

            {/* Columnas de Equipos */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative">
              
              {/* Overlay Conteo Regresivo 5s */}
              {countdown !== null && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md animate-in fade-in zoom-in-95 duration-300">
                  <div className="text-center flex flex-col items-center">
                    <p className="text-3xl md:text-5xl text-emerald-400 font-black tracking-widest mb-2 drop-shadow-lg">LA PARTIDA INICIA EN</p>
                    <p className="text-[10rem] md:text-[15rem] leading-none font-black font-mono text-white animate-pulse drop-shadow-[0_0_40px_rgba(16,185,129,0.4)]">{countdown}</p>
                  </div>
                </div>
              )}

              {/* Equipo 1 */}
              <div className="bg-blue-900/20 border border-blue-500/30 rounded-3xl p-6 flex flex-col items-center relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <Shield size={120} />
                </div>
                <h3 className="text-2xl font-black text-blue-400 mb-6 flex items-center gap-2">EQUIPO 1</h3>
                
                <div className="w-full space-y-3 mb-6 z-10">
                  {Array.from({ length: 2 }).map((_, i) => {
                    const teamPlayers = players.filter(p => p.team === 1);
                    const player = teamPlayers[i];
                    return (
                      <div key={i} className="h-16 bg-blue-950/50 border border-blue-800/50 rounded-xl flex items-center px-4">
                        {player ? (
                          <div className="flex items-center gap-3 w-full animate-in zoom-in duration-300">
                            <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-xs font-bold shadow-lg">
                              {player.name.substring(0, 2).toUpperCase()}
                            </div>
                            <span className="font-bold text-blue-100 flex-1 truncate">{player.name}</span>
                            {player.id === user?.id && <span className="text-xs bg-blue-500 text-white px-2 py-1 rounded-md font-bold">TÚ</span>}
                          </div>
                        ) : (
                          <span className="text-blue-500/50 font-medium italic">Libre...</span>
                        )}
                      </div>
                    );
                  })}
                </div>

                <button 
                  onClick={() => selectTeam(1)}
                  disabled={players.filter(p => p.team === 1).length >= 2 || countdown !== null}
                  className="w-full py-4 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-xl font-bold tracking-widest transition-all z-10 shadow-lg shadow-blue-900/50"
                >
                  UNIRSE AL EQUIPO 1
                </button>
              </div>

              {/* Equipo 2 */}
              <div className="bg-orange-900/20 border border-orange-500/30 rounded-3xl p-6 flex flex-col items-center relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <Shield size={120} />
                </div>
                <h3 className="text-2xl font-black text-orange-400 mb-6 flex items-center gap-2">EQUIPO 2</h3>
                
                <div className="w-full space-y-3 mb-6 z-10">
                  {Array.from({ length: 2 }).map((_, i) => {
                    const teamPlayers = players.filter(p => p.team === 2);
                    const player = teamPlayers[i];
                    return (
                      <div key={i} className="h-16 bg-orange-950/50 border border-orange-800/50 rounded-xl flex items-center px-4">
                        {player ? (
                          <div className="flex items-center gap-3 w-full animate-in zoom-in duration-300">
                            <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-xs font-bold shadow-lg">
                              {player.name.substring(0, 2).toUpperCase()}
                            </div>
                            <span className="font-bold text-orange-100 flex-1 truncate">{player.name}</span>
                            {player.id === user?.id && <span className="text-xs bg-orange-500 text-white px-2 py-1 rounded-md font-bold">TÚ</span>}
                          </div>
                        ) : (
                          <span className="text-orange-500/50 font-medium italic">Libre...</span>
                        )}
                      </div>
                    );
                  })}
                </div>

                <button 
                  onClick={() => selectTeam(2)}
                  disabled={players.filter(p => p.team === 2).length >= 2 || countdown !== null}
                  className="w-full py-4 bg-orange-600 hover:bg-orange-500 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-xl font-bold tracking-widest transition-all z-10 shadow-lg shadow-orange-900/50"
                >
                  UNIRSE AL EQUIPO 2
                </button>
              </div>

            </div>
          </div>
        )}

      </div>
    </main>
  );
}
