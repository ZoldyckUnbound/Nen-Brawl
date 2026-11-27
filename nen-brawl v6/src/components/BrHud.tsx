import { useEffect, useRef, useState } from 'react';
import type { Game, HudState } from '../game/Game';
import { CARDS, RANK_COLOR, RANK_NAME, POIS } from '../game/br/data';
import type { BrHudState } from '../game/br/mode';

const fmtT = (s: number) => `${String(Math.floor(Math.max(0, s) / 60)).padStart(2, '0')}:${String(Math.floor(Math.max(0, s) % 60)).padStart(2, '0')}`;
const MARK: Record<string, string> = { ally: '#7dff9a', enemy: '#ff5a5a', trace: '#ff2a2a', beacon: '#ffd24a', drop: '#ffd24a', boss: '#ff6a3a', npc: '#6ad0ff', chest: '#ffd24a', loot: '#ffffff' };

function MapCanvas({ br, game, size, big }: { br: BrHudState; game: Game; size: number; big: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    const src = game.br?.world.mapCanvas;
    if (!cv || !src) return;
    const ctx = cv.getContext('2d')!;
    const S = size, W = game.br!.world.mapW;
    const view = big ? W : 2600;
    const cx = big ? 0 : br.mini.x, cz = big ? 0 : br.mini.z;
    const k = S / view;
    const X = (x: number) => (x - cx) * k + S / 2;
    const Y = (z: number) => (z - cz) * k + S / 2;
    ctx.clearRect(0, 0, S, S);
    ctx.save();
    if (!big) { ctx.beginPath(); ctx.arc(S / 2, S / 2, S / 2, 0, 6.2832); ctx.clip(); }
    ctx.fillStyle = '#17324a';
    ctx.fillRect(0, 0, S, S);
    const sp = src.width / W;
    const sx = (cx - view / 2 + W / 2) * sp, sy = (cz - view / 2 + W / 2) * sp, sw = view * sp;
    // clamp the source rect so the draw never exceeds the canvas
    const x0 = Math.max(0, sx), y0 = Math.max(0, sy), x1 = Math.min(src.width, sx + sw), y1 = Math.min(src.height, sy + sw);
    if (x1 > x0 && y1 > y0) ctx.drawImage(src, x0, y0, x1 - x0, y1 - y0, ((x0 - sx) / sw) * S, ((y0 - sy) / sw) * S, ((x1 - x0) / sw) * S, ((y1 - y0) / sw) * S);
    // outside the barrier
    ctx.beginPath();
    ctx.rect(0, 0, S, S);
    ctx.arc(X(0), Y(0), Math.max(0.1, br.mini.safeR * k), 0, 6.2832, true);
    ctx.fillStyle = 'rgba(120,40,200,0.42)';
    ctx.fill('evenodd');
    ctx.lineWidth = big ? 3 : 2;
    ctx.strokeStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(X(0), Y(0), Math.max(0.1, br.mini.safeR * k), 0, 6.2832); ctx.stroke();
    if (br.mini.nextR < br.mini.safeR - 1) { ctx.setLineDash([6, 5]); ctx.strokeStyle = '#ffd24a'; ctx.beginPath(); ctx.arc(X(0), Y(0), Math.max(0.1, br.mini.nextR * k), 0, 6.2832); ctx.stroke(); ctx.setLineDash([]); }
    // towns
    ctx.font = `bold ${big ? 12 : 9}px system-ui`;
    ctx.textAlign = 'center';
    for (const p of POIS) {
      const x = X(p.x), y = Y(p.z);
      if (x < -20 || y < -20 || x > S + 20 || y > S + 20) continue;
      if (!big && p.tier < 2 && Math.hypot(p.x - cx, p.z - cz) > 1500) continue;
      ctx.fillStyle = 'rgba(0,0,0,.55)';
      ctx.beginPath(); ctx.arc(x, y, big ? 10 : 7, 0, 6.2832); ctx.fill();
      ctx.font = `${big ? 13 : 9}px system-ui`;
      ctx.fillStyle = '#fff';
      ctx.fillText(p.icon, x, y + (big ? 4.5 : 3.2));
      if (big) { ctx.font = 'bold 11px system-ui'; ctx.lineWidth = 3; ctx.strokeStyle = '#000'; ctx.strokeText(p.name, x, y + 22); ctx.fillStyle = '#fff'; ctx.fillText(p.name, x, y + 22); }
    }
    for (const m of br.mini.marks) {
      const x = X(m.x), y = Y(m.z);
      if (x < 0 || y < 0 || x > S || y > S) continue;
      if (m.t === 'npc' && !big) continue;
      const r = m.t === 'loot' ? 1.8 : m.t === 'chest' ? 2.6 : m.t === 'trace' || m.t === 'boss' || m.t === 'drop' ? 5 : big ? 4.5 : 3.4;
      ctx.fillStyle = MARK[m.t] ?? '#fff';
      ctx.strokeStyle = '#000'; ctx.lineWidth = 1;
      ctx.beginPath();
      if (m.t === 'beacon' || m.t === 'drop') { ctx.moveTo(x, y - r - 1); ctx.lineTo(x + r + 1, y); ctx.lineTo(x, y + r + 1); ctx.lineTo(x - r - 1, y); ctx.closePath(); } else ctx.arc(x, y, r, 0, 6.2832);
      ctx.fill(); if (r > 3) ctx.stroke();
      if (big && m.label && m.t !== 'npc' && m.t !== 'loot' && m.t !== 'chest') { ctx.font = 'bold 10px system-ui'; ctx.fillStyle = '#fff'; ctx.lineWidth = 3; ctx.strokeStyle = '#000'; ctx.strokeText(m.label, x, y - 8); ctx.fillText(m.label, x, y - 8); }
    }
    // player arrow (camera direction)
    const px = X(br.mini.x), py = Y(br.mini.z), a = br.mini.yaw;
    ctx.save(); ctx.translate(px, py); ctx.rotate(Math.atan2(Math.sin(a), -Math.cos(a)) + Math.PI / 2 - Math.PI / 2);
    ctx.rotate(0);
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(Math.sin(a) * 9, Math.cos(a) * 9); ctx.lineTo(Math.sin(a + 2.5) * 6, Math.cos(a + 2.5) * 6); ctx.lineTo(Math.sin(a - 2.5) * 6, Math.cos(a - 2.5) * 6); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
    ctx.restore();
  });
  return <canvas ref={ref} width={size} height={size} className="block" style={{ width: size, height: size }} />;
}

