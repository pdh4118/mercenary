# 그림 에셋 이상치 보고서

측정한 PNG 635개 (`_old`·`_raw` 제외). 기준 |z| ≥ 2.5.

| 종류 | 개수 | 채도 중앙값 | 밝기 중앙값 | 대비 중앙값 | 외곽선 중앙값 | 외곽선 두께(px) | 밝은 테두리 | 반투명 |
|---|---|---|---|---|---|---|---|---|
| 일러스트 | 152 | 0.42 | 0.25 | 0.44 | -0.21 | 2.0 | 0.00 | 0.07 |
| 이펙트 | 412 | 0.38 | 0.45 | 0.47 | -0.25 | 2.0 | 0.00 | 0.15 |
| 지형 | 64 | 0.46 | 0.36 | 0.53 | -0.31 | 2.0 | 0.80 | 0.07 |
| UI | 7 | 0.31 | 0.29 | 0.42 | -0.21 | 3.0 | 0.04 | 0.02 |

## 1. 캔버스 가장자리에 길게 닿아 잘렸을 수 있는 그림 (46개)

불투명한 부분이 캔버스 한 변의 20% 넘게 이어져 닿은 것(딱 맞게 오린 그림은 한두 점만 닿아서 제외). 지형 타일은 원래 가득 채우므로 뺐다. 넓은 바닥 그림자나 땅에 닿는 이펙트는 정상일 수 있다.

- `fx/boss9_drain_beam.png` (508x106, 닿은 길이 100%)
- `fx/boss6_break_0.png` (118x88, 닿은 길이 97%)
- `fx/boss8_dust_0.png` (72x40, 닿은 길이 97%)
- `fx/boss4_inv_0.png` (69x42, 닿은 길이 94%)
- `fx/boss4_inv_2.png` (158x92, 닿은 길이 87%)
- `fx/boss4_inv_1.png` (152x88, 닿은 길이 86%)
- `fx/rice_eat_0.png` (99x65, 닿은 길이 76%)
- `fx/boss6_fire_0.png` (88x72, 닿은 길이 68%)
- `fx/boss6_fire_2.png` (94x70, 닿은 길이 65%)
- `fx/rice_glint_0.png` (74x73, 닿은 길이 65%)
- `fx/boss6_fire_1.png` (98x76, 닿은 길이 62%)
- `fx/rice_eat_1.png` (122x92, 닿은 길이 61%)
- `fx/rice_eat_2.png` (126x92, 닿은 길이 60%)
- `fx/boss4_shield_2.png` (166x92, 닿은 길이 57%)
- `fx/boss9_rise_0.png` (72x83, 닿은 길이 56%)
- `fx/boss7_cornered_1.png` (134x104, 닿은 길이 55%)
- `fx/boss4_shield_1.png` (171x91, 닿은 길이 55%)
- `fx/boss8_scythe_0.png` (93x85, 닿은 길이 53%)
- `fx/boss8_heat_3.png` (112x101, 닿은 길이 53%)
- `fx/meteor_5.png` (128x176, 닿은 길이 51%)
- `fx/boss9_chain_mark_1.png` (80x110, 닿은 길이 50%)
- `fx/boss7_cornered_2.png` (88x78, 닿은 길이 48%)
- `fx/boss9_chain_mark_0.png` (80x110, 닿은 길이 48%)
- `fx/boss9_rise_2.png` (73x117, 닿은 길이 47%)
- `fx/boss8_dust_1.png` (127x61, 닿은 길이 46%)
- `fx/boss7_cornered_0.png` (63x60, 닿은 길이 46%)
- `fx/boss9_chain_mark_2.png` (80x110, 닿은 길이 45%)
- `fx/boss6_break_1.png` (140x91, 닿은 길이 44%)
- `fx/boss3_rain_stuck.png` (101x102, 닿은 길이 44%)
- `fx/boss9_rise_1.png` (69x100, 닿은 길이 43%)
- `fx/boss4_reflect_2.png` (152x86, 닿은 길이 43%)
- `fx/skill_slam_charge_3.png` (325x319, 닿은 길이 38%)
- `fx/cmd_flag_1.png` (77x72, 닿은 길이 33%)
- `fx/boss8_heat_2.png` (98x92, 닿은 길이 33%)
- `fx/boss8_dust_2.png` (141x83, 닿은 길이 31%)
- `fx/boss8_heat_0.png` (94x88, 닿은 길이 29%)
- `fx/boss8_heat_1.png` (94x88, 닿은 길이 29%)
- `fx/boss8_dust_3.png` (140x66, 닿은 길이 27%)
- `fx/boss8_crash_3.png` (118x81, 닿은 길이 26%)
- `fx/boss9_drain_mote_0.png` (51x27, 닿은 길이 26%)
- … 외 6개

