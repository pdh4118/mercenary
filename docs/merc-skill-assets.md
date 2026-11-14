# 용병 승급 스킬 에셋 요청 (그림 24 + 이펙트 + 효과음)

레벨·승급 스킬(베타 1.311)에 쓸 그림과 소리입니다. 지금은 스킬 이름 글자와 임시 도형(고리·직선)만 나옵니다. 프롬프트는 영어, 그대로 붙여넣으면 됩니다.
**공통 첨부**: `docs/style-reference/main_style_sheet.png`(스타일 기준) 한 장. 이펙트는 이 한 장만, 아이콘은 한 장으로 충분합니다.
**우선순위**: ① 아이콘 24종(패널·도크에 바로 쓰임) → ② 이펙트(이동·은신 → 타격·방어 → 지면·마법) → ③ 효과음.
**받은 뒤**: 칸마다 같은 기준점으로 잘라(`tools/slice_sheet.py`, 필요하면 `--min-height`·`--attach`), `python3 tools/make_webp.py`로 webp를 만들고 `docs/asset-prompts.md` 진행표에 적습니다. 예전 그림이 있으면 `_old`로 보관합니다.

## 1. 스킬 아이콘 24종 (병종마다 4장 한 시트, 총 6번 요청)

**규칙**: 패시브는 은청색 테두리, 액티브는 금색 테두리로 구분합니다(게임 화면에서 한눈에 구분). 글자는 넣지 않습니다. 40px로 줄여도 알아보도록 상징 하나를 크게 그립니다.

### 1. 궁병 아이콘 4종 - `assets/ui/mskill_archer_1~4`

```
Generate an image. I attached images: Image 1 is the art STYLE reference (copy its flat cel-shaded, thick-outlined cartoon style exactly).

Make ONE sprite sheet image with four square skill ICONS side by side in one row, each large and clearly separated with at least 40px of empty space around it, captions "mskill_archer_1", "mskill_archer_2", "mskill_archer_3", "mskill_archer_4". Plain flat light-gray background, no logo or watermark.

Each icon is a rounded-square badge about 128x128 with a thick near-black outline about 3px and a dark flat-colored background, with ONE simple bold symbol drawn big in the middle (readable when shrunk to 40px). PASSIVE skills have a SILVER-BLUE border ring, ACTIVE skills have a GOLD border ring. The symbols:
- "mskill_archer_1" (passive): a bow arrow with a green dripping poison drop on the tip, a purple-green skull-free droplet
- "mskill_archer_2" (active): a boot print with a curved arrow jumping up and backward and a small dust puff
- "mskill_archer_3" (passive): an arrow with a light-blue ice crystal tip and a small snowflake
- "mskill_archer_4" (active): a hooded head silhouette drawn with a dashed fading outline and half transparent, one small bright eye

Style: cute chibi cartoon like Image 1, flat cel-shaded colors in 2-3 tones, thick dark outline, no gradients, no glow blur, no realistic rendering, no text or letters inside the icons.

Avoid: realistic style, gradients, glow blur, thin lines, tiny details, text inside icons, cropped items, checkerboard pattern, logo, watermark, any text other than the four captions.
```

### 2. 기병 아이콘 4종 - `assets/ui/mskill_cav_1~4`

```
Generate an image. I attached images: Image 1 is the art STYLE reference (copy its flat cel-shaded, thick-outlined cartoon style exactly).

Make ONE sprite sheet image with four square skill ICONS side by side in one row, each large and clearly separated with at least 40px of empty space around it, captions "mskill_cav_1", "mskill_cav_2", "mskill_cav_3", "mskill_cav_4". Plain flat light-gray background, no logo or watermark.

Each icon is a rounded-square badge about 128x128 with a thick near-black outline about 3px and a dark flat-colored background, with ONE simple bold symbol drawn big in the middle (readable when shrunk to 40px). PASSIVE skills have a SILVER-BLUE border ring, ACTIVE skills have a GOLD border ring. The symbols:
- "mskill_cav_1" (passive): a lance piercing straight through three round targets in a row, with a small shock burst
- "mskill_cav_2" (active): three horse heads in a diagonal line charging together with speed lines
- "mskill_cav_3" (passive): an armored horse chest plate (barding) with a rivet and a small cross
- "mskill_cav_4" (active): a translucent pale-blue ghost horse with a ghost rider charging, a faint trail behind

Style: cute chibi cartoon like Image 1, flat cel-shaded colors in 2-3 tones, thick dark outline, no gradients, no glow blur, no realistic rendering, no text or letters inside the icons.

Avoid: realistic style, gradients, glow blur, thin lines, tiny details, text inside icons, cropped items, checkerboard pattern, logo, watermark, any text other than the four captions.
```

