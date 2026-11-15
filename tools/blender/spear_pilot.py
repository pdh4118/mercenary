"""창병 3D 파일럿: 도형을 조합한 치비 창병을 툰 셰이딩 + 외곽선으로 8방향(렌더는 5방향, 나머지는 좌우 반전) x (대기·걷기·공격) 렌더한다.

실행(블렌더의 파이썬 모듈 bpy가 필요하다. pip install bpy):
  python tools/blender/spear_pilot.py <출력폴더> [--size 256] [--team ally|enemy]
결과: <출력폴더>/spear_<방향>_<동작>_<번호>.png (방향 0=뒤, 1=뒤 비스듬, 2=옆, 3=앞 비스듬, 4=앞)
"""
import math
import sys

import bpy
from mathutils import Euler, Vector

OUT = sys.argv[1] if len(sys.argv) > 1 else "/tmp/frames"
SIZE = int(sys.argv[sys.argv.index("--size") + 1]) if "--size" in sys.argv else 256
TEAM = sys.argv[sys.argv.index("--team") + 1] if "--team" in sys.argv else "ally"

PAL = {
    "ally": dict(cloth=(0.18, 0.55, 0.16), trim=(0.95, 0.78, 0.25), pants=(0.16, 0.45, 0.14)),
    "enemy": dict(cloth=(0.22, 0.2, 0.22), trim=(0.75, 0.2, 0.12), pants=(0.18, 0.16, 0.18)),
}[TEAM]
SKIN = (0.98, 0.84, 0.7)
LEATHER = (0.36, 0.2, 0.1)
WOOD = (0.55, 0.32, 0.14)
STEEL = (0.72, 0.76, 0.82)
BLACK = (0.02, 0.02, 0.03)

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = "CYCLES"
sc.cycles.samples = 24
sc.cycles.device = "CPU"
sc.render.resolution_x = sc.render.resolution_y = SIZE
sc.render.film_transparent = True
sc.view_settings.view_transform = "Standard"  # 기본 필름 톤이 색을 흐리게 하므로 쓰지 않는다
sc.view_settings.look = "None"
sc.render.image_settings.file_format = "PNG"
sc.render.image_settings.color_mode = "RGBA"
sc.render.use_freestyle = True
sc.render.line_thickness_mode = "ABSOLUTE"
sc.render.line_thickness = SIZE / 130.0  # 256px에서 약 2px

_mats = {}


def toon(color):
    key = tuple(color)
    if key in _mats:
        return _mats[key]
    m = bpy.data.materials.new("toon")
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    diff = nt.nodes.new("ShaderNodeBsdfDiffuse")
    diff.inputs[0].default_value = (1, 1, 1, 1)
    s2r = nt.nodes.new("ShaderNodeShaderToRGB")
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.interpolation = "CONSTANT"
    ramp.color_ramp.elements[0].position = 0.0
    ramp.color_ramp.elements[0].color = (0.55, 0.55, 0.55, 1)
    e1 = ramp.color_ramp.elements.new(0.38)
    e1.color = (0.8, 0.8, 0.8, 1)
    e2 = ramp.color_ramp.elements.new(0.72)
    e2.color = (1, 1, 1, 1)
    mix = nt.nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.blend_type = "MULTIPLY"
    mix.inputs[0].default_value = 1
    mix.inputs[7].default_value = (*color, 1)
    emit = nt.nodes.new("ShaderNodeEmission")
    nt.links.new(diff.outputs[0], s2r.inputs[0])
    nt.links.new(s2r.outputs[0], ramp.inputs[0])
    nt.links.new(ramp.outputs[0], mix.inputs[6])
    nt.links.new(mix.outputs[2], emit.inputs[0])
    nt.links.new(emit.outputs[0], out.inputs[0])
    _mats[key] = m
    return m


