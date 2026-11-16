"""궁병 3D 렌더: KayKit Adventurers의 Rogue_Hooded(CC0)를 노란 두건 궁병으로 칠하고, 같은 팩의 활·화살통(Ranger)을 붙여
툰 셰이딩·외곽선으로 5방향 x (대기·걷기·공격) 렌더한다. 화살과 시위는 직접 만든다(당긴 손을 따라 시위가 꺾인다).

출처(둘 다 CC0, Kay Lousberg, www.kaylousberg.com):
  https://kaylousberg.itch.io/kaykit-adventurers          (Free 2.0)
  https://kaylousberg.itch.io/kaykit-character-animations (Free 1.1)
압축을 푼 폴더를 --src로 넘긴다(그 안에 kaykit_adventurers/, kaykit_animations/ 가 있어야 한다).

실행:
  blender -b -P tools/blender/archer_kaykit.py -- --src <모델폴더> --out <출력폴더> --team ally|enemy [--dirs 0,1,2,3,4]
결과: <출력폴더>/archer_<팀>_<방향>_<동작>_<번호>.png  (방향 0=뒤 1=뒤 비스듬 2=옆(오른쪽) 3=앞 비스듬 4=앞)
얼굴 정리·명암·외곽선·다리 배율은 spear_kaykit.py와 같은 방식이다.
"""
import math
import os
import sys

import bmesh
import bpy
from mathutils import Vector


def arg(name, default):
    a = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    return a[a.index(name) + 1] if name in a else default


SRC = arg("--src", "C:/Users/pdh999/Desktop/mercenary_3d_src")
OUT = arg("--out", "/tmp/frames")
TEAM = arg("--team", "ally")
SIZE = int(arg("--size", 256))
SAMPLES = int(arg("--samples", 192))
DIRS = [int(x) for x in arg("--dirs", "0,1,2,3,4").split(",")]
LINE = float(arg("--line", 13.0))
CHAR = arg("--char", "Rogue_Hooded")
SS = 2

CH = f"{SRC}/kaykit_adventurers/KayKit_Adventurers_2.0_FREE/Characters/gltf/{CHAR}.glb"
AN = f"{SRC}/kaykit_animations/KayKit_Character_Animations_1.1/Animations/gltf/Rig_Medium/Rig_Medium_%s.glb"


def hexc(h):
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(((v + 0.055) / 1.055) ** 2.4 if v > 0.04045 else v / 12.92 for v in c)


bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = "CYCLES"
sc.cycles.samples = SAMPLES
sc.cycles.use_denoising = False
sc.render.resolution_x = sc.render.resolution_y = SIZE * SS
sc.render.film_transparent = True
sc.view_settings.view_transform = "Standard"
sc.view_settings.look = "None"
sc.render.image_settings.file_format = "PNG"
sc.render.image_settings.color_mode = "RGBA"
sc.render.filter_size = 1.0
sc.cycles.device = "CPU"
try:
    prefs = bpy.context.preferences.addons["cycles"].preferences
    for kind in ("OPTIX", "CUDA"):
        prefs.compute_device_type = kind
        prefs.get_devices()
        if [d for d in prefs.devices if d.type == kind]:
            for d in prefs.devices:
                d.use = d.type == kind
            sc.cycles.device = "GPU"
            print("렌더 장치:", kind)
            break
except Exception as e:  # noqa
    print("GPU 설정 실패, CPU로 렌더:", e)

# --- 모델·동작 불러오기 -----------------------------------------------------------------
bpy.ops.import_scene.gltf(filepath=CH, bone_heuristic="BLENDER")
for o in list(bpy.data.objects):
    if o.type == "MESH" and o.parent is None:  # 팩에 딸려 오는 보조 구(Icosphere)
        bpy.data.objects.remove(o)
arm = [o for o in bpy.data.objects if o.type == "ARMATURE"][0]
# 화살통: Ranger 캐릭터의 것(같은 뼈대에 맞춰져 있다)을 가져와 이 뼈대에 붙인다
_before = set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=CH.replace(CHAR + ".glb", "Ranger.glb"), bone_heuristic="BLENDER")
quiver = bpy.data.objects["Ranger_Quiver"]
for o in set(bpy.data.objects) - _before:
    if o is not quiver:
        bpy.data.objects.remove(o)
quiver.parent = arm
for md in quiver.modifiers:
    if md.type == "ARMATURE":
        md.object = arm
# 활: 시위 없는 것(시위는 당긴 손을 따라가게 직접 만든다)
_before = set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=f"{SRC}/kaykit_adventurers/KayKit_Adventurers_2.0_FREE/Assets/gltf/bow.gltf")
bow = next(o for o in set(bpy.data.objects) - _before if o.type == "MESH")
for o in set(bpy.data.objects) - _before:
    if o is not bow:
        bpy.data.objects.remove(o)
char_objs = set(bpy.data.objects)
for f in ("CombatRanged", "MovementBasic", "General"):
    bpy.ops.import_scene.gltf(filepath=AN % f, bone_heuristic="BLENDER")
for o in list(bpy.data.objects):  # 동작 파일에 딸린 뼈대·메시는 버리고 동작만 남긴다
    if o not in char_objs:
        bpy.data.objects.remove(o)

