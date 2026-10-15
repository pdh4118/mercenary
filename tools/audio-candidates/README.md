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
| `meteor_fall_1` | univ_lyon3 (#367093, 원본 `chatel_florian_2016_2017_meteorite.wav` 5.8초 중 4.15~5.83초) | 미확인 | 미정 |
| `armor_fall_1~4` | artninja / halleck (#704881) | 미확인 | 미정 |
| `armor_fall_5` | sgossner (#209405) | 미확인 | 미정 |
| `melee_hit_8` | marb7e (#620355) | 미확인 | 미정 |
| `shield_block_4` | dermotte (#263008) | 미확인 | 미정 |
| `arrow_hit_3` | thecrow_br (#574044) | 미확인 | 미정 |
| `ally_hurt_1` | micahlg (#413186) | 미확인 | 미정(1종뿐이라 변형 추가 권장) |
| `level_up_1` | makofox (#126422) | 미확인 | 미정 |

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
| `armor_fall_1 ~ 4` | `704881__artninja__121623__halleck__tf_prime_inspired_robot_body_falls_or_impacts_03.mp3` | 원본 12.6초에 로봇 몸체가 쓰러지는 소리 10개가 있어 그중 4개(0, 1.2, 4.65, 8.0초 시작, 각 0.8초)를 사용. 중심 약 3.6kHz로 금속성이 강함. 제작자 artninja(원 제작 halleck), **라이선스 확인 필요** |
| `armor_fall_5` | `209405__sgossner__plate-armor-rustle-4.mp3` | 원본 0.97초(너무 작아 12dB 키움)에서 0.35~0.95초만 사용, 판금 갑옷이 스치며 달그락거리는 소리(중심 약 5.6kHz). 쓰러지는 소리보다는 부스럭에 가까움. 제작자 sgossner, **라이선스 확인 필요** |
| `melee_hit_8` | `620355__marb7e__whooshsword_hit-armor.wav` | 원본 2.2초 중 0.1~0.5초(칼 휘두르는 바람 소리가 짧게 앞에 붙고 갑옷에 맞는 소리가 이어짐). 다른 타격음보다 앞이 살짝 길다. 제작자 marb7e, **라이선스 확인 필요** |
| `shield_block_4` | `263008__dermotte__metallic_hit.wav` | 원본 1.57초 중 앞 0.45초, 금속이 부딪히며 울리는 소리(중심 약 4kHz). 타격 후 쇳소리 여운이 남음. 방패 막힘으로 사용. 제작자 dermotte, **라이선스 확인 필요** |
| `ally_hurt_1` | `413186__micahlg__male_hurt9.ogg` | 원본 0.38초 중 앞 0.27초, 짧게 "윽" 하는 남자 신음(중심 약 3.2kHz). 원본이 작아 6dB 키움. 1종뿐이라 높낮이를 ±8% 바꿔 재생. 제작자 micahlg, **라이선스 확인 필요** |
| `level_up_1` | `126422__makofox__level-up.wav` | 0.6초, 중심 약 1.15kHz로 다른 후보보다 낮고 따뜻함. 원본이 끝에서 갑자기 끊겨 끝 0.15초를 줄임. 제작자 makofox, **라이선스 확인 필요** |
| (미사용) `level_up_3note2_jivatma07.ogg` | `76234__jivatma07__level_up_3note2.wav` | 레벨업 후보였다가 교체(더 밝고 게임 효과음 같음). 이 폴더에 보관. 제작자 jivatma07 |
| (미사용) `level_up_2_ecofuture3.ogg` | `346425__soneproject__ecofuture3.wav` | 레벨업 후보였으나 탈락(미래적인 신스 소리라 분위기에 안 맞고 여운이 길어 자주 나기엔 부담). 게임 폴더에서 빼고 이 폴더에 보관. 제작자 soneproject |

## 정리: 기타 소리가 섞인 것으로 의심되는 소리를 뺌

플레이 중 "기타를 튕기는 소리" 같은 울림이 들린다는 의견이 있어, 음높이가 또렷하게 울리는(음악 소리가 섞였을 가능성이 있는) 파일을 분석해 다음과 같이 바꿨습니다. **직접 들어 본 것이 아니라 수치로 고른 것**이라, 여전히 들리면 어떤 상황(활 쏠 때 / 화살 맞을 때 / 방패 깨질 때 등)에서 나는지 알려 주세요.

| 바꾼 것 | 이유 | 처리 |
| --- | --- | --- |
| `bow_shot_1` (활 쏘는 소리) | 시위가 울리는 음이 0.3초 가까이 이어짐(291Hz 중심, 뚜렷함). 가장 자주 나는 소리 | 0.16초로 줄이고 291/582/873Hz 부근을 깎음. 원본은 `removed/bow_shot_1_original.ogg` |
| `arrow_hit_1` | Suno 곡에서 자른 것, 226Hz가 또렷하게 울림 | 뺌. 깨끗한 `melee_hit_3`·`melee_hit_4`를 높여 `arrow_hit_1`, `arrow_hit_3`으로 대체 |
| `shield_break_1, 2` (Suno) | 226Hz·441Hz가 뚜렷하게 울림 | 뺌. 외부 소리(`shield_break_3`)가 `shield_break_1`이 됨 |
| `melee_hit_3, 4` (Suno) | 낮은 음이 또렷하게 남음(86~108Hz) | 뺌. 남은 소리는 번호를 앞당겨 `melee_hit_1 ~ 6`이 됨 |

뺀 파일은 `removed/` 폴더에 보관했습니다. (위의 출처 표에 적힌 `melee_hit_5~8`, `shield_break_3`은 각각 `melee_hit_3~6`, `shield_break_1`로 번호가 바뀌었습니다.)

추가: 화살 맞는 소리 `arrow_hit_1`에서 기타 튕기는 소리가 난다는 확인이 있어, 이 번호의 파일을 완전히 비웠습니다(옛 Suno 조각은 `removed/`에 있음). 지금 `arrow_hit`은 2종(`arrow_hit_1` = `melee_hit_4`를 높인 소리, `arrow_hit_2` = Suno 조각)입니다.
| `arrow_hit_3` | `574044__thecrow_br__arrow.mp3` | 원본 1.32초(화살이 날아와 꽂히는 소리) 중 꽂히는 순간 0.57~0.84초만 사용. 소음이 섞인 타격음이라 음높이가 또렷하지 않음. 제작자 thecrow_br, **라이선스 확인 필요** |

## 마법사 운석

`meteor_fall_univ_lyon3.ogg`: 받은 `367093__univ_lyon3__chatel_florian_2016_2017_meteorite.wav`(5.8초)의 **뒷부분 4.15~5.83초**(상승하는 낙하음 → 0.6초 뒤 충돌음 → 여운)를 잘라 `meteor_fall_1.ogg`로 쓴다. 게임은 운석이 하늘에서 떨어지기 시작하는 순간(폭발 0.6초 전)에 이 소리를 한 번 내서 충돌음이 폭발과 맞물리게 했다. 낙하 시간은 주문 시간의 마지막 20%라 주문 시간(`MERC_STATS`/지팡이 `windup`)을 바꾸면 어긋날 수 있다. 직접 들어 보지 못하고 파형으로 맞췄으니 어긋나면 알려 주세요.
