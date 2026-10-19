# 에셋 제작 프롬프트 (이미지 생성 AI / 아티스트 의뢰용)

프롬프트는 영어로 써 두었습니다(이미지 생성 AI가 영어를 더 잘 따릅니다). 그대로 복사해서 쓰시면 됩니다.

## 진행 상황

| 에셋 | 상태 |
|---|---|
| 병종 유닛 10종 (아군·적 각 5) | 완료, 게임에 적용됨 (`client/public/assets/units/`) |
| 주인공 (무기별 포즈) | 완료, 적용됨 (`assets/hero/`). 기병 포즈는 아직 쓸 곳이 없어 보관 |
| 마법사 (아군·적 유닛, 주인공 지팡이 포즈, 카드 일러스트) | 아군·주인공·카드는 적용됨(`units/ally_mage.png`, `hero/hero_mage.png`, `cards/art_mage.png`). 적 마법사 그림(`units/enemy_mage.png`)은 적이 아직 마법사를 쓰지 않아 보관 |
| 운석 이펙트 (낙하 6컷·폭발 5컷·바닥 그을음 5컷) | 완료, 적용됨 (`assets/fx/meteor_*`, `boom_*`, `scorch_*`) |
| 캠프 | 완료, 적용됨 (`assets/camp/camp.png`) |
| 바닥 타일 | 완료, 적용됨 (`assets/tiles/ground_a.png`) |
| 투사체 (화살, 아군·적 각 5컷) | 완료, 적용됨 (`assets/fx/`). 속도선 컷으로 날아가고 명중 컷을 잠깐 보여 줌 |
| 레벨업 카드 아이콘 19종 | 이 문서 7번 |
| 무기·HUD 아이콘 | 이 문서 8번 |
| 효과음·음악 | 이 문서 10번 |
| 스페이스 스킬 아이콘 6종 | 완료, 적용됨 (`assets/ui/skill_icon_*.png`, 철퇴는 시안 2개 중 `skill_icon_mace`를 쓰고 `skill_icon_mace_b`는 보관) |
| 방벽 상태 3컷(평면 띠 시안) | 보관 (`assets/fx/skill_wall_0~2.png`). 조각 그림이 있으면 쓰이지 않음 |
| 방벽 수정 조각 9개 | 적용됨 (`assets/fx/skill_wall_<상태>_<a~c>.png`, 윤곽선을 덧입혀 사용, 원본은 `skill_wall_raw/`). 부서짐·생성 모션은 아직 |
| 철퇴 투척 그림 | 적용됨 (`assets/fx/skill_mace_thrown.png`, `skill_mace_trail_0~2.png`, `skill_mace_hit_0~3.png`). 받은 시안에서 오려 냄. 충격은 4컷(5컷 중 앞쪽 흐린 컷 제외), 소리 2종은 아직 |
| 스페이스 스킬 나머지 이펙트·소리 | 이 문서 11번. 아직 에셋이 없어 도형과 고리로 대신 그리는 중 |

### 이미지 생성 도구가 투명 배경을 주지 않을 때

생성 도구가 투명 PNG 대신 **흰 배경(체크무늬 잡음이 구워진 가짜 투명)** 이미지를 주는 경우가 많습니다. 처음 유닛 시트는 진짜 투명이었지만 주인공·캠프·화살은 흰 배경이었습니다. 그래도 문제없이 처리할 수 있습니다.

```sh
# 1) 흰 배경을 투명으로 (가장자리에서 이어진 흰색만 지우므로 그림 속 흰 하이라이트는 남는다)
python3 tools/remove_bg.py 원본.webp 투명.png
#   - 속도선·폭발 같은 반투명 이펙트가 있으면:  --effects --threshold 215
#   - 활과 시위 사이처럼 '닫힌 구멍 속 배경'이 남으면 그 위치를 지정:  --pocket-box x0,y0,x1,y1
# 2) 시트를 한 장씩 자르기
python3 tools/slice_sheet.py 투명.png client/public/assets/<폴더> --names a,b,c --rows 1 --scale 0.4
#   - 속도선처럼 본체와 떨어진 조각이 있으면:  --attach 120 --min-height 40
```

이번에 쓴 명령(다시 만들 때 그대로 쓸 수 있음):

```sh
python3 tools/remove_bg.py 주인공.webp /tmp/hero.png --pocket-box 790,390,880,550
python3 tools/slice_sheet.py /tmp/hero.png client/public/assets/hero --names hero_cavalry,hero_spear,hero_archer,hero_sword,hero_mace --rows 1 --scale 0.4
python3 tools/remove_bg.py 캠프.webp /tmp/camp.png
python3 tools/slice_sheet.py /tmp/camp.png client/public/assets/camp --names camp --rows 1 --scale 0.4 --min-height 300
python3 tools/remove_bg.py 화살.webp /tmp/arrows.png --effects --threshold 215
python3 tools/slice_sheet.py /tmp/arrows.png client/public/assets/fx --names arrow_ally_0,arrow_ally_1,arrow_ally_2,arrow_ally_3,arrow_ally_4,arrow_enemy_0,arrow_enemy_1,arrow_enemy_2,arrow_enemy_3,arrow_enemy_4 --rows 2 --scale 0.3 --min-height 40 --attach 120
# 바닥은 512x512로 줄여 tools/tile_preview.py 로 이음새 점수를 확인
```

## 0. 먼저 읽어 주세요 (그림체와 시트 형식)

**1. 그림체는 이미 만든 유닛 시트로 고정합니다.** 새로 만들 때마다 **유닛 시트 이미지를 스타일 기준(reference / style reference)으로 같이 첨부**하세요. 그러면 주인공·캠프·아이콘이 같은 화풍으로 나옵니다. 지금 화풍은 다음과 같습니다.

- **옆모습**(위에서 내려다본 시점이 아님), 치비 비율, 굵은 검정 윤곽선, 약간의 질감이 있는 채색
- 아군은 밝고 선명하게, 적은 어둡고 탁하게(붉은 포인트)
- 오른쪽을 보고 서 있는 자세 (게임에서 왼쪽으로 갈 때 좌우 반전합니다)

**2. 한 장에 여러 개를 뽑는 "시트" 형식으로 요청하세요.** `tools/slice_sheet.py`가 시트를 한 장씩 자릅니다. 잘리려면 이 규칙을 지켜야 합니다.

- **투명 배경** PNG/WEBP
- 항목들은 격자로 배치하고, **서로 충분히 떨어뜨리기**(최소 한 항목 크기의 1/4 이상 여백). 닿거나 겹치면 한 덩어리로 묶입니다.
- 항목 아래에 작은 라벨(이름·파일명)은 있어도 됩니다. 라벨은 자동으로 버려집니다.
- 각 항목의 높이가 **시트 기준 100px 이상**이 되게(너무 작게 뽑으면 라벨로 오인되어 버려집니다). 해상도를 높게 요청하세요.
- **항목 수를 정확히** 지켜 주세요. 개수가 틀리면 도구가 알려 줍니다.

시트 요청 머리말(아래 시트 프롬프트 앞에 공통으로 붙임):

```
Reference: match the art style of the attached unit sheet exactly (side view,
chibi proportions, thick dark outline, painterly flat colors with subtle texture).
Output a sprite sheet on a fully transparent background, items arranged in a
clean grid with generous empty space between them, nothing touching or overlapping,
each item large and fully visible, a small caption with the file name under each item.
```

