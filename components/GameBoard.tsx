'use client';

import { useEffect, useState, useRef } from 'react';
import { User } from '@supabase/supabase-js';
import { Howl } from 'howler';
import { motion, AnimatePresence } from 'motion/react';
import { Dices, Timer as TimerIcon } from 'lucide-react';
import Matter from 'matter-js';
import { createClient } from '@/lib/supabase/client';

type PlayerState = {
  id: string;
  name: string;
  isReady: boolean;
  joinedAt: string;
  team: 1 | 2 | null;
  vote?: 'DOUBLE_6' | 'HIGHEST' | null;
};

type GameBoardProps = {
  channel: any;
  user: User;
  players: PlayerState[];
  roomCode: string;
};

export default function GameBoard({ channel, user, players, roomCode }: GameBoardProps) {
  const [step, setStep] = useState<'VOTING' | 'TIE_BREAKER' | 'SHUFFLING' | 'DEALING'>('VOTING');
  const [tieBreakerResult, setTieBreakerResult] = useState<'DOUBLE_6' | 'HIGHEST' | null>(null);
  const [shuffleTimeLeft, setShuffleTimeLeft] = useState(10);
  const [votingTimeLeft, setVotingTimeLeft] = useState(15);
  
  const shuffleSound = useRef<Howl | null>(null);
  const lastClackTime = useRef<number>(0);
  const lastBroadcastTime = useRef<number>(0);
  const hasResolvedVoting = useRef(false);

  const [gameChannel, setGameChannel] = useState<any>(null);

  const sceneRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Matter.Engine | null>(null);
  const runnerRef = useRef<Matter.Runner | null>(null);
  const handBodyRef = useRef<Matter.Body | null>(null);
  const isPressing = useRef(false);
  const dominoRefs = useRef<(HTMLDivElement | null)[]>([]);

  const sortedPlayers = [...players].sort((a, b) => new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime());
  const hostId = sortedPlayers.length > 0 ? sortedPlayers[0].id : '';
  const amIHost = user.id === hostId;

  useEffect(() => {
    const supabase = createClient();
    
    supabase.getChannels().forEach(c => {
      if (c.topic === `realtime:game:${roomCode}`) {
        supabase.removeChannel(c);
      }
    });

    const newGameChannel = supabase.channel(`game:${roomCode}`, {
      config: {
        broadcast: { self: true }
      }
    });

    const handleTieBreaker = (payload: any) => {
      setStep('TIE_BREAKER');
      setTimeout(() => {
        setTieBreakerResult(payload.payload.result);
        setTimeout(() => setStep('SHUFFLING'), 3000); 
      }, 2000);
    };

    const handleStartShuffling = () => {
      setStep('SHUFFLING');
      setShuffleTimeLeft(10);
    };

    const handleSyncDominoes = (payload: any) => {
      if (amIHost) return; 
      
      payload.payload.forEach((d: { x: number, y: number, a: number }, index: number) => {
        const el = dominoRefs.current[index];
        if (el) {
          const x = d.x - 15;
          const y = d.y - 30;
          el.style.transform = `translate(${x}px, ${y}px) rotate(${d.a}rad)`;
        }
      });
    };

    const handleEndShuffle = () => {
      setStep('DEALING');
    };

    newGameChannel
      .on('broadcast', { event: 'TIE_BREAKER' }, handleTieBreaker)
      .on('broadcast', { event: 'START_SHUFFLING' }, handleStartShuffling)
      .on('broadcast', { event: 'SYNC_DOMINOES' }, handleSyncDominoes)
      .on('broadcast', { event: 'END_SHUFFLE' }, handleEndShuffle)
      .subscribe();

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGameChannel(newGameChannel);

    return () => {
      supabase.removeChannel(newGameChannel);
    };
  }, [roomCode, amIHost]);

  useEffect(() => {
    if (step === 'VOTING') {
      const int = setInterval(() => {
        setVotingTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(int);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(int);
    }
  }, [step]);

  useEffect(() => {
    if (step === 'SHUFFLING' && amIHost && gameChannel) {
      const int = setInterval(() => {
        setShuffleTimeLeft((prev) => {
          if (prev <= 1) {
            gameChannel.send({ type: 'broadcast', event: 'END_SHUFFLE' });
            clearInterval(int);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(int);
    }
  }, [step, amIHost, gameChannel]);

  useEffect(() => {
    shuffleSound.current = new Howl({
      src: ['https://assets.mixkit.co/active_storage/sfx/2003/2003-preview.mp3'], 
      volume: 0.3,
      rate: 1.5,
    });
    return () => {
      if (shuffleSound.current) shuffleSound.current.unload();
    };
  }, []);

  const playClack = () => {
    const now = Date.now();
    if (shuffleSound.current && now - lastClackTime.current > 80) { 
      shuffleSound.current.play();
      lastClackTime.current = now;
    }
  };

  useEffect(() => {
    if (step !== 'SHUFFLING' || !amIHost || !sceneRef.current || !gameChannel) return;

    const { Engine, Render, Runner, World, Bodies, Events } = Matter;
    
    const engine = Engine.create();
    engine.gravity.y = 0; 
    engine.gravity.x = 0;
    engineRef.current = engine;

    const width = sceneRef.current.clientWidth;
    const height = sceneRef.current.clientHeight;

    const wallOptions = { isStatic: true, restitution: 0.9, friction: 0 };
    const walls = [
      Bodies.rectangle(width / 2, -20, width, 40, wallOptions),
      Bodies.rectangle(width / 2, height + 20, width, 40, wallOptions),
      Bodies.rectangle(-20, height / 2, 40, height, wallOptions),
      Bodies.rectangle(width + 20, height / 2, 40, height, wallOptions)
    ];

    const dominoes = Array.from({ length: 28 }).map((_, i) => {
      const x = (width / 2) + (Math.random() - 0.5) * 100; 
      const y = (height / 2) + (Math.random() - 0.5) * 100;
      
      return Bodies.rectangle(x, y, 30, 60, {
        restitution: 0.2,    
        friction: 0.8,       
        frictionAir: 0.08,   
        density: 0.05,       
        angle: Math.random() * Math.PI * 2,
        label: `domino-${i}`
      });
    });

    const hand = Bodies.circle(-1000, -1000, 20, {
      isStatic: true, 
      friction: 0.8,
      restitution: 0.5,
      label: 'hand'
    });
    handBodyRef.current = hand;

    World.add(engine.world, [...walls, ...dominoes, hand]);

    Events.on(engine, 'collisionStart', (event) => {
      const pairs = event.pairs;
      let shouldPlay = false;
      for (let i = 0; i < pairs.length; i++) {
        if (pairs[i].bodyA.label.includes('domino') || pairs[i].bodyB.label.includes('domino')) {
          shouldPlay = true; break;
        }
      }
      if (shouldPlay) playClack();
    });

    Events.on(engine, 'afterUpdate', () => {
      const now = Date.now();

      dominoes.forEach((body, index) => {
        const el = dominoRefs.current[index];
        if (el) {
          const x = body.position.x - 15;
          const y = body.position.y - 30;
          el.style.transform = `translate(${x}px, ${y}px) rotate(${body.angle}rad)`;
        }
      });

      if (now - lastBroadcastTime.current > 66) {
        const payload = dominoes.map(d => ({
          x: Math.round(d.position.x),
          y: Math.round(d.position.y),
          a: Number(d.angle.toFixed(2)) 
        }));
        
        gameChannel.send({ type: 'broadcast', event: 'SYNC_DOMINOES', payload });
        lastBroadcastTime.current = now;
      }
    });

    const runner = Runner.create();
    runnerRef.current = runner;
    Runner.run(runner, engine);

    return () => {
      Runner.stop(runner);
      Engine.clear(engine);
    };
  }, [step, amIHost, gameChannel]);

  const updateHandPosition = (e: React.PointerEvent) => {
    if (!amIHost || !isPressing.current || !handBodyRef.current || !sceneRef.current) return;
    const rect = sceneRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    Matter.Body.setPosition(handBodyRef.current, { x, y });
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!amIHost) return;
    isPressing.current = true;
    updateHandPosition(e);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    updateHandPosition(e);
  };

  const handlePointerUp = () => {
    isPressing.current = false;
    if (handBodyRef.current) Matter.Body.setPosition(handBodyRef.current, { x: -1000, y: -1000 });
  };

  const myState = players.find(p => p.id === user.id);
  const partner = players.find(p => p.team === myState?.team && p.id !== user.id);
  const enemies = players.filter(p => p.team !== myState?.team);

  const double6Votes = players.filter(p => p.vote === 'DOUBLE_6').length;
  const highestVotes = players.filter(p => p.vote === 'HIGHEST').length;
  const totalVotes = double6Votes + highestVotes;

  useEffect(() => {
    if (step === 'VOTING' && amIHost && gameChannel) {
      if (totalVotes === 4 || votingTimeLeft === 0) {
        if (hasResolvedVoting.current) return;
        hasResolvedVoting.current = true;

        if (double6Votes > highestVotes) {
          gameChannel.send({ type: 'broadcast', event: 'START_SHUFFLING', payload: {} });
        } else if (highestVotes > double6Votes) {
          gameChannel.send({ type: 'broadcast', event: 'START_SHUFFLING', payload: {} });
        } else {
          const result = Math.random() > 0.5 ? 'DOUBLE_6' : 'HIGHEST';
          gameChannel.send({ type: 'broadcast', event: 'TIE_BREAKER', payload: { result } });
        }
      }
    }
  }, [totalVotes, votingTimeLeft, step, amIHost, gameChannel, double6Votes, highestVotes]);

  const handleVote = async (choice: 'DOUBLE_6' | 'HIGHEST') => {
    if (!channel || !myState || myState.vote || votingTimeLeft === 0) return; 
    await channel.track({ ...myState, vote: choice });
  };

  return (
    <div className="w-full h-[calc(100vh-120px)] bg-slate-900 rounded-3xl border-4 border-slate-700 shadow-2xl overflow-hidden relative flex items-center justify-center">
      
      {/* Mesa Verde Top-Down */}
      <div 
        ref={sceneRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        className={`absolute inset-4 bg-emerald-800 rounded-[3rem] border-8 border-emerald-950 shadow-inner overflow-hidden ${step === 'SHUFFLING' ? (amIHost ? 'touch-none cursor-grab active:cursor-grabbing' : 'pointer-events-none') : ''}`}
      >
        
        {/* Nombres de Jugadores */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-slate-900/80 px-6 py-2 rounded-full border border-slate-600 text-white font-bold tracking-widest z-10 shadow-lg pointer-events-none whitespace-nowrap">
          {myState?.name} (TÚ)
        </div>
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-slate-900/80 px-6 py-2 rounded-full border border-slate-600 text-slate-300 font-bold tracking-widest z-10 shadow-lg pointer-events-none whitespace-nowrap">
          {partner?.name || 'COMPAÑERO'}
        </div>
        <div className="absolute left-[-50px] top-1/2 -translate-y-1/2 -rotate-90 bg-slate-900/80 px-6 py-2 rounded-full border border-slate-600 text-red-300 font-bold tracking-widest z-10 shadow-lg pointer-events-none whitespace-nowrap">
          {enemies[0]?.name || 'RIVAL 1'}
        </div>
        <div className="absolute right-[-50px] top-1/2 -translate-y-1/2 rotate-90 bg-slate-900/80 px-6 py-2 rounded-full border border-slate-600 text-red-300 font-bold tracking-widest z-10 shadow-lg pointer-events-none whitespace-nowrap">
          {enemies[1]?.name || 'RIVAL 2'}
        </div>

        {/* Modal de Votación */}
        <AnimatePresence>
          {(step === 'VOTING' || step === 'TIE_BREAKER') && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.1, filter: 'blur(10px)' }}
              className="absolute z-40 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-slate-900/95 p-8 rounded-3xl border border-slate-700 shadow-2xl max-w-md w-[90%] text-center backdrop-blur-md"
            >
              {step === 'VOTING' ? (
                <>
                  <h2 className="text-2xl font-black text-white mb-6 uppercase tracking-widest">¿Cómo sale el primer jugador?</h2>
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <button 
                      onClick={() => handleVote('DOUBLE_6')}
                      disabled={!!myState?.vote || votingTimeLeft === 0}
                      className={`p-4 rounded-xl border-2 transition-all font-bold flex flex-col items-center ${myState?.vote === 'DOUBLE_6' ? 'bg-emerald-600 border-emerald-400 text-white' : 'bg-slate-800 border-slate-600 hover:border-emerald-500 text-slate-300'}`}
                    >
                      Doble 6
                      {double6Votes > 0 && (
                        <span className="mt-2 text-xs bg-slate-900/50 py-1 px-3 rounded-full text-emerald-400">
                          {double6Votes} VOTO(S)
                        </span>
                      )}
                    </button>
                    <button 
                      onClick={() => handleVote('HIGHEST')}
                      disabled={!!myState?.vote || votingTimeLeft === 0}
                      className={`p-4 rounded-xl border-2 transition-all font-bold flex flex-col items-center ${myState?.vote === 'HIGHEST' ? 'bg-emerald-600 border-emerald-400 text-white' : 'bg-slate-800 border-slate-600 hover:border-emerald-500 text-slate-300'}`}
                    >
                      Piedra más alta
                      {highestVotes > 0 && (
                        <span className="mt-2 text-xs bg-slate-900/50 py-1 px-3 rounded-full text-emerald-400">
                          {highestVotes} VOTO(S)
                        </span>
                      )}
                    </button>
                  </div>
                  
                  <div className="flex flex-col items-center justify-center gap-2 mt-4">
                    <div className="bg-slate-800 px-4 py-2 rounded-full border border-slate-600 flex items-center gap-2">
                      <TimerIcon size={18} className={votingTimeLeft <= 5 ? 'text-red-500 animate-pulse' : 'text-emerald-500'} />
                      <span className="text-slate-200 font-mono font-bold">{votingTimeLeft}s</span>
                    </div>
                    <p className="text-slate-400 text-xs font-bold tracking-widest">VOTOS REGISTRADOS: {totalVotes}/4</p>
                  </div>
                </>
              ) : (
                <div className="py-8">
                  <Dices size={48} className="mx-auto mb-4 text-emerald-500 animate-spin" />
                  <h2 className="text-2xl font-black text-white mb-2 uppercase tracking-widest">¡RESOLVIENDO!</h2>
                  <p className="text-slate-400 mb-6">La máquina está decidiendo...</p>
                  
                  <div className="h-20 bg-slate-950 rounded-xl border-2 border-slate-700 flex items-center justify-center overflow-hidden relative">
                    {tieBreakerResult ? (
                      <motion.div 
                        initial={{ y: 50, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        className="text-2xl font-bold text-emerald-400 uppercase tracking-widest"
                      >
                        {tieBreakerResult === 'DOUBLE_6' ? '¡DOBLE 6!' : '¡PIEDRA MÁS ALTA!'}
                      </motion.div>
                    ) : (
                      <div className="text-3xl font-mono text-slate-500 blur-[2px] animate-pulse">
                        ??? ??? ???
                      </div>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Fase de Barajeo (SHUFFLING) */}
        {step === 'SHUFFLING' && (
          <>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full pointer-events-none flex flex-col items-center justify-center opacity-30">
              <p className="text-4xl md:text-5xl font-black text-emerald-950 uppercase tracking-widest rotate-[-15deg] select-none text-center mb-8">
                {amIHost ? '¡BARAJEA LAS FICHAS!' : `ESPERANDO A ${sortedPlayers[0]?.name.toUpperCase()}`}
              </p>
              
              <div className="flex items-center gap-4 rotate-[-15deg]">
                <TimerIcon size={48} className="text-emerald-950" />
                <span className="text-6xl font-mono font-black text-emerald-950">{shuffleTimeLeft}s</span>
              </div>
            </div>
            
            {Array.from({ length: 28 }).map((_, i) => (
              <div
                key={i}
                ref={(el) => { dominoRefs.current[i] = el; }}
                style={{ transition: amIHost ? 'none' : 'transform 0.08s linear' }}
                className="absolute top-0 left-0 w-[30px] h-[60px] bg-slate-100 rounded-md border-2 border-slate-400 shadow-[0_4px_6px_rgba(0,0,0,0.5)] flex items-center justify-center pointer-events-none will-change-transform"
              >
                <div className="w-2 h-2 rounded-full bg-slate-300 shadow-inner"></div>
              </div>
            ))}
          </>
        )}

        {/* Fase de Repartición (Siguiente Sprint) */}
        {step === 'DEALING' && (
          <div className="absolute inset-0 bg-slate-900/90 flex flex-col items-center justify-center z-50">
             <Dices size={64} className="text-emerald-500 animate-bounce mb-6" />
             <h2 className="text-4xl font-black text-white tracking-widest text-center">REPARTIENDO FICHAS...</h2>
             <p className="text-emerald-400 mt-4 font-mono">(Fin del Sprint 4)</p>
          </div>
        )}

      </div>
    </div>
  );
}