### 3. 창병 아이콘 4종 - `assets/ui/mskill_spear_1~4`

```
Generate an image. I attached images: Image 1 is the art STYLE reference (copy its flat cel-shaded, thick-outlined cartoon style exactly).

Make ONE sprite sheet image with four square skill ICONS side by side in one row, each large and clearly separated with at least 40px of empty space around it, captions "mskill_spear_1", "mskill_spear_2", "mskill_spear_3", "mskill_spear_4". Plain flat light-gray background, no logo or watermark.

Each icon is a rounded-square badge about 128x128 with a thick near-black outline about 3px and a dark flat-colored background, with ONE simple bold symbol drawn big in the middle (readable when shrunk to 40px). PASSIVE skills have a SILVER-BLUE border ring, ACTIVE skills have a GOLD border ring. The symbols:
- "mskill_spear_1" (passive): a long spear piercing through two shields in a row
- "mskill_spear_2" (active): a spear flying through the air along a curved dotted arc
- "mskill_spear_3" (passive): two spear tips thrusting forward one after the other with two small impact bursts
- "mskill_spear_4" (active): a spear thrust forward with a dash of speed lines behind and a boot

Style: cute chibi cartoon like Image 1, flat cel-shaded colors in 2-3 tones, thick dark outline, no gradients, no glow blur, no realistic rendering, no text or letters inside the icons.

Avoid: realistic style, gradients, glow blur, thin lines, tiny details, text inside icons, cropped items, checkerboard pattern, logo, watermark, any text other than the four captions.
```

### 4. 검방병 아이콘 4종 - `assets/ui/mskill_shield_1~4`

```
Generate an image. I attached images: Image 1 is the art STYLE reference (copy its flat cel-shaded, thick-outlined cartoon style exactly).

Make ONE sprite sheet image with four square skill ICONS side by side in one row, each large and clearly separated with at least 40px of empty space around it, captions "mskill_shield_1", "mskill_shield_2", "mskill_shield_3", "mskill_shield_4". Plain flat light-gray background, no logo or watermark.

Each icon is a rounded-square badge about 128x128 with a thick near-black outline about 3px and a dark flat-colored background, with ONE simple bold symbol drawn big in the middle (readable when shrunk to 40px). PASSIVE skills have a SILVER-BLUE border ring, ACTIVE skills have a GOLD border ring. The symbols:
- "mskill_shield_1" (passive): a round shield covered with sharp spikes
- "mskill_shield_2" (active): a shield pushing forward with a white impact burst in front of it
- "mskill_shield_3" (passive): a shield with a small ally silhouette standing behind it and a small heart
- "mskill_shield_4" (active): a shield inside a glowing dome ring (barrier circle) with three small arrows pointing inward to it

Style: cute chibi cartoon like Image 1, flat cel-shaded colors in 2-3 tones, thick dark outline, no gradients, no glow blur, no realistic rendering, no text or letters inside the icons.

Avoid: realistic style, gradients, glow blur, thin lines, tiny details, text inside icons, cropped items, checkerboard pattern, logo, watermark, any text other than the four captions.
```

### 5. 둔기병 아이콘 4종 - `assets/ui/mskill_blunt_1~4`

```
Generate an image. I attached images: Image 1 is the art STYLE reference (copy its flat cel-shaded, thick-outlined cartoon style exactly).

Make ONE sprite sheet image with four square skill ICONS side by side in one row, each large and clearly separated with at least 40px of empty space around it, captions "mskill_blunt_1", "mskill_blunt_2", "mskill_blunt_3", "mskill_blunt_4". Plain flat light-gray background, no logo or watermark.

Each icon is a rounded-square badge about 128x128 with a thick near-black outline about 3px and a dark flat-colored background, with ONE simple bold symbol drawn big in the middle (readable when shrunk to 40px). PASSIVE skills have a SILVER-BLUE border ring, ACTIVE skills have a GOLD border ring. The symbols:
- "mskill_blunt_1" (passive): a mace smashing a cracked armor plate, pieces flying
- "mskill_blunt_2" (active): a mace raised overhead with a big curved arrow pointing down and a dust puff
- "mskill_blunt_3" (passive): a mace head with three ripple rings spreading outward
- "mskill_blunt_4" (active): a ground surface with big zigzag cracks and rocks jumping up

Style: cute chibi cartoon like Image 1, flat cel-shaded colors in 2-3 tones, thick dark outline, no gradients, no glow blur, no realistic rendering, no text or letters inside the icons.

Avoid: realistic style, gradients, glow blur, thin lines, tiny details, text inside icons, cropped items, checkerboard pattern, logo, watermark, any text other than the four captions.
```