네거티브(지원하는 도구에서): `perspective, 3d render, isometric, top-down view, realistic, photo, blurry, noisy texture, background scenery, cropped, overlapping items`

## 1. 색 규칙 (코드와 화면이 이 색을 기준으로 씁니다)

| 병종 | 주색 | 무장 |
|---|---|---|
| 기병 | 주황 | 말을 탄 경기병, 가벼운 창 |
| 창병 | 초록 | 긴 창, 가죽·천 갑옷 |
| 궁병 | 노랑 | 활, 가벼운 복장, 화살통 |
| 검방병 | 파랑 | 검과 둥근 방패, 판금 |
| 둔기병 | 보라 | 철퇴, 두꺼운 갑옷 |

**카드 종류별 테두리 색**: 규모 = 금색, 용병 강화 = 초록, 주인공 강화 = 파랑.
**플레이어 구분 색**(8가지)은 **코드가 발밑 고리로 덧입히므로** 스프라이트에는 칠하지 마세요.

## 2. (참고) 이미 끝난 유닛 시트 프롬프트

그림체를 다시 맞춰야 할 때 참고용입니다.

```
<시트 요청 머리말>
10 fantasy mercenary soldiers in two rows of five. Top row (allies, bright saturated
colors): orange light cavalry rider on a horse with a short lance, green hooded
spearman with a long spear, yellow hooded archer with a bow and quiver, blue
sword-and-round-shield soldier in plate armor, purple heavy soldier with a spiked mace.
Bottom row (enemies): the same five, but dark desaturated colors with dark red accents
and battered armor.
```

## 3. 주인공 (무기 4종)

주인공은 용병보다 한눈에 띄어야 합니다. **몸은 같고 무기만 다른 4장**을 한 줄로 뽑습니다. 플레이어마다 발밑 고리 색이 달라서, 주인공 몸 색은 **중립(검정·회색·금색)** 으로 해 주세요(빨강·파랑·초록 같은 병종/플레이어 색은 피합니다).

```
<시트 요청 머리말>
4 variants of the same mercenary captain hero in one row, facing right, slightly
larger and more detailed than ordinary soldiers (about 1.2x). Dark charcoal cloak,
gold trim, white scarf, confident pose, no bright saturated colors on the body.
Each holds a different weapon: 1) a longbow drawn, 2) a long spear thrust forward,
3) a sword raised with the other hand open, 4) a large spiked iron mace over the shoulder.
Captions: hero_bow, hero_spear, hero_sword, hero_mace
```

- 파일 이름 순서: `hero_bow, hero_spear, hero_sword, hero_mace` (왼쪽부터)
- 자르기: `python3 tools/slice_sheet.py <시트> client/public/assets/hero --names hero_bow,hero_spear,hero_sword,hero_mace --rows 1 --scale 0.45`

## 4. 캠프

용병을 고용하는 곳입니다. 화면에서 **반경 120px의 노란 원** 안에 서 있는 것은 코드가 그리므로, 원 가운데에 놓일 **캠프 오브젝트 하나**만 만들면 됩니다. 멀리서도 "여기가 캠프"임이 보이게 **금색·주황 포인트**를 쓰세요.

```
<시트 요청 머리말>
A single mercenary camp object, side view: a canvas tent in warm brown and orange,
a small campfire with a little flame and a thin wisp of smoke, a tall banner pole with
a golden flag, two wooden crates. Compact silhouette that reads clearly when small.
Caption: camp
```

- 자르기: `python3 tools/slice_sheet.py <시트> client/public/assets/camp --names camp --rows 1 --scale 0.5`
- 선택: 만료가 임박한 캠프용으로 같은 그림에 불이 꺼지고 천막이 낡은 버전 `camp_old`를 더 만들면 좋습니다(2개를 한 줄로).

## 5. 바닥 타일

전투가 잘 보이는 것이 최우선입니다. **대비를 낮게**, 어둡게, 유닛이 올라갔을 때 묻히지 않게 해 주세요. 시트가 아니라 **이미지 한 장**으로 받습니다.

```
Seamless tileable ground texture for a 2D top-down-ish fantasy battlefield, dark muted
olive-brown grass and packed dirt, very low contrast, subtle noise and a few tiny
pebbles and grass tufts, no large objects, no paths, no text, no borders,
evenly distributed detail, 512x512, edges match for perfect tiling
```

- **반복해도 이음새가 보이지 않아야 합니다.** 받으신 파일로 `python3 tools/tile_preview.py ground.png`를 실행하면 3x3으로 이어 붙인 미리보기와 이음새 점수가 나옵니다.
- 이음새가 보이면 같은 프롬프트에 `seamless, tileable, wraps around on all four sides`를 반복해서 다시 뽑거나, 이미지 편집 도구의 "타일링(offset) 후 경계 보정"을 쓰세요.
- 선택: 변주용 `ground_b`(같은 색조, 돌/꽃 약간 더)를 만들어 두면 반복이 덜 티가 납니다.
- 파일 이름: `client/public/assets/tiles/ground_a.png`

## 6. 투사체 (화살)

작아서 시트 자르기보다 **이미지 두 장**으로 받는 편이 낫습니다. **오른쪽(→)을 향하게**, 투명 배경, 가로로 긴 모양.

```
A single arrow pointing right, side view, same thick-outline painterly style as the
attached sheet, wooden shaft with pale yellow fletching, steel tip, transparent
background, large and clearly visible
```
- `arrow_ally.png`: 위 그대로
- `arrow_enemy.png`: `dark red shaft and fletching, black tip, slightly rusty`

크기·여백 정리(자르기·축소)는 파일만 주시면 제가 하겠습니다.

## 7. 레벨업 카드 아이콘 (19종)

카드는 3종류입니다. 종류별로 **한 장씩 시트**로 뽑으세요(색을 통일하기 쉽습니다). 아이콘은 **한 가지 상징을 크게**, 굵은 윤곽선, 가운데 정렬, 카드 종류 색을 포인트로 씁니다.

공통 머리말:
```
<시트 요청 머리말>
Flat game UI icons in a grid, each a single bold symbol centered in a rounded-square
badge, same thick dark outline painterly style, <포인트 색> accent color on the badge
rim and highlights, no text inside the icons.
```

### 7-1. 규모 (금색) - 4개, 한 줄
`<포인트 색>` = `gold`

| 순서 | 파일 이름 | 카드 | 아이콘 |
|---|---|---|---|
| 1 | card_leadership1 | 통솔력 +1 | 깃발 하나 |
| 2 | card_leadership2 | 통솔력 +2 | 깃발 두 개 (또는 깃발 + 별) |
| 3 | card_price | 고용 비용 -15% | 금화 위에 아래 화살표 |
| 4 | card_loot | 전리품 +25% | 금화가 가득한 주머니 |

`python3 tools/slice_sheet.py <시트> client/public/assets/cards --names card_leadership1,card_leadership2,card_price,card_loot --rows 1 --scale 0.35`

### 7-2. 용병 강화 (초록) - 10개, 두 줄 x 다섯
`<포인트 색>` = `green`
- **윗줄 (전체 용병 강화 5)**:

| 순서 | 파일 이름 | 카드 | 아이콘 |
|---|---|---|---|
| 1 | card_merc_hp | 용병 체력 +15% | 병사 방패 + 하트 |
| 2 | card_merc_dmg | 용병 공격력 +12% | 병사 + 교차한 검 |
| 3 | card_merc_atkspeed | 용병 공격 속도 +10% | 검 + 번개 |
| 4 | card_merc_speed | 용병 이동 속도 +10% | 병사 + 날개 달린 신발 |
| 5 | card_merc_respawn | 빠른 재집결(부활 -20%) | 나팔(뿔피리) |

- **아랫줄 (병종 단련 5)**: 각 병종의 **고유 색**을 아이콘 몸통에, 별 하나를 모서리에 붙입니다.

| 순서 | 파일 이름 | 카드 | 아이콘 |
|---|---|---|---|
| 6 | card_boost_cavalry | 기병 단련 | 주황 말머리 + 별 |
| 7 | card_boost_spear | 창병 단련 | 초록 창 + 별 |
| 8 | card_boost_archer | 궁병 단련 | 노랑 활과 화살 + 별 |
| 9 | card_boost_sword | 검방병 단련 | 파랑 검과 방패 + 별 |
| 10 | card_boost_mace | 둔기병 단련 | 보라 철퇴 + 별 |

`python3 tools/slice_sheet.py <시트> client/public/assets/cards --names card_merc_hp,card_merc_dmg,card_merc_atkspeed,card_merc_speed,card_merc_respawn,card_boost_cavalry,card_boost_spear,card_boost_archer,card_boost_sword,card_boost_mace --rows 2 --scale 0.35`

### 7-3. 주인공 강화 (파랑) - 5개, 한 줄
`<포인트 색>` = `blue`

| 순서 | 파일 이름 | 카드 | 아이콘 |
|---|---|---|---|
| 1 | card_hero_hp | 최대 체력 +25 | 큰 하트 |
| 2 | card_hero_speed | 이동 속도 +8% | 날개 달린 부츠 |
| 3 | card_hero_dmg | 사격 피해 +25% | 화살 + 불꽃 |
| 4 | card_hero_firerate | 연사 속도 +15% | 화살 여러 개 |
| 5 | card_hero_regen | 체력 재생 | 하트 + 반짝임 |

`python3 tools/slice_sheet.py <시트> client/public/assets/cards --names card_hero_hp,card_hero_speed,card_hero_dmg,card_hero_firerate,card_hero_regen --rows 1 --scale 0.35`

> 카드가 새로 생기면(`shared/src/cards.ts`) 여기에 아이콘이 필요합니다. 아이콘이 없는 카드는 지금처럼 글자만 나오도록 두겠습니다.

## 8. 무기·HUD 아이콘

### 8-1. 무기 4개 (화면 오른쪽 아래 무기 바용), 한 줄
```
<시트 요청 머리말>
4 weapon icons in one row, each centered in a rounded-square badge, thick dark outline,
no text: a longbow with an arrow, a long spear, a sword with a small round shield,
a spiked iron mace. Silver-steel and wood tones.
Captions: weapon_bow, weapon_spear, weapon_sword, weapon_mace
```
`python3 tools/slice_sheet.py <시트> client/public/assets/ui --names weapon_bow,weapon_spear,weapon_sword,weapon_mace --rows 1 --scale 0.3`

### 8-2. HUD 아이콘 4개 (금화·체력·통솔력·레벨), 한 줄
```
<시트 요청 머리말>
4 small HUD icons in one row, each a single bold symbol with thick dark outline, no badge,
no text: a gold coin, a red heart, a small banner flag, a golden star.
Captions: icon_gold, icon_hp, icon_leadership, icon_level
```
`python3 tools/slice_sheet.py <시트> client/public/assets/ui --names icon_gold,icon_hp,icon_leadership,icon_level --rows 1 --scale 0.2`

## 9. 만든 에셋을 넘겨 주실 때

- 저장소에 올리거나 이 대화에 이미지를 보내 주세요. **시트 그대로** 주셔도 됩니다. 자르는 것은 제가 하겠습니다.
- 한 번에 다 만들지 말고 **주인공 → 캠프·바닥 → 카드 순서**로 진행하세요. 주인공·캠프·바닥이 들어가면 화면이 크게 바뀌므로, 먼저 그림체가 어울리는지 확인한 뒤 나머지를 만드는 편이 낫습니다.
- 받으면 게임에 적용한 뒤 **화면에서 크기, 겹침, 가독성**을 직접 보고 조정합니다. 용병이 수십 명 겹칠 때 알아볼 수 있는지가 기준입니다.
- 폴더: `client/public/assets/{units,hero,camp,tiles,cards,ui,audio}/`

## 10. 사운드 (효과음) 요청 목록

효과음 생성 도구(예: 텍스트로 효과음을 만드는 AI)나 음향 작가에게 그대로 붙여 넣는 문구입니다. 영어 문구가 도구에 잘 먹히므로 영어로 적었고, 괄호는 설명입니다.

### 10-0. 공통 규칙 (모든 소리에 같이 적어 주세요)

- **길이**: 대부분 0.1~0.5초. 꼬리(울림)를 짧게 끊습니다. 전투 중 같은 소리가 **초당 수십 번** 겹치므로, 길거나 날카로우면 금방 시끄럽습니다.
- **음색**: 둥글고 낮은 소리 위주. 3kHz 이상의 쨍한 고음, 귀를 찌르는 소리는 피합니다. 말소리는 넣지 않습니다.
- **변형**: 자주 나는 소리(화살, 타격, 방패, 사망)는 **같은 문구로 3~4개씩** 뽑아 주세요(`_1`, `_2`, `_3`). 게임이 번갈아 틀어 반복 느낌을 줄입니다.
- **형식**: WAV 또는 OGG, 44.1kHz, 모노(효과음) / 스테레오(음악·팡파르). 최대 볼륨 -1dB 이하, 소리끼리 크기 차이가 크지 않게 맞춰 주세요(작은 소리를 지나치게 키우지 않기).
- **분위기**: 어두운 판타지 전장(중세풍, 나무·가죽·쇠). 현대·SF 느낌 금지.
- **파일 이름과 위치**: `client/public/assets/audio/<이름>_<번호>.ogg` (예: `arrow_hit_1.ogg`). 아래 표의 **파일 이름**을 그대로 쓰면 코드 연결이 바로 됩니다.

### 10-1. 1순위: 이것만 있어도 체감이 큽니다 (10종)

게임에서 가장 자주, 가장 중요하게 일어나는 일입니다.

