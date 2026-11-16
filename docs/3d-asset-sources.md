# 3D 유닛 에셋 출처와 만드는 법

## 창병(spear)

`client/public/assets/units3d/spear_*` 90장은 외부 모델을 가져와 Blender로 렌더한 것이다.

### 가져온 것 (둘 다 CC0, Kay Lousberg, www.kaylousberg.com)
- KayKit Adventurers (Free 2.0): https://kaylousberg.itch.io/kaykit-adventurers — 캐릭터 `Rogue_Hooded`
- KayKit Character Animations (Free 1.1): https://kaylousberg.itch.io/kaykit-character-animations — 뼈대 `Rig_Medium`의 대기·걷기 동작

CC0라 출처 표기 의무는 없지만 기록해 둔다. 모델 파일은 저장소에 넣지 않았다(각 팩의 License.txt 참고).

### 직접 만든 것
- 창(자루·금속 고리·날), 눈, 이마 보석
- 두건 테두리 띠, 적 팀 붉은 목도리(모델 면의 색만 바꿈)
- 두 손으로 창을 쥐는 자세와 공격 4컷(뼈대를 직접 움직임)
- 원래 모델의 눈·눈썹·코·입은 뗐다

### 다시 만드는 법
1. 위 두 팩을 내려받아 한 폴더에 `kaykit_adventurers/`, `kaykit_animations/`로 푼다.
2. 256px 원본 렌더(팀마다 한 번):
   `blender -b -P tools/blender/spear_kaykit.py -- --src <모델 폴더> --out <렌더 폴더> --team ally --hide Mask,Cape`
3. 게임이 읽는 틀로 옮기기:
   `python tools/blender/pack_units3d.py <렌더 폴더> client/public/assets/units3d`

### 게임 틀에 대해
게임(`client/src/main.ts`)은 방향별 그림을 앵커 (0.46, 0.95), 배율 0.46으로 그린다. 처음 파일럿 그림(119x110, 키 약 90px)에 맞춘 값이다.
그래서 256px 렌더를 키 약 90px로 줄이고 발 기준점이 앵커에 오게 208x240 캔버스에 놓는다(`pack_units3d.py`).
인수인계 문서의 "256px 정사각"과 다르니, 다른 병종을 만들 때도 이 변환을 거쳐야 한다.

## 궁병(archer)

`client/public/assets/units3d/archer_*` 90장. 창병과 같은 두 팩(CC0)을 쓴다.

### 가져온 것
- 몸: 창병과 같은 `Rogue_Hooded`(팩의 궁수 `Ranger`는 두건이 없고 수염 난 얼굴이라 기존 궁병 그림과 달라 쓰지 않았다)
- 화살통: `Ranger` 캐릭터에 딸린 것을 떼어 붙임
- 활: Assets의 `bow.gltf`
- 동작: `Rig_Medium_CombatRanged`의 활 대기·당기기·놓기

### 직접 만든 것
- 시위(당기는 손을 따라 꺾인다), 화살
- 걷기 4컷(발 자리를 직접 놓음), 다리·팔 배율

### 다시 만드는 법
1. `blender -b -P tools/blender/archer_kaykit.py -- --src <모델 폴더> --out <렌더 폴더> --team ally --hide Mask,Cape` (enemy도 한 번)
2. `python tools/blender/pack_units3d.py <렌더 폴더> client/public/assets/units3d 0.575 176 340 107.5 210.8 archer_`

창병은 `python tools/blender/pack_units3d.py <렌더 폴더> client/public/assets/units3d 0.616 208 240 84.5 206.3 spear_`.