function CardTile({ id, n = 1, sel, onClick, empty, no }: { id?: string; n?: number; sel?: boolean; onClick?: () => void; empty?: boolean; no?: number }) {
  const c = id ? CARDS[id] : null;
  if (!c || empty) return <div className="grid aspect-[5/7] place-items-center rounded-md border border-white/10 bg-white/[0.03] text-[9px] font-black text-white/20">{String(no ?? 0).padStart(3, '0')}</div>;
  const col = RANK_COLOR[c.rank];
  return (
    <button onClick={onClick} className="relative aspect-[5/7] overflow-hidden rounded-md border text-center transition hover:-translate-y-0.5" style={{ borderColor: col, background: `linear-gradient(165deg, ${col}55, #0b0b16 72%)`, boxShadow: sel ? `0 0 14px ${col}, inset 0 0 10px ${col}55` : `0 0 5px ${col}44` }}>
      <div className="absolute left-0.5 top-0.5 rounded px-1 text-[8px] font-black text-black" style={{ background: col }}>{c.rank}</div>
      {n > 1 && <div className="absolute right-0.5 top-0.5 rounded bg-black/70 px-1 text-[8px] font-black">×{n}</div>}
      <div className="pt-3 text-[22px] leading-7 sm:text-[26px]">{c.icon}</div>
      <div className="px-0.5 text-[8px] font-extrabold leading-[9px] text-white/90 sm:text-[9px] sm:leading-[10px]">{c.name}</div>
    </button>
  );
}