HIDE = [h for h in arg("--hide", "").split(",") if h]  # 빼고 싶은 부품 이름 조각(예: Mask,Cape)
for o in list(bpy.data.objects):
    if o.type == "MESH" and any(h in o.name for h in HIDE):
        bpy.data.objects.remove(o)

root = bpy.data.objects.new("root", None)
bpy.context.collection.objects.link(root)
arm.parent = root
arm.rotation_mode = "XYZ"
arm.rotation_euler = (0, 0, math.radians(90))  # 모델 앞(-Y)을 +X로

# --- 재질: 손그림 느낌의 4단 명암 ----------------------------------------------------------
# 밝기 = (월드 고정 빛 방향) x (틈·그늘이 어두워지는 주변광 차폐) + (붓결처럼 경계를 흔드는 노이즈)
# 이 밝기를 4단(짙은 그림자·그림자·중간·밝은 면)으로 끊고, 그림자는 푸르게 밝은 면은 누렇게 물들인다.
# 거울 렌더(--mirror 1, 기본은 끔): 반대쪽을 보게 렌더한 뒤 그림을 좌우로 뒤집는다. 활을 든 손을 바꿔 보고 싶을 때 쓴다.
# 뒤집은 뒤에도 빛이 왼쪽 위에서 오도록 빛 방향을 미리 반대로 둔다. 기본(끔)이 오른쪽을 볼 때 가슴이 보이는 쪽이다.
MIRROR = int(arg("--mirror", 0)) == 1
LIGHT = Vector((0.25 if MIRROR else -0.25, -0.45, 0.86)).normalized()
AO_DIST = float(arg("--ao", 0.55))


def toonify(m, flat=None):
    nt = m.node_tree
    tex = next((n for n in nt.nodes if n.type == "TEX_IMAGE"), None)
    img = tex.image if tex else None
    nt.nodes.clear()
    n = nt.nodes
    L = nt.links.new

    def math_(op, a, b):
        nd = n.new("ShaderNodeMath")
        nd.operation = op
        for i, v in enumerate((a, b)):
            if isinstance(v, (int, float)):
                nd.inputs[i].default_value = v
            else:
                L(v, nd.inputs[i])
        return nd.outputs[0]

    def remap(v, lo, hi):
        nd = n.new("ShaderNodeMapRange")
        nd.inputs[3].default_value, nd.inputs[4].default_value = lo, hi
        L(v, nd.inputs[0])
        return nd.outputs[0]

    out = n.new("ShaderNodeOutputMaterial")
    geo = n.new("ShaderNodeNewGeometry")
    dot = n.new("ShaderNodeVectorMath")
    dot.operation = "DOT_PRODUCT"
    dot.inputs[1].default_value = LIGHT
    L(geo.outputs["Normal"], dot.inputs[0])
    lam = math_("ADD", math_("MULTIPLY", dot.outputs["Value"], 0.5), 0.5)
    ao = n.new("ShaderNodeAmbientOcclusion")
    ao.samples = 16
    ao.inputs["Distance"].default_value = AO_DIST
    occ = remap(math_("POWER", ao.outputs["AO"], 1.5), float(arg("--ao_min", 0.55)), 1.0)
    tc = n.new("ShaderNodeTexCoord")
    n1 = n.new("ShaderNodeTexNoise")
    n1.inputs["Scale"].default_value = 4.5
    n1.inputs["Detail"].default_value = 3.0
    L(tc.outputs["Object"], n1.inputs["Vector"])
    shade = math_("ADD", math_("MULTIPLY", lam, occ), remap(n1.outputs["Fac"], -0.09, 0.09))
    bands = [(0.0, (0.30, 0.30, 0.40), (0, 0, 0)), (0.20, (0.60, 0.60, 0.72), (0, 0, 0)),
             (0.40, (1, 1, 1), (0, 0, 0)), (0.64, (1.45, 1.4, 1.2), (0.05, 0.05, 0.02))]
    rm, ra = n.new("ShaderNodeValToRGB"), n.new("ShaderNodeValToRGB")
    for r_, k in ((rm, 1), (ra, 2)):
        r_.color_ramp.interpolation = "CONSTANT"
        els = r_.color_ramp.elements
        els[0].position, els[0].color = 0.0, (*bands[0][k], 1)
        els[1].position, els[1].color = bands[1][0], (*bands[1][k], 1)
        for pos, *cols in bands[2:]:
            e = els.new(pos)
            e.color = (*cols[k - 1], 1)
        L(shade, r_.inputs[0])
    n2 = n.new("ShaderNodeTexNoise")  # 잔 얼룩
    n2.inputs["Scale"].default_value = 26.0
    n2.inputs["Detail"].default_value = 2.0
    L(tc.outputs["Object"], n2.inputs["Vector"])
    grain = remap(n2.outputs["Fac"], 0.9, 1.07)

    def mixc(kind, a, b):
        nd = n.new("ShaderNodeMix")
        nd.data_type = "RGBA"
        nd.blend_type = kind
        nd.inputs[0].default_value = 1
        for i, v in ((6, a), (7, b)):
            if isinstance(v, tuple):
                nd.inputs[i].default_value = v
            else:
                L(v, nd.inputs[i])
        return nd.outputs[2]

    if img and flat is None:
        t = n.new("ShaderNodeTexImage")
        t.image = img
        t.interpolation = "Closest"
        base = t.outputs["Color"]
    else:
        base = (*hexc(flat or "#888888"), 1)
    col = mixc("MULTIPLY", mixc("MULTIPLY", rm.outputs[0], grain), base)
    col = mixc("ADD", col, ra.outputs[0])
    emit = n.new("ShaderNodeEmission")
    L(col, emit.inputs[0])
    L(emit.outputs[0], out.inputs[0])


