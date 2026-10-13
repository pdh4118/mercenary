# 에셋 제작 프롬프트 (이미지 생성 AI / 아티스트 의뢰용)

프롬프트는 영어로 써 두었습니다(이미지 생성 AI가 영어를 더 잘 따릅니다). 그대로 복사해서 쓰시면 됩니다.

## 진행 상황

| 에셋 | 상태 |
|---|---|
| 병종 유닛 10종 (아군·적 각 5) | 완료, 게임에 적용됨 (`client/public/assets/units/`) |
| 주인공 (무기 4종) | 이 문서 3번 |
| 캠프 | 이 문서 4번 |
| 바닥 타일 | 이 문서 5번 |
| 투사체 (화살) | 이 문서 6번 |
| 레벨업 카드 아이콘 19종 | 이 문서 7번 |
| 무기·HUD 아이콘 | 이 문서 8번 |
| 효과음·음악 | 이 문서 10번 |

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

효과음 생성 도구에 쓰실 문구입니다. 짧게(0.1~0.6초) 만들고, **같은 소리가 수십 번 겹쳐도 거슬리지 않게** 낮고 둥근 소리로 요청하세요.

- 활 쏘기: `short bow release twang, dry, 0.2s`
- 화살 명중: `soft arrow hit thud, 0.15s`
- 창 찌르기: `quick spear thrust whoosh with a light impact, 0.25s`
- 검 휘두르기: `sword swing whoosh, light metallic, 0.25s`
- 철퇴 타격: `heavy mace smash, deep thud, 0.4s`
- 적 처치: `small enemy defeated pop, low volume, 0.15s`
- 금화 획득: `coin pickup chime, bright, 0.2s`
- 용병 고용: `hire confirmation sound, coins and a short horn, 0.5s`
- 레벨업: `level up fanfare, short, uplifting, 0.8s`
- 돌격 지시: `cavalry charge horn call, 0.6s`
- 주인공 피격: `player hurt grunt with a dull hit, 0.25s`
- 쓰러짐/부활: `defeat low tone` / `revive rising shimmer`
- 배경음악: `loopable dark fantasy battle theme, drums and low strings, 120 bpm, 2 minutes, seamless loop`
