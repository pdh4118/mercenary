# 에셋 제작 프롬프트 (이미지 생성 AI / 아티스트 의뢰용)

게임 화면은 **위에서 내려다보는 2D 탑다운**이고, 화면에 유닛이 수백 개 나옵니다. 그래서 가장 중요한 건 **작게 줄여도 알아보이는 실루엣과 색**입니다. 아래 프롬프트는 영어로 써 두었습니다(이미지 생성 AI가 영어를 더 잘 따릅니다). 그대로 복사해 쓰시면 됩니다.

## 0. 먼저 정할 것

1. **그림체 하나를 고르고 끝까지 고정**합니다. 에셋마다 화풍이 다르면 게임이 어수선해집니다. 아래 "스타일 머리말"을 모든 프롬프트 앞에 붙이세요.
2. 마음에 드는 첫 결과(예: 창병)를 **스타일 기준 이미지**로 삼고, 이후 생성 때 참고 이미지(reference / style reference)로 같이 넣으세요.
3. **투명 배경 PNG**로 받으세요. 안 되면 단색 배경으로 받아 따로 배경을 지웁니다.
4. 생성은 크게(1024px 이상) 하고, 게임에 넣을 때 줄입니다. 줄였을 때 뭉개지는지 반드시 확인하세요.

## 1. 스타일 머리말 (모든 프롬프트 앞에 붙임)

```
2D top-down game sprite, viewed from directly above, flat colors with a thick
dark outline, clean readable silhouette, minimal shading, slightly stylized
chibi proportions, consistent lighting from the top-left, isolated on a
transparent background, no text, no watermark, no cast shadow on the ground
```

네거티브(지원하는 도구에서): `perspective, 3d render, isometric, side view, realistic, photo, blurry, noisy texture, text, logo, background scenery, multiple characters`

## 2. 색 규칙 (코드가 이 색을 기준으로 구분합니다)

| 병종 | 주색 | 무장 |
|---|---|---|
| 기병 | 주황 | 말을 탄 경기병, 가벼운 창/검 |
| 창병 | 초록 | 긴 창, 가죽·천 갑옷 |
| 궁병 | 노랑 | 활, 가벼운 복장, 화살통 |
| 검방병 | 파랑 | 검과 큰 방패, 판금 |
| 둔기병 | 보라 | 철퇴/둔기, 두꺼운 갑옷 |

- **아군**은 밝고 선명하게, **적**은 같은 병종이라도 **어둡고 탁하게** 그려서 한눈에 구분되게 합니다(적은 붉은 기운이 도는 어두운 톤).
- 플레이어별 구분 색(테두리 고리)은 **코드에서 덧입히므로**, 아군 스프라이트의 바깥 테두리는 **밝은 회백색**으로 두세요.
- 모든 유닛은 **오른쪽(동쪽)을 바라보게** 그려 주세요. 게임에서 방향에 맞춰 회전시킵니다.

## 3. 크기 규격

| 종류 | 최종 크기(px) | 비고 |
|---|---|---|
| 용병/적 유닛 | 64 x 64 | 실제 화면에서는 24~32px 정도로 보임 |
| 주인공 | 64 x 64 | 무기 4종 각각 |
| 투사체 | 16 x 16 | 화살, 적 화살 |
| 캠프 | 128 x 128 | |
| 카드 아이콘 | 96 x 96 | 레벨업 카드 15종 |
| 바닥 타일 | 256 x 256 | 이음새 없이 반복되어야 함 |

파일 이름은 `assets/units/ally_spear.png`, `assets/units/enemy_spear.png`처럼 **영문 소문자 + 밑줄**로 해 주세요.

## 4. 유닛 프롬프트

`<스타일 머리말>` 부분에는 1번 머리말을 통째로 붙입니다. `ally`는 아군, `enemy`는 적 버전입니다.

### 기병 (cavalry) - 주황
```
<스타일 머리말>
a light cavalry rider on a horse, facing right (east), orange cloth and
accents, short lance held forward, bright and saturated colors, silver-white outer rim
```
적 버전: 위 프롬프트에서 `bright and saturated colors, silver-white outer rim` 를
`dark desaturated colors with dark red accents, battered armor` 로 교체.

### 창병 (spear) - 초록
```
<스타일 머리말>
a spearman soldier, facing right (east), green tunic, long spear pointing right
extending beyond the body, leather armor, bright and saturated colors, silver-white outer rim
```