def recolor(img, head=False):
    """텍스처를 기존 2D 그림의 팔레트 쪽으로 옮긴다. 옷(초록~청록)은 팀 색, 가죽은 더 어둡게, 살색은 그대로."""
    import numpy as np
    px = np.array(img.pixels[:], dtype=np.float32).reshape(-1, 4)
    r, g, b = px[:, 0], px[:, 1], px[:, 2]
    mx, mn = px[:, :3].max(1), px[:, :3].min(1)
    df = mx - mn + 1e-6
    h = np.where(mx == r, ((g - b) / df) % 6, np.where(mx == g, (b - r) / df + 2, (r - g) / df + 4)) / 6.0
    sat = df / (mx + 1e-6)
    cloth = (h > 0.22) & (h < 0.58) & (sat > 0.2)
    teal = cloth & (h >= float(arg("--teal", 0.42)))
    leather = ((h < 0.11) | (h > 0.95)) & (sat > 0.42) & (mx < 0.8)
    nh, ns, nv = h.copy(), sat.copy(), mx.copy()
    if TEAM == "ally":  # 기존 그림: 노란 두건·튜닉(#e2a81c 안팎), 그늘은 주황 갈색
        nh[cloth], ns[cloth], nv[cloth] = 0.105, 0.85, np.clip(mx[cloth] * float(arg("--ally_v", 1.3)), 0, 0.95)
    else:  # 기존 그림: 붉은 두건, 어두운 회색 옷
        if head:  # 두건
            nh[cloth], ns[cloth], nv[cloth] = 0.01, 0.72, np.clip(mx[cloth] * 1.2, 0, 0.78)
        else:  # 옷
            nh[cloth], ns[cloth], nv[cloth] = 0.93, 0.14, mx[cloth] * float(arg("--enemy_v", 0.42))
    nv[leather] = mx[leather] * (0.66 if TEAM == "ally" else 0.5)
    if TEAM == "enemy":
        ns[leather] = sat[leather] * 0.6
    i = np.floor(nh * 6).astype(int) % 6
    f = nh * 6 - np.floor(nh * 6)
    p_, q, t = nv * (1 - ns), nv * (1 - f * ns), nv * (1 - (1 - f) * ns)
    R = np.choose(i, [nv, q, p_, p_, t, nv])
    G = np.choose(i, [t, nv, nv, q, p_, p_])
    B = np.choose(i, [p_, p_, t, nv, nv, q])
    px[:, 0], px[:, 1], px[:, 2] = R, G, B
    img.pixels[:] = px.reshape(-1).tolist()
    img.update()


SRC_PIXELS = {}
for im in list(bpy.data.images):
    if im.size[0] > 0 and im.type == "IMAGE":
        SRC_PIXELS[im.name] = list(im.pixels)  # 얼굴 정리에서 원래 색으로 부위를 가려낸다
        recolor(im)
if TEAM == "enemy":  # 적은 두건만 붉고 옷은 회색: 머리 메시에는 따로 칠한 텍스처 사본을 쓴다
    for o in bpy.data.objects:
        if o.type == "MESH" and o.name.endswith("_Head"):
            for slot in o.material_slots:
                m2 = slot.material.copy()
                for nd in m2.node_tree.nodes:
                    if nd.type == "TEX_IMAGE" and nd.image:
                        src = nd.image
                        im2 = src.copy()
                        im2.pixels[:] = SRC_PIXELS[src.name]
                        SRC_PIXELS[im2.name] = SRC_PIXELS[src.name]
                        recolor(im2, head=True)
                        nd.image = im2
                slot.material = m2
for m in list(bpy.data.materials):
    if m.use_nodes:
        toonify(m)
TRIM = "#c9a23a" if TEAM == "ally" else "#b8402c"


def flat_mat(color, plain=False):
    m = bpy.data.materials.new("flat")
    m.use_nodes = True
    if plain:  # 명암 없이 한 색(눈)
        nt = m.node_tree
        nt.nodes.clear()
        e = nt.nodes.new("ShaderNodeEmission")
        e.inputs[0].default_value = (*hexc(color), 1)
        nt.links.new(e.outputs[0], nt.nodes.new("ShaderNodeOutputMaterial").inputs[0])
    else:
        toonify(m, color)
    return m


