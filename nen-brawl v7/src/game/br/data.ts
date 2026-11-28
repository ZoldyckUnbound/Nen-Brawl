/** Greed Island data: cards (canonical numbers / ranks / limits), monsters, towns, zone phases, bot personalities. */

export type Rank = 'SS' | 'S' | 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';
export const RANKS: Rank[] = ['SS', 'S', 'A', 'B', 'C', 'D', 'E', 'F', 'G'];
export const RANK_COLOR: Record<Rank, string> = { SS: '#ff3d6e', S: '#ffc83a', A: '#ff8a2a', B: '#b06bff', C: '#4aa8ff', D: '#46d39a', E: '#8fe36a', F: '#c9d3de', G: '#9aa3ad' };
export const RANK_VALUE: Record<Rank, number> = { SS: 250000, S: 60000, A: 24000, B: 9000, C: 4000, D: 1800, E: 900, F: 450, G: 200 };
export const RANK_NAME: Record<Rank, string> = { SS: 'MYTHIC', S: 'LEGENDARY', A: 'EPIC', B: 'RARE', C: 'UNCOMMON+', D: 'UNCOMMON', E: 'COMMON+', F: 'COMMON', G: 'BASIC' };

export interface Pass {
  dmg?: number; spd?: number; hp?: number; cdr?: number; regen?: number; luck?: number; jenny?: number; shield?: number; shop?: number;
  xp?: number; stun?: number; energy?: number; revive?: number; beacon?: boolean; income?: number; sac?: number; guard?: boolean;
}
export interface Fx {
  heal?: [number, number]; shield?: number; energy?: number;
  buff?: { dmg?: number; spd?: number; atk?: number; t: number };
  zone?: { r: number; t: number; heal?: number; slow?: number; imm?: boolean; dps?: number; dmg?: number };
  summon?: { m: string; t: number };
  stealth?: number; invuln?: number; stun?: { r: number; t: number }; slow?: { r: number; t: number; m: number };
  float?: boolean; cleanse?: boolean; level?: number; maxhp?: number; pack?: number; gamble?: boolean; sp?: string;
}
export type Tgt = 'none' | 'enemy' | 'met' | 'town' | 'friend';
export interface Card {
  id: string; no: number; name: string; rank: Rank; limit: number; kind: 'spec' | 'spell';
  type: 'consume' | 'passive' | 'collect' | 'creature' | 'spell';
  icon: string; desc: string; fx?: Fx; pass?: Pass; tgt?: Tgt; cast?: number;
}

const RAW_SPEC = `000|Ruler's Blessing|SS|1;001|Patch of Forest|SS|3;002|Plot of Beach|SS|3;003|Pitcher of Eternal Water|A|17;004|Skin Care Hot Springs|A|15;005|Spirited Away Hollow|S|8;006|Liquor Spring|A|15;007|Pregnancy Stone|S|10;008|Mystery Pond|S|10;009|Tree of Plenty|S|10;010|Golden Guidebook|A|20;011|Golden Scales|B|30;012|Golden Dictionary|S|10;013|Luck Bankbook|A|20;014|Connection Severing Scissors|B|22;015|Fickle Genie|S|10;016|Fairy King's Advice|S|6;017|Angel's Breath|SS|3;018|Imp's Wink|A|18;019|Poltergeist Pillow|A|13;020|Mood Clock|B|30;021|X-Ray Goggles|B|27;022|Toraemon|A|22;023|Tome of a Thousand Tales|B|30;024|Hypothetical TV|A|20;025|Risky Dice|A|20;026|Night Shift Dwarves|B|25;027|Book of V.I.P Passes|B|25;028|Capricious Remote|B|27;029|Pre-Order Vouchers|A|20;030|Favor Cushion|B|21;031|Double Postcard to the Dead|S|13;032|Parrot Candy|B|30;033|Hormone Cookies|S|13;034|Universal Survey|B|30;035|Chameleon Cat|S|6;036|Recycling Room|S|10;037|Fledgling Athlete|B|30;038|Fledgling Artist|B|30;039|Fledgling Politician|B|30;040|Fledgling Musician|B|30;041|Fledgling Pilot|B|30;042|Fledgling Novelist|B|30;043|Fledgling Gambler|B|30;044|Fledgling Actor|B|30;045|Fledgling CEO|B|30;046|Gold Dust Girl|A|13;047|Sleeping Girl|A|11;048|Aromatherapy Girl|A|15;049|Miniature Mermaid|B|23;050|Miniature Dino|A|11;051|Miniature Dragon|S|10;052|Pearl Locusts|B|30;053|King White Stag Beetle|A|30;054|Millennium Butterfly|A|25;055|Revenge Shop|A|20;056|Perfect Memory Studio|B|25;057|Hideout Realtor|A|11;058|Secrets Video Rental|A|13;059|Instant Foreign Language School|A|20;060|Long Lost Delivery|B|30;061|Vending Check-Up|A|20;062|Club You Rule|B|20;063|Virtual Restaurant|B|30;064|Witch's Love Potion|B|30;065|Witch's Rejuvenation Potion|S|10;066|Witch's Diet Pills|B|28;067|Doyen's Growth Pills|B|30;068|Doyen's Virility Pills|A|20;069|Doyen's Hair Restorer|B|30;070|Mad Scientist's Steroids|A|16;071|Mad Scientist's Pheromones|A|20;072|Mad Scientist's Plastic Surgery|A|15;073|Night Jade|A|15;074|Sage's Aquamarine|A|15;075|Wild Luck Alexandrite|A|20;076|Roaming Ruby|B|30;077|Beauty Magnet Emerald|S|10;078|Lonely Sapphire|B|30;079|Rainbow Diamond|A|20;080|Levitation Stone|S|7;081|Blue Planet|SS|5;082|Staff of Judgement|A|15;083|Sword of Truth|B|22;084|Paladin's Necklace|D|60;085|Sacrifice Armor|S|8;086|Quiver of Frustration|A|11;087|Shield of Faith|S|15;088|Eternal Hammer|A|15;089|Tax Collector's Gauntlet|A|20;090|Memory Helmet|A|20;091|Plastic King|A|20;092|Swap Ticket|S|7;093|Book of Life|B|28;094|Bandit's Blade|S|10;095|Secret Cape|A|20;096|Clairvoyant Snake|A|12;097|3-D Camera|A|20;098|Silver Dog|S|8;099|Panda Maid|S|8;100|Map of the Island|G|400`;