### 6. 마법사 아이콘 4종 - `assets/ui/mskill_mage_1~4`

```
Generate an image. I attached images: Image 1 is the art STYLE reference (copy its flat cel-shaded, thick-outlined cartoon style exactly).

Make ONE sprite sheet image with four square skill ICONS side by side in one row, each large and clearly separated with at least 40px of empty space around it, captions "mskill_mage_1", "mskill_mage_2", "mskill_mage_3", "mskill_mage_4". Plain flat light-gray background, no logo or watermark.

Each icon is a rounded-square badge about 128x128 with a thick near-black outline about 3px and a dark flat-colored background, with ONE simple bold symbol drawn big in the middle (readable when shrunk to 40px). PASSIVE skills have a SILVER-BLUE border ring, ACTIVE skills have a GOLD border ring. The symbols:
- "mskill_mage_1" (passive): a glowing orb with four short lines converging into it from the sides
- "mskill_mage_2" (active): two small portal rings with a sparkle trail and an arrow between them
- "mskill_mage_3" (passive): a small campfire-like flame burning on cracked ground with embers
- "mskill_mage_4" (active): three meteors falling one after another in a diagonal row with fire tails

Style: cute chibi cartoon like Image 1, flat cel-shaded colors in 2-3 tones, thick dark outline, no gradients, no glow blur, no realistic rendering, no text or letters inside the icons.

Avoid: realistic style, gradients, glow blur, thin lines, tiny details, text inside icons, cropped items, checkerboard pattern, logo, watermark, any text other than the four captions.
```
## 2. 스킬 이펙트 (캐릭터 없이 효과만, 시트 3번 요청)

**공통 규칙**: 흰색이 아닌 **단색 연회색 배경**, 칸마다 같은 크기·같은 기준점(효과의 중심)으로, 면을 평평하게 2~3톤 색칠, 굵은 어두운 외곽선(약 2px), 그라데이션·번짐·사실적 연기 금지. 서로 다른 효과는 **줄(행)로 나누고** 줄마다 캡션을 붙입니다. 한 줄은 4컷(또는 3컷)입니다.

### 2-1. 이동·은신 이펙트 - `assets/fx/mskill_jump_0~3`, `mskill_blink_0~3`, `mskill_stealth_0~2`, `mskill_dash_0~2`, `mskill_phantom_0~2`

쓰이는 곳: 궁병 뒤로 점프(출발 자리에 먼지), 마법사 점멸(출발·도착 자리에 보랏빛 반짝임), 궁병 은신(몸 주위 일렁임), 기병 일제 질주(옆으로 흐르는 바람줄), 환영 기병대(환영 기병 뒤에 끌리는 푸른 잔상).

```
Generate an image. I attached one image: Image 1 is the art STYLE reference (copy its flat cel-shaded, thick-outlined cartoon style). Draw short VISUAL EFFECT animations on a plain flat light-gray background, one effect per row, with at least 40px of empty space around each frame. No characters, no ground line, no logo or watermark.

Row 1, four frames, captions "mskill_jump_0" to "mskill_jump_3": a ground DUST POOF from a hard jump-off: a small flat cream-colored puff ring on the ground (frame 0), bigger with three little puffs flying outward (frame 1), the biggest, round and flat (frame 2), only thin pale puffs fading (frame 3).
Row 2, four frames, captions "mskill_blink_0" to "mskill_blink_3": a magic TELEPORT sparkle: a small violet-and-white four-point star flash with a thin ring (frame 0), the ring expands with six small sparkles around it (frame 1), the sparkles drift outward and the ring is faint (frame 2), a few tiny violet dots left (frame 3).
Row 3, three frames, captions "mskill_stealth_0" to "mskill_stealth_2": a STEALTH shimmer: a soft pale-green oval ring of wavy dashed lines (like heat haze), slightly different wave shapes in each frame, getting fainter (frame 0 strongest, frame 2 faintest).
Row 4, three frames, captions "mskill_dash_0" to "mskill_dash_2": WIND speed lines flowing to the left: five thin white-and-pale-yellow horizontal streaks of different lengths with small curled tips, slightly different in each frame.
Row 5, three frames, captions "mskill_phantom_0" to "mskill_phantom_2": a GHOST TRAIL flowing to the left: three tapering translucent pale-blue horizontal streaks with small wisps at the ends, a little different in each frame.
Style: flat cel-shaded shapes in 2-3 tones, thick dark outline about 2px, pale cheerful colors (not neon), no gradients, no glow blur, no realistic smoke. All frames of one row share the same canvas size (about 200x200) and are centered on the same point.

Avoid: gradients, glow blur, realistic smoke, characters, text other than the captions, ground line, logo, watermark.
```