def shape(kind, color, loc=(0, 0, 0), scale=(1, 1, 1), rot=(0, 0, 0), parent=None, seg=24):
    if kind == "sphere":
        bpy.ops.mesh.primitive_uv_sphere_add(radius=1, segments=seg, ring_count=seg // 2)
    elif kind == "cyl":
        bpy.ops.mesh.primitive_cylinder_add(radius=1, depth=2, vertices=seg)
    elif kind == "cone":
        bpy.ops.mesh.primitive_cone_add(radius1=1, radius2=0, depth=2, vertices=seg)
    elif kind == "box":
        bpy.ops.mesh.primitive_cube_add(size=2)
    ob = bpy.context.active_object
    ob.location = loc
    ob.scale = scale
    ob.rotation_euler = Euler(rot)
    bpy.ops.object.shade_smooth()
    ob.data.materials.append(toon(color))
    if parent:
        ob.parent = parent
    return ob


def empty(name, loc=(0, 0, 0), parent=None):
    e = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(e)
    e.location = loc
    if parent:
        e.parent = parent
    return e


# --- 모델(앞을 +X로 본다) ----------------------------------------------------
root = empty("root")
hips = empty("hips", (0, 0, 0.75), root)
torso = empty("torso", (0, 0, 0.2), hips)
head = empty("head", (0.02, 0, 0.78), torso)

legL = empty("legL", (0, 0.16, -0.02), hips)
legR = empty("legR", (0, -0.16, -0.02), hips)
for leg, side in ((legL, 1), (legR, -1)):
    shape("cyl", PAL["pants"], (0, 0, -0.26), (0.13, 0.13, 0.26), parent=leg)
    shape("cyl", LEATHER, (0.03, 0, -0.52), (0.16, 0.16, 0.14), parent=leg)  # 장화
    shape("box", LEATHER, (0.1, 0, -0.64), (0.2, 0.14, 0.07), parent=leg)  # 발

shape("sphere", PAL["cloth"], (0, 0, 0.12), (0.34, 0.3, 0.38), parent=torso)  # 상의
shape("cyl", LEATHER, (0, 0, -0.12), (0.345, 0.31, 0.05), parent=torso)  # 허리띠
shape("box", PAL["trim"], (0.3, 0, -0.12), (0.05, 0.07, 0.07), parent=torso)  # 버클
shape("sphere", SKIN, (0, 0, 0), (0.5, 0.5, 0.48), parent=head, seg=32)  # 얼굴(머리)
# 두건: 머리 위·뒤를 덮는 초록 모자 + 뒤로 뾰족한 끝
def cut_sphere(color, loc, scale, parent, front_x, low_z):
    """앞(+X)과 아래를 잘라 낸 구: 얼굴이 보이는 두건"""
    import bmesh
    me = bpy.data.meshes.new("hood")
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=32, v_segments=16, radius=1)
    kill = [f for f in bm.faces if f.calc_center_median().x > front_x or f.calc_center_median().z < low_z]
    bmesh.ops.delete(bm, geom=kill, context="FACES")
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new("hood", me)
    bpy.context.collection.objects.link(ob)
    ob.location, ob.scale, ob.parent = loc, scale, parent
    for poly in me.polygons:
        poly.use_smooth = True
    me.materials.append(toon(color))
    return ob


hood = cut_sphere(PAL["cloth"], (-0.08, 0, 0.1), (0.58, 0.57, 0.54), head, 0.22, -0.2)
shape("cone", PAL["cloth"], (-0.55, 0, 0.42), (0.17, 0.17, 0.34), (0, math.radians(-55), 0), parent=head)
# 얼굴이 보이도록 두건 앞쪽을 파낸다: 같은 위치의 피부색 구를 두건 앞에 겹쳐 보이게 하는 대신, 얼굴 구를 앞으로 내민다
face = shape("sphere", SKIN, (0.14, 0, -0.06), (0.4, 0.42, 0.36), parent=head, seg=32)
for s in (1, -1):
    shape("sphere", BLACK, (0.575, 0.15 * s, -0.04), (0.04, 0.04, 0.07), parent=head, seg=12)  # 눈
armL = empty("armL", (0.02, 0.34, 0.28), torso)
armR = empty("armR", (0.02, -0.34, 0.28), torso)
for arm in (armL, armR):
    shape("cyl", PAL["cloth"], (0, 0, -0.17), (0.1, 0.1, 0.19), parent=arm)
    shape("sphere", SKIN, (0, 0, -0.38), (0.1, 0.1, 0.1), parent=arm)  # 손
spear = empty("spear", (0.12, -0.04, 0.1), torso)  # 창은 몸통에 붙여 수평으로 두고, 양손이 창을 잡는다
shape("cyl", WOOD, (0.1, 0, 0), (0.05, 0.05, 1.35), (0, math.radians(90), 0), parent=spear)
shape("cone", STEEL, (1.55, 0, 0), (0.09, 0.09, 0.2), (0, math.radians(90), 0), parent=spear)
shape("cyl", PAL["trim"], (1.32, 0, 0), (0.05, 0.05, 0.03), (0, math.radians(90), 0), parent=spear)