| 파일 이름 | 언제 나는가 | 문구 (영어) | 길이·변형 |
| --- | --- | --- | --- |
| `bow_shot` | 활을 쏠 때(주인공·궁병) | `short wooden bow release, dry string twang, no echo` | 0.2초, 3종 |
| `arrow_volley` | 궁병 여럿이 동시에 쏠 때(화살 연사) | `volley of many arrows released at once, bowstrings snapping together then a rush of arrows through the air` | 0.8초, 1종 |
| `arrow_hit` | 화살이 적에게 맞을 때 | `soft arrow thud into leather and flesh, short, low volume` | 0.15~0.27초, 3종 |
| `melee_hit` | 근접 타격(검·창·철퇴로 몸을 때림) | `quick melee weapon hit, dull cloth and metal impact, medium thud` | 0.2~0.4초, 6종 |
| `shield_block` | 방패가 공격을 막을 때 | `wooden shield block, solid knock with a faint metal ring` | 0.2~0.45초, 4종 |
| `shield_break` | 방패가 깨질 때 | `shield shattering, splintering wood and a metal snap, short` | 1.2초, 1종 |
| `crit_hit` | 치명타 | `sharp critical strike, bright metallic slash with a heavy thump` | 0.3초, 8종 (충격음 8개 적용됨) |
| `enemy_die` | 적이 쓰러질 때 | `small fantasy soldier falls, short grunt-less thud and armor clatter, low volume` | 0.7~0.85초, 2종 |
| `armor_fall` | 적이 쓰러질 때 갑옷 소리(비명과 함께) | `metal armor body falling and clattering on the ground, short` | 0.6~0.8초, 5종 (적용됨) |
| `ally_hurt` | 내 유닛(주인공)이 맞을 때 | `player takes damage, dull body hit with short breathy grunt, not shrill` | 0.25초, 1종 |
| `level_up` | 레벨업 | `short uplifting level-up chime, warm bells, about one second` | 0.6초, 1종 |
| `boss_warning` | 보스군이 나타날 때 | `distant war horn blast, deep and ominous, two long notes, with faint marching drums` | 3초, 1종 |

### 10-2. 2순위: 게임의 맛을 살립니다 (17종)

| 파일 이름 | 언제 나는가 | 문구 (영어) | 길이·변형 |
| --- | --- | --- | --- |
| `spear_thrust` | 창을 찌를 때 | `quick spear thrust, short airy whoosh with a light tip impact` | 0.25초, 2종 |
| `sword_swing` | 검을 휘두를 때 | `light sword swing whoosh, short, slightly metallic` | 0.25초, 2종 |
| `mace_smash` | 철퇴 타격·범위 공격 | `heavy mace smash, deep low thud with a little crunch, short tail` | 0.4초, 2종 |
| `meteor_fall` | 마법사 운석이 떨어지기 시작할 때(약 0.6초 뒤 폭발) | `meteor falling from the sky, rising whoosh into a heavy explosion with a rumbling tail` | 6.6초, 1종 (사용자 제공 `meteo.aup4`에서 뽑아 -3dB·끝 페이드아웃) |
| `backstab` | 배후 공격 | `sneaky backstab slash, quick low whoosh with a sharper cut` | 0.25초, 2종 |
| `knockback` | 넉백으로 적이 밀려날 때 | `short heavy shove impact, muffled whomp` | 0.2초, 2종 |
| `dodge` | 회피 | `quick evasive whoosh, soft cloth swish` | 0.15초, 2종 |
| `cavalry_charge` | 우클릭 돌격 지시 | `short cavalry charge horn call, brave and rising, with galloping hooves` | 0.8초, 1종 |
| `hoof_gallop` | 기병이 속도를 낼 때(반복) | `light horse gallop loop, soft hooves on dirt, seamless loop` | 1초 루프 |
| `coin_gain` | 금화를 얻을 때(처치 보상) | `tiny soft coin clink, very short, low volume` | 0.1초, 3종 |
| `hire` | 캠프에서 용병 고용 | `hire confirmation: coins clinking into a purse and a short low horn`   | 0.6초, 1종 |
| `upgrade_ready` | 용병이 강화 가능해질 때 | `gentle ready-to-upgrade notification, two soft rising bell tones` | 0.5초, 1종 |
| `upgrade_done` | 용병 강화 완료 | `merc upgrade complete, anvil strike with a bright ring and short uplift` | 0.8초, 1종 |
| `card_pick` | 카드를 고를 때 | `card chosen, crisp paper-and-wood tap with a faint sparkle` | 0.3초, 2종 |
| `card_reroll` | 카드 새로고침 | `cards reshuffle, quick paper flutter` | 0.4초, 1종 |
| `legend_card` | 전설 카드를 고를 때 | `legendary power gained, deep resonant chord swell with shimmering overtones, about 1.5 seconds` | 1.5초, 1종 |
| `hero_down` | 주인공이 쓰러질 때 | `hero collapses, heavy thud with a low mournful tone` | 0.8초, 1종 |

### 10-3. 3순위: 상태 변화와 진행 알림 (10종)

| 파일 이름 | 언제 나는가 | 문구 (영어) | 길이·변형 |
| --- | --- | --- | --- |
| `revive_loop` | 동료를 일으키는 동안(E 누르는 중) | `soft rising healing shimmer loop, gentle, seamless loop` | 1.5초 루프 |
| `revive_done` | 부활 완료 | `revive complete, warm rising shimmer and a soft chime` | 0.8초, 1종 |
| `morale_break` | 사기 저하가 걸릴 때 | `morale breaks, low dissonant drone drop with a faint distant groan` | 1초, 1종 |
| `squad_warning` | 적 소대 접근 | `short enemy scouts horn, two quick notes` | 1초, 1종 |
| `stage_clear` | 스테이지 클리어 | `stage victory fanfare, short brass and drums, triumphant but compact` | 3초, 1종 |
| `victory` | 최종 승리 | `grand victory fanfare, full brass, choir pad and drums, about 6 seconds` | 6초, 1종 |
| `defeat` | 전멸 | `defeat sting, slow descending low brass and a muted drum, about 4 seconds` | 4초, 1종 |
| `camp_open` | 캠프 범위에 들어갔을 때 | `soft campfire crackle with a small tent-flap rustle, calm` | 0.5초, 1종 |
| `ui_click` | 로비·버튼 클릭 | `subtle wooden UI click, very short` | 0.08초, 2종 |
| `merc_respawn` | 용병이 부활해 합류할 때 | `small reinforcement arrives, quick cloth and armor rustle with a short rising tone` | 0.4초, 2종 |

### 10-4. 배경 음악 (효과음 다음에)

- `bgm_lobby`: `calm dark fantasy lobby theme, lute and soft strings, slow 70 bpm, 90 seconds, seamless loop`
- `bgm_grow`: `tense but steady mercenary camp theme, low strings and light war drums, 100 bpm, 2 minutes, seamless loop, leaves room for sound effects (not too busy)` (성장 시간에 깔림)
- `bgm_boss`: `epic dark fantasy boss battle, pounding war drums, brass stabs and driving low strings, 130 bpm, 2 minutes, seamless loop`
- 음악은 **효과음이 묻히지 않도록** 중저음과 잡음이 적게, 볼륨은 효과음보다 확실히 낮게(-18dB 안팎) 맞춰 주세요. 루프가 끊기는 느낌이 없어야 합니다.

### 10-5. 부탁드리는 순서

1. 10-1의 10종부터(변형 포함 약 30개 파일). 이것만 들어가도 전투가 훨씬 살아납니다.
2. 이어서 10-2, 10-3.
3. 배경 음악은 마지막에.

넘겨 주시면 코드에서 소리를 틀어 주는 부분도 같이 만듭니다(같은 소리가 너무 자주 겹치지 않게 간격 제한, 화면 밖이나 먼 소리는 작게, 종류별 볼륨, 음소거·볼륨 설정 포함).

## 11. 스페이스 스킬 에셋 (주인공 무기별 스킬)

