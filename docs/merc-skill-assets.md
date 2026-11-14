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
| `mskill_stealth_end` | 은신 해제 | a short soft cloth snap with a tiny bow string pluck, no voice, 0.3 seconds |
| `mskill_gallop` | 기병 일제 질주 | several horse hooves breaking into a gallop with a short rising wind whoosh, no voice, 0.7 seconds |
| `mskill_phantom` | 환영 기병대 | a ghostly low horse whinny blended with a airy magical whoosh and distant hoof beats, no human voice, 0.8 seconds |
| `mskill_spear_throw` | 창 던지기 | a heavy spear thrown, a short strained whoosh and a sharp thunk into a target, no voice, 0.5 seconds |
| `mskill_lunge` | 돌진 찌르기 | a quick boot dash followed by a sharp metal spear stab, no voice, 0.4 seconds |
| `mskill_bash` | 방패 밀치기 | a wooden shield slamming into armor with a dull heavy thud and a small metal clank, no voice, 0.3 seconds |
| `mskill_thorn` | 가시 방패 반사 | a short sharp metallic scrape and spark zing as spikes scratch a weapon, no voice, 0.25 seconds |
| `mskill_taunt` | 도발 결계 | a deep low horn-like hum with a rising magical shimmer ring, no voice, 0.8 seconds |
| `mskill_leap` | 둔기병 도약 내려찍기 | a heavy armored jump, a whoosh and a huge crunching ground slam with rocks, no voice, 0.7 seconds |
| `mskill_quake` | 지진 | a deep rumbling ground quake with cracking rock and a low boom, no voice, 1.0 seconds |
| `mskill_blink` | 마법사 점멸 | a quick magical pop with a tiny glassy sparkle whoosh, no voice, 0.3 seconds |
| `mskill_ember` | 불씨 | a soft crackling small fire loop with tiny pops, seamless loop, no voice, 1.0 seconds |
| `mskill_ice` | 얼음 화살 맞음 | a short crisp ice crack with a tiny glassy chime, no voice, 0.25 seconds |
| `mskill_poison` | 독 화살 맞음 | a short wet bubbling splash with a soft sizzle, no voice, 0.3 seconds |

연쇄 운석은 기존 운석 소리를 쓰고, 연속 찌르기·돌파·철갑마·수호·분쇄·충격파·마력 집중 같은 패시브는 소리를 따로 만들지 않습니다(평소 타격 소리를 씁니다).

## 4. 진행 상황

| 에셋 | 상태 |
|---|---|
| 스킬 아이콘 | **궁병·기병·창병·검방병·둔기병 20종 받음, 적용됨(베타 1.312)**: `assets/ui/mskill_<archer|cav|spear|shield|blunt>_1~4`(약 131x129). 회색 배경을 지우고 같은 배율로 잘랐다. 용병 패널에 22px 4칸(얻은 스킬 밝게, 아직인 스킬 어둡게, 올리면 설명)으로 표시. 마법사 4종도 받아 적용(`mskill_mage_1~4`, 베타 1.313). 기병 3번(철갑마)은 대포처럼 보여 다시 요청 권장 |
| 이동·은신 이펙트 | **받음, 적용됨(베타 1.313)**: `assets/fx/mskill_jump_0~3`, `blink_0~3`, `stealth_0~2`, `dash_0~2`, `phantom_0~2`. 환영 기병대는 푸른 잔상 3줄이 앞으로 달려가는 것으로만 표현(환영 기병 그림은 아직 안 씀) |
| 타격·방어 이펙트 | **받음, 적용됨(베타 1.313)**: `mskill_spear_fly`(아직 안 씀), `spear_hit_0~2`, `lunge_0~2`, `bash_0~2`, `thorn_0~2`(가시 반사는 연결 안 함), `taunt_0~3`(안쪽 회색 채움을 반투명으로 바꿈) |
| 지면·마법·화살 이펙트 | **받음, 적용됨(베타 1.313)**: `mskill_leap_0~3`, `quake_0~3`, `ember_0~3`(반복), `ice_0~2`, `poison_0~2` |
| 스킬 효과음 16종 | **15개 받음, 적용됨(베타 1.314~1.316)**: `mskill_jump_1~2`(뒤로 점프), `mskill_stealth_1~2`(은신), `mskill_gallop_1~2`(일제 질주), `mskill_phantom_1~2`(환영 기병대), `mskill_spear_throw_1~2`(창 던지기), `mskill_leap_1~3`(도약 내려찍기), `mskill_bash_1`(방패 밀치기), `mskill_thorn_1`(가시 반사). 나머지(`stealth_end`, `lunge`, `taunt`, `quake`, `blink`, `ember`, `ice`, `poison`) 아직 |