### 2-2. 타격·방어 이펙트 - `assets/fx/mskill_spear_fly`, `mskill_spear_hit_0~2`, `mskill_lunge_0~2`, `mskill_bash_0~2`, `mskill_thorn_0~2`, `mskill_taunt_0~3`

쓰이는 곳: 창 던지기(날아가는 창 한 장과 맞는 순간 3컷), 돌진 찌르기(돌진 줄 3컷), 방패 밀치기(앞으로 퍼지는 충격 3컷), 가시 방패(반사 불꽃 3컷), 도발 결계(주변 고리 4컷).

```
Generate an image. I attached one image: Image 1 is the art STYLE reference (copy its flat cel-shaded, thick-outlined cartoon style). Draw VISUAL EFFECTS on a plain flat light-gray background, one effect per row, with at least 40px of empty space around each item. No characters, no ground line, no logo or watermark.

Row 1, one item, caption "mskill_spear_fly": a single thrown SPEAR flying to the RIGHT: a long wooden shaft, a sharp steel tip, a small red cloth tassel, thin white speed streaks behind it, drawn horizontally about 260x40.
Row 2, three frames, captions "mskill_spear_hit_0" to "mskill_spear_hit_2": the spear HITTING: a sharp white-and-orange starburst with the spear tip poking in from the left (frame 0), the burst at its largest with four small chips flying (frame 1), only small chips and a faint pale puff (frame 2).
Row 3, three frames, captions "mskill_lunge_0" to "mskill_lunge_2": a LUNGE: thick white-and-pale-orange speed streaks converging to a sharp point at the right, with a small star flash at the tip, a little longer in each frame.
Row 4, three frames, captions "mskill_bash_0" to "mskill_bash_2": a SHIELD BASH shockwave: a flat white crescent arc pushing to the right with a few small round chips (frame 0), a bigger arc with a ring of small impact lines (frame 1), a faint wide arc fading (frame 2).
Row 5, three frames, captions "mskill_thorn_0" to "mskill_thorn_2": THORN REFLECT: a small spiky orange-and-white spark burst with five short sharp spikes radiating (frame 0), bigger (frame 1), only tiny sparks left (frame 2).
Row 6, four frames, captions "mskill_taunt_0" to "mskill_taunt_3": a TAUNT RING on the ground seen from a slightly raised three-quarter view: a thin flat red-orange ellipse ring with short inward-pointing triangle marks around it (frame 0), the ring a little wider and brighter (frame 1), the widest with a soft pale inner fill (frame 2), fading (frame 3); loops smoothly.
Style: flat cel-shaded shapes in 2-3 tones, thick dark brown-black outline about 2px, muted warm palette (not neon), no gradients, no glow blur, no realistic smoke. All frames of one row share the same canvas size and are centered on the same point (rows 3-5 about 200x200, row 6 about 400x220).

Avoid: gradients, glow blur, realistic blood, smoke, characters, text other than the captions, ground line, logo, watermark.
```

### 2-3. 지면·마법·화살 이펙트 - `assets/fx/mskill_leap_0~3`, `mskill_quake_0~3`, `mskill_ember_0~3`, `mskill_ice_0~2`, `mskill_poison_0~2`

쓰이는 곳: 둔기병 도약 내려찍기(내려찍는 자리 충격 4컷), 지진(갈라지는 땅과 고리 4컷), 마법사 불씨(운석 자리에 남는 불꽃 4컷 반복), 얼음 화살(맞는 순간 서리 3컷), 독 화살(맞는 순간 독 방울 3컷).