스페이스를 누르면 지금 든 무기의 스킬이 나갑니다(쿨타임은 모든 무기가 공유, 기본 10초). 지금은 **그림·소리 파일이 없어서** 던진 철퇴는 도형이 돌고, 방벽은 파란 반투명 막대, 나머지는 무기 색 고리로 표시합니다. 아래 파일을 `client/public/assets/` 아래 지정한 위치에 넣어 주시면 코드를 연결합니다(파일이 없으면 지금처럼 도형으로 그립니다). 그림체·투명 배경·시트 형식은 위 **0번**을 그대로 따릅니다.

| 무기 | 스킬 | 무슨 일이 일어나나 |
| --- | --- | --- |
| 활 | 후퇴 | 조준 반대쪽으로 130px를 0.14초 만에 물러남 |
| 창 | 돌진 | 조준 방향으로 240px를 0.18초 만에 돌진, 끝에 앞을 찌름 |
| 검 | 무적 | 1초 동안 피해를 받지 않음 |
| 철퇴 | 투척 | 커서 방향으로 철퇴가 420px 날아가다 적에게 닿으면 그 자리에 반경 80 광역 피해 |
| 지팡이 | 방벽 | 사거리 안 커서 위치에 조준선과 수직인 벽(길이 170 x 두께 22)이 5초 동안 섬. 부서지면 사라짐 |
| 기마 | 가속 | 2초 동안 최고 속도로 달림(공격하면 가속이 끝남) |

### 11-1. 그림 (이펙트) - `assets/fx/`

모두 **투명 PNG**, 시트로 한 번에 받아 주시면 `tools/slice_sheet.py`로 제가 자릅니다. 방향이 있는 것은 **오른쪽(→)을 향하게** 그려 주세요(코드가 돌립니다). 색은 흰색~밝은 회색 위주로 그려 주시면 무기 색으로 물들일 수 있습니다(아래 표에 "색 입힘"이라고 적은 것).

| 파일 이름 | 어디에 쓰이나 | 크기 | 컷 수 | 문구 (영어) |
| --- | --- | --- | --- | --- |
| `skill_mace_thrown` | 던진 철퇴(날아가는 동안 빙글빙글 돈다) | 64x64 | 1 | `a spiked iron mace seen from above, flying, wooden handle and a heavy spiked steel head, same thick-outline painterly style, transparent background` |
| `skill_mace_hit_0~4` | 철퇴가 적에게 닿은 자리의 충격(반경 80 = 지름 160) | 160x160 | 5 | `ground-shock impact burst, dust and cracked earth ring expanding outward, top-down, 5-frame sequence`, 기존 `boom_*`와 같은 결 |
| `skill_wall_0~2` | 마법사 방벽의 상태: 온전함 / 금이 감 / 거의 부서짐 | 170x22 (가로로 긴 띠) | 3 | `thin magical barrier wall made of translucent blue crystal and light, horizontal strip seen from above, glowing edge, (0 intact) (1 cracked) (2 almost shattered)`, 가로 길이는 게임에서 조절 가능(`SKILL_WALL_LEN`) |
| `skill_wall_break_0~3` | 방벽이 부서질 때 | 128x128 | 4 | `crystal wall shattering into glowing shards that fade, top-down, 4-frame sequence` |
| `skill_wall_rise_0~3` | 방벽이 서는 순간 | 170x64 | 4 | `magical barrier rising from the ground with sparkles, strip seen from above, 4-frame sequence` |
| `skill_dash_0~2` | 창 돌진의 속도선(몸 뒤로 길게 남음) | 160x64 | 3 | `speed streak trail pointing right, soft white motion lines and a faint afterimage, transparent, 3 frames`, 색 입힘 |
| `skill_dust_0~2` | 활 후퇴·창 돌진 시작의 먼지 | 96x64 | 3 | `small dust puff kicked up by sliding feet, 3-frame sequence`, 색 입힘 |
| `skill_guard_0~3` | 검 무적 중 주인공 몸을 감싼 막(1초 동안 반복) | 96x96 | 4 | `shimmering round energy ward around a hero, translucent pale cyan, gently pulsing, 4-frame loop` |
| `skill_boost_0~3` | 기마 가속 중 바람·속도 효과(몸 뒤) | 128x64 | 4 | `wind and speed aura trailing behind a galloping horse, white swirling lines with a few sparks, 4-frame loop, pointing right` |
| `skill_cast_0~3` | 스킬을 쓰는 순간의 신호(모든 스킬 공통, 발 밑) | 96x96 | 4 | `quick circular rune flash expanding under a hero, thin glowing ring, 4-frame sequence`, 색 입힘 |

#### 11-1-1. 방벽 이펙트 시트 프롬프트 (지팡이 스킬) - 수정 군락 "조각" 방식

방벽은 조준선과 수직으로 서고 **화면에서 가로·세로·대각선 어느 방향으로도** 놓입니다. 위로 솟은 그림을 통째로 돌리면 눕거나 뒤집혀 보이므로, 그림을 **작은 "조각"으로 만들어 방벽 선을 따라 일렬로 세워 놓는** 방식으로 그립니다(조각은 절대 회전하지 않고 항상 위가 위). 그래서 **조각 하나**를 아래 규칙으로 그려 주세요.

- **시점**: 유닛 시트와 같은 **옆에서 본(아주 약간 위에서 내려다본) 시점**. 수정이 **위로 솟아** 있고 면마다 명암이 있어 입체적으로. 위에서 수직으로 내려다본 평면 그림은 금지.
- **바닥선**: 그림 **맨 아래 가장자리**가 땅에 닿는 선(수정 밑동과 작은 돌조각이 그 선에 놓임). 밑동 아래에 얇은 그림자. 이 아래 선이 게임의 충돌 선이 됩니다.
- **좌우 이음**: 조각을 **옆으로 붙여 놓아도 이어지게**, 왼쪽·오른쪽 가장자리는 키 낮은 수정으로 끝나고 **캔버스 밖으로 삐져나가지 않게**. 좌우 가장자리 높이와 밑동 위치가 모든 조각에서 같아야 합니다.
- **크기**: 조각 하나는 대략 정사각형에서 약간 세로로 긴 비율(가로 : 세로 = 1 : 1.1), 게임에서는 가로 약 64px로 줄입니다. 시트에서는 **조각 하나를 높이 300px 이상**으로 크게 뽑아야 자를 때 높이 기준(100px)을 넘습니다.
- **색**: 마법사 지팡이와 같은 파란 수정(연한 하늘색~선명한 파랑), 안쪽에서 은은한 빛. **그림체는 게임 유닛과 같게**: 굵은 어두운 윤곽선(바깥 테두리 3~4px 느낌), 면을 단순하게 나눈 평평한 색(그라데이션·무지개빛 광택·사실적인 질감 금지), 치비·만화 같은 단순한 모양. **유닛 시트도 스타일 기준 이미지로 같이 첨부**하세요(수정 시안만 첨부하면 사실적으로 그려집니다). 첫 시안은 윤곽선이 얇고 광택이 많아서 게임에서는 코드로 굵은 남색 윤곽선을 덧입혀 쓰고 있습니다(원본은 `assets/fx/skill_wall_raw/`에 보관).
- 배경은 투명(또는 단색 회색)이어도 됩니다. 제가 지우겠습니다. 이미 받은 군락 시안(skill_wall_0~2)을 **참고 이미지로 같이 첨부**해 주세요.
- 네거티브: `top-down view, flat strip, floating, shadow cast far away, perspective distortion, text, characters`