# --- 얼굴 정리: 코·입·눈썹을 없애고, 기존 2D 그림 같은 세로로 긴 까만 눈을 단다 ---------------------
def clean_face(ob):
    from mathutils import Matrix
    me = ob.data
    img = next(n.image for m in me.materials for n in m.node_tree.nodes if n.type == "TEX_IMAGE")
    w, h = img.size
    px = SRC_PIXELS[img.name]
    uvl = me.uv_layers.active.data

    def color(p):
        u = sum((uvl[l].uv for l in p.loop_indices), Vector((0, 0))) / p.loop_total
        i = (min(int(u.y % 1 * h), h - 1) * w + min(int(u.x % 1 * w), w - 1)) * 4
        return px[i], px[i + 1], px[i + 2]

    cols = {p.index: color(p) for p in me.polygons}
    bm = bmesh.new()
    bm.from_mesh(me)
    fmark = bm.faces.layers.bool.get("freestyle_face") or bm.faces.layers.bool.new("freestyle_face")
    bm.faces.ensure_lookup_table()
    seen, islands = set(), []  # 서로 붙어 있지 않은 조각(눈·속눈썹·눈썹·코·입은 얼굴 위에 따로 얹힌 조각이다)
    for f in bm.faces:
        if f.index in seen:
            continue
        seen.add(f.index)
        stack, comp = [f], []
        while stack:
            g = stack.pop()
            comp.append(g)
            for e in g.edges:
                for k in e.link_faces:
                    if k.index not in seen:
                        seen.add(k.index)
                        stack.append(k)
        islands.append(comp)

    def info(comp):
        n = len(comp)
        mean = [sum(cols[f.index][c] for f in comp) / n for c in range(3)]
        cs = [f.calc_center_median() for f in comp]
        return mean, min(c.x for c in cs), max(c.x for c in cs), min(c.y for c in cs), min(c.z for c in cs), max(c.z for c in cs)

    eyes = [c for c in islands if all(max(cols[f.index]) < 0.2 for f in c)]  # 까만 조각 = 눈·속눈썹
    zs = [f.calc_center_median().z for c in eyes for f in c]
    eye_z = (min(zs) + max(zs)) / 2 if zs else 1.6
    kill = [f for c in eyes for f in c]
    for comp in islands:
        (r, g, b), x0, x1, y0, z0, z1 = info(comp)
        skin = r > 0.85 and g > 0.55
        if skin and len(comp) < 150 and x0 > -0.12 and x1 < 0.12 and y0 < -0.4 and z1 < eye_z + 0.1:  # 코·입
            kill += comp
        if 0.45 < r < 0.8 and g < 0.45 and len(comp) > 50 and z0 > eye_z and z1 < eye_z + 0.25 and y0 < -0.38:  # 눈썹
            kill += comp
    print("FACE: removed", len(kill), "polys, eye_z", round(eye_z, 3))
    dead = set(kill)
    for f in bm.faces:  # 살색 면 표시: 얼굴 안의 꺾임·가장자리 선(구멍 테두리)을 그리지 않게 한다
        r, g, b = cols[f.index]
        if f not in dead and r > 0.85 and g > 0.55:
            f[fmark] = True
    bmesh.ops.delete(bm, geom=kill, context="FACES")
    # 코·입을 떼어 낸 자리는 얼굴 면이 뚫려 있다: 구멍 위에 얼굴 곡면을 따라 휜 살색 판을 얼굴 면 높이로 덮는다
    def near(v):
        return abs(v.co.x) < 0.16 and v.co.y < -0.36 and eye_z - 0.3 < v.co.z < eye_z + 0.14
    src = next((f for f in bm.faces if all(near(v) for v in f.verts) and cols.get(f.index, (0, 0, 0))[0] > 0.85), None)
    if src:
        uvk = bm.loops.layers.uv.active
        dl = bm.verts.layers.deform.active
        skin_uv = src.loops[0][uvk].uv.copy()
        xs = [-0.12 + 0.04 * k for k in range(7)]
        rows = []
        for z, back in ((eye_z - 0.31, 0.03), (eye_z - 0.22, 0.0), (eye_z + 0.1, 0.0)):
            row = []
            for x in xs:
                v = bm.verts.new((x, -0.448 + 1.4 * x * x + back, z))
                if dl:
                    for g, wgt in src.verts[0][dl].items():
                        v[dl][g] = wgt
                row.append(v)
            rows.append(row)
        for k in range(12):
            r0, r1, k = rows[k // 6], rows[k // 6 + 1], k % 6
            f = bm.faces.new((r0[k], r0[k + 1], r1[k + 1], r1[k]))
            f.material_index = src.material_index
            f[fmark] = True
            f.smooth = True
            f.normal_update()
            if f.normal.y > 0:
                f.normal_flip()
            for l in f.loops:
                l[uvk].uv = skin_uv
        print("FACE: patch added")
    # 볼살: 눈 아래 양 볼을 머리 중심에서 바깥쪽으로 부풀린다
    puff = float(arg("--cheek", 0.07))
    center = Vector((0, 0.0, eye_z - 0.05))
    for v in {v for f in bm.faces if f[fmark] for v in f.verts}:
        for sx in (1, -1):
            d = (v.co - Vector((0.2 * sx, -0.40, eye_z - 0.15))).length
            v.co += (v.co - center).normalized() * puff * math.exp(-(d / 0.15) ** 2)
    # 얼굴 살색 면은 실제 면 방향 대신 머리 중심에서 뻗는 공 모양 방향으로 명암을 넣는다(덧댄 판과 이음매가 보이지 않게)
    skin_mat = me.materials[src.material_index].copy() if src else None
    if skin_mat:
        for f in bm.faces:
            if f[fmark]:
                f.material_index = len(me.materials)
    bm.to_mesh(me)
    bm.free()
    if skin_mat:
        me.materials.append(skin_mat)
        a = bpy.data.objects.new("face_center", None)
        bpy.context.scene.collection.objects.link(a)
        a.parent, a.parent_type, a.parent_bone = arm, "BONE", "head"
        bpy.context.view_layer.update()
        a.matrix_world = ob.matrix_world @ Matrix.Translation((0, 0.05, eye_z - 0.05))
        c = bpy.data.objects.new("face_center_world", None)  # 위치만 따라가고 회전은 세계 축 그대로
        bpy.context.scene.collection.objects.link(c)
        con = c.constraints.new("COPY_LOCATION")
        con.target = a
        nt = skin_mat.node_tree
        dot = next(nd for nd in nt.nodes if nd.type == "VECT_MATH" and nd.operation == "DOT_PRODUCT")
        for l in list(dot.inputs[0].links):
            nt.links.remove(l)
        tc = nt.nodes.new("ShaderNodeTexCoord")
        tc.object = c
        nz = nt.nodes.new("ShaderNodeVectorMath")
        nz.operation = "NORMALIZE"
        nt.links.new(tc.outputs["Object"], nz.inputs[0])
        nt.links.new(nz.outputs["Vector"], dot.inputs[0])
    return eye_z, float(arg("--face_y", -0.445))


def add_eyes(head_ob, eye_z, front):
    bpy.context.view_layer.update()
    mw = head_ob.matrix_world.copy()
    for sx in (1, -1):
        parts = [("#17100e", (0.17 * sx, front + 0.01, eye_z - 0.01), (0.062, 0.03, 0.115))]
        if int(arg("--eye_hl", 0)):  # 눈 안의 흰 점(기본은 없음)
            parts.append(("#ffffff", (0.17 * sx + 0.018, front - 0.012, eye_z + 0.04), (0.02, 0.012, 0.03)))
        for col, loc, sc_ in parts:
            bm = bmesh.new()
            bmesh.ops.create_uvsphere(bm, u_segments=16, v_segments=10, radius=1)
            me = bpy.data.meshes.new("eye")
            bm.to_mesh(me)
            bm.free()
            for p in me.polygons:
                p.use_smooth = True
            me.materials.append(flat_mat(col, plain=True))
            ob = bpy.data.objects.new("eye", me)
            nolines.objects.link(ob)
            ob.parent = arm
            ob.parent_type = "BONE"
            ob.parent_bone = "head"
            bpy.context.view_layer.update()
            from mathutils import Matrix
            ob.matrix_world = mw @ Matrix.Translation(loc) @ Matrix.Diagonal((*sc_, 1))


# --- 두건 장식: 얼굴 둘레 테두리를 금색(적은 붉은색) 띠로, 이마 위에 보석을 단다 ------------------
def hood_trim(ob, eye_z):
    from mathutils import Matrix
    me = ob.data
    img = next(n.image for m in me.materials for n in m.node_tree.nodes if n.type == "TEX_IMAGE")
    w, h = img.size
    px = SRC_PIXELS[img.name]
    uvl = me.uv_layers.active.data
    band = len(me.materials)
    me.materials.append(flat_mat(TRIM))
    ny, y_max, z_min = float(arg("--band_n", -0.45)), float(arg("--band_y", -0.36)), eye_z + float(arg("--band_z", -0.32))
    tip = None
    for p in me.polygons:
        u = sum((uvl[l].uv for l in p.loop_indices), Vector((0, 0))) / p.loop_total
        i = (min(int(u.y % 1 * h), h - 1) * w + min(int(u.x % 1 * w), w - 1)) * 4
        r, g, b = px[i], px[i + 1], px[i + 2]
        if not (g > r and g > b):
            continue
        c = p.center
        if p.normal.y < ny and c.y < y_max - float(arg("--band_k", 0.33)) * max(0.0, c.z - eye_z) and c.z > z_min:  # 위로 갈수록 두건이 앞으로 나오므로 기준도 앞으로
            p.material_index = band
        if abs(c.x) < 0.08 and c.z > eye_z + 0.2 and (tip is None or c.y < tip.y):
            tip = c.copy()
    if tip is None or not int(arg("--gem", 1)):
        return
    bm = bmesh.new()  # 보석: 납작한 마름모
    bmesh.ops.create_cone(bm, segments=4, radius1=1, radius2=0, depth=1, cap_ends=False)
    bmesh.ops.mirror(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], axis="Z", matrix=Matrix.Translation((0, 0, -0.5)), merge_dist=1e-4)
    gm = bpy.data.meshes.new("gem")
    bm.to_mesh(gm)
    bm.free()
    gm.materials.append(flat_mat("#c8322a"))
    gem = bpy.data.objects.new("gem", gm)
    bpy.context.collection.objects.link(gem)
    gem.parent, gem.parent_type, gem.parent_bone = arm, "BONE", "head"
    bpy.context.view_layer.update()
    k = float(arg("--gem_size", 0.085))
    gem.matrix_world = (ob.matrix_world @ Matrix.Translation((0, tip.y - 0.02, tip.z - 0.03))
                        @ Matrix.Rotation(math.radians(90), 4, "X") @ Matrix.Diagonal((k, k * 1.25, k * 0.6, 1)))