type FxRow = [number, string, string, Fx];
const FXS: FxRow[] = [
  [1, '🌲', 'Plant a Patch of Forest: a 45s sanctuary that heals 4%/s and blocks the Nen Barrier.', { zone: { r: 15, t: 45, heal: 0.04, imm: true } }],
  [2, '🏖️', 'A Plot of Beach: for 60s enemies inside are slowed 40% while allies heal 3%/s.', { zone: { r: 16, t: 60, heal: 0.03, slow: 0.4 } }],
  [3, '🏺', 'Restore 35% HP and refill all energy.', { heal: [0.35, 2], energy: 100 }],
  [4, '♨️', 'A healing pool (8m): restores 5%/s for 20s.', { zone: { r: 8, t: 20, heal: 0.05 } }],
  [5, '🌳', 'Vanish into the hollow for 3s (invulnerable) and reappear 45m ahead.', { invuln: 3, sp: 'hollow' }],
  [6, '🍶', 'A fountain zone (9m): allies deal +20% damage and heal 2%/s for 25s.', { zone: { r: 9, t: 25, heal: 0.02, dmg: 0.2 } }],
  [8, '🪷', 'Toss in your 3 weakest cards – a random B+ card rises from the pond.', { sp: 'pond' }],
  [9, '🍎', 'Grows a tree that drops 6 fruit cards over 30s.', { sp: 'tree' }],
  [10, '📙', 'Reveals every chest and card on the map for 30s.', { sp: 'scanAll' }],
  [14, '✂️', 'Cut every chain, root and slow, then sprint (+10% speed for 6s).', { cleanse: true, buff: { spd: 0.1, t: 6 } }],
  [15, '🧞', 'Make a wish: full heal, two rare spells, or teleport to the safe zone.', { sp: 'genie' }],
  [16, '🧚', 'The Fairy King reveals the next Barrier position and grants +20% speed for 40s.', { sp: 'fairy', buff: { spd: 0.2, t: 40 } }],
  [18, '😈', 'Wink at the world: bots lose you and you turn nearly invisible for 10s.', { stealth: 10 }],
  [19, '🛏️', 'Haunted objects hurl themselves at nearby enemies for 8s.', { sp: 'polter' }],
  [20, '⏰', 'Enemies within 25m are slowed 40% for 6s.', { slow: { r: 25, t: 6, m: 0.4 } }],
  [21, '🥽', 'See players through walls (130m) for 20s.', { sp: 'xray' }],
  [22, '🐱', 'Toraemon pulls three spell cards from his pocket.', { pack: 3 }],
  [23, '📖', 'Read the tome: gain +1 level.', { level: 1 }],
  [24, '📺', 'Hypothetical TV broadcasts the 5 nearest players for 12s.', { sp: 'tv' }],
  [25, '🎲', 'Roll! 1-2 lose 25% HP, 3-4 nothing, 5-6 win a rare card.', { gamble: true }],
  [28, '📡', 'Press a random button: a random spell card effect fires.', { sp: 'randSpell' }],
  [31, '💌', 'Revive up to two fallen teammates at your side (solo: an 80 spirit shield).', { sp: 'postcard' }],
  [35, '🐈', 'Camouflage for 40s – nearly invisible while you stand still.', { stealth: 40 }],
  [47, '😴', 'Everyone within 12m falls asleep for 3.5s.', { stun: { r: 12, t: 3.5 } }],
  [48, '🌸', 'A soothing aroma (7m): heals 5%/s for 20s.', { zone: { r: 7, t: 20, heal: 0.05 } }],
  [49, '🧜', 'Summon a Miniature Mermaid ally for 30s.', { summon: { m: 'a_mermaid', t: 30 } }],
  [50, '🦖', 'Summon a Miniature Dino ally for 40s.', { summon: { m: 'a_dino', t: 40 } }],
  [51, '🐉', 'Summon a Miniature Dragon ally for 45s.', { summon: { m: 'a_dragon', t: 45 } }],
  [52, '🦗', 'A locust swarm (8m) gnaws enemies for 9 dps over 12s.', { zone: { r: 8, t: 12, dps: 9 } }],
  [53, '🪲', 'Summon the King White Stag Beetle for 35s.', { summon: { m: 'a_beetle', t: 35 } }],
  [54, '🦋', 'Butterflies heal 25% over 8s and cleanse every debuff.', { heal: [0.25, 8], cleanse: true }],
  [55, '🏪', 'For 20s damage taken is reflected at 35%.', { sp: 'revenge' }],
  [65, '🧪', 'Rejuvenation: restore 100% HP over 6s.', { heal: [1, 6] }],
  [66, '💊', '+18% move speed for 60s.', { buff: { spd: 0.18, t: 60 } }],
  [67, '💊', '+45 max HP and heal 45.', { maxhp: 45 }],
  [68, '💊', '+20% attack speed for 60s.', { buff: { atk: 0.2, t: 60 } }],
  [70, '💉', '+25% damage and +10% speed for 45s.', { buff: { dmg: 0.25, spd: 0.1, t: 45 } }],
  [72, '🎭', 'New face: invisible to bots and radar for 14s.', { stealth: 14 }],
  [77, '💚', 'Pull every card within 45m to you.', { sp: 'magnet' }],
  [80, '🪨', 'Shoot skyward and glide down for 4s.', { float: true }],
  [82, '⚖️', 'Call down a judgement bolt at the cursor (140 damage, 1.2s delay).', { sp: 'smite' }],
  [86, '🏹', 'Unleash 24 arrows of frustration at the cursor.', { sp: 'quiver' }],
  [91, '🤴', 'Cast a plastic decoy of yourself that tanks for 12s.', { sp: 'decoy' }],
  [92, '🎫', 'Swap places with a player you have met.', { sp: 'swap' }],
  [95, '🧥', 'Secret Cape: nearly invisible for 12s.', { stealth: 12 }],
  [96, '🐍', 'The snake scouts 150m around you for 25s.', { sp: 'snake' }],
  [97, '📷', 'FLASH! enemies within 14m are blinded for 2s.', { stun: { r: 14, t: 2 } }],
  [98, '🐕', 'Summon the Silver Dog for 45s.', { summon: { m: 'a_dog', t: 45 } }],
  [99, '🐼', 'Summon the Panda Maid: heals you and brawls for 40s.', { summon: { m: 'a_panda', t: 40 } }],
];
type PassRow = [number, string, string, Pass];
const PASS: PassRow[] = [
  [0, '👑', "Greed Island's blessing: +30% damage, +25% speed, +150 HP, fast regeneration – but everyone sees you on the map.", { dmg: 0.3, spd: 0.25, hp: 150, regen: 0.012, beacon: true }],
  [7, '🥚', 'A warm stone that fortifies the body: +40 max HP.', { hp: 40 }],
  [11, '⚖️', 'Trade shops pay 15% more.', { shop: 0.15 }],
  [12, '📚', '+25% XP from every source.', { xp: 0.25 }],
  [13, '🏦', '+30% Jenny from everything.', { jenny: 0.3 }],
  [17, '😇', 'If you or a teammate within 40m would fall, the holder spends this card and the fallen rises with 60% HP.', { revive: 0.6 }],
  [27, '🎟️', 'VIP prices: shops are 30% cheaper.', { shop: 0.3 }],
  [29, '🧾', 'Shops 10% cheaper.', { shop: 0.1 }],
  [30, '🛋️', 'People owe you favors: shops 20% cheaper.', { shop: 0.2 }],
  [33, '🍪', '+10% damage.', { dmg: 0.1 }],
  [34, '📋', 'The survey says… +10% luck.', { luck: 0.1 }],
  [37, '🏃', '+8% speed.', { spd: 0.08 }],
  [38, '🎨', 'Skills 6% faster.', { cdr: 0.06 }],
  [39, '🏛️', 'Shops 20% cheaper.', { shop: 0.2 }],
  [40, '🎻', '+20% energy regeneration.', { energy: 0.2 }],
  [41, '✈️', '+5% speed, +20 HP.', { spd: 0.05, hp: 20 }],
  [42, '🖋️', '+20% XP.', { xp: 0.2 }],
  [43, '🎰', '+15% luck in chests and the casino.', { luck: 0.15 }],
  [44, '🎭', 'Stuns last 15% shorter.', { stun: 0.15 }],
  [45, '💼', '+25% Jenny.', { jenny: 0.25 }],
  [46, '✨', 'Gold dust trickles from her: +120 Jenny every 12s (hostile Hunters will come for her!).', { income: 120 }],
  [73, '💠', '+4% speed and slow regeneration.', { spd: 0.04, regen: 0.002 }],
  [74, '💧', '+30% energy regeneration.', { energy: 0.3 }],
  [75, '🍀', '+35% luck for chests, gambling and quests.', { luck: 0.35 }],
  [76, '♦️', '+5% speed.', { spd: 0.05 }],
  [78, '🔷', '+10% energy regeneration.', { energy: 0.1 }],
  [79, '💎', '+10% luck and +20 HP.', { luck: 0.1, hp: 20 }],
  [81, '🌍', 'The most valuable card on the island. Slow regeneration – and a beacon for every bounty hunter.', { regen: 0.004, beacon: true }],
  [83, '🗡️', '+8% damage.', { dmg: 0.08 }],
  [84, '📿', 'Protection against hostile effects: stuns 25% shorter, +25 HP, blocks one hostile spell every 45s.', { stun: 0.25, hp: 25, guard: true }],
  [85, '🛡️', 'When you drop below 30% HP the armor sacrifices itself: +150 shield (once).', { sac: 150, hp: 30 }],
  [87, '🔰', '+80 max shield that regenerates when you are out of combat.', { shield: 80 }],
  [88, '🔨', '+10% damage.', { dmg: 0.1 }],
  [89, '🥊', '+15% Jenny and +4% damage.', { jenny: 0.15, dmg: 0.04 }],
  [90, '🪖', 'Skills 10% faster.', { cdr: 0.1 }],
  [93, '📕', 'A page of life: you rise with 30% HP when you would fall.', { revive: 0.3 }],
  [94, '🗡️', '+14% damage.', { dmg: 0.14 }],
];

