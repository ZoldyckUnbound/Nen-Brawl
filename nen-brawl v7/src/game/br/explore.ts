/**
 * Cartography: the map is a window on the world, not a HUD overlay.
 *
 * Every metre the player actually walks is remembered in ~90 m cells. With no map card that memory is ALL
 * you have (see BrHud's fog of war); a chart/atlas reveals the island layer underneath it. The store lives
 * in its own module so the minimap, the full map and the game loop can share one copy without a cycle.
 */
export const EXPLORED_CELL = 90;
export const explored = new Set<string>();
/** true once we hold an atlas: with the whole island revealed the fog sheet is pointless and only darkens the sea */
export let atlasHeld = false;
export function setAtlas(v: boolean) { atlasHeld = v; }
/** chart/atlas holders saw the island once already – start them with the coarse island visible */
export function seedChart() {
  for (let x = -8500; x <= 8500; x += 600) for (let z = -8500; z <= 8500; z += 600) explored.add(Math.floor((x + 8500) / EXPLORED_CELL) + ',' + Math.floor((z + 8500) / EXPLORED_CELL));
}
let lastKey = '';
/** remember the cell under (x, z) – cheap enough to call every frame */
export function markExplored(x: number, z: number, worldW: number) {
  const i = Math.floor((x + worldW / 2) / EXPLORED_CELL), j = Math.floor((z + worldW / 2) / EXPLORED_CELL);
  const k = i + ',' + j;
  if (k === lastKey) return;
  lastKey = k;
  explored.add(k);
  // also reveal the ring around you so the edge of the fog is not a staircase
  for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) explored.add((i + a) + ',' + (j + b));
}