```
Generate an image. I attached one image: Image 1 is the art STYLE reference (copy its flat cel-shaded, thick-outlined cartoon style). Draw VISUAL EFFECT animations on a plain flat light-gray background, one effect per row, with at least 40px of empty space around each frame. No characters, no ground line, no logo or watermark.

Row 1, four frames, captions "mskill_leap_0" to "mskill_leap_3": a heavy LANDING SLAM seen from a slightly raised three-quarter view: a small flat cream dust ring on the ground with a white star flash in the middle (frame 0), the ring bigger with four chunky rock chips flying up (frame 1), the biggest ring with a few jagged cracks around it (frame 2), faint ring, cracks and a little dust left (frame 3).
Row 2, four frames, captions "mskill_quake_0" to "mskill_quake_3": an EARTHQUAKE: thick jagged brown cracks spreading out from the center on the ground in a circle, growing (frame 0 small, frame 2 widest), with flat rock chips jumping up and two expanding thin pale rings, fading (frame 3).
Row 3, four frames, captions "mskill_ember_0" to "mskill_ember_3": EMBERS burning on the ground, a looping flame: a ring-shaped patch of cracked dark ground with six small flat orange-and-yellow flames of different heights and a few rising sparks, each frame with the flames in different shapes so it loops smoothly.
Row 4, three frames, captions "mskill_ice_0" to "mskill_ice_2": an ICE ARROW hit: a small pale-blue and white snowflake-shaped frost burst with six short pointed crystals (frame 0), bigger with tiny ice chips flying (frame 1), only tiny pale-blue sparkles (frame 2).
Row 5, three frames, captions "mskill_poison_0" to "mskill_poison_2": a POISON ARROW hit: a small flat green-and-purple splash with three round droplets flying out and two tiny bubbles (frame 0), bigger splash with droplets (frame 1), only a few small droplets and bubbles left (frame 2).
Style: flat cel-shaded shapes in 2-3 tones, thick dark brown-black outline about 2px, muted colors (not neon), no gradients, no glow blur, no realistic smoke or fire. All frames of one row share the same canvas size (about 220x220) and are centered on the same point.

Avoid: gradients, glow blur, realistic fire, realistic smoke, characters, text other than the captions, ground line, logo, watermark.
```

**환영 기병대 그림은 따로 요청하지 않습니다**: 환영 기병은 기존 아군 기병 그림을 푸른 반투명으로 칠해 재사용하고, 위 `mskill_phantom` 잔상만 뒤에 붙입니다. 연쇄 운석은 기존 운석 이펙트(`meteor_*`, `boom_*`, `scorch_*`)를 그대로 씁니다.

## 3. 스킬 효과음 (16종, 규칙은 `docs/asset-prompts.md` 10-0과 같음)

**공통**: 0.2~0.8초, 둥글고 낮은 소리 위주, 3kHz 이상 고음 없음, 말소리 없음, 어두운 판타지 전장(나무·가죽·쇠), WAV/OGG 44.1kHz 모노, 최대 -1dB 이하. 파일은 `client/public/assets/audio/<이름>_<번호>.ogg`, **각각 2~3개 변형**(`_1`, `_2`, `_3`)을 뽑습니다. 효과음 생성 AI에 아래 영어 문구를 그대로 넣습니다(문구 끝의 길이를 지켜 주세요).

| 파일 이름 | 어떤 때 | 프롬프트 |
|---|---|---|
| `mskill_jump` | 궁병 뒤로 점프 | a quick leather boot push-off with a short cloth whoosh and a soft thud landing, no voice, 0.4 seconds |
| `mskill_stealth` | 궁병 은신 | a soft airy shimmer, a quiet cloth rustle fading into near silence, no voice, 0.6 seconds |
| `mskill_stealth_end` | 은신 해제 | subtle and gentle: a soft cloth rustle with a faint airy shimmer slowly fading in, as if someone quietly steps out of the shadows, delicate, no sharp attack, no voice, 0.6 seconds |
| `mskill_gallop` | 기병 일제 질주 | several horse hooves breaking into a gallop with a short rising wind whoosh, no voice, 0.7 seconds |
| `mskill_phantom` | 환영 기병대 | a ghostly low horse whinny blended with a airy magical whoosh and distant hoof beats, no human voice, 0.8 seconds |
| `mskill_spear_throw` | 창 던지기 | a heavy spear thrown, a short strained whoosh and a sharp thunk into a target, no voice, 0.5 seconds |
| `mskill_lunge` | 돌진 찌르기 | a spear thrust sound effect: a fast air-cutting whoosh that ends in a sharp metallic stab hit, swoosh then shink, clear and punchy, no voice, 0.6 seconds |
| `mskill_bash` | 방패 밀치기 | a wooden shield slamming into armor with a dull heavy thud and a small metal clank, no voice, 0.3 seconds |
| `mskill_thorn` | 가시 방패 반사 | a short sharp metallic scrape and spark zing as spikes scratch a weapon, no voice, 0.25 seconds |
| `mskill_taunt` | 도발 결계 | layered battle provocation: three rapid heavy war drum hits, swords banging on shields in a rolling rhythm and a low brass horn swell with a little echo, rising and intimidating, rich and full, no voice, 1.2 seconds |
| `mskill_leap` | 둔기병 도약 내려찍기 | a heavy armored jump, a whoosh and a huge crunching ground slam with rocks, no voice, 0.7 seconds |
| `mskill_quake` | 지진 | close-up, very loud and powerful: a huge ground slam, a deep thunderous boom with a sharp heavy impact at the very first moment, cracking stone and a short rolling rumble tail, dense and full, no voice, 1.0 seconds |
| `mskill_blink` | 마법사 점멸 | a quick magical pop with a tiny glassy sparkle whoosh, no voice, 0.3 seconds |
| `mskill_ember` | 불씨 | a soft crackling small fire loop with tiny pops, seamless loop, no voice, 1.0 seconds |
| `mskill_ice` | 얼음 화살 맞음 | a short crisp ice crack with a tiny glassy chime, no voice, 0.25 seconds |
| `mskill_poison` | 독 화살 맞음 | a short wet bubbling splash with a soft sizzle, no voice, 0.3 seconds |