## 2. 맨 바깥에 밝은 테두리가 남은 일러스트 (0개)

일러스트의 맨 바깥 1px 링이 그 안쪽 외곽선보다 0.3 넘게 밝다. 흰 배경을 지운 흔적이며 어두운 바닥 위에서 가는 흰 선으로 보인다. 이펙트는 밝은 것이 정상이라 뺐다.


## 3. 같은 종류 안에서 화풍이 어긋난 그림

같은 종류의 묶음별 중앙값에서 크게 벗어난 그림. 이펙트는 모양·밝기가 원래 제각각이고 색을 입혀 쓰는 흰색 계열(`skill_*`)이 많아 기준을 1.6배로 높이고 두 가지 이상이 벗어난 것만 적었다(`--z`로 조정). 같은 세트가 같은 이유로 3장 이상 튀면 한 줄로 합쳤다.

### 일러스트 (152개 중 6개가 튐)

- `units/skel_archer.png`: 대비 셈, 외곽선이 진함
- `units/boss6_blink.png`: 밝음
- `hero/hero_mage.png`: 과하게 짙은 색
- `cards/art_sword.png`: 밝음
- `units/boss7_gallop.png`: 외곽선이 진함
- `cards/art_mage.png`: 과하게 짙은 색

### 이펙트 (412개 중 17개가 튐)

- `fx/skill_back_wind_2.png`: 외곽선이 두꺼움, 밝음, 밋밋함
- `fx/skill_dash_*` (5개): 외곽선이 두꺼움, 밋밋함, 밝음
- `fx/fx_hit_spark_crit_5.png`: 외곽선이 두꺼움, 밋밋함
- `fx/fx_hit_spark_crit_3.png`: 외곽선이 두꺼움, 밋밋함
- `fx/skill_slam_wave_5.png`: 외곽선이 두꺼움, 밋밋함
- `fx/skill_boost_end_2.png`: 외곽선이 두꺼움, 밋밋함
- `fx/skill_boost_start_5.png`: 외곽선이 두꺼움, 밋밋함
- `fx/boss6_tele_2.png`: 외곽선이 두꺼움, 밋밋함
- `fx/boss7_cornered_2.png`: 외곽선이 약함/없음, 외곽선이 두꺼움
- `fx/skill_slam_charge_5.png`: 외곽선이 두꺼움, 밋밋함
- `fx/skill_slam_charge_0.png`: 외곽선이 두꺼움, 밋밋함
- `fx/boss9_orb_hit_3.png`: 외곽선이 두꺼움, 밋밋함
- `fx/boss9_drain_ring_2.png`: 외곽선이 두꺼움, 밝음

### 지형 (64개 중 12개가 튐)

- `tiles/ground_b.png`: 외곽선이 약함/없음, 밋밋함, 밝음
- `tiles/ground_a.png`: 밋밋함, 외곽선이 약함/없음, 외곽선이 두꺼움
- `terrain/t15.png`: 외곽선이 약함/없음
- `terrain/t28.png`: 대비 셈
- `terrain/t09.png`: 대비 셈
- `terrain/t23.png`: 대비 셈
- `terrain/t24.png`: 대비 셈
- `terrain/t16.png`: 외곽선이 약함/없음
- `terrain/t27.png`: 대비 셈
- `terrain/t12.png`: 외곽선이 약함/없음
- `terrain/t25.png`: 대비 셈
- `terrain/t29.png`: 대비 셈