def red_scarf(ob):
    """적 팀: 몸통 맨 위(목 둘레)의 천을 붉게 칠한다(기존 그림의 붉은 목도리)."""
    me = ob.data
    img = next(n.image for m in me.materials for n in m.node_tree.nodes if n.type == "TEX_IMAGE")
    w, h = img.size
    px = SRC_PIXELS[img.name]
    uvl = me.uv_layers.active.data
    red = len(me.materials)
    me.materials.append(flat_mat("#93261e"))
    z0 = float(arg("--scarf_z", 1.1))
    for p in me.polygons:
        u = sum((uvl[l].uv for l in p.loop_indices), Vector((0, 0))) / p.loop_total
        i = (min(int(u.y % 1 * h), h - 1) * w + min(int(u.x % 1 * w), w - 1)) * 4
        if px[i + 1] > px[i] and px[i + 1] > px[i + 2] and p.center.z > z0:
            p.material_index = red


nolines = bpy.data.collections.new("nolines")  # 외곽선을 그리지 않는 물체(눈)
bpy.context.scene.collection.children.link(nolines)
if arg("--face", "cute") == "cute":
    for o in list(bpy.data.objects):
        if o.type == "MESH" and o.name.endswith("_Head"):
            ez, fy = clean_face(o)
            add_eyes(o, ez, fy)
            if int(arg("--trim", 0)):
                hood_trim(o, ez)