연쇄 운석은 기존 운석 소리를 쓰고, 연속 찌르기·돌파·철갑마·수호·분쇄·충격파·마력 집중 같은 패시브는 소리를 따로 만들지 않습니다(평소 타격 소리를 씁니다).

**다시 요청한 4종(받아 보니 소리가 너무 작거나 어울리지 않아서 문구를 바꿈)**: 은신 해제·돌진 찌르기·도발 결계·지진. 공통으로 `close-up and loud`, `sharp ... right at the very first moment`(시작 직후 강한 타격음), `dense and punchy`(꽉 찬 소리)를 넣어 소리가 작게 나오는 것을 막고, 도발 결계는 마법 허밍 대신 뿔피리와 방패 두드리는 소리로 바꿨다.

**2차 수정(사용자 의견)**: 돌진 찌르기는 소리가 안 나와서 문구를 단순한 "휙 + 찌르는 쇳소리"로 바꾸고 길이를 0.6초로(생성 AI는 0.5초 아래를 못 만드는 듯), 은신 해제는 조용하고 은근하게 드러나는 소리로, 도발 결계는 경적 같은 단음 대신 북·방패·뿔피리를 겹친 소리로 바꿨다.

## 4. 진행 상황

| 에셋 | 상태 |
|---|---|
| 스킬 아이콘 | **궁병·기병·창병·검방병·둔기병 20종 받음, 적용됨(베타 1.312)**: `assets/ui/mskill_<archer|cav|spear|shield|blunt>_1~4`(약 131x129). 회색 배경을 지우고 같은 배율로 잘랐다. 용병 패널에 22px 4칸(얻은 스킬 밝게, 아직인 스킬 어둡게, 올리면 설명)으로 표시. 마법사 4종도 받아 적용(`mskill_mage_1~4`, 베타 1.313). 기병 3번(철갑마)은 대포처럼 보여 다시 요청 권장 |
| 이동·은신 이펙트 | **받음, 적용됨(베타 1.313)**: `assets/fx/mskill_jump_0~3`, `blink_0~3`, `stealth_0~2`, `dash_0~2`, `phantom_0~2`. 환영 기병대는 푸른 잔상 3줄이 앞으로 달려가는 것으로만 표현(환영 기병 그림은 아직 안 씀) |
| 타격·방어 이펙트 | **받음, 적용됨(베타 1.313)**: `mskill_spear_fly`(아직 안 씀), `spear_hit_0~2`, `lunge_0~2`, `bash_0~2`, `thorn_0~2`(가시 반사는 연결 안 함), `taunt_0~3`(안쪽 회색 채움을 반투명으로 바꿈) |
| 지면·마법·화살 이펙트 | **받음, 적용됨(베타 1.313)**: `mskill_leap_0~3`, `quake_0~3`, `ember_0~3`(반복), `ice_0~2`, `poison_0~2` |
| 스킬 효과음 16종 | **모두 받음, 적용됨(베타 1.314~1.319)**: `mskill_jump_1~2`(뒤로 점프), `mskill_stealth_1~2`(은신), `mskill_gallop_1~2`(일제 질주), `mskill_phantom_1~2`(환영 기병대), `mskill_spear_throw_1~2`(창 던지기), `mskill_leap_1~3`(도약 내려찍기), `mskill_bash_1`(방패 밀치기), `mskill_thorn_1`(가시 반사), `mskill_blink_1~2`(점멸), `mskill_poison_1~2`, `mskill_ice_1`, `mskill_ember_1`(불씨), `mskill_quake_1~2`(지진, 다시 요청한 문구로 받음). `mskill_stealth_end_1`, `mskill_lunge_1~2`, `mskill_taunt_1~2`(2차 수정 문구로 받음). 연쇄 운석은 기존 운석 소리. |