각 프롬프트 앞에 위 **시트 요청 머리말**을 붙입니다.

**A. 방벽 조각 상태 3단계 x 변형 3개 (9조각, 3행 x 3열)**
행 = 상태(온전함 → 금이 감 → 거의 부서짐), 열 = 서로 다른 모양 3가지(같은 줄에서 번갈아 써서 반복감을 줄입니다).
```
<시트 요청 머리말>
A set of 9 modular crystal wall segments, 3 rows x 3 columns, each a small upright cluster of
translucent blue crystals seen from the side (very slightly from above), crystals pointing up,
flat ground line along the bottom edge with tiny rubble and a thin shadow, left and right ends
taper to low crystals so segments can be placed side by side and join seamlessly, same width,
same height and same base line in every segment, painterly style with soft glow inside the crystals.
row 1 (intact): clean sharp tall crystals, three different arrangements
row 2 (damaged): the same crystals with visible cracks and a few chipped tips, small shards on
  the ground, glow dimmer, three different arrangements
row 3 (almost shattered): mostly broken stumps and rubble with a few crystals left, bright blue
  light leaking from the cracks, scattered shards on the ground, three different arrangements
Captions, in order left to right then top to bottom:
skill_wall_0_a, skill_wall_0_b, skill_wall_0_c,
skill_wall_1_a, skill_wall_1_b, skill_wall_1_c,
skill_wall_2_a, skill_wall_2_b, skill_wall_2_c
```
```
python3 tools/slice_sheet.py <시트> client/public/assets/fx --names skill_wall_0_a,skill_wall_0_b,skill_wall_0_c,skill_wall_1_a,skill_wall_1_b,skill_wall_1_c,skill_wall_2_a,skill_wall_2_b,skill_wall_2_c --rows 3 --scale 0.2
```

**B. 부서질 때 4컷 (조각 하나가 부서지는 순서, 2행 x 2열)**
방벽의 모든 조각이 동시에 이 모션을 재생합니다.
```
<시트 요청 머리말>
4 frames of one upright crystal wall segment shattering, arranged 2 rows x 2 columns, seen from
the side (very slightly from above), each frame the same size with the same ground line along
the bottom edge, translucent blue crystals, painterly style.
frame 1: the intact segment with a bright crack of light across it
frame 2: the crystals bursting apart into large shards flying outward and up, bright glow
frame 3: smaller shards and glowing dust falling back down, glow fading
frame 4: only a few tiny shards and faint blue dust on the ground line
Captions: skill_wall_break_0, skill_wall_break_1, skill_wall_break_2, skill_wall_break_3
```
```
python3 tools/slice_sheet.py <시트> client/public/assets/fx --names skill_wall_break_0,skill_wall_break_1,skill_wall_break_2,skill_wall_break_3 --rows 2 --scale 0.2
```

**C. 서는 순간 4컷 (조각 하나가 솟아오르는 순서, 2행 x 2열)**
```
<시트 요청 머리말>
4 frames of one upright crystal wall segment growing out of the ground, arranged 2 rows x 2
columns, seen from the side (very slightly from above), each frame the same size with the same
ground line along the bottom edge, translucent blue crystals, painterly style.
frame 1: a glowing crack on the ground with a few sparkles and a small dust puff
frame 2: small sharp crystal tips pushing up out of the ground, glow
frame 3: the crystals mostly grown, about three quarters of the final height, bright glow burst
frame 4: the finished intact segment (same look as the intact segments), glow settling
Captions: skill_wall_rise_0, skill_wall_rise_1, skill_wall_rise_2, skill_wall_rise_3
```
```
python3 tools/slice_sheet.py <시트> client/public/assets/fx --names skill_wall_rise_0,skill_wall_rise_1,skill_wall_rise_2,skill_wall_rise_3 --rows 2 --scale 0.2
```

- **만드는 순서**: A를 먼저. B·C를 뽑을 때 A의 온전한 조각(skill_wall_0_a)을 참고 이미지로 같이 첨부하면 색·질감이 이어집니다.
- **게임에서 쓰는 방식**: 방벽 길이(`SKILL_WALL_LEN`)만큼 조각 3~4개를 선을 따라 세우고(조각마다 a·b·c 변형을 번갈아), 유닛과 같은 y 기준으로 앞뒤 가림을 맞춥니다. 판정(두께 22의 선)은 조각의 **아래쪽 바닥선**에 둡니다.
- **이전 시안 보관**: 이미 받아서 적용한 평면 띠 그림(`skill_wall_0~2.png`)은 지우지 않고 보관하며, 조각 그림이 들어오기 전까지는 그대로 쓰입니다.
- 위 11-1 표의 `skill_wall_*` 행은 이 조각 방식으로 대체됩니다(크기: 조각 하나 약 64x70px).

#### 11-1-2. 철퇴 투척 에셋 전체 (그림 3종 + 소리 2종)

철퇴 스킬은 **커서 방향으로 철퇴를 던지고, 날아가다 적에게 닿으면 그 자리에 반경 80(지름 160)의 광역 피해**를 줍니다. 필요한 에셋은 ① 날아가는 철퇴, ② 날아가는 꼬리(궤적), ③ 적중 충격, ④ 소리 2종입니다(아이콘은 완료). **그림체는 게임 유닛과 같게**: 굵은 어두운 윤곽선, 면을 단순하게 나눈 평평한 색, 치비·만화풍, 사실적인 질감·그라데이션 금지. 각 프롬프트 앞에 **시트 요청 머리말**을 붙이고 **유닛 시트를 스타일 기준 이미지로 같이 첨부**하세요(0장). 네거티브: `realistic, photo, 3d render, gradients, text, characters, background scenery`.

**A. 날아가는 철퇴 + 궤적 (4개, 한 줄)**
철퇴는 날아가는 동안 **코드가 빙글빙글 돌립니다**. 그래서 철퇴는 **한 장만** 그리고, 돌려도 어색하지 않게 **머리(가시 달린 쇠공)가 중심에 오도록** 비스듬히 놓습니다. 궤적은 철퇴 뒤에 깔리는 **휘어진 바람줄**입니다.
```
<시트 요청 머리말>
4 items in one row on a transparent background, thick dark outline, flat painterly colors:
1. a spiked iron mace for a projectile, seen from the side, placed diagonally, the spiked steel
   ball head near the center of the image and the short wooden handle pointing down-left,
   dull silver-steel head with a few dark rivets, brown wood handle with a leather wrap,
   a faint motion tint on the spikes, nothing else around it
2-4. three frames of a curved spin trail (white and pale cyan swoosh lines), a crescent arc
   of 3 thin streaks curving around a point, frame 2-4 gradually longer and thinner, soft
   fading tips, no weapon in them
Captions: skill_mace_thrown, skill_mace_trail_0, skill_mace_trail_1, skill_mace_trail_2
```
```
python3 tools/slice_sheet.py <시트> client/public/assets/fx --names skill_mace_thrown,skill_mace_trail_0,skill_mace_trail_1,skill_mace_trail_2 --rows 1 --scale 0.12
```
- 철퇴(1번)는 화면에서 약 **64px**, 궤적은 약 **128px**로 줄여 씁니다.
- 크게 뽑아 주세요(각 항목 시트 기준 높이 300px 이상).