### UI (7개 중 0개가 튐)

표본이 적어 비교하지 않았다.

## 4. 같은 이름 묶음 안에서 어긋난 그림

`boss1_*`, `skill_*`처럼 같은 접두어 묶음(4개 이상)의 중앙값과 비교했다. 한 세트로 그린 그림 중 혼자 다른 것이다.

- `cards/art_mage.png`: 과하게 짙은 색
- `fx/arrow_ally_0.png`: 외곽선이 진함
- `fx/boom_3.png`: 바랜 색
- `fx/boom_4.png`: 바랜 색
- `fx/boss1_impact_0.png`: 외곽선이 두꺼움
- `fx/boss1_impact_0b.png`: 외곽선이 두꺼움
- `fx/boss1_impact_1.png`: 대비 셈
- `fx/boss1_slash_1.png`: 대비 셈
- `fx/boss10_bolt_0.png`: 과하게 짙은 색
- `fx/boss10_bolt_2.png`: 과하게 짙은 색
- `fx/boss10_hall_corner.png`: 밋밋함
- `fx/boss10_hall_torch.png`: 대비 셈
- `fx/boss10_oil_3.png`: 어두움
- `fx/boss10_slam_0.png`: 대비 셈
- `fx/boss10_ward_*` (3개): 과하게 짙은 색
- `fx/boss10_ward_3.png`: 밝음
- `fx/boss2_spear_fly.png`: 바랜 색, 대비 셈
- `fx/boss2_spear_stuck.png`: 바랜 색, 외곽선이 진함
- `fx/boss3_dust_3.png`: 밋밋함
- `fx/boss3_ice_3.png`: 외곽선이 두꺼움, 밋밋함
- `fx/boss4_bash_3b.png`: 과하게 짙은 색
- `fx/boss4_shell_hit_0.png`: 외곽선이 약함/없음
- `fx/boss5_flurry_arc_0.png`: 외곽선이 약함/없음
- `fx/boss5_flurry_arc_1.png`: 외곽선이 약함/없음
- `fx/boss5_flurry_hit_2.png`: 외곽선이 약함/없음
- `fx/boss7_cornered_2.png`: 외곽선이 두꺼움, 외곽선이 약함/없음
- `fx/boss7_fire_out.png`: 어두움, 밋밋함
- `fx/boss7_lasso_hit.png`: 대비 셈
- `fx/boss8_crash_4.png`: 밋밋함, 외곽선이 두꺼움
- `fx/boss8_dazed_*` (4개): 대비 셈
- `fx/boss8_scythe_3.png`: 대비 셈
- `fx/boss9_orb_hit_3.png`: 과하게 짙은 색
- `fx/cmd_ring_0.png`: 밝음, 과하게 짙은 색
- `fx/cmd_ring_1.png`: 밝음, 과하게 짙은 색
- `fx/meteor_0.png`: 과하게 짙은 색
- `fx/meteor_5.png`: 바랜 색, 밋밋함
- `fx/rice_eat_2.png`: 바랜 색
- `fx/scorch_0.png`: 밝음
- `fx/scorch_1.png`: 밝음
- `hero/hero_mage.png`: 과하게 짙은 색
- `hero/hero_sword.png`: 대비 셈
- `units/boss10_guard_mage.png`: 대비 셈
- `units/boss10_post_mage_cast.png`: 대비 셈, 외곽선이 얇음
- `units/boss10_scepter.png`: 외곽선이 두꺼움
- `units/boss2_guard_b.png`: 밋밋함, 어두움
- `units/boss5_whirlpose_*` (3개): 과하게 짙은 색
- `units/boss8_mad.png`: 과하게 짙은 색, 외곽선이 약함/없음
- `units/boss8_mad_b.png`: 과하게 짙은 색, 외곽선이 약함/없음
- `units/cav_idle_0.png`: 과하게 짙은 색, 밝음
- `units/cav_idle_4.png`: 외곽선이 진함
- `units/cav_idle_7.png`: 과하게 짙은 색
- `units/cav_run_*` (4개): 과하게 짙은 색, 밝음
- `units/cav_run_*` (4개): 과하게 짙은 색
- `units/cav_thrust_0.png`: 과하게 짙은 색, 밝음
- `units/cav_thrust_1.png`: 과하게 짙은 색
- `units/cav_thrust_7.png`: 과하게 짙은 색
- `units/enemy_sword.png`: 밝음, 대비 셈
- `units/skel_archer.png`: 밝음, 대비 셈
- `units/supply_hurt.png`: 외곽선이 약함/없음
- `units/supply_run_2.png`: 외곽선이 진함, 밝음