type SpRow = [number, string, Rank, number, string, Tgt, number, string, string];
const SPELLS: SpRow[] = [
  [1001, 'Peek', 'G', 200, '👁️', 'none', 0.8, 'Reveal players within 70m on your map for 8s.', 'peek'],
  [1002, 'Fluoroscopy', 'F', 150, '🩻', 'none', 1, 'See every player within 120m through walls for 12s.', 'fluoro'],
  [1003, 'Defensive Wall', 'G', 400, '🧱', 'none', 0.6, '+60 shield and blocks the next hostile spell.', 'wall'],
  [1004, 'Reflect', 'E', 120, '🪞', 'none', 0.6, 'For 8s reflect 35% of incoming damage and every hostile spell.', 'reflect'],
  [1005, 'Magnetic Force', 'C', 50, '🧲', 'met', 2, 'Pull a player you have met straight to your location.', 'magnet'],
  [1006, 'Pickpocket', 'F', 170, '🧤', 'none', 0.8, 'Steal a random spell card from the nearest enemy (20m).', 'pickpocket'],
  [1007, 'Thief', 'C', 50, '🦝', 'none', 0.8, 'Steal a random Specified Slot card from the nearest enemy (20m).', 'thief'],
  [1009, 'Return', 'G', 380, '🌀', 'town', 3, 'Fly back to a town you have visited.', 'return'],
  [1010, 'Mimic', 'A', 20, '🪄', 'none', 1, 'Duplicate your most valuable spell card.', 'mimic'],
  [1012, 'Relegate', 'F', 140, '📤', 'none', 1, 'Send the nearest enemy (30m) somewhere else on the island.', 'relegate'],
  [1013, 'Origin', 'D', 65, '🌱', 'none', 1.2, 'Send the nearest enemy (30m) back to the Shiso Tree.', 'origin'],
  [1014, 'Leave', 'B', 30, '🚪', 'none', 3.5, 'Eject the nearest enemy (12m) from the island! 3.5s cast – they can dodge by running or countering.', 'leave'],
  [1015, 'Clairvoyance', 'D', 70, '🔮', 'none', 1, 'Reveal the 6 nearest players and how rich their binders are for 20s.', 'clair'],
  [1016, 'Drift', 'F', 200, '🍃', 'none', 3, 'Fly to a random town you have not visited yet.', 'drift'],
  [1017, 'Collision', 'F', 200, '💥', 'none', 3, 'Crash next to a random player you have not met. Dangerous!', 'collision'],
  [1018, 'Levy', 'B', 25, '🧾', 'none', 2, 'Take one random card from every enemy within 20m.', 'levy'],
  [1019, 'Drawbridge', 'F', 200, '🌉', 'none', 0.6, 'Blocks the next hostile spell for 60s.', 'bridge'],
  [1020, 'Fake', 'C', 40, '🎭', 'none', 0.8, 'Conjure a decoy of yourself for 10s.', 'fake'],
  [1021, 'Mug', 'B', 30, '🗡️', 'none', 1, 'Take the best card from the nearest enemy (15m).', 'mug'],
  [1022, 'Corruption', 'C', 40, '☠️', 'none', 1, 'Destroy the best Specified card of the nearest enemy (25m).', 'corrupt'],
  [1023, 'Compromise', 'B', 25, '🤝', 'none', 1, 'A truce: nobody within 15m can deal damage for 6s.', 'truce'],
  [1024, 'Dispel', 'B', 40, '✨', 'none', 0.6, 'Cleanse every debuff, root and slow from you.', 'dispel'],
  [1025, 'Blackout Curtain', 'F', 200, '🌑', 'none', 0.8, 'Hide from Peek, Fluoroscopy, Clairvoyance and radar for 45s.', 'blackout'],
  [1026, 'Holy Water', 'A', 20, '💧', 'none', 1, 'Immune to the Nen Barrier for 25s and 10 charges against hostile spells.', 'holy'],
  [1027, 'Trace', 'E', 90, '📍', 'none', 1, 'Tag the nearest enemy (60m): they glow on your screen for 25s.', 'trace'],
  [1028, 'Rock Toss', 'E', 100, '🪨', 'none', 0.5, 'Hurl a boulder at the cursor: 55 damage, 6m blast.', 'rock'],
  [1031, 'Analysis', 'G', 300, '🔎', 'none', 0.8, 'Scan for cards and chests within 140m for 25s.', 'analysis'],
  [1032, 'Lottery', 'G', 300, '🎟️', 'none', 0.8, 'Draw a random card – sometimes a better one!', 'lottery'],
  [1038, 'List', 'G', 350, '📜', 'none', 0.8, 'Reveal the 3 richest players on the island for 15s.', 'list'],
  [1039, 'Accompany', 'F', 130, '🛫', 'town', 5, 'Fly yourself and everyone within 20m to a teammate or a visited town.', 'accompany'],
  [1040, 'Contact', 'F', 200, '📞', 'none', 0.8, 'Heal teammates within 30m for 25% and reveal them (solo: heal 15%).', 'contact'],
];