**B. 적에게 닿았을 때 충격 5컷 (한 줄)**
```
<시트 요청 머리말>
5 frames of a heavy mace impact shockwave on the ground, in one row, seen from slightly above
so the effect reads as a roughly circular burst, thick dark outline, flat painterly colors,
each frame a square with the same center, dust in warm brown and stone-gray, a few bright
white impact flashes:
frame 1: a bright white-yellow flash at the center with a small crack on the ground
frame 2: a ring of dust and stone chunks bursting outward, cracks spreading, the strongest moment
frame 3: the ring at its widest, thinner dust, chunks flying and falling, cracks fading
frame 4: scattered dust clouds and a few small pebbles settling, ring almost gone
frame 5: only faint dust wisps and two or three tiny pebbles
Captions: skill_mace_hit_0, skill_mace_hit_1, skill_mace_hit_2, skill_mace_hit_3, skill_mace_hit_4
```
```
python3 tools/slice_sheet.py <시트> client/public/assets/fx --names skill_mace_hit_0,skill_mace_hit_1,skill_mace_hit_2,skill_mace_hit_3,skill_mace_hit_4 --rows 1 --scale 0.16
```
- 충격 그림은 **지름 160px**로 줄여 씁니다(폭발 반경 80). 가장 넓은 2~3번 컷이 반경을 채우게 그려 주세요(반경을 넘으면 실제 판정보다 커 보입니다).
- 기존 운석 폭발(`boom_*`)과 비슷한 결이면 좋지만, 철퇴는 **불꽃이 아니라 흙먼지와 돌조각**이어야 마법과 구분됩니다.

**C. 소리 2종** (규칙은 10-0과 같음, 문구는 11-3과 같음)
| 파일 이름 | 언제 나는가 | 문구 (영어) | 길이·변형 |
| --- | --- | --- | --- |
| `skill_mace_throw` | 철퇴를 던질 때 | `heavy mace thrown, deep spinning whoosh that fades away, no voice` | 0.5초, 2종 |
| `skill_mace_hit` | 던진 철퇴가 적에게 닿을 때 | `heavy mace crashing into armor, big dull impact with a short rumbling shockwave and a few stone chips` | 0.6초, 2종 |

**만드는 순서**: A의 철퇴 → B의 충격 → 소리 → A의 궤적(없어도 됨). 철퇴는 이미 만든 스킬 아이콘(`skill_icon_mace`)과 모양(가시 쇠공 + 나무 자루)이 같아야 어울리니 **아이콘도 참고 이미지로 첨부**하세요.

#### 11-1-3. 기마 가속 속도 이펙트 (애니메이션 4세트)

이전의 **속도선 세 줄**(기병 뒤 선)은 속도감이 없어서 없앴고, 그 자리를 **여러 장면으로 움직이는 이펙트**로 대신합니다. 기마 스킬 **가속**(2초 동안 최고 속도, 공격하면 해제)을 쓰는 동안 **말 뒤에 바람 궤적이 흐르고, 발굽에서 흙먼지가 튀며**, 시작할 때 폭발하듯 퍼지고, 공격으로 풀릴 때 가속이 빠지는 느낌을 줍니다.

**방향 규칙(중요)**: 기병은 8방향으로 달리므로, 이펙트는 모두 **오른쪽(→)으로 달릴 때를 기준**으로 그려 주세요. **효과가 몸 왼쪽(뒤)으로 길게 늘어지게** 그립니다. 게임이 달리는 방향의 반대쪽으로 돌려서 붙입니다(그래서 위쪽·아래쪽이 대칭에 가깝고 방향성 없는 소용돌이가 좋습니다).
**움직임 규칙**: 반복(루프) 세트는 **마지막 컷에서 첫 컷으로 이어질 때 튀지 않게** 같은 위치·같은 크기에서 모양만 흘러가듯 바뀌게 그려 주세요(각 컷이 앞 컷에서 조금씩 뒤로 밀려난 모양).
**그림체**: 게임 유닛과 같게. 굵지 않은 어두운 윤곽선(2px 느낌) 또는 윤곽 없이 흰색 중심, 면이 단순한 평평한 색, 사실적인 연기·그라데이션 금지. 색은 **흰색~연한 하늘색**(바람)과 **따뜻한 흙색**(먼지)만 씁니다. 유닛 시트를 스타일 기준 이미지로 첨부하고, 투명 배경 또는 단색 회색 배경으로 받습니다(지우는 건 제가 합니다). 네거티브: `realistic smoke, photo, 3d render, text, characters, horse, rider, background scenery`.

각 프롬프트 앞에 **시트 요청 머리말**을 붙입니다.

**A. 바람 궤적 반복 6컷 (3행 x 2열)** - 말 뒤에 흐르는 바람
```
<시트 요청 머리말>
6 frames of a looping speed wind trail effect, arranged 3 rows x 2 columns, each frame a wide
rectangle (about 2:1), no horse and no rider. The trail flows horizontally: it starts thick and
bright at the RIGHT edge (the front, near the horse) and stretches out to the LEFT, thinning and
fading with swirling curved wind ribbons, 4 to 5 white and pale-cyan ribbons of different
lengths, a few small spiral curls and tiny sparkles. Same size and same placement in every
frame, the ribbons shifting backward (to the left) a little more in each frame so the 6 frames
loop smoothly, the last frame flowing back into the first. Flat colors, thin dark outline.
Captions in order left to right, top to bottom: skill_boost_0, skill_boost_1, skill_boost_2,
skill_boost_3, skill_boost_4, skill_boost_5
```
```
python3 tools/slice_sheet.py <시트> client/public/assets/fx --names skill_boost_0,skill_boost_1,skill_boost_2,skill_boost_3,skill_boost_4,skill_boost_5 --rows 3 --scale 0.16
```
- 화면에서 길이 약 **190px**, 높이 약 **95px**로 씁니다. 시트에서 컷 하나를 높이 300px 이상으로 크게 뽑아 주세요.

**B. 발굽 흙먼지 반복 4컷 (한 줄)** - 달리는 동안 땅에서 튀는 먼지
```
<시트 요청 머리말>
4 frames of a looping hoof dust effect for a galloping horse, one row, no horse. Small puffs of
warm brown dust and a few pebbles kicked up behind (to the LEFT of) a point at the bottom right
of each frame, rising a little and drifting left. Each frame has 3 to 4 puffs of different
sizes at slightly different positions so the 4 frames loop smoothly, last frame back into the
first. Ground line along the bottom edge. Flat colors, thin dark outline.
Captions: skill_boost_dust_0, skill_boost_dust_1, skill_boost_dust_2, skill_boost_dust_3
```
```
python3 tools/slice_sheet.py <시트> client/public/assets/fx --names skill_boost_dust_0,skill_boost_dust_1,skill_boost_dust_2,skill_boost_dust_3 --rows 1 --scale 0.16
```
- 화면에서 약 **96x64px**. 말 발밑에 붙여 쓰므로 **바닥선이 이미지 맨 아래**에 오게 해 주세요.