function Binder({ game, br }: { game: Game; br: BrHudState }) {
  const [tab, setTab] = useState<'spell' | 'spec' | 'info'>('spell');
  const [sel, setSel] = useState<string | null>(null);
  const [tgt, setTgt] = useState<string>('');
  const card = sel ? CARDS[sel] : null;
  const owned = sel ? (sel[0] === 'p' ? br.spells.find((s) => s.id === sel)?.n : br.spec[sel]) ?? 0 : 0;
  const choose = (id: string) => { setSel(id); setTgt(''); };
  const need = card?.tgt ?? 'none';
  const targets = need === 'met' ? br.met.map((m) => ({ id: m.id, label: m.label, sub: m.sub })) : need === 'town' ? [...(card?.fx?.sp === 'accompany' && br.hasFriends ? [{ id: 'ally', label: 'Teammate', sub: 'fly to your squad' }] : []), ...br.towns.map((t) => ({ id: t.id, label: t.label, sub: 'visited town' }))] : [];
  const canUse = !!card && owned > 0 && card.type !== 'passive' && card.type !== 'collect' && (need === 'none' || need === 'enemy' || tgt !== '' || (card.fx?.sp === 'accompany'));
  const specIds = Object.keys(CARDS).filter((k) => k[0] === 's').sort();
  return (
    <div className="pointer-events-auto absolute bottom-1 right-1 top-1 z-30 flex w-[min(540px,97vw)] flex-col overflow-hidden rounded-2xl border border-yellow-300/60 bg-[#120c20]/90 shadow-[0_0_40px_rgba(255,200,60,.25)] backdrop-blur-md sm:bottom-2 sm:right-2 sm:top-2" onContextMenu={(e) => e.preventDefault()}>
      <div className="flex items-center justify-between border-b border-white/10 bg-gradient-to-r from-yellow-300/20 to-fuchsia-400/10 px-3 py-2">
        <div>
          <div className="text-[9px] font-black tracking-[0.4em] text-yellow-300">GREED ISLAND</div>
          <div className="text-lg font-black leading-5 tracking-widest">📖 CARD BINDER</div>
        </div>
        <div className="text-right text-[11px] font-black"><div className="text-yellow-300">{br.jenny.toLocaleString()} J</div><div className="text-white/50">collection {br.specCount}/101 · luck +{Math.round(br.luck * 100)}%</div></div>
        <button onClick={() => game.toggleBinder()} className="ml-2 grid h-8 w-8 place-items-center rounded-full border border-white/30 text-sm font-black hover:bg-white/10">✕</button>
      </div>
      <div className="grid grid-cols-3 gap-1 p-2 text-[10px] font-black tracking-widest">
        {([['spell', `🔮 FREE SLOTS ${br.spellCount}/18`], ['spec', `🃏 SPECIFIED ${br.specCount}/101`], ['info', '📜 MISSIONS']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className="rounded-lg border py-1.5 transition" style={{ borderColor: tab === k ? '#ffd23f' : 'rgba(255,255,255,.15)', background: tab === k ? 'rgba(255,210,63,.18)' : 'transparent' }}>{l}</button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2 [scrollbar-width:thin]">
        {card && (
          <div className="mb-2 flex gap-2 rounded-xl border p-2" style={{ borderColor: RANK_COLOR[card.rank] + 'aa', background: RANK_COLOR[card.rank] + '14' }}>
            <div className="w-[74px] shrink-0"><CardTile id={card.id} n={owned} sel /></div>
            <div className="min-w-0 flex-1 text-[12px] leading-4">
              <div className="flex items-center gap-1.5"><b className="text-[14px]">{card.name}</b><span className="rounded px-1 text-[9px] font-black text-black" style={{ background: RANK_COLOR[card.rank] }}>{card.rank} · {RANK_NAME[card.rank]}</span></div>
              <div className="text-[10px] text-white/45">No.{String(card.no).padStart(card.kind === 'spell' ? 4 : 3, '0')} · limit {card.limit} · {card.kind === 'spell' ? 'SPELL CARD' : card.type === 'passive' ? 'PASSIVE' : card.type === 'creature' ? 'CREATURE' : card.type === 'consume' ? 'CONSUMABLE' : 'COLLECTIBLE'}</div>
              <div className="mt-0.5 text-white/80">{card.desc}</div>
              {targets.length > 0 && (
                <div className="mt-1 flex max-h-[84px] flex-col gap-0.5 overflow-y-auto">
                  {targets.map((t) => (
                    <button key={t.id} onClick={() => setTgt(t.id)} className="rounded border px-1.5 py-0.5 text-left text-[11px]" style={{ borderColor: tgt === t.id ? '#ffd23f' : 'rgba(255,255,255,.15)', background: tgt === t.id ? 'rgba(255,210,63,.2)' : 'transparent' }}>{t.label} <span className="text-white/40">{t.sub}</span></button>
                  ))}
                </div>
              )}
              {need === 'met' && !targets.length && <div className="mt-1 text-[11px] text-red-300">You haven't met anyone yet — get within 45m of other players.</div>}
              {need === 'town' && !targets.length && <div className="mt-1 text-[11px] text-red-300">No visited towns yet.</div>}
              <button disabled={!canUse} onClick={() => { game.br?.useCard(card.id, tgt || undefined); }} className="mt-1.5 w-full rounded-lg py-1.5 text-[12px] font-black tracking-[0.2em] text-black transition disabled:opacity-30" style={{ background: `linear-gradient(135deg, ${RANK_COLOR[card.rank]}, #fff1b0)` }}>
                {card.type === 'passive' ? 'PASSIVE · ALWAYS ACTIVE' : card.type === 'collect' ? 'COLLECTIBLE · SELL AT A SHOP' : owned <= 0 ? 'NOT OWNED' : 'USE CARD'}
              </button>
            </div>
          </div>
        )}
        {tab === 'spell' && (
          br.spells.length ? (
            <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-6">{br.spells.map((s) => <CardTile key={s.id} id={s.id} n={s.n} sel={sel === s.id} onClick={() => choose(s.id)} />)}</div>
          ) : <div className="p-6 text-center text-sm text-white/50">No spell cards yet. Find them in chests and on the ground — or buy a pack in Masadora's Spell Card Shop (10,000 J).</div>
        )}
        {tab === 'spec' && (
          <div className="grid grid-cols-6 gap-1 sm:grid-cols-8">
            {specIds.map((id) => <CardTile key={id} id={id} n={br.spec[id] ?? 0} empty={!br.spec[id]} no={CARDS[id].no} sel={sel === id} onClick={() => choose(id)} />)}
          </div>
        )}
        {tab === 'info' && (
          <div className="space-y-2 p-1 text-[12px]">
            {br.quests.length === 0 && <div className="text-white/50">No active missions. Talk to Eta at the Shiso Tree, the Bounty Board in Antokiba, Biscuit in the Badlands, or the Sick Villagers.</div>}
            {br.quests.map((q) => (
              <div key={q.id} className="rounded-lg border border-yellow-300/40 bg-yellow-300/10 p-2"><b className="text-yellow-200">{q.title}</b><div className="text-white/75">{q.desc}</div><div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/15"><div className="h-full bg-yellow-300" style={{ width: `${(q.prog / q.goal) * 100}%` }} /></div><div className="text-[10px] text-white/50">{q.prog}/{q.goal} · reward: {q.reward}</div></div>
            ))}
            <div className="rounded-lg border border-white/10 bg-white/5 p-2 text-[11px] leading-4 text-white/70"><b className="text-white">Card ranks:</b> G basic · F/E common · D/C uncommon · B rare · A epic · S legendary · SS mythic. Specified-slot cards are items, creatures and passives; spell cards are single-use tactics. You can't attack while the binder is open — close it with <b>B</b>.</div>
          </div>
        )}
      </div>
    </div>
  );
}

function DialogView({ game, br }: { game: Game; br: BrHudState }) {
  const d = br.dialog!;
  return (
    <div className="pointer-events-auto absolute inset-0 z-40 grid place-items-center overflow-y-auto bg-black/55 p-3 backdrop-blur-[2px]" onClick={() => game.br?.closeDialog()}>
      <div className="nb-panel w-[min(540px,96vw)] rounded-2xl border border-yellow-300/60 bg-[#14101f]/95 p-4 shadow-[0_0_40px_rgba(255,200,60,.2)]" onClick={(e) => e.stopPropagation()}>
        <div className="text-[10px] font-black tracking-[0.4em] text-yellow-300">{d.npc.toUpperCase()}</div>
        <div className="text-xl font-black tracking-wide">{d.title}</div>
        <p className="mt-1 text-[13px] leading-5 text-white/80">{d.text}</p>
        {d.reels && <div className="my-2 flex justify-center gap-2">{d.reels.map((r, i) => <div key={i} className="grid h-16 w-16 place-items-center rounded-xl border-2 border-yellow-300 bg-black text-3xl font-black text-red-400 shadow-[0_0_16px_rgba(255,210,63,.5)]">{r}</div>)}</div>}
        {d.hand && (
          <div className="my-2 space-y-1 text-center text-lg font-black">
            <div><span className="mr-2 text-[10px] tracking-widest text-white/50">YOU</span>{d.hand.you.map((c, i) => <span key={i} className="mx-0.5 rounded bg-white px-1 text-black" style={{ color: /[♥♦]/.test(c) ? '#d02030' : '#111' }}>{c.replace('11', 'J').replace('12', 'Q').replace('13', 'K').replace('14', 'A')}</span>)}</div>
            <div><span className="mr-2 text-[10px] tracking-widest text-white/50">KING</span>{d.hand.king.map((c, i) => <span key={i} className="mx-0.5 rounded bg-white px-1 text-black" style={{ color: /[♥♦]/.test(c) ? '#d02030' : '#111' }}>{c.replace('11', 'J').replace('12', 'Q').replace('13', 'K').replace('14', 'A')}</span>)}</div>
          </div>
        )}
        <div className="mt-2 flex max-h-[44vh] flex-col gap-1.5 overflow-y-auto">
          {d.opts.map((o) => (
            <button key={o.id} disabled={o.disabled} onClick={() => game.br?.choose(o.id)} className="rounded-xl border border-white/20 bg-white/[0.05] px-3 py-2 text-left transition hover:border-yellow-300 hover:bg-yellow-300/10 disabled:opacity-35">
              <div className="text-[13px] font-black">{o.label}</div>
              {o.sub && <div className="text-[11px] text-white/55">{o.sub}</div>}
            </button>
          ))}
        </div>
        <button onClick={() => game.br?.closeDialog()} className="mt-2 w-full rounded-lg border border-white/20 py-1 text-[11px] font-black tracking-widest text-white/60 hover:bg-white/10">CLOSE</button>
      </div>
    </div>
  );
}

export default function BrHud({ game, hud }: { game: Game; hud: HudState }) {
  const br = hud.br!;
  const touch = hud.touch;
  const [vh, setVh] = useState(window.innerHeight);
  const [hint, setHint] = useState(true);
  useEffect(() => { const t = window.setTimeout(() => setHint(false), 26000); return () => window.clearTimeout(t); }, []);
  useEffect(() => { const f = () => setVh(window.innerHeight); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f); }, []);
  const mm = touch ? 112 : 168;
  const z = br.zone;
  const bigSize = Math.min(vh * 0.8, window.innerWidth * 0.92, 720);

  if (br.cut) {
    const c = br.cut;
    return (
      <div className="pointer-events-none absolute inset-0 z-30 font-sans text-white">
        <div className="absolute inset-x-0 top-0 h-[12vh] bg-black" />
        <div className="absolute inset-x-0 bottom-0 h-[26vh] bg-gradient-to-t from-black via-black/85 to-black" />
        <div className="absolute inset-x-0 bottom-[3vh] mx-auto w-[min(780px,92vw)] text-center">
          {c.lines.map((l, i) => (
            <div key={l.text} className="animate-[pop_.5s_ease-out]" style={{ opacity: i === c.lines.length - 1 ? 1 : 0.45 }}>
              {l.title && <div className="nb-title text-4xl font-black tracking-[0.2em] sm:text-6xl">{l.title}</div>}
              {l.who && <div className="text-[11px] font-black tracking-[0.4em] text-yellow-300">{l.who.toUpperCase()}</div>}
              <div className="text-[13px] font-semibold leading-5 text-white/90 sm:text-lg sm:leading-7">{l.text}</div>
            </div>
          ))}
        </div>
        <div className="absolute left-4 top-[13vh] text-[10px] font-black tracking-[0.4em] text-white/50">GREED ISLAND · GAME MASTER BROADCAST · CINEMATIC</div>
        <div className="absolute inset-x-6 bottom-[1.2vh] h-1 overflow-hidden rounded-full bg-white/15"><div className="h-full bg-yellow-300" style={{ width: `${(c.t / c.len) * 100}%` }} /></div>
        <div className="absolute inset-0 bg-white" style={{ opacity: c.flash }} />
      </div>
    );
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-30 font-sans text-white">
      {!touch && hint && !br.binderOpen && <div className="absolute bottom-[112px] left-1/2 -translate-x-1/2 rounded-lg border border-white/15 bg-black/55 px-3 py-1 text-[11px] font-bold tracking-wide text-white/80 backdrop-blur"><b className="text-yellow-300">B</b> binder · <b className="text-yellow-300">E</b> interact · <b className="text-yellow-300">R</b> heal · <b className="text-yellow-300">M</b> map · <b className="text-yellow-300">I / O</b> zoom</div>}
      {br.outside && (
        <>
          <div className="absolute inset-0 animate-pulse" style={{ background: 'radial-gradient(ellipse at center, transparent 35%, rgba(130,40,220,.45) 100%)' }} />
          <div className="absolute left-1/2 top-[13%] -translate-x-1/2 rounded-full border border-fuchsia-300/70 bg-black/70 px-4 py-1 text-center text-[11px] font-black tracking-widest text-fuchsia-200 sm:text-xs">☠ NEN BARRIER · {z.dps.toFixed(1)}% HP/s · RUN TO THE SAFE ZONE ({Math.max(0, Math.round(-br.edge))}m)</div>
        </>
      )}
      {br.warn && <div className="absolute left-1/2 top-[19%] max-w-[90vw] -translate-x-1/2 animate-pulse rounded-lg border border-red-400 bg-red-950/85 px-4 py-1.5 text-center text-xs font-black tracking-wider text-red-200 sm:text-sm">⚠ {br.warn}</div>}

      {/* top-right: stats + minimap */}
      <div className={`absolute flex flex-col items-end gap-1.5 ${touch ? 'right-2 top-[54px]' : 'right-3 top-3'}`}>
        <div className="flex gap-1 text-[11px] font-black sm:text-sm">
          <div className="rounded-lg border border-white/20 bg-black/65 px-2 py-0.5 backdrop-blur">⏱ {fmtT(br.time)}</div>
          <div className="rounded-lg border border-white/20 bg-black/65 px-2 py-0.5 backdrop-blur">👥 <span className="text-yellow-300">{br.format === 'solo' ? br.alive : br.teams}</span><span className="text-white/40 text-[9px]">{br.format === 'solo' ? '' : ' teams'}</span></div>
          <div className="rounded-lg border border-white/20 bg-black/65 px-2 py-0.5 backdrop-blur">☠ <span className="text-red-300">{br.kills}</span></div>
        </div>
        <button className="pointer-events-auto overflow-hidden rounded-full border-2 border-white/60 bg-black/50 shadow-[0_0_14px_rgba(0,0,0,.7)]" onClick={() => game.br?.toggleMap()} style={{ width: mm, height: mm }}>
          <MapCanvas br={br} game={game} size={mm} big={false} />
        </button>
        <div className="max-w-[210px] rounded-lg border border-fuchsia-300/40 bg-black/65 px-2 py-1 text-right text-[10px] font-black leading-3 tracking-wider text-fuchsia-100 backdrop-blur sm:text-[11px]">
          {!z.started ? <>BARRIER RISES IN {fmtT(1200 - br.time)}</> : z.closing ? <>BARRIER CLOSING · {fmtT(z.tNext)}<div className="text-fuchsia-300/70">→ {Math.round(z.nextR)}m</div></> : <>NEXT SHRINK {fmtT(z.tNext)}<div className="text-fuchsia-300/70">→ {Math.round(z.nextR)}m</div></>}
        </div>
      </div>

      {/* left: feed + allies + toasts */}
      <div className={`absolute flex w-[min(280px,44vw)] flex-col gap-0.5 ${touch ? 'left-2 top-[150px] origin-top-left scale-[0.8]' : 'left-3 top-3'}`}>
        {br.allies.length > 0 && (
          <div className="mb-1 space-y-0.5">
            {br.allies.map((a) => (
              <div key={a.name} className="flex items-center gap-1.5 rounded-md border border-emerald-300/30 bg-black/55 px-1.5 py-0.5 text-[10px] font-black backdrop-blur"><span className="w-20 truncate text-emerald-200">{a.name}</span><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/15"><div className="h-full bg-emerald-400" style={{ width: `${a.alive ? (a.hp / a.maxHp) * 100 : 0}%` }} /></div>{!a.alive && <span className="text-red-300">☠</span>}</div>
            ))}
          </div>
        )}
        {br.feed.map((f, i) => <div key={i + f.text} className="w-fit max-w-full truncate rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-bold backdrop-blur sm:text-[11px]" style={{ color: f.color }}>{f.text}</div>)}
      </div>
      <div className={`absolute flex flex-col gap-1 ${touch ? 'left-2 top-[46%]' : 'left-3 top-[34%]'}`}>
        {br.toasts.map((t, i) => <div key={i + t.text} className="w-fit max-w-[70vw] animate-[pop_.3s_ease-out] rounded-lg border bg-black/70 px-2.5 py-1 text-[11px] font-black backdrop-blur sm:text-xs" style={{ borderColor: t.color + '99', color: t.color }}>{t.text}</div>)}
      </div>

      {/* boss + dodgeball */}
      {br.boss && (
        <div className="absolute left-1/2 top-[8%] w-[min(520px,56vw)] -translate-x-1/2">
          <div className="mb-0.5 flex justify-between px-1 text-xs font-black tracking-widest text-orange-200 [text-shadow:0_2px_3px_#000]"><span>☠ {br.boss.name.toUpperCase()}</span><span className="text-white/70">{Math.ceil(br.boss.hp)}/{br.boss.maxHp}</span></div>
          <div className="h-3.5 overflow-hidden rounded-md border border-white/30 bg-black/60"><div className="h-full" style={{ width: `${(br.boss.hp / br.boss.maxHp) * 100}%`, background: 'linear-gradient(180deg,#ffa05a,#c2410c)', boxShadow: '0 0 12px rgba(255,120,40,.7)' }} /></div>
        </div>
      )}
      {br.dodge && <div className="absolute left-1/2 top-[8%] -translate-x-1/2 rounded-xl border border-red-300 bg-black/70 px-4 py-1 text-center text-sm font-black tracking-widest text-red-200">🏐 DODGEBALL · {Math.max(0, 40 - br.dodge.t).toFixed(0)}s · {'♥'.repeat(br.dodge.lives)}{'♡'.repeat(3 - br.dodge.lives)}</div>}

      {/* casting + prompt + effects */}
      {br.casting && (
        <div className="absolute left-1/2 top-[56%] w-52 -translate-x-1/2 text-center">
          <div className="text-xs font-black tracking-widest [text-shadow:0_2px_3px_#000]">{br.casting.name.toUpperCase()}</div>
          <div className="mt-0.5 h-2 overflow-hidden rounded-full border border-white/40 bg-black/60"><div className="h-full bg-fuchsia-300" style={{ width: `${Math.min(100, (br.casting.t / br.casting.max) * 100)}%` }} /></div>
        </div>
      )}
      {br.prompt && (
        <div className="absolute left-1/2 top-[66%] -translate-x-1/2 animate-pulse rounded-xl border border-yellow-300/70 bg-black/70 px-4 py-1.5 text-sm font-black tracking-wide backdrop-blur">
          {touch ? '👆 Tap INTERACT' : <><span className="mr-1.5 rounded bg-yellow-300 px-1.5 text-black">{br.prompt.key}</span></>} {br.prompt.text}
        </div>
      )}
      {br.effects.length > 0 && (
        <div className={`absolute flex max-w-[60vw] flex-wrap gap-1 ${touch ? 'left-2 top-[110px]' : 'bottom-[218px] left-4'}`}>
          {br.effects.map((e) => (
            <div key={e.name} className="relative overflow-hidden rounded-md border border-white/20 bg-black/65 px-1.5 py-0.5 text-[10px] font-black backdrop-blur" style={{ color: e.color }}>
              <div className="absolute inset-y-0 left-0 opacity-25" style={{ width: `${Math.min(100, (e.t / e.max) * 100)}%`, background: e.color }} />
              <span className="relative">{e.name} {Math.ceil(e.t)}s</span>
            </div>
          ))}
        </div>
      )}
      {br.trade && (
        <div className="pointer-events-auto absolute bottom-[34%] left-2 w-[min(300px,70vw)] rounded-xl border border-emerald-300/70 bg-black/80 p-2.5 text-xs backdrop-blur sm:left-4">
          <div className="font-black text-emerald-300">🤝 TRADE OFFER · {br.trade.name}</div>
          <div className="mt-0.5 text-white/80">Gives <b style={{ color: RANK_COLOR[CARDS[br.trade.give].rank] }}>{CARDS[br.trade.give].name}</b> for your <b style={{ color: RANK_COLOR[CARDS[br.trade.want].rank] }}>{CARDS[br.trade.want].name}</b></div>
          <div className="mt-1.5 flex gap-1.5"><button onClick={() => game.br?.acceptTrade()} className="flex-1 rounded-lg bg-emerald-400 py-1 font-black text-black">ACCEPT</button><button onClick={() => game.br?.declineTrade()} className="flex-1 rounded-lg border border-white/30 py-1 font-black">DECLINE</button></div>
        </div>
      )}

      {/* ESP markers */}
      {br.esp.map((e, i) => <div key={i} className="absolute -translate-x-1/2 -translate-y-full text-center text-[10px] font-black [text-shadow:0_1px_2px_#000]" style={{ left: `${e.x * 100}%`, top: `${e.y * 100}%`, color: e.color }}>▼<div>{e.name} · {Math.round(e.dist)}m</div></div>)}

      {br.binderOpen && <Binder game={game} br={br} />}
      {br.dialog && <DialogView game={game} br={br} />}
      {br.mapOpen && (
        <div className="pointer-events-auto absolute inset-0 z-40 grid place-items-center bg-black/65 backdrop-blur-sm" onClick={() => game.br?.toggleMap()}>
          <div className="relative overflow-hidden rounded-2xl border-2 border-yellow-300/70 shadow-[0_0_40px_rgba(0,0,0,.8)]" onClick={(e) => e.stopPropagation()}>
            <MapCanvas br={br} game={game} size={Math.round(bigSize)} big />
            <div className="absolute left-2 top-2 rounded-lg bg-black/70 px-2 py-1 text-[10px] font-black leading-4 tracking-wider"><div className="text-yellow-300">GREED ISLAND</div><div><span className="text-white">▬</span> safe zone · <span className="text-yellow-300">┅</span> next</div><div className="text-emerald-300">● ally</div><div className="text-red-300">● revealed</div><div className="text-yellow-300">◆ drop / beacon</div></div>
            <button onClick={() => game.br?.toggleMap()} className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full border border-white/40 bg-black/70 text-sm font-black">✕</button>
          </div>
        </div>
      )}
    </div>
  );
}

export function BrResults({ hud, onAgain }: { hud: HudState | null; onAgain: () => void }) {
  const r = hud?.br?.result;
  if (!r) return null;
  const rows: [string, string][] = [['Placement', r.victory ? '#1' : `#${r.placement}`], ['Eliminations', String(r.kills)], ['Survived', fmtT(r.time)], ['Cards found', String(r.cards)], ['Monsters slain', String(r.monsters)], ['Jenny earned', r.jenny.toLocaleString()]];
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/75 p-3 font-sans text-white backdrop-blur-sm">
      <div className="nb-panel w-[min(520px,96vw)] rounded-3xl border p-5 text-center" style={{ borderColor: r.victory ? '#ffd23f' : '#ff4d4d', background: 'rgba(12,8,22,.92)', boxShadow: `0 0 60px ${r.victory ? 'rgba(255,210,63,.45)' : 'rgba(255,60,60,.35)'}` }}>
        <div className="text-[10px] font-black tracking-[0.5em] text-white/50">GREED ISLAND · BATTLE ROYALE</div>
        <div className="text-5xl font-black sm:text-6xl" style={{ color: r.victory ? '#ffd23f' : '#ff4d4d', textShadow: '0 4px 0 #000, 0 0 40px currentColor' }}>{r.victory ? 'VICTORY ROYALE' : 'ELIMINATED'}</div>
        <div className="mt-1 text-sm text-white/70">{r.victory ? "You claimed Ruler's Blessing. The island is cleared." : `You placed #${r.placement}. Collect better cards and try again.`}</div>
        <div className="mt-4 grid grid-cols-2 gap-2 text-left sm:grid-cols-3">
          {rows.map(([k, v]) => <div key={k} className="rounded-xl border border-white/15 bg-white/5 px-3 py-2"><div className="text-[9px] font-black tracking-widest text-white/45">{k.toUpperCase()}</div><div className="text-lg font-black">{v}</div></div>)}
        </div>
        <button onClick={onAgain} className="mt-5 rounded-xl border-2 border-black bg-yellow-400 px-10 py-3 text-lg font-black text-black shadow-[0_5px_0_#000] transition hover:bg-yellow-300 active:translate-y-1 active:shadow-none">BACK TO LOBBY</button>
      </div>
    </div>
  );
}