export const CARDS: Record<string, Card> = {};
for (const row of RAW_SPEC.split(';')) {
  const [n, name, rank, lim] = row.split('|');
  const no = parseInt(n, 10);
  const r = rank as Rank;
  CARDS['s' + n] = { id: 's' + n, no, name, rank: r, limit: parseInt(lim, 10), kind: 'spec', type: 'collect', icon: '🃏', desc: `A collectible. Sells for ${RANK_VALUE[r].toLocaleString()} J at any Trade Shop and fills pocket #${n}.` };
}
for (const [no, icon, desc, fx] of FXS) {
  const c = CARDS['s' + String(no).padStart(3, '0')];
  c.icon = icon; c.desc = desc; c.fx = fx; c.type = fx.summon ? 'creature' : 'consume';
}
for (const [no, icon, desc, pass] of PASS) {
  const c = CARDS['s' + String(no).padStart(3, '0')];
  c.icon = icon; c.desc = desc; c.pass = pass; c.type = 'passive';
}
CARDS.s100 = { ...CARDS.s100, name: 'Greed Island Atlas', rank: 'B', limit: 12, type: 'passive', icon: '🗺️', desc: 'A fully detailed atlas: biomes, rivers, roads, every named town, dungeon and rare site – plus you and your teammates. Open it with M.' };
CARDS.s101 = { id: 's101', no: 101, name: 'Island Chart', rank: 'D', limit: 30, kind: 'spec', type: 'passive', icon: '📜', desc: 'A rough chart: only the outline of the island, you and your teammates. Open it with M. Buy it, take it, or loot it from a rival.' };
CARDS.s081.icon = '🌍';
for (const [no, name, rank, limit, icon, tgt, cast, desc, sp] of SPELLS) {
  CARDS['p' + no] = { id: 'p' + no, no, name, rank, limit, kind: 'spell', type: 'spell', icon, desc, tgt, cast, fx: { sp } };
}
export const SPEC_IDS = Object.keys(CARDS).filter((k) => k[0] === 's');
export const SPELL_IDS = Object.keys(CARDS).filter((k) => k[0] === 'p');
export const cardValue = (id: string) => RANK_VALUE[CARDS[id].rank];

const TIER_W: number[][] = [
  [0, 0.2, 1.5, 4, 7, 13, 20, 26, 28],
  [0.05, 1, 4, 9, 12, 17, 19, 19, 19],
  [0.25, 3, 9, 15, 17, 17, 14, 13, 12],
  [1.4, 8, 20, 24, 18, 12, 8, 5, 4],
];
const BY_RANK: Record<Rank, string[]> = { SS: [], S: [], A: [], B: [], C: [], D: [], E: [], F: [], G: [] };
for (const id of Object.keys(CARDS)) if (id !== 's100' && id !== 's101') BY_RANK[CARDS[id].rank].push(id);
const issued: Record<string, number> = {};
export function resetIssued() { for (const k of Object.keys(issued)) delete issued[k]; }

/** weighted loot roll. Rarer ranks and low-limit cards are much harder to find. */
export function rollCard(tier: number, luck = 0, spellBias = 0.5, rnd: () => number = Math.random): string {
  const w = TIER_W[Math.max(0, Math.min(3, tier))].map((x, i) => x * (1 + luck * 2 * (1 - i / 8)));
  let t = rnd() * w.reduce((a, b) => a + b, 0);
  let ri = 0;
  for (; ri < w.length - 1; ri++) { t -= w[ri]; if (t <= 0) break; }
  for (let tries = 0; tries < 6; tries++) {
    const rank = RANKS[Math.min(8, ri + tries)];
    const pool = BY_RANK[rank].filter((id) => {
      const cap = CARDS[id].rank === 'SS' || CARDS[id].rank === 'S' ? Math.max(1, Math.round(CARDS[id].limit / 3)) : 999;
      return (issued[id] ?? 0) < cap;
    });
    if (!pool.length) continue;
    const spells = pool.filter((id) => id[0] === 'p');
    const specs = pool.filter((id) => id[0] === 's');
    const usePool = spells.length && (!specs.length || rnd() < spellBias) ? spells : specs.length ? specs : spells;
    let sum = 0;
    for (const id of usePool) sum += CARDS[id].limit;
    let r = rnd() * sum;
    for (const id of usePool) { r -= CARDS[id].limit; if (r <= 0) { issued[id] = (issued[id] ?? 0) + 1; return id; } }
    const id = usePool[0];
    issued[id] = (issued[id] ?? 0) + 1;
    return id;
  }
  return 'p1001';
}
export function rollRank(rank: Rank, rnd: () => number = Math.random): string {
  const pool = BY_RANK[rank].length ? BY_RANK[rank] : BY_RANK.A;
  return pool[Math.floor(rnd() * pool.length)];
}