## 5. 묶음별 중앙값 비교 (일러스트·이펙트)

묶음끼리 평균이 서로 다르면 '다른 시기·다른 도구로 만든 그림'일 가능성이 있다. 종류 중앙값에서 가장 먼 묶음부터.

### 일러스트

| 묶음 | 개수 | 채도 | 밝기 | 대비 | 외곽선 | 종류 중앙값과의 거리 |
|---|---|---|---|---|---|---|
| `cards/art` | 6 | 0.51 | 0.33 | 0.63 | -0.11 | 7.8 |
| `units/boss8` | 5 | 0.31 | 0.17 | 0.29 | -0.10 | 7.7 |
| `units/boss5` | 9 | 0.23 | 0.20 | 0.35 | -0.16 | 5.5 |
| `units/supply` | 7 | 0.44 | 0.31 | 0.47 | -0.32 | 5.0 |
| `units/ally` | 6 | 0.47 | 0.26 | 0.59 | -0.29 | 4.5 |
| `units/boss10` | 18 | 0.29 | 0.19 | 0.33 | -0.20 | 4.4 |
| `units/boss2` | 4 | 0.32 | 0.24 | 0.53 | -0.26 | 3.6 |
| `units/enemy` | 8 | 0.35 | 0.18 | 0.41 | -0.19 | 3.3 |
| `units/skel` | 6 | 0.35 | 0.23 | 0.49 | -0.25 | 3.1 |
| `hero/hero` | 16 | 0.39 | 0.24 | 0.52 | -0.25 | 2.5 |
| `units/cav` | 48 | 0.44 | 0.25 | 0.42 | -0.20 | 0.6 |
| (종류 중앙값) | 152 | 0.42 | 0.25 | 0.44 | -0.21 | - |

### 이펙트

| 묶음 | 개수 | 채도 | 밝기 | 대비 | 외곽선 | 종류 중앙값과의 거리 |
|---|---|---|---|---|---|---|
| `fx/boss2` | 8 | 0.96 | 0.30 | 0.39 | -0.13 | 3.9 |
| `fx/meteor` | 6 | 0.71 | 0.42 | 0.72 | -0.42 | 3.4 |
| `fx/boss6` | 24 | 0.78 | 0.53 | 0.51 | -0.38 | 2.7 |
| `fx/boom` | 5 | 0.66 | 0.44 | 0.76 | -0.29 | 2.6 |
| `fx/arrow` | 10 | 0.55 | 0.22 | 0.57 | -0.18 | 2.6 |
| `fx/rice` | 6 | 0.35 | 0.66 | 0.65 | -0.15 | 2.5 |
| `fx/skill` | 89 | 0.24 | 0.66 | 0.36 | -0.17 | 2.4 |
| `fx/boss1` | 12 | 0.66 | 0.52 | 0.57 | -0.36 | 2.4 |
| `fx/cmd` | 5 | 0.59 | 0.25 | 0.45 | -0.29 | 2.1 |
| `fx/boss3` | 18 | 0.41 | 0.46 | 0.71 | -0.39 | 2.0 |
| `fx/boss7` | 10 | 0.59 | 0.44 | 0.62 | -0.30 | 1.7 |
| `fx/fx` | 22 | 0.43 | 0.55 | 0.37 | -0.17 | 1.6 |
| (종류 중앙값) | 412 | 0.38 | 0.45 | 0.47 | -0.25 | - |

