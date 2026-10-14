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

## 교체·크레딧 정리 (출시 전 확인)

아래 파일은 외부 사이트(Freesound 형식 이름)에서 받은 것이라 **라이선스를 확인하지 않았습니다.** 상업 이용 가능 여부(CC0 / CC BY / CC BY-NC 등)와 저작자 표시 의무를 원본 페이지에서 확인해, 쓸 수 없으면 직접 만든 소리나 라이선스가 확실한 소리로 같은 파일 이름에 덮어쓰면 됩니다(코드 수정 불필요).

| 게임 파일 | 제작자 | 라이선스 확인 | 교체 필요 여부 |
| --- | --- | --- | --- |
| `melee_hit_5` | luminousfridge (#496192) | 미확인 | 미정 |
| `melee_hit_6` | sypherzent (#420673) | 미확인 | 미정 |
| `melee_hit_7` | heckfricker (#797821) | 미확인 | 미정 |
| `shield_break_3` | soundflakes (#492237) | 미확인 | 미정 |
| `boss_warning_1` | poligonstudio (#392618) | 미확인 | 미정 |
| `bgm_boss` | harrisonlace (#871671) | 미확인 | 미정(임시 음악) |
| `bgm_grow` | code_box (#559485) | 미확인 | 미정(임시 음악) |
| `enemy_die_1` | starkvind (#559975) | 미확인 | 미정 |
| `enemy_die_2` | artmasterrich (#345456) | 미확인 | 미정 |

Suno로 만든 곡에서 자른 `melee_hit_1~4`, `arrow_hit_*`, `shield_break_1~2`와 직접 받은 `impact`, 활·방패 소리 파일(`bow_shot_1`, `arrow_volley_1`, `shield_block_*`, `crit_hit_*`)도 생성·출처 약관을 확인해야 합니다(Suno는 요금제에 따라 상업 이용 조건이 다릅니다).

## 외부에서 받은 소리와 출처

| 게임 파일 | 원본 파일 이름 | 비고 |
| --- | --- | --- |
| `melee_hit_5` | `496192__luminousfridge__bash-hit-sfx.ogg` | 0.2초 단일 타격, Freesound 형식의 이름(제작자 luminousfridge). **라이선스(CC0 / 저작자 표시 필요 등)를 원본 페이지에서 확인하고, 표시가 필요하면 크레딧에 넣어야 합니다.** |
| `melee_hit_6` | `420673__sypherzent__basic-melee-hit.wav` | 0.18초, 둔탁한 타격(중심 약 1.5kHz). 제작자 sypherzent, **라이선스 확인 필요** |
| `melee_hit_7` | `797821__heckfricker__thwack-01.wav` | 0.21초 타격(중심 약 2.5kHz로 위 둘보다 밝음). 제작자 heckfricker, **라이선스 확인 필요** |
| `shield_break_3` | `492237__soundflakes__shield-breaking-with-bludgeon.wav` | 1.2초(원본 1.9초에서 0.3~1.5초 구간), 둔기로 방패가 부서지는 소리. 제작자 soundflakes, **라이선스 확인 필요** |
| `boss_warning_1` | `392618__poligonstudio__movie-horn.wav` | 원본 29초 중 앞 3.4초(뒤는 잔향), 낮은 호른(기본음 약 110Hz). 제작자 poligonstudio, **라이선스 확인 필요** |
| `bgm_boss` | `871671__harrisonlace__cinematic_drum_loop_shellshock_143.wav` | 60.4초 드럼만 있는 루프(143 BPM, 36마디). 임시 보스전 음악. 제작자 harrisonlace, **라이선스 확인 필요** |
| `bgm_grow` | `559485__code_box__battle-tactics.wav` | 원본 74초 중 앞 69초(끝의 소리가 줄어드는 부분 제외), 처음부터 끝까지 꽉 찬 전투 분위기 음악. 임시 성장 시간 음악. 제작자 code_box, **라이선스 확인 필요** |
| `enemy_die_1` | `559975__starkvind__man-dies.wav` | 0.7초, 남자가 쓰러지며 내는 비명(중심 약 1.2kHz). 한 종류뿐이라 높낮이를 매번 ±15% 바꿔 재생하고 간격을 150ms로 늘렸다. 제작자 starkvind, **라이선스 확인 필요** |
| `enemy_die_2` | `345456__artmasterrich__male_death_04.wav` | 0.85초(원본 1.03초), 남자 죽는 비명. 원본이 0dB를 넘어 5dB 낮춤(중심 약 1.8kHz). 제작자 artmasterrich, **라이선스 확인 필요** |