// ------------------------------------------------------------------ towns / world
export interface Poi { id: string; name: string; sub: string; x: number; z: number; r: number; tier: number; color: string; icon: string; style: string }
export const MAP_R = 9000;
/** Official-map layout (north up, 1 px = 11.5 m). z grows southwards. */
export const POIS: Poi[] = [
  { id: 'limeiro', name: 'Limeiro', sub: "Capital · Walled Royal City", x: 4358, z: -4933, r: 520, tier: 3, color: '#ffd24a', icon: '🏰', style: 'castle' },
  { id: 'antokiba', name: 'Antokiba', sub: 'City of Prizes · Wig & Pen · Trade Shops', x: 563, z: -69, r: 460, tier: 2, color: '#ffb35a', icon: '🏆', style: 'market' },
  { id: 'rubicuta', name: 'Rubicuta', sub: 'Farming Town', x: 2220, z: 2909, r: 380, tier: 1, color: '#9ad36a', icon: '🏘️', style: 'village' },
  { id: 'shiso', name: 'Shiso Tree', sub: 'Starting Point · Eta', x: -230, z: 1943, r: 250, tier: 1, color: '#7be08a', icon: '🌳', style: 'tree' },
  { id: 'masadora', name: 'Masadora', sub: 'Magic City · Spell Card Shop', x: 862, z: -2484, r: 470, tier: 2, color: '#b58cff', icon: '🔮', style: 'magic' },
  { id: 'aiai', name: 'Aiai', sub: 'City of Love', x: 4358, z: 5255, r: 420, tier: 1, color: '#ff7ab8', icon: '💗', style: 'love' },
  { id: 'dodgeball', name: "Razor's Dodgeball Court", sub: 'Minigame', x: 3150, z: 3950, r: 120, tier: 1, color: '#ff5a5a', icon: '🏐', style: 'court' },
  { id: 'dorias', name: 'Dorias', sub: 'Gambling City', x: -3634, z: 2254, r: 450, tier: 2, color: '#ff4fd8', icon: '🎰', style: 'casino' },
  { id: 'bunzen', name: 'Bunzen', sub: 'Forest Town', x: -115, z: -3921, r: 290, tier: 1, color: '#5fbf6a', icon: '🌲', style: 'forest' },
  { id: 'soufrabi', name: 'Soufrabi', sub: 'Port City', x: -2484, z: -5612, r: 450, tier: 2, color: '#5ab0ff', icon: '⚓', style: 'port' },
  { id: 'lighthouse', name: 'Pirate Lighthouse', sub: "Razor's Pirates · Dungeon", x: -3289, z: -5934, r: 110, tier: 3, color: '#6ad0ff', icon: '🗼', style: 'lighthouse' },
  { id: 'port', name: 'Greed Island Port', sub: 'Elena · Harbormaster', x: -2358, z: -840, r: 340, tier: 1, color: '#4fd0e8', icon: '🚢', style: 'port2' },
  { id: 'badlands', name: 'Badlands Camp', sub: "Biscuit's Training Ground · Cyclops Canyon", x: 4588, z: -1621, r: 260, tier: 2, color: '#e0894a', icon: '🏜️', style: 'camp' },
  { id: 'bandits', name: 'Mountain Bandit Village', sub: 'Sick Villagers', x: 1782, z: -771, r: 250, tier: 1, color: '#9aa7b8', icon: '⛰️', style: 'village2' },
  { id: 'mansion', name: 'Gold Dust Mansion', sub: 'Gold Dust Girl', x: 1598, z: -4036, r: 150, tier: 2, color: '#ffd24a', icon: '✨', style: 'mansion' },
  { id: 'bomber', name: 'Bomber Hideout', sub: "Genthru's lair", x: -4380, z: -2312, r: 170, tier: 3, color: '#ff6a3a', icon: '💣', style: 'hideout' },
];
export const DUNGEONS = [
  { id: 'mine', name: 'Forgotten Mine', x: 3669, z: 678, color: '#c9a24a' },
  { id: 'temple', name: 'Sunken Temple', x: 449, z: 3438, color: '#6ad0ff' },
  { id: 'den', name: "Dragon's Den", x: 5040, z: 2863, color: '#ff6a3a' },
  { id: 'crypt', name: 'Hunter Crypt', x: -2657, z: 2978, color: '#b58cff' },
];
export const LAKES: { x: number; z: number; r: number }[] = [];
export const ROADS: [string, string][] = [
  ['shiso', 'antokiba'], ['antokiba', 'port'], ['antokiba', 'masadora'], ['masadora', 'bunzen'], ['bunzen', 'soufrabi'], ['port', 'soufrabi'], ['masadora', 'limeiro'],
  ['bandits', 'badlands'], ['antokiba', 'bandits'], ['bandits', 'masadora'], ['shiso', 'dorias'], ['shiso', 'rubicuta'], ['rubicuta', 'aiai'], ['aiai', 'dodgeball'],
  ['badlands', 'limeiro'], ['dorias', 'port'], ['masadora', 'mansion'], ['dorias', 'bomber'], ['soufrabi', 'lighthouse'], ['rubicuta', 'bandits'], ['bandits', 'dodgeball'],
];
export const poi = (id: string) => POIS.find((p) => p.id === id)!;
export const BADLANDS_C = { x: 4588, z: -1621, r: 2000 };
export const HIGHLAND_C = { x: -4380, z: -2312, r: 1200 };

/** Nen Barrier: [start, end, radius, dps % max HP] – first shrink after 1:00, fully closed by 25:00 */
export const ZONE_PHASES: { t0: number; t1: number; r: number; dps: number }[] = [
  { t0: 1200, t1: 1560, r: 6700, dps: 1.2 },
  { t0: 1680, t1: 1980, r: 4700, dps: 1.6 },
  { t0: 2100, t1: 2340, r: 3100, dps: 2.2 },
  { t0: 2430, t1: 2610, r: 1900, dps: 3 },
  { t0: 2670, t1: 2790, r: 1000, dps: 4.2 },
  { t0: 2820, t1: 2910, r: 450, dps: 5.5 },
  { t0: 2930, t1: 2990, r: 160, dps: 7 },
  { t0: 2995, t1: 3000, r: 0, dps: 10 },
];
export const MATCH_LEN = 3000;
export const BARRIER_T = 1200;