# --- 창(직접 제작): 손 슬롯 뼈에 붙인다 --------------------------------------------------------
def tube(points, rx, ry, sides, frame):
    bm = bmesh.new()
    rings = []
    for i, p in enumerate(points):
        p = Vector(p)
        u, v = (Vector((1, 0, 0)), Vector((0, 1, 0))) if frame == "z" else (Vector((0, 1, 0)), Vector((0, 0, 1)))
        rings.append([bm.verts.new(p + u * math.cos(2 * math.pi * j / sides) * rx[i] + v * math.sin(2 * math.pi * j / sides) * ry[i]) for j in range(sides)])
    for i in range(len(points) - 1):
        for j in range(sides):
            bm.faces.new((rings[i][j], rings[i][(j + 1) % sides], rings[i + 1][(j + 1) % sides], rings[i + 1][j]))
    bm.faces.new(rings[0][::-1])
    bm.faces.new(rings[-1])
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new("m")
    bm.to_mesh(me)
    bm.free()
    return me


def part(parent, me, color, smooth=True):
    ob = bpy.data.objects.new("p", me)
    bpy.context.collection.objects.link(ob)
    for p in me.polygons:
        p.use_smooth = smooth
    me.materials.append(flat_mat(color))
    ob.parent = parent
    return ob


# 활: 왼손 슬롯 뼈에 붙인다
BOWK = float(arg("--bow", 0.82))  # 활은 팔뼈에 붙어 팔 배율(ARM)만큼 더 커진다
_ys = [v.co.y for v in bow.data.vertices]
_top = [v.co for v in bow.data.vertices if v.co.y > max(_ys) - 0.03]
_bot = [v.co for v in bow.data.vertices if v.co.y < min(_ys) + 0.03]
TIP_TOP = sum(_top, Vector()) / len(_top)
TIP_BOT = sum(_bot, Vector()) / len(_bot)
bow.parent = arm
bow.parent_type = "BONE"
bow.parent_bone = "handslot.l"
bow.location = (0, -arm.data.bones["handslot.l"].length, 0)
bow.rotation_mode = "XYZ"
bow.rotation_euler = tuple(math.radians(float(v)) for v in arg("--bow_rot", "-90,0,180").split(","))
bow.scale = (BOWK, BOWK, BOWK)
bow.data.materials.clear()
bow.data.materials.append(flat_mat("#8a5a2c"))

# 시위: 활 양 끝을 잇는 가는 줄. 당길 때는 오른손을 거쳐 꺾인다
cu = bpy.data.curves.new("string", "CURVE")
cu.dimensions = "3D"
sp = cu.splines.new("POLY")
sp.points.add(2)
cu.bevel_depth = float(arg("--string", 0.014))
cu.bevel_resolution = 2
cu.materials.append(flat_mat("#2a1d14", plain=True))
string = bpy.data.objects.new("string", cu)
nolines.objects.link(string)

# 화살(직접 제작): 오늬(원점)에서 +Z로 뻗는다
AL = float(arg("--arrow", 1.3))
arrow = bpy.data.objects.new("arrow", None)
bpy.context.collection.objects.link(arrow)
arrow.rotation_mode = "QUATERNION"
part(arrow, tube([(0, 0, 0), (0, 0, AL * 0.9)], [0.04] * 2, [0.04] * 2, 8, "z"), "#b08a55")
part(arrow, tube([(0, 0, AL * 0.84), (0, 0, AL * 0.89), (0, 0, AL)], [0.04, 0.1, 0.0], [0.04, 0.05, 0.0], 4, "z"), "#aeb8c6", smooth=False)
part(arrow, tube([(0, 0, 0.03), (0, 0, 0.09), (0, 0, 0.22)], [0.05, 0.065, 0.02], [0.012] * 3, 4, "z"), "#e8e2cf", smooth=False)


