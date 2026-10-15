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
| `meteor_fall` | 마법사 운석이 떨어지기 시작할 때(약 0.6초 뒤 폭발) | `meteor falling from the sky, rising whoosh into a heavy explosion with a rumbling tail` | 1.7초, 1종 |
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