// ------------------------------------------------------------------ monsters
export interface MonDef {
  id: string; name: string; hp: number; spd: number; scale: number; tint: number; dmg: number; range: number; aggro: number; leash: number;
  atk: 'melee' | 'slam' | 'charge' | 'pounce' | 'volley' | 'bomb' | 'heal'; cd: number; xp: number; jenny: [number, number];
  drop?: { tier: number; n: number; min?: Rank }; boss?: boolean; variant: number; ally?: boolean; desc: string; model?: string; biome?: string; pack?: number;
}
export const MONS: Record<string, MonDef> = {
  cyclops: { id: 'cyclops', name: 'Cyclops', hp: 520, spd: 6.4, scale: 2.2, tint: 0xb08a62, dmg: 30, range: 5.6, aggro: 32, leash: 70, atk: 'slam', cd: 3.2, xp: 70, jenny: [800, 2000], drop: { tier: 1, n: 2 }, variant: 0, model: 'cyclops', desc: 'One-eyed giants of the badlands. Strike the eye and they turn into a card.' },
  beetle: { id: 'beetle', name: 'King White Stag Beetle', hp: 400, spd: 9.5, scale: 1.7, tint: 0xe9e4d2, dmg: 28, range: 4.6, aggro: 30, leash: 60, atk: 'charge', cd: 3.6, xp: 80, jenny: [900, 2200], drop: { tier: 2, n: 2 }, variant: 1, model: 'beetle', desc: 'A giant insect that guards rare items.' },
  locust: { id: 'locust', name: 'Pearl Locust', hp: 140, spd: 11, scale: 1, tint: 0xd8f0e8, dmg: 12, range: 3.6, aggro: 26, leash: 50, atk: 'pounce', cd: 1.6, xp: 25, jenny: [200, 600], drop: { tier: 0, n: 1 }, variant: 2, model: 'locust', desc: 'Swarming pearl-shelled insects.' },
  beast: { id: 'beast', name: 'Bunzen Forest Beast', hp: 680, spd: 10, scale: 2.0, tint: 0x4f7a4a, dmg: 34, range: 5, aggro: 34, leash: 80, atk: 'pounce', cd: 2.6, xp: 95, jenny: [1000, 2600], drop: { tier: 2, n: 2 }, variant: 3, model: 'beast', desc: 'A magical beast that attacks anyone entering its territory.' },
  golem: { id: 'golem', name: 'Dungeon Guardian', hp: 2000, spd: 6.4, scale: 2.5, tint: 0x8a8a9a, dmg: 42, range: 6.4, aggro: 38, leash: 55, atk: 'slam', cd: 2.8, xp: 220, jenny: [3000, 6000], drop: { tier: 3, n: 3 }, boss: true, variant: 0, model: 'golem', desc: 'A dungeon boss. Bring friends.' },
  pirate: { id: 'pirate', name: "Razor's Pirate", hp: 320, spd: 8, scale: 1.25, tint: 0x4a6aa8, dmg: 20, range: 4.4, aggro: 30, leash: 60, atk: 'melee', cd: 1.6, xp: 55, jenny: [600, 1400], drop: { tier: 1, n: 1 }, variant: 1, desc: "Razor's pirates guard the Soufrabi lighthouse." },
  captain: { id: 'captain', name: 'Pirate Captain', hp: 3400, spd: 7.4, scale: 2.0, tint: 0x2c4a9a, dmg: 40, range: 6, aggro: 40, leash: 60, atk: 'slam', cd: 2.4, xp: 320, jenny: [4000, 8000], drop: { tier: 3, n: 3 }, boss: true, variant: 2, desc: 'The lighthouse boss. Soufrabi legend says it takes a team of fifteen.' },
  guard: { id: 'guard', name: 'Gold Dust Guard', hp: 1300, spd: 8.2, scale: 1.6, tint: 0x6a5a3a, dmg: 34, range: 5, aggro: 34, leash: 50, atk: 'melee', cd: 1.9, xp: 160, jenny: [2000, 4500], drop: { tier: 2, n: 2 }, boss: true, variant: 3, desc: 'Guards the Gold Dust Girl.' },
  genthru: { id: 'genthru', name: 'Genthru the Bomber', hp: 4200, spd: 8.6, scale: 1.45, tint: 0x6a2a2a, dmg: 36, range: 30, aggro: 70, leash: 140, atk: 'bomb', cd: 2.2, xp: 500, jenny: [8000, 14000], drop: { tier: 3, n: 4, min: 'A' }, boss: true, variant: 1, desc: 'WORLD BOSS. Convicted Bomber – plants Little Flower bombs on anyone.' },
  lizard: { id: 'lizard', name: 'Melanin Lizard', hp: 1500, spd: 9, scale: 3.2, tint: 0x3a3a46, dmg: 46, range: 7, aggro: 44, leash: 90, atk: 'charge', cd: 3.4, xp: 190, jenny: [2000, 4500], drop: { tier: 2, n: 3 }, variant: 0, model: 'lizard', biome: 'badlands', desc: 'A gigantic black lizard that stalks the Badlands. Gon and Killua had to hide from it.' },
  puffball: { id: 'puffball', name: 'Hyper Puffball', hp: 200, spd: 7, scale: 1.4, tint: 0xf0c0ff, dmg: 14, range: 14, aggro: 30, leash: 60, atk: 'volley', cd: 1.7, xp: 45, jenny: [300, 900], drop: { tier: 1, n: 1 }, variant: 2, model: 'puffball', biome: 'lowland', desc: 'A spiky floating fluffball that fires needle spores.' },
  bubblehorse: { id: 'bubblehorse', name: 'Bubble Horse', hp: 420, spd: 15, scale: 1.7, tint: 0xffe0e0, dmg: 24, range: 18, aggro: 36, leash: 90, atk: 'bomb', cd: 2.6, xp: 90, jenny: [900, 2200], drop: { tier: 2, n: 2, min: 'C' }, variant: 3, model: 'horse', biome: 'lowland', desc: 'Blows red and white bubbles that burst with a deafening bang. Switch between Ten and Zetsu to catch it.' },
  wolf: { id: 'wolf', name: 'Wolf Pack Hunter', hp: 210, spd: 14, scale: 1.05, tint: 0x8a8f9a, dmg: 17, range: 3.8, aggro: 38, leash: 80, atk: 'pounce', cd: 1.5, xp: 35, jenny: [250, 700], drop: { tier: 0, n: 1 }, variant: 3, model: 'wolf', biome: 'forest', pack: 4, desc: 'Wolves hunt in packs and circle their prey.' },
  rat: { id: 'rat', name: 'Radio Rat', hp: 110, spd: 12, scale: 0.8, tint: 0x9a8a7a, dmg: 11, range: 3, aggro: 24, leash: 50, atk: 'pounce', cd: 1.3, xp: 20, jenny: [150, 450], drop: { tier: 0, n: 1 }, variant: 2, model: 'rat', biome: 'coast', desc: 'A rat with a little antenna – steals cards from careless hunters.' },
  melanin: { id: 'melanin', name: 'Dune Scorpion', hp: 640, spd: 9, scale: 1.9, tint: 0xc08a50, dmg: 34, range: 5, aggro: 34, leash: 70, atk: 'pounce', cd: 2.2, xp: 100, jenny: [900, 2400], drop: { tier: 2, n: 2 }, variant: 1, model: 'scorpion', biome: 'badlands', desc: 'Badlands ambush hunter.' },
  a_cyclops: { id: 'a_cyclops', name: 'Giant Cyclops', hp: 380, spd: 7, scale: 2, tint: 0xb08a62, dmg: 26, range: 5.4, aggro: 40, leash: 90, atk: 'slam', cd: 3, xp: 0, jenny: [0, 0], variant: 0, ally: true, model: 'cyclops', desc: '' },
  a_dino: { id: 'a_dino', name: 'Miniature Dino', hp: 300, spd: 10, scale: 1.3, tint: 0x6aaa4a, dmg: 22, range: 4.2, aggro: 40, leash: 90, atk: 'pounce', cd: 1.8, xp: 0, jenny: [0, 0], variant: 1, ally: true, model: 'dino', desc: '' },
  a_dragon: { id: 'a_dragon', name: 'Miniature Dragon', hp: 360, spd: 10, scale: 1.4, tint: 0xd04a3a, dmg: 20, range: 26, aggro: 44, leash: 90, atk: 'volley', cd: 1.2, xp: 0, jenny: [0, 0], variant: 2, ally: true, model: 'dragon', desc: '' },
  a_beetle: { id: 'a_beetle', name: 'King White Stag Beetle', hp: 520, spd: 9, scale: 1.6, tint: 0xe9e4d2, dmg: 24, range: 4.6, aggro: 40, leash: 90, atk: 'charge', cd: 3.2, xp: 0, jenny: [0, 0], variant: 1, ally: true, model: 'beetle', desc: '' },
  a_dog: { id: 'a_dog', name: 'Silver Dog', hp: 280, spd: 13, scale: 1.1, tint: 0xd8dde8, dmg: 20, range: 3.6, aggro: 50, leash: 100, atk: 'pounce', cd: 1.1, xp: 0, jenny: [0, 0], variant: 3, ally: true, model: 'wolf', desc: '' },
  a_panda: { id: 'a_panda', name: 'Panda Maid', hp: 420, spd: 9, scale: 1.35, tint: 0xf2f2f2, dmg: 22, range: 4.2, aggro: 40, leash: 90, atk: 'heal', cd: 1.6, xp: 0, jenny: [0, 0], variant: 0, ally: true, model: 'panda', desc: '' },
  a_mermaid: { id: 'a_mermaid', name: 'Miniature Mermaid', hp: 240, spd: 8, scale: 1.0, tint: 0x6ad0ff, dmg: 16, range: 24, aggro: 40, leash: 90, atk: 'volley', cd: 1.3, xp: 0, jenny: [0, 0], variant: 2, ally: true, model: 'mermaid', desc: '' },
};