def aim(drawn, nocked):
    """자세를 넣은 뒤 부른다: 시위를 활 끝(과 당긴 손)에 맞추고, 화살을 오늬에서 활 손잡이 쪽으로 놓는다."""
    from mathutils import Matrix
    bpy.context.view_layer.update()
    mw = bow.matrix_world
    top, bot = mw @ TIP_TOP, mw @ TIP_BOT
    hand = arm.matrix_world @ arm.pose.bones["handslot.r"].head
    mid = hand if drawn else (top + bot) / 2
    for p_, co in zip(sp.points, (top, mid, bot)):
        p_.co = (*co, 1)
    for o in arrow.children:
        o.hide_render = not nocked
    if nocked:
        d = (mw.translation - mid).normalized()
        arrow.matrix_world = Matrix.Translation(mid) @ d.to_track_quat("Z", "Y").to_matrix().to_4x4()
    bpy.context.view_layer.update()


# --- 카메라·외곽선 --------------------------------------------------------------------
bpy.context.view_layer.update()
zs = [(o.matrix_world @ Vector(c)).z for o in bpy.data.objects if o.type == "MESH" and o.parent == arm for c in o.bound_box]
H = max(zs) - min(zs)
print("캐릭터 키:", round(H, 3))
ORTHO = float(arg("--ortho", 0)) or H * 1.7
bpy.ops.object.camera_add()
cam = bpy.context.active_object
cam.data.type = "ORTHO"
cam.data.ortho_scale = ORTHO
elev = math.radians(24)
dist = 14
cam.location = (ORTHO * (-0.08 if MIRROR else 0.08), -dist * math.cos(elev), H * 0.5 + dist * math.sin(elev))
cam.rotation_euler = (math.radians(90) - elev, 0, 0)
sc.camera = cam

sc.render.use_freestyle = True
sc.render.line_thickness_mode = "ABSOLUTE"
sc.render.line_thickness = 1.0
vl = sc.view_layers[0]
vl.use_freestyle = True
vl.freestyle_settings.crease_angle = math.radians(float(arg("--crease", 100)))


def lineset(name, thick, **sel):
    ls = vl.freestyle_settings.linesets.new(name)
    for k in ("silhouette", "border", "crease", "edge_mark", "external_contour", "contour", "material_boundary"):
        setattr(ls, "select_" + k, sel.get(k, False))
    st = bpy.data.linestyles.new(name)
    ls.linestyle = st
    st.color = hexc("#120c0a")
    st.thickness = thick * SIZE / 256 * SS
    ls.select_by_collection = True
    ls.collection = nolines
    ls.collection_negation = "EXCLUSIVE"
    return ls


lineset("outer", LINE * 0.5, external_contour=True)  # 바깥 윤곽: 굵게
lineset("inner", LINE * float(arg("--line_in", 0.15)), silhouette=True)  # 안쪽 선: 가늘게
ls = lineset("crease", LINE * float(arg("--line_crease", 0.09)), border=True, crease=True)  # 꺾임 선: 얼굴 면끼리 만나는 곳은 뺀다
ls.select_by_face_marks = True
ls.face_mark_negation = "EXCLUSIVE"
ls.face_mark_condition = "ONE"


# --- 동작: 동작 파일에서 자세를 뽑아(sample) 부위별로 섞어(mix) 뼈대에 넣는다(apply) ------------------
UPPER = {"spine", "chest", "head", "upperarm.l", "lowerarm.l", "wrist.l", "hand.l", "handslot.l",
         "upperarm.r", "lowerarm.r", "wrist.r", "hand.r", "handslot.r"}
for pb in arm.pose.bones:
    pb.rotation_mode = "QUATERNION"


def sample(clip, t):
    act = bpy.data.actions[clip]
    if arm.animation_data is None:
        arm.animation_data_create()
    arm.animation_data.action = act
    if hasattr(arm.animation_data, "action_slot") and act.slots:
        arm.animation_data.action_slot = act.slots[0]
    f0, f1 = act.frame_range
    f = f0 + (f1 - f0) * t
    sc.frame_set(int(f), subframe=f - int(f))
    return {pb.name: (pb.location.copy(), pb.rotation_quaternion.copy(), pb.scale.copy()) for pb in arm.pose.bones}


def mix(lower, upper):
    return {k: (upper[k] if k in UPPER else lower[k]) for k in lower}


LEG = float(arg("--leg", 1.45))  # 다리(허벅지 아래 전부) 배율. 원래 모델은 다리가 아주 짧아 종종걸음처럼 보인다
ARM = float(arg("--arm", 1.3))  # 팔(어깨 아래 전부) 배율. 원래 모델은 팔이 가늘고 짧다
HIP_Z = arm.data.bones["upperleg.l"].head_local.z
ANKLE = {s_: Vector((arm.data.bones["foot." + s_].head_local.x, arm.data.bones["foot." + s_].head_local.y * LEG, arm.data.bones["foot." + s_].head_local.z * LEG)) for s_ in "lr"}
feet, leg_ik = {}, {}
for s_ in "lr":
    t = bpy.data.objects.new("foot_" + s_, None)
    bpy.context.collection.objects.link(t)
    t.parent = arm
    t.location = ANKLE[s_]
    feet[s_] = t
    con = arm.pose.bones["lowerleg." + s_].constraints.new("IK")
    con.target = t
    con.chain_count = 2
    con.influence = 0.0
    leg_ik[s_] = con