**C. 가속 시작 폭발 5컷 (한 줄)** - 스킬을 쓰는 순간
```
<시트 요청 머리말>
5 frames of a sudden speed-burst effect, one row, no horse, centered, each frame a square.
frame 1: a small bright white flash with a few short speed lines
frame 2: a ring-shaped shockwave of white and pale-cyan wind bursting outward, dust at the bottom
frame 3: the ring at its widest, long thin speed lines streaking toward the LEFT, dust puffs
frame 4: the ring thin and fading, speed lines shorter, dust drifting
frame 5: only a few faint streaks and dust wisps
Flat colors, thin dark outline.
Captions: skill_boost_start_0, skill_boost_start_1, skill_boost_start_2, skill_boost_start_3, skill_boost_start_4
```
```
python3 tools/slice_sheet.py <시트> client/public/assets/fx --names skill_boost_start_0,skill_boost_start_1,skill_boost_start_2,skill_boost_start_3,skill_boost_start_4 --rows 1 --scale 0.16
```
- 화면에서 약 **128px**, 0.4초 동안 재생합니다.

**D. 가속이 풀릴 때 3컷 (한 줄, 없어도 됨)** - 공격으로 속도를 잃는 순간
```
<시트 요청 머리말>
3 frames of a speed-loss effect, one row, no horse, centered, each frame a square.
frame 1: the wind ribbons snapping and bursting into a few short pieces, a small white flash
frame 2: the pieces scattering backward (to the LEFT), a small dust cloud
frame 3: only faint wisps fading away
Flat colors, thin dark outline.
Captions: skill_boost_end_0, skill_boost_end_1, skill_boost_end_2
```
```
python3 tools/slice_sheet.py <시트> client/public/assets/fx --names skill_boost_end_0,skill_boost_end_1,skill_boost_end_2 --rows 1 --scale 0.16
```

- **만드는 순서**: A(바람 궤적)가 가장 중요하고, 다음 B(흙먼지), C(시작 폭발), D 순서입니다. A만 있어도 속도감이 크게 달라집니다.
- **게임에서 쓰는 방식**: 가속 중에는 A를 말 뒤에 붙여 **0.05초마다 한 컷씩 반복**하고, B를 발밑에 같이 반복하며, 시작할 때 C를 한 번, 공격으로 풀릴 때 D를 한 번 재생합니다. 이펙트는 달리는 방향의 반대쪽으로 돌려 붙입니다.
- 위 11-1 표의 `skill_boost_0~3`(4컷)과 `skill_dust`(기마 가속 쪽) 행은 이 4세트로 대체됩니다.

### 11-2. 스킬 아이콘 6개 (화면 오른쪽 아래 스킬 줄용), 한 줄 - `assets/ui/`

화면 오른쪽 아래 무기 칸 위의 **스킬 줄**에 쓰입니다(쿨타임 막대와 숫자는 코드가 그립니다). 위 **8-1** 무기 아이콘과 같은 형식(둥근 사각형 배지 안에 그림 하나)으로 만들어서 한 줄로 어울리게 합니다. 투명 배경, 그림 속에 글자 없음.

```
<시트 요청 머리말>
6 skill icons in one row, each centered in a rounded-square badge, thick dark outline,
no text, each icon is one bold readable symbol that reads clearly even at 48 pixels.
Silver-steel, wood and a little warm gold; the badge fill is a dark slate color.
1. a longbow with a small curved arrow pointing backward (retreat / back-step),
   a few short dust lines behind it
2. a long spear thrusting forward with three bold motion streaks behind the blade (dash)
3. a sword with a small round shield, a thin glowing pale-cyan ring around the shield (invulnerability)
4. a spiked iron mace tilted as if thrown, with a curved spin trail behind it
5. a magic wooden staff with a blue crystal, a small translucent blue crystal wall rising next to it
6. a galloping horse head seen from the side with white wind lines streaming behind it (speed boost)
Captions: skill_icon_bow, skill_icon_spear, skill_icon_sword, skill_icon_mace, skill_icon_staff, skill_icon_mount
```
`python3 tools/slice_sheet.py <시트> client/public/assets/ui --names skill_icon_bow,skill_icon_spear,skill_icon_sword,skill_icon_mace,skill_icon_staff,skill_icon_mount --rows 1 --scale 0.3`

- 한 번에 6개가 안 맞으면 3개씩 두 장으로 나눠 뽑아도 됩니다(순서는 위와 같게).
- 배지 색을 무기별로 다르게 하고 싶으면 문구 끝에 `badge colors: green, orange, cyan, purple, blue, brown (in the same order)`를 붙이세요(무기 칸의 병종 색과 같은 순서: 활 초록, 창 주황, 검 하늘색, 철퇴 보라, 지팡이 파랑, 기마 갈색).

### 11-3. 소리 - `assets/audio/` (형식·길이 규칙은 **10-0**과 같음)

| 파일 이름 | 언제 나는가 | 문구 (영어) | 길이·변형 |
| --- | --- | --- | --- |
| `skill_backstep` | 활 후퇴 | `quick backward skid on dirt, short scuff and a small cloth rustle` | 0.2초, 2종 |
| `skill_dash` | 창 돌진 | `fast forward dash, sharp air whoosh ending in a light spear tip whistle` | 0.3초, 2종 |
| `skill_guard` | 검 무적 시작 | `bright protective ward activating, short shimmer and a soft metallic ring` | 0.5초, 1종 |
| `skill_mace_throw` | 철퇴 던질 때 | `heavy mace thrown, deep spinning whoosh that fades away` | 0.5초, 2종 |
| `skill_mace_hit` | 던진 철퇴가 적에게 닿을 때 | `heavy mace crashing into armor, big dull impact with a short rumbling shockwave` | 0.6초, 2종 |
| `skill_wall_up` | 방벽이 설 때 | `crystal barrier rising from the ground, glassy chime and a low stone rumble` | 0.6초, 1종 |
| `skill_wall_hit` | 방벽이 공격을 맞을 때 | `dull hit on a crystal wall, short thud with a tiny glassy crack` | 0.15초, 3종 |
| `skill_wall_break` | 방벽이 부서질 때 | `crystal wall shattering into pieces, short bright shatter and falling shards` | 0.7초, 1종 |
| `skill_boost` | 기마 가속 | `horse bursting into a gallop, hoof drum roll and a short whinny with a rush of wind` | 0.8초, 1종 |
| `skill_ready` | 쿨타임이 끝났을 때(작게) | `very soft ready chime, single short low bell, subtle` | 0.3초, 1종 |

### 11-4. 우선순위

1. **스킬 아이콘 6종**(11-2)과 **던진 철퇴·철퇴 충격**(`skill_mace_thrown`, `skill_mace_hit`): 눈에 가장 자주 보입니다.
2. **방벽 3상태와 부서짐**(`skill_wall_0~2`, `skill_wall_break`): 지금은 파란 막대라 가장 임시처럼 보입니다.
3. **돌진·후퇴·가속 이펙트**(`skill_dash`, `skill_dust`, `skill_boost`), **무적 막**(`skill_guard`).
4. 소리 10종: `skill_mace_hit`, `skill_wall_up`, `skill_guard`, `skill_dash`부터.
5. 시전 신호(`skill_cast`)와 방벽 생성(`skill_wall_rise`)은 나중에.

넘겨 주신 파일은 이름이 위 표와 같으면 바로 연결하고, 다르면 제가 이름을 맞춰 옮기겠습니다. 소리는 `shared/src/audio.ts`의 `SOUNDS`에 항목(음량, 겹침 제한)을 추가하고, 이펙트는 서버가 보내는 `EVT_SKILL` 이벤트(무기 번호, 발동/적중/부서짐 구분)에 연결합니다.