## 5. 철갑마 아이콘 재요청 (`assets/ui/mskill_cav_3`)

**왜**: 처음 받은 그림이 말 가슴 갑옷 위에 긴 통이 솟아 대포처럼 보였다. 이번에는 **갑옷을 입은 말의 옆얼굴 + 목**으로 그린다. 첨부: `main_style_sheet.png`와 받아 둔 기병 아이콘 시트(`mskill_cav_1~4` 한 장, 같은 테두리·배경 느낌을 맞추려고). 받으면 `mskill_cav_3.png`만 교체한다.

```
Generate an image. I attached images: Image 1 is the art STYLE reference (copy its flat cel-shaded, thick-outlined cartoon style exactly). Image 2 is a sheet of four sibling skill icons: match their size, rounded-square badge shape, thick near-black outline, and SILVER-BLUE border ring exactly.

Make ONE image with ONE square skill ICON, large, in the middle, with at least 40px of empty space around it, caption "mskill_cav_3" under it. Plain flat light-gray background, no logo or watermark.

The icon is a rounded-square badge about 128x128 with a thick near-black outline about 3px, a dark navy flat-colored background and a SILVER-BLUE border ring (a PASSIVE skill). The symbol, drawn big in the middle: the HEAD AND NECK of a cute chibi warhorse seen from the side, facing right, fully covered in heavy steel horse armor: a steel face plate (chamfron) with a small spike on the forehead, overlapping steel neck plates with gold rivets and a gold trim, a short red plume on top of the head. The horse's eye is a small black dot, its ears are small. Dark steel gray plates with lighter gray highlights and gold details, flat cel-shaded colors in 2-3 tones, thick dark outline.

Style: cute chibi cartoon like Image 1, flat cel-shaded colors, thick dark outline, no gradients, no glow blur, no realistic rendering, no text or letters inside the icon.

Avoid: cannon, barrel, tube, gun, wheel, realistic horse, human rider, knight, gradients, glow blur, thin lines, tiny details, text inside the icon, cropped items, checkerboard pattern, logo, watermark, any text other than the caption.
```

## 6. 창병 스킬 아이콘 새로 요청 (베타 1.333 창병 스킬 개편)

**왜**: 창병 스킬이 "2단 찌르기(패시브1)·수비 태세(액티브2)·휩쓸기(패시브3)·돌진 찌르기(액티브4)"로 바뀌었다. 지금은 기존 그림을 돌려 쓴다(2단 찌르기←`mskill_spear_3`, 수비 태세←`mskill_spear_1`, 휩쓸기←`mskill_spear_2`). **수비 태세와 휩쓸기 두 장만 새로 받으면** 맞는 그림이 된다. 받으면 `mskill_spear_2`(수비 태세)·`mskill_spear_3`(휩쓸기)로 넣고, 지금의 `mskill_spear_3`(두 번 찌르는 그림)는 `mskill_spear_1`(2단 찌르기)로 옮기고, 예전 그림은 `_old`로 보관한다. **첨부**: `main_style_sheet.png`와 받아 둔 창병 아이콘 시트(`mskill_spear_1~4`, 같은 배지 모양·테두리를 맞추려고).