# --- 조명·카메라 ------------------------------------------------------------
bpy.ops.object.light_add(type="SUN", location=(2, -2, 5))
sun = bpy.context.active_object
sun.rotation_euler = (math.radians(40), math.radians(-15), math.radians(-30))
sun.data.energy = 3.0
bpy.ops.object.camera_add()
cam = bpy.context.active_object
cam.data.type = "ORTHO"
cam.data.ortho_scale = 3.6
elev = math.radians(24)
dist = 12
cam.location = (0, -dist * math.cos(elev), 1.0 + dist * math.sin(elev))
cam.rotation_euler = (math.radians(90) - elev, 0, 0)
sc.camera = cam

vl = sc.view_layers[0]
vl.use_freestyle = True
ls = vl.freestyle_settings.linesets.new("outline")
ls.select_silhouette = True
ls.select_border = True
ls.select_crease = True
ls.select_edge_mark = False
vl.freestyle_settings.crease_angle = math.radians(135)
lst = bpy.data.linestyles["LineStyle"] if "LineStyle" in bpy.data.linestyles else bpy.data.linestyles.new("LineStyle")
ls.linestyle = lst
lst.color = (0.03, 0.02, 0.02)
lst.thickness = SIZE / 130.0


# --- 동작 ---------------------------------------------------------------------
def pose(anim, t):
    """t: 0..1(걷기·공격의 위상). 각 부위를 회전/이동한다."""
    for o in (hips, torso, head, armL, armR, legL, legR, spear):
        o.rotation_euler = (0, 0, 0)
    hips.location = (0, 0, 0.75)
    spear.rotation_euler = (0, 0, 0)
    spear.location = (0.12, -0.04, 0.1)
    armR.rotation_euler = (math.radians(38), math.radians(-62), 0)  # 창을 앞으로 든 자세(안쪽으로 모은다)
    armL.rotation_euler = (math.radians(-38), math.radians(-62), 0)
    if anim == "walk":
        s = math.sin(t * 2 * math.pi)
        legL.rotation_euler = (0, math.radians(32) * s, 0)
        legR.rotation_euler = (0, -math.radians(32) * s, 0)
        hips.location = (0, 0, 0.75 + 0.05 * abs(math.sin(t * 2 * math.pi)))
        torso.rotation_euler = (0, math.radians(-4), math.radians(6) * s)
        armL.rotation_euler = (math.radians(-38), math.radians(-62) - math.radians(10) * s, 0)
    elif anim == "idle":
        hips.location = (0, 0, 0.75 + 0.015 * math.sin(t * 2 * math.pi))
    elif anim == "attack":
        # 0 준비(뒤로 당김) -> 1 찌르기 -> 2 끝까지 -> 3 복귀
        k = int(round(t * 3))
        if k == 0:  # 준비: 창을 뒤로 당긴다
            spear.location = (-0.22, -0.04, 0.1)
            torso.rotation_euler = (0, 0, math.radians(-14))
        elif k == 1:  # 찌르는 중
            spear.location = (0.3, -0.04, 0.1)
            torso.rotation_euler = (0, math.radians(6), math.radians(6))
        elif k == 2:  # 끝까지 뻗음
            spear.location = (0.62, -0.04, 0.1)
            torso.rotation_euler = (0, math.radians(10), math.radians(14))
            hips.location = (0.08, 0, 0.72)
        else:  # 복귀
            spear.location = (0.3, -0.04, 0.1)
            torso.rotation_euler = (0, 0, math.radians(4))
        legL.rotation_euler = (0, math.radians(22), 0)
        legR.rotation_euler = (0, math.radians(-22), 0)


# --- 렌더 ---------------------------------------------------------------------
# 방향 0=뒤 1=뒤비스듬 2=옆 3=앞비스듬 4=앞: 모델 앞(+X)이 카메라 기준으로 어느 쪽을 보는지
# 카메라는 -Y에서 +Y를 본다. 옆(오른쪽을 봄)은 앞=+X(yaw 0). 앞(카메라를 봄)은 앞=-Y(yaw -90), 뒤는 +Y(yaw 90).
YAW = {0: math.radians(90), 1: math.radians(45), 2: 0.0, 3: math.radians(-45), 4: math.radians(-90)}
ANIMS = [("idle", 1), ("walk", 4), ("attack", 4)]
import os

os.makedirs(OUT, exist_ok=True)
ONLY = os.environ.get("ONLY_DIRS")
for d, yaw in YAW.items():
    if ONLY and str(d) not in ONLY.split(","):
        continue
    root.rotation_euler = (0, 0, yaw)
    for anim, n in ANIMS:
        for i in range(n):
            pose(anim, i / n if anim == "walk" else (i / (n - 1) if anim == "attack" else 0))
            sc.render.filepath = os.path.join(OUT, f"spear_{d}_{anim}_{i}.png")
            bpy.ops.render.render(write_still=True)
print("done")