// ------------------------------------------------------------------ personalities (99 unique)
export interface Pers {
  id: number; title: string; arche: string; temper: string; style: 'chill' | 'toxic' | 'polite' | 'lore' | 'noob' | 'sweat'; blurb: string;
  aggr: number; caution: number; greed: number; curio: number; skill: number; patience: number; social: number; spells: number; healAt: number; tilt: number;
}
type TK = 'aggr' | 'caution' | 'greed' | 'curio' | 'skill' | 'patience' | 'social' | 'spells' | 'healAt' | 'tilt';
const ARCH: [string, Pers['style'], Partial<Record<TK, number>>, string][] = [
  ['Card Hoarder', 'polite', { greed: 0.9, curio: 0.7, aggr: 0.3 }, 'Searches every chest and never leaves a card behind.'],
  ['Trigger-Happy', 'toxic', { aggr: 0.95, caution: 0.15, patience: 0.1 }, 'Shoots first, asks never.'],
  ['Cautious Scout', 'polite', { caution: 0.9, aggr: 0.25, curio: 0.6, skill: 0.6 }, 'Keeps distance and watches before moving.'],
  ['Zone Runner', 'chill', { caution: 0.6, patience: 0.1, curio: 0.3 }, 'Always moves early to stay ahead of the Barrier.'],
  ['Camper', 'chill', { patience: 0.95, aggr: 0.4, caution: 0.8 }, 'Sits in a building waiting for prey.'],
  ['Bounty Hunter', 'sweat', { aggr: 0.7, greed: 0.8, skill: 0.75 }, 'Tracks players carrying valuable cards.'],
  ['Monster Slayer', 'chill', { aggr: 0.6, curio: 0.6, skill: 0.65 }, 'Farms beasts for rare drops.'],
  ['Casino Rat', 'toxic', { greed: 0.8, curio: 0.8, caution: 0.3 }, 'Cannot resist a slot machine.'],
  ['Quest Junkie', 'polite', { curio: 0.9, aggr: 0.3, social: 0.6 }, 'Chases every NPC mission.'],
  ['Trader', 'polite', { social: 0.9, aggr: 0.15, greed: 0.6 }, 'Always offering a swap.'],
  ['Pacifist', 'polite', { aggr: 0.05, caution: 0.8, social: 0.8 }, 'Only fights when cornered.'],
  ['Vulture', 'toxic', { aggr: 0.8, patience: 0.7, caution: 0.5 }, 'Waits for fights to end, then pounces.'],
  ['Duelist', 'lore', { aggr: 0.7, skill: 0.8, social: 0.3 }, 'Prefers honorable one-on-ones.'],
  ['Sweat', 'sweat', { skill: 0.95, aggr: 0.75, caution: 0.5 }, 'Plays to win every fight.'],
  ['Newbie', 'noob', { skill: 0.15, curio: 0.8, caution: 0.3 }, 'Still learning the island.'],
  ['Show-off', 'toxic', { aggr: 0.65, skill: 0.5, tilt: 0.5 }, 'Taunts and emotes mid-fight.'],
  ['Rager', 'toxic', { aggr: 0.8, tilt: 0.95, skill: 0.45 }, 'Tilts hard after taking damage.'],
  ['Sneaky Thief', 'toxic', { greed: 0.85, caution: 0.7, spells: 0.8 }, 'Loves Pickpocket and Mug.'],
  ['Explorer', 'chill', { curio: 0.95, aggr: 0.3, patience: 0.2 }, 'Hunts hidden dungeons and ruins.'],
  ['Medic', 'polite', { healAt: 0.7, caution: 0.7, social: 0.8, aggr: 0.25 }, 'Heals early and often.'],
  ['Berserker', 'toxic', { aggr: 0.95, caution: 0.05, healAt: 0.1 }, 'Never retreats.'],
  ['Strategist', 'lore', { skill: 0.8, caution: 0.7, spells: 0.8, patience: 0.7 }, 'Plans around spell cards and zones.'],
  ['Lone Wolf', 'chill', { social: 0.05, aggr: 0.6, skill: 0.7 }, 'Avoids everyone, even allies.'],
  ['Team Player', 'polite', { social: 0.95, aggr: 0.5, skill: 0.6 }, 'Always sticks with the squad.'],
  ['Coward', 'noob', { caution: 0.98, aggr: 0.1, healAt: 0.85 }, 'Runs at the first sign of danger.'],
  ['Veteran', 'lore', { skill: 0.85, caution: 0.65, patience: 0.6, spells: 0.6 }, 'Seen it all on Greed Island.'],
  ['Lucky Charm', 'chill', { curio: 0.6, greed: 0.5, skill: 0.4 }, 'Somehow always finds rare cards.'],
  ['Gold Digger', 'toxic', { greed: 0.95, aggr: 0.45 }, 'Obsessed with Jenny.'],
  ['Lore Nerd', 'lore', { curio: 0.8, social: 0.7, skill: 0.55 }, "Quotes Ging's notes mid-battle."],
  ['Speed Runner', 'sweat', { patience: 0.05, skill: 0.7, curio: 0.4, aggr: 0.55 }, 'Dashes everywhere.'],
  ['Ambusher', 'sweat', { patience: 0.85, aggr: 0.75, caution: 0.6, skill: 0.7 }, 'Strikes from the treeline.'],
  ['Spellcaster', 'lore', { spells: 0.98, skill: 0.6, greed: 0.6 }, 'Lives and dies by the Binder.'],
  ['Loot Goblin', 'chill', { greed: 0.9, curio: 0.9, aggr: 0.3, caution: 0.4 }, 'Grabs everything that glows.'],
];
const TEMPER: [string, Partial<Record<TK, number>>][] = [
  ['Bold', { aggr: 0.15, caution: -0.15 }],
  ['Careful', { aggr: -0.12, caution: 0.2, patience: 0.1 }],
  ['Chaotic', { curio: 0.15, skill: -0.05, tilt: 0.12 }],
];
const clamp = (v: number, a = 0.04, b = 0.98) => Math.min(b, Math.max(a, v));
const hash = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

