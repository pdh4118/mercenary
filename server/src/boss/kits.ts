import type { KitDef } from "./types.js";
import { cavalryKit } from "./cavalry.js";
import { spearKit } from "./spear.js";
import { archerKit } from "./archer.js";
import { shieldKit } from "./shield.js";
import { bluntKit } from "./blunt.js";
import { mageKit } from "./mage.js";
import { mountedKit } from "./mounted.js";
import { chariotKit } from "./chariot.js";
import { necroKit } from "./necro.js";

/** 스테이지 번호 → 그 스테이지 장군의 스킬 목록 */
export const KITS: Record<number, KitDef> = {
  1: cavalryKit,
  2: spearKit,
  3: archerKit,
  4: shieldKit,
  5: bluntKit,
  6: mageKit,
  7: mountedKit,
  8: chariotKit,
  9: necroKit,
};