```
Generate an image. I attached images: Image 1 is the art STYLE reference (copy its flat cel-shaded, thick-outlined cartoon style exactly). Image 2 is a sheet of four sibling skill icons: match their size, rounded-square badge shape, thick near-black outline and border rings exactly.

Make ONE sprite sheet image with TWO square skill ICONS side by side in one row, each large and clearly separated with at least 40px of empty space around it, captions "mskill_spear_2" and "mskill_spear_3". Plain flat light-gray background, no logo or watermark.

Each icon is a rounded-square badge about 128x128 with a thick near-black outline about 3px and a dark flat-colored background, with ONE simple bold symbol drawn big in the middle (readable when shrunk to 40px).
- "mskill_spear_2" (an ACTIVE skill, so a GOLD border ring): a DEFENSIVE SPEAR STANCE. A long spear held horizontally in front of a round wooden-and-steel shield, the spear tip pointing right, with a wide fan of three short thrust lines spreading out from the tip and two small arrows bouncing off the front of the shield. Dark navy background. The idea is "a wall of spears that stabs and blocks arrows".
- "mskill_spear_3" (a PASSIVE skill, so a SILVER-BLUE border ring): a WIDE SPEAR SWEEP. A spear drawn diagonally with a big flat white-and-pale-orange crescent slash arc sweeping across the whole icon in front of it, and three small round enemy silhouettes (dark circles with tiny eyes) being knocked back along the arc, tiny impact bursts. Dark brown background. The idea is "the spear swings wide and hits everything in front".

Style: cute chibi cartoon like Image 1, flat cel-shaded colors in 2-3 tones, thick dark outline, no gradients, no glow blur, no realistic rendering, no text or letters inside the icons.

Avoid: realistic style, gradients, glow blur, thin lines, tiny details, text inside icons, cropped items, checkerboard pattern, logo, watermark, any text other than the two captions.
```

**받음, 적용됨(베타 1.335)**: 수비 태세=`mskill_spear_2`(방패와 튕기는 화살), 휩쓸기=`mskill_spear_3`(크게 휘두르는 호와 밀려나는 적), 2단 찌르기=`mskill_spear_1`(두 번 찌르는 그림을 옮김). 예전 그림은 `_old`로 보관, 임시 순서(`SPEAR_ICON_ORDER`)는 지웠다.

**(원래 계획)**: `tools/remove_flat_bg.py`로 배경을 지우고 `tools/slice_sheet.py`(`--rows 1 --scale 0.32 --min-height 150 --attach 4`)로 자른 뒤, 클라이언트의 임시 순서(`SPEAR_ICON_ORDER`)를 지운다.

## 7. 휩쓸기 이펙트 요청 (`assets/fx/mskill_swing_0~3`)

**쓰이는 곳**: 창병 3단계 패시브 "휩쓸기"(25% 확률로 전방 약 160도를 훑는 공격). 지금은 방패 밀치기용 흰 반원 그림을 임시로 쓴다. 창을 크게 휘두르는 **넓은 호 + 속도선** 4컷을 새로 받는다. 첨부: `main_style_sheet.png` 한 장.
**방향/크기**: 오른쪽(전방)으로 휘두르는 모양, 4컷 모두 같은 캔버스(약 300x200)·같은 기준점(창병 앞쪽 중심)으로.

```
Generate an image. I attached one image: Image 1 is the art STYLE reference (copy its flat cel-shaded, thick-outlined cartoon style). Draw a short VISUAL EFFECT animation, four frames in one row, on a plain flat light-gray background with at least 40px of empty space around each frame, captions "mskill_swing_0", "mskill_swing_1", "mskill_swing_2", "mskill_swing_3". No characters, no weapons, no ground line, no logo or watermark.

The effect is a WIDE SPEAR SWEEP: a spear swung in a big horizontal arc in front of the wielder, seen from the side, sweeping toward the RIGHT of the picture (the wielder stands at the left):
- frame 0: a thin crescent arc just starting at the upper left, cream-white with a pale orange edge, with three short speed lines trailing behind it;
- frame 1: the arc grows into a big wide crescent covering about 160 degrees of a circle opening to the left, thick in the middle and tapering at both ends, bright cream-white core with pale orange outer band, a few small flat white sparks along its outer edge;
- frame 2: the arc at its widest and brightest, slightly thicker, with five small flat starburst impacts (pale yellow and white) scattered along the front of the arc;
- frame 3: the arc fading: thinner and paler, impacts gone, only two or three tiny sparks and faint speed lines left.
Style: flat cel-shaded shapes in 2-3 tones, a thick dark orange-brown outline about 2px, warm cream-white and pale orange palette (NOT green, NOT blue), no gradients, no glow blur, no realistic smoke. All four frames centered on the same point and the same canvas size, each about 300x200 in a 4x1 layout.

Avoid: green or blue colors, gradients, glow blur, realistic smoke, characters, spear shaft, text other than the four captions, ground line, logo, watermark.
```

**받은 뒤**: `tools/slice_fx_rows.py`(`--rows swing:4`)로 자르고, 클라이언트의 `MSK_FRAMES`에 `swing: 4`를 넣은 뒤 `MSK_DEF[13]`을 `swing`으로 바꾼다.