export function makePersonalities(): Pers[] {
  const out: Pers[] = [];
  let id = 0;
  for (const [an, style, tr, blurb] of ARCH) {
    for (const [tn, tt] of TEMPER) {
      const base: Record<TK, number> = { aggr: 0.5, caution: 0.5, greed: 0.5, curio: 0.5, skill: 0.5, patience: 0.4, social: 0.4, spells: 0.4, healAt: 0.4, tilt: 0.3 };
      for (const k of Object.keys(base) as TK[]) base[k] = clamp(base[k] * 0.35 + (tr[k] ?? base[k]) * 0.65 + (tt[k] ?? 0) + (hash(id * 11 + k.length * 7 + k.charCodeAt(0)) - 0.5) * 0.14);
      out.push({ id, title: `${tn} ${an}`, arche: an, temper: tn, style, blurb, ...base });
      id++;
    }
  }
  return out;
}

const NA = ['Shadow', 'Neon', 'Crimson', 'Silent', 'Golden', 'Lucky', 'Rapid', 'Frozen', 'Hollow', 'Nova', 'Iron', 'Mystic', 'Savage', 'Swift', 'Wild', 'Dark', 'Pixel', 'Toxic', 'Turbo', 'Zen', 'Cosmic', 'Phantom', 'Lunar', 'Rusty', 'Velvet'];
const NB = ['Fang', 'Wolf', 'Hunter', 'Blade', 'Fox', 'Raven', 'Viper', 'Mage', 'King', 'Ace', 'Ghost', 'Dragon', 'Panda', 'Cat', 'Cyclops', 'Gambler', 'Joker', 'Knight', 'Nomad', 'Ninja', 'Moth', 'Hawk', 'Tiger', 'Rogue', 'Sage'];
export function makeNames(n: number): string[] {
  const set = new Set<string>();
  const out: string[] = [];
  let guard = 0;
  while (out.length < n && guard++ < 5000) {
    const a = NA[Math.floor(Math.random() * NA.length)];
    const b = NB[Math.floor(Math.random() * NB.length)];
    const r = Math.random();
    const nm = r < 0.55 ? a + b : r < 0.75 ? `${a}${b}${Math.floor(Math.random() * 99)}` : r < 0.88 ? `${a}_${b}` : r < 0.95 ? `xX${a}${b}Xx` : `${b}${Math.floor(Math.random() * 900 + 10)}`;
    if (!set.has(nm)) { set.add(nm); out.push(nm); }
  }
  return out;
}

export const CHAT: Record<Pers['style'], Record<'greet' | 'taunt' | 'kill' | 'die' | 'hurt' | 'loot' | 'flee', string[]>> = {
  chill: { greet: ['yo', 'hey there', 'nice day on the island'], taunt: ['easy', 'relax lol'], kill: ['gg', 'good fight'], die: ['ok that was fair', 'gg'], hurt: ['ow', 'hey!'], loot: ['ooh shiny', 'nice card'], flee: ['brb', 'not today'] },
  toxic: { greet: ['oh look, free loot', 'you lost?'], taunt: ['ez', 'trash', 'too slow'], kill: ['ez clap', 'sit down', 'get good'], die: ['lag!!', 'no way', 'hacker'], hurt: ['bro??', 'cheater'], loot: ['MINE', 'thanks for the card'], flee: ['fine, fine', 'cheap'] },
  polite: { greet: ['hello!', 'good luck out there', 'want to trade?'], taunt: ['sorry!'], kill: ['sorry, gg', 'well played'], die: ['well played!', 'good one'], hurt: ['ouch', 'hey, careful'], loot: ['thank you!', 'lucky me'], flee: ['please no', 'excuse me!'] },
  lore: { greet: ["Ging's masterpiece…", 'Another hunter enters the game'], taunt: ['A true hunter never hesitates', 'Observe.'], kill: ['Nen does not forgive', 'Balance restored'], die: ['The island always wins', 'Impressive.'], hurt: ['Not bad.', 'A worthy opponent'], loot: ['A rare card!', 'Fascinating'], flee: ['A tactical retreat', 'Not yet.'] },
  noob: { greet: ['hi!!', 'omg another player', 'how do i open binder'], taunt: ['please dont hurt me'], kill: ['wait i won??', 'oh wow'], die: ['aww', 'i tried'], hurt: ['AAA', 'help!'], loot: ['what does this do', 'is this good?'], flee: ['RUN', 'nope nope nope'] },
  sweat: { greet: ['locked in', 'no mercy'], taunt: ['predictable', 'outplayed'], kill: ['next', 'clean'], die: ['GG, rematch', 'respect'], hurt: ['tracked', 'sloppy'], loot: ['value', 'tier up'], flee: ['reset', 'repositioning'] },
};