def apply(pose, ext=None):
    """ext(걷기 컷): hip=(앞뒤, 위아래) 엉덩이 이동, front/rear=왼발/오른발 자리(앞이 음수), lift_*=발 들기, pitch_*=발 기울기."""
    from mathutils import Matrix
    arm.animation_data.action = None
    pb = arm.pose.bones
    for b in pb:
        b.location, b.rotation_quaternion, b.scale = pose[b.name]
    pb["hips"].location.y += HIP_Z * (LEG - 1)  # 다리가 길어진 만큼 엉덩이를 올린다(뼈가 위를 향해 있어 y가 위쪽)
    for s_ in "lr":
        pb["upperleg." + s_].scale = (LEG, LEG, LEG)
        pb["upperarm." + s_].scale = (ARM, ARM, ARM)
        leg_ik[s_].influence = 1.0 if ext else 0.0
        feet[s_].location = ANKLE[s_]
    bpy.context.view_layer.update()
    if ext:  # 뼈대 좌표: 앞 -Y
        feet["l"].location = ANKLE["l"] + Vector((ext.get("side_l", 0), ext["front"] * LEG, ext.get("lift_l", 0) * LEG))
        feet["r"].location = ANKLE["r"] + Vector((ext.get("side_r", 0), ext["rear"] * LEG, ext.get("lift_r", 0) * LEG))
        pb["hips"].matrix = Matrix.Translation((0, ext["hip"][0], ext["hip"][1] * LEG)) @ pb["hips"].matrix
        bpy.context.view_layer.update()
        for s_ in "lr":  # 발바닥은 땅과 나란히(정강이를 따라 꺾이지 않게), pitch로만 기울인다
            tilt = Matrix.Rotation(math.radians(ext.get("pitch_" + s_, 0)), 3, "X")  # 음수: 발끝이 들린다, 양수: 뒤꿈치가 들린다
            m = (tilt @ arm.data.bones["foot." + s_].matrix_local.to_3x3() * LEG).to_4x4()
            m.translation = pb["foot." + s_].matrix.translation
            pb["foot." + s_].matrix = m
    bpy.context.view_layer.update()


IDLE = arg("--idle", "Ranged_Bow_Idle")
hold = sample(IDLE, 0.0)
# 걷기 4컷(왼발 디딤 → 오른발 넘김 → 오른발 디딤 → 왼발 넘김): 발이 땅을 길게 디디게 직접 놓는다
STRIDE = float(arg("--stride", 0.18))
STEP = [
    dict(hip=(0, -0.05), front=-STRIDE, rear=STRIDE, pitch_l=-15, pitch_r=22),
    dict(hip=(0, -0.01), front=0.02, rear=-0.04, lift_r=0.07, pitch_r=10),
    dict(hip=(0, -0.05), front=STRIDE, rear=-STRIDE, pitch_l=22, pitch_r=-15),
    dict(hip=(0, -0.01), front=-0.04, rear=0.02, lift_l=0.07, pitch_l=10),
]
# 각 컷: (자세, 다리 놓기, 시위를 당겼는가, 화살을 메겼는가)
FRAMES = {
    "idle": [(hold, None, False, False)],
    "walk": [(hold, e, False, False) for e in STEP],
    "attack": [
        (sample("Ranged_Bow_Draw", 0.5), None, True, True),
        (sample("Ranged_Bow_Draw", 1.0), None, True, True),
        (sample("Ranged_Bow_Release", 0.2), None, False, False),
        (sample("Ranged_Bow_Release", 0.8), None, False, False),
    ],
}
STRIP = arg("--strip", "")  # 동작 하나를 8등분해 훑어보는 점검용
if STRIP:
    FRAMES = {"strip": [(sample(STRIP, i / 8), None, int(arg("--strip_draw", 0)) == 1, int(arg("--strip_draw", 0)) == 1) for i in range(8)]}
ONLY = [a for a in arg("--anims", "").split(",") if a]
if ONLY:
    FRAMES = {k: v for k, v in FRAMES.items() if k in ONLY}
YAW = {0: math.radians(90), 1: math.radians(45), 2: 0.0, 3: math.radians(-45), 4: math.radians(-90)}
BODY = {0: 0, 1: 0, 2: float(arg("--side_yaw", -25)), 3: 0, 4: 0}  # 옆모습에서 얼굴·가슴이 보이게 몸을 카메라 쪽으로 튼다
os.makedirs(OUT, exist_ok=True)
for d in DIRS:
    yaw = YAW[d] + math.radians(BODY[d])
    root.rotation_euler = (0, 0, math.pi - yaw if MIRROR else yaw)
    for anim, poses in FRAMES.items():
        for i, (pose, ext, drawn, nocked) in enumerate(poses):
            apply(pose, ext)
            aim(drawn, nocked)
            fn = os.path.join(OUT, f"archer_{TEAM}_{d}_{anim}_{i}.png")
            sc.render.filepath = fn
            bpy.ops.render.render(write_still=True)
            img = bpy.data.images.load(fn)
            img.scale(SIZE, SIZE)
            if MIRROR:
                import numpy as np
                px = np.array(img.pixels[:], dtype=np.float32).reshape(SIZE, SIZE, 4)[:, ::-1]
                img.pixels[:] = px.reshape(-1).tolist()
            img.filepath_raw = fn
            img.file_format = "PNG"
            img.save()
            bpy.data.images.remove(img)
print("done")