### 궁병 (archer) - 노랑
```
<스타일 머리말>
an archer soldier, facing right (east), yellow hood and tunic, drawing a short
bow, quiver on the back, light clothing, bright and saturated colors, silver-white outer rim
```

### 검방병 (sword and shield) - 파랑
```
<스타일 머리말>
a heavy infantry soldier with a sword and a large round shield, facing right
(east), blue plate armor, shield held in front, bright and saturated colors, silver-white outer rim
```

### 둔기병 (mace) - 보라
```
<스타일 머리말>
a heavily armored soldier carrying a large spiked iron mace over the shoulder,
facing right (east), purple armor trim, bulky silhouette, bright and saturated colors, silver-white outer rim
```

적 버전은 모두 같은 프롬프트에서 마지막 부분만 아래로 바꿉니다.
`dark desaturated colors with dark red accents, battered armor, no bright rim`

## 5. 주인공 (무기 4종)

주인공은 용병보다 한눈에 띄어야 합니다. 몸은 같고 **무기만 다르게** 4장을 뽑으세요.
```
<스타일 머리말>
a mercenary captain hero, facing right (east), dark cloak with a bright red
scarf, confident pose, slightly larger and more detailed than ordinary soldiers,
holding <무기>
```
`<무기>` 자리에: `a longbow` / `a long spear` / `a sword` / `a spiked iron mace`

## 6. 투사체와 이펙트

```
<스타일 머리말>
a single arrow pointing right (east), simple shape, 16x16 icon, pale yellow shaft
```
적 화살: `a single arrow pointing right, dark red shaft with a black tip`

이펙트(공격 예고 부채꼴, 돌격 표시, 레벨업 고리)는 **코드로 그려서 이미 구현**되어 있으므로 따로 만들지 않아도 됩니다.
타격 이펙트 스프라이트가 필요해지면 그때 추가하세요.

## 7. 캠프, 바닥

```
<스타일 머리말>
a small mercenary camp seen from above: a canvas tent, a campfire with a little
smoke, a banner pole, a few crates, warm brown and orange palette
```
```
seamless tileable ground texture, top-down, dark muted grass and dirt, very low
contrast so units stay readable on top, subtle noise, 256x256, no objects, no text
```
바닥은 **대비를 낮게** 해야 합니다. 유닛이 수백 개 올라가므로 바닥이 화려하면 전투가 안 보입니다.

## 8. 레벨업 카드 아이콘 (96 x 96)

카드는 3종류입니다. 종류별로 테두리 색을 통일하세요: **규모 = 금색, 용병 강화 = 초록, 주인공 강화 = 파랑**.

공통 머리말:
```
flat game UI icon, single centered symbol, bold simple shapes, thick dark outline,
<테두리 색> accent, dark transparent background, no text
```

| 카드 | 아이콘 설명 |
|---|---|
| 통솔력 +1 / +2 | 깃발, 또는 여러 병사 머리 |
| 고용 비용 -15% | 금화 위에 아래 화살표 |
| 전리품 +25% | 금화 주머니 |
| 용병 체력 | 병사 방패 + 하트 |
| 용병 공격력 | 병사 + 교차한 검 |
| 용병 공격 속도 | 병사 + 번개 |
| 용병 이동 속도 | 병사 + 신발 날개 |
| 빠른 재집결 | 나팔 / 뿔피리 |
| 병종 단련(5종) | 각 병종 무기 + 별 |
| 주인공 최대 체력 | 큰 하트 |
| 주인공 이동 속도 | 날개 달린 부츠 |
| 주인공 사격 피해 | 화살 + 불꽃 |
| 주인공 연사 속도 | 화살 여러 개 |
| 체력 재생 | 하트 + 반짝임 |

## 9. 사운드 (효과음) 요청 목록

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

## 10. 만든 에셋을 넘겨 주실 때

- 폴더: `assets/units/`, `assets/hero/`, `assets/ui/`, `assets/tiles/`, `assets/audio/`
- 파일 이름: 영문 소문자 + 밑줄 (`ally_cavalry.png`, `enemy_blunt.png`, `hero_bow.png`, `card_leadership.png`)
- 저장소에 올려 주시거나 알려 주시면 코드의 도형을 이 스프라이트로 교체하고, 화면에서 겹침·잘림·가독성을 직접 확인한 뒤 크기와 색을 조정하겠습니다.
- 전부 한 번에 만들지 말고 **유닛 5종(아군) + 적 1종**만 먼저 만들어서 그림체를 확정하세요. 그다음 나머지를 같은 방식으로 뽑으면 일관성이 훨씬 좋습니다.
