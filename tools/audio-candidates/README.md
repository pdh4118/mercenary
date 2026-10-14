# 소리 원본 보관

받은 충격음(impact) 10개를 앞뒤 무음을 자르고 최대 음량을 맞춰 보관한 것입니다. 모두 0.4~0.5초, 3~4.6kHz 중심의 밝은 금속성 타격음입니다. 게임이 읽는 파일은 `client/public/assets/audio/`에 복사본으로 들어 있습니다.

| 원본 | 쓰임 |
| --- | --- |
| `impact_8`, `impact_10` | 방패 막힘 `shield_block_2`, `_3` (가장 낮고 둔한 쪽) |
| `impact_2, 7, 1, 3, 4, 5, 6, 9` | 치명타 `crit_hit_1 ~ _8` (밝고 짧은 순서) |

바꾸려면 `client/public/assets/audio/`의 `<이름>_<번호>.ogg`를 다른 후보로 덮어쓰면 됩니다.

## Medieval Combat Foley (Suno 생성곡 2개) 에서 잘라 쓴 것

두 파일은 효과음 목록을 프롬프트로 만든 **음악 생성 결과(약 3분)**라서 효과음이 음악·잡음과 섞여 있습니다. 앞쪽 40초 안에 프롬프트 순서(활 → 화살 명중 → 근접 타격 → 방패 막힘 → 방패 깨짐 → 치명타...)대로 4~5초 간격의 타격음이 있었고, 그중 배경이 비교적 조용한 것만 골랐습니다. **직접 들어 보고 고른 것이 아니라 파형·음색 수치로 고른 것**이라 어울리지 않으면 바꿔 주세요.

| 게임 파일 | 원본(mp3 → 시각) |
| --- | --- |
| `arrow_hit_1` | Foley_1 8.89초 |
| `arrow_hit_2` | Foley 5.69초 |
| `melee_hit_1 ~ 4` | Foley_1 13.38초 / Foley 13.29초 / Foley_1 13.66초 / Foley 13.85초 |
| `shield_break_1, 2` | Foley_1 21.81초 / 22.93초 (0.6초) |

(`Foley_1`은 `Medieval_Combat_Foley_1.mp3`, `Foley`는 `Medieval_Combat_Foley.mp3`)

## 외부에서 받은 소리와 출처

| 게임 파일 | 원본 파일 이름 | 비고 |
| --- | --- | --- |
| `melee_hit_5` | `496192__luminousfridge__bash-hit-sfx.ogg` | 0.2초 단일 타격, Freesound 형식의 이름(제작자 luminousfridge). **라이선스(CC0 / 저작자 표시 필요 등)를 원본 페이지에서 확인하고, 표시가 필요하면 크레딧에 넣어야 합니다.** |
| `melee_hit_6` | `420673__sypherzent__basic-melee-hit.wav` | 0.18초, 둔탁한 타격(중심 약 1.5kHz). 제작자 sypherzent, **라이선스 확인 필요** |
| `melee_hit_7` | `797821__heckfricker__thwack-01.wav` | 0.21초 타격(중심 약 2.5kHz로 위 둘보다 밝음). 제작자 heckfricker, **라이선스 확인 필요** |
