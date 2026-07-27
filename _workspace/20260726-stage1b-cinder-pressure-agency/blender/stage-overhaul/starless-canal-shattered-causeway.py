import bpy
import math
from mathutils import Vector
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
WORK = ROOT / "_workspace/20260726-stage1b-cinder-pressure-agency"
SOURCE_DIR = WORK / "blender/stage-overhaul"
QA_DIR = WORK / "qa/stage-overhaul"
TERRAIN_DIR = ROOT / "assets/images/battle/glb/terrain"
ALBEDO_PATH = WORK / "engineering/asset-pipeline/shared-textures/abyssal-toon-surface-v01.png"
NORMAL_PATH = WORK / "engineering/asset-pipeline/shared-textures/abyssal-toon-normal-v01.png"
for directory in (SOURCE_DIR, QA_DIR, TERRAIN_DIR):
    directory.mkdir(parents=True, exist_ok=True)


def reset_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for datablocks in (bpy.data.meshes, bpy.data.curves, bpy.data.materials, bpy.data.cameras, bpy.data.lights):
        for datablock in list(datablocks):
            if datablock.users == 0:
                datablocks.remove(datablock)


def make_material(name, tint, metallic=0.0, roughness=0.72, emission=None, emission_strength=0.0):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    material.diffuse_color = (*tint, 1.0)
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    nodes.clear()
    output = nodes.new('ShaderNodeOutputMaterial')
    shader = nodes.new('ShaderNodeBsdfPrincipled')
    shader.inputs['Base Color'].default_value = (*tint, 1.0)
    shader.inputs['Metallic'].default_value = metallic
    shader.inputs['Roughness'].default_value = roughness
    if emission:
        shader.inputs['Emission Color'].default_value = (*emission, 1.0)
        shader.inputs['Emission Strength'].default_value = emission_strength
    albedo = nodes.new('ShaderNodeTexImage')
    albedo.name = f'{name}_ALBEDO'
    albedo.image = bpy.data.images.load(str(ALBEDO_PATH), check_existing=True)
    albedo.image.pack()
    normal = nodes.new('ShaderNodeTexImage')
    normal.name = f'{name}_NORMAL'
    normal.image = bpy.data.images.load(str(NORMAL_PATH), check_existing=True)
    normal.image.colorspace_settings.name = 'Non-Color'
    normal.image.pack()
    normal_map = nodes.new('ShaderNodeNormalMap')
    normal_map.inputs['Strength'].default_value = 0.48
    links.new(albedo.outputs['Color'], shader.inputs['Base Color'])
    links.new(normal.outputs['Color'], normal_map.inputs['Color'])
    links.new(normal_map.outputs['Normal'], shader.inputs['Normal'])
    links.new(shader.outputs['BSDF'], output.inputs['Surface'])
    return material


def finalize_mesh(obj, material, bevel=0.0, smooth=False):
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    if bevel > 0:
        modifier = obj.modifiers.new('EdgeWeathering', 'BEVEL')
        modifier.width = bevel
        modifier.segments = 2
        modifier.limit_method = 'ANGLE'
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if not obj.data.uv_layers:
        bpy.ops.object.mode_set(mode='EDIT')
        bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.02)
        bpy.ops.object.mode_set(mode='OBJECT')
    obj.data.materials.clear()
    obj.data.materials.append(material)
    for polygon in obj.data.polygons:
        polygon.material_index = 0
        polygon.use_smooth = smooth
    obj['terrain_authored'] = True
    obj['material_contract'] = 'embedded_albedo_normal'
    obj.select_set(False)
    return obj


def box(name, loc, dims, material, bevel=0.12, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(location=loc, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dims
    return finalize_mesh(obj, material, bevel)


def cylinder(name, loc, radius, depth, material, vertices=12, rotation=(0, 0, 0), bevel=0.08):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    return finalize_mesh(obj, material, bevel)


def cone(name, loc, radius1, radius2, depth, material, vertices=8, rotation=(0, 0, 0), bevel=0.05):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=radius1, radius2=radius2, depth=depth, location=loc, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    return finalize_mesh(obj, material, bevel)


def torus(name, loc, major_radius, minor_radius, material, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=major_radius, minor_radius=minor_radius, major_segments=12, minor_segments=6, location=loc, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    return finalize_mesh(obj, material, 0.02, smooth=True)


def arch(name, center, width, height, depth, thickness, material, rotation=(0, 0, 0), segments=14):
    radius = width * 0.5
    inner = max(0.25, radius - thickness)
    spring_z = -height * 0.5 + radius
    verts = []
    for y in (-depth * 0.5, depth * 0.5):
        for r in (radius, inner):
            for i in range(segments + 1):
                angle = math.pi * i / segments
                verts.append((r * math.cos(angle), y, spring_z + r * math.sin(angle)))
    def idx(side, ring, i):
        return side * 2 * (segments + 1) + ring * (segments + 1) + i
    faces = []
    for i in range(segments):
        faces.append((idx(0,0,i), idx(0,0,i+1), idx(0,1,i+1), idx(0,1,i)))
        faces.append((idx(1,1,i), idx(1,1,i+1), idx(1,0,i+1), idx(1,0,i)))
        faces.append((idx(0,0,i), idx(1,0,i), idx(1,0,i+1), idx(0,0,i+1)))
        faces.append((idx(0,1,i+1), idx(1,1,i+1), idx(1,1,i), idx(0,1,i)))
    for i in (0, segments):
        faces.append((idx(0,0,i), idx(0,1,i), idx(1,1,i), idx(1,0,i)))
    mesh = bpy.data.meshes.new(f'{name}_Mesh')
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.location = center
    obj.rotation_euler = rotation
    return finalize_mesh(obj, material, 0.08)


def curved_segment(name, center, radius, a0, a1, depth, thickness, material, rotation=(0,0,0), segments=7):
    verts = []
    for y in (-depth * 0.5, depth * 0.5):
        for r in (radius, radius - thickness):
            for i in range(segments + 1):
                angle = a0 + (a1 - a0) * i / segments
                verts.append((r * math.cos(angle), y, r * math.sin(angle)))
    def idx(side, ring, i):
        return side * 2 * (segments + 1) + ring * (segments + 1) + i
    faces = []
    for i in range(segments):
        faces.extend([
            (idx(0,0,i), idx(0,0,i+1), idx(0,1,i+1), idx(0,1,i)),
            (idx(1,1,i), idx(1,1,i+1), idx(1,0,i+1), idx(1,0,i)),
            (idx(0,0,i), idx(1,0,i), idx(1,0,i+1), idx(0,0,i+1)),
            (idx(0,1,i+1), idx(1,1,i+1), idx(1,1,i), idx(0,1,i)),
        ])
    for i in (0, segments):
        faces.append((idx(0,0,i), idx(0,1,i), idx(1,1,i), idx(1,0,i)))
    mesh = bpy.data.meshes.new(f'{name}_Mesh')
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.location = center
    obj.rotation_euler = rotation
    return finalize_mesh(obj, material, 0.08)


def add_pillar(name, x, y, height, stone, cap):
    box(f'{name}_Shaft', (x,y,height*0.5), (1.05,1.05,height), stone, 0.16)
    box(f'{name}_Foot', (x,y,0.45), (1.55,1.55,0.8), cap, 0.14)
    box(f'{name}_Crown', (x,y,height+0.18), (1.45,1.45,0.55), cap, 0.14)


def add_lantern(name, x, y, z, metal, light):
    cylinder(f'{name}_Post', (x,y,z*0.5), 0.11, z, metal, vertices=8, bevel=0.03)
    cone(f'{name}_Lamp', (x,y,z+0.32), 0.32, 0.18, 0.62, light, vertices=8, bevel=0.04)
    cone(f'{name}_Finial', (x,y,z+0.85), 0.16, 0.0, 0.42, metal, vertices=8, bevel=0.02)


def configure_world(stage, warm=False):
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_EEVEE'
    scene.render.resolution_x = 960
    scene.render.resolution_y = 720
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.film_transparent = False
    scene.render.image_settings.color_mode = 'RGBA'
    scene.view_settings.look = 'AgX - Medium High Contrast'
    scene.view_settings.exposure = 1.35
    world = bpy.data.worlds.new(f'{stage}_World') if not bpy.data.worlds else bpy.data.worlds[0]
    scene.world = world
    world.use_nodes = True
    background = world.node_tree.nodes.get('Background')
    background.inputs['Color'].default_value = ((0.018,0.006,0.028,1) if warm else (0.004,0.012,0.032,1))
    background.inputs['Strength'].default_value = 0.34
    for i, (loc, energy, color, size) in enumerate([
        ((-8,-6,12), 2450, (0.25,0.45,1.0) if not warm else (1.0,0.16,0.05), 7.0),
        ((8,7,10), 2100, (0.52,0.2,1.0) if not warm else (1.0,0.36,0.12), 6.0),
        ((0,0,15), 1750, (0.5,0.65,1.0) if not warm else (1.0,0.16,0.36), 5.0),
    ]):
        light_data = bpy.data.lights.new(f'{stage}_Area_{i}', 'AREA')
        light_data.energy = energy
        light_data.color = color
        light_data.shape = 'DISK'
        light_data.size = size
        light_obj = bpy.data.objects.new(light_data.name, light_data)
        bpy.context.collection.objects.link(light_obj)
        light_obj.location = loc
        light_obj.rotation_euler = (0,0,0)


def point_camera(camera, target):
    camera.rotation_euler = (Vector(target) - camera.location).to_track_quat('-Z','Y').to_euler()


def render_views(stage_slug):
    scene = bpy.context.scene
    camera_data = bpy.data.cameras.new(f'{stage_slug}_Camera')
    camera_data.type = 'ORTHO'
    camera_data.lens = 50
    camera = bpy.data.objects.new(camera_data.name, camera_data)
    bpy.context.collection.objects.link(camera)
    scene.camera = camera
    camera.location = (19,-23,22)
    camera_data.ortho_scale = 34
    point_camera(camera, (0,0,2.2))
    scene.render.filepath = str(QA_DIR / f'starless-canal-shattered-causeway-{stage_slug}-oblique.png')
    bpy.ops.render.render(write_still=True)
    camera.location = (0,0,32)
    camera_data.ortho_scale = 31
    point_camera(camera, (0,0,0))
    scene.render.filepath = str(QA_DIR / f'starless-canal-shattered-causeway-{stage_slug}-top.png')
    bpy.ops.render.render(write_still=True)


def export_stage(stage_slug):
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
    bpy.ops.object.select_all(action='DESELECT')
    for obj in meshes:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.export_scene.gltf(
        filepath=str(TERRAIN_DIR / f'{stage_slug}.glb'),
        export_format='GLB',
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_normals=True,
        export_texcoords=True,
        export_materials='EXPORT',
        export_cameras=False,
        export_lights=False,
    )


def build_starless():
    reset_scene()
    configure_world('StarlessCanal', warm=False)
    stone = make_material('Starless_Canal_OiledStone', (0.10,0.16,0.24), metallic=0.12, roughness=0.72)
    slate = make_material('Starless_Towpath_BlueSlate', (0.08,0.12,0.20), metallic=0.05, roughness=0.82)
    iron = make_material('Starless_Lock_BlackIron', (0.04,0.07,0.12), metallic=0.72, roughness=0.36)
    silver = make_material('Starless_Toll_SilverSignal', (0.42,0.65,0.9), metallic=0.42, roughness=0.24, emission=(0.25,0.68,1.0), emission_strength=4.5)
    water = make_material('Starless_Undertow_DeepWater', (0.015,0.07,0.13), metallic=0.28, roughness=0.18, emission=(0.01,0.08,0.16), emission_strength=0.8)

    # Twin masonry banks frame a true central channel without blocking the battle corridor.
    box('Starless_NorthBank', (-7.25,0,0.0), (6.7,27.0,0.9), stone, 0.28)
    box('Starless_SouthBank', (7.25,0,0.0), (6.7,27.0,0.9), stone, 0.28)
    box('Starless_ChannelWater', (0,0,-0.38), (7.6,27.0,0.24), water, 0.06)
    for side in (-1,1):
        x_inner = side * 4.15
        x_outer = side * 10.55
        for segment, y in enumerate((-11.8,-8.4,-5.0,-1.7,1.7,5.0,8.4,11.8)):
            box(f'Starless_InnerParapet_{side}_{segment}', (x_inner,y,0.82), (0.48,2.55,1.10), slate, 0.12)
            if segment % 2 == 0:
                box(f'Starless_OuterButtress_{side}_{segment}', (x_outer,y,1.45), (0.95,1.55,2.9), stone, 0.18)
                cone(f'Starless_OuterSpire_{side}_{segment}', (x_outer,y,3.35), 0.48, 0.0, 1.15, iron, vertices=8)
    # Three narrow bridges make the channel readable yet keep its void dominant.
    for index, y in enumerate((-7.2,0.0,7.2)):
        box(f'Starless_BridgeDeck_{index}', (0,y,0.72), (9.2,1.35,0.48), slate, 0.16)
        box(f'Starless_BridgeBeam_{index}_A', (0,y-0.48,0.28), (8.7,0.22,0.55), iron, 0.06)
        box(f'Starless_BridgeBeam_{index}_B', (0,y+0.48,0.28), (8.7,0.22,0.55), iron, 0.06)
        for side in (-1,1):
            cylinder(f'Starless_BridgePylon_{index}_{side}', (side*4.2,y,1.2), 0.38, 2.3, stone, vertices=8)
    # Paired lock-gate arches and monumental piers.
    for gate, y in enumerate((-10.2,10.2)):
        arch(f'Starless_LockArch_{gate}', (0,y,3.55), 8.4,7.1,0.82,0.72, iron)
        box(f'Starless_LockLintel_{gate}', (0,y,6.75), (9.3,0.95,0.62), slate, 0.14)
        for side in (-1,1):
            add_pillar(f'Starless_LockPier_{gate}_{side}', side*4.55, y, 5.0, stone, slate)
            box(f'Starless_LockButtress_{gate}_{side}', (side*5.3,y,2.0), (0.75,2.1,4.0), stone, 0.16, rotation=(0,0,side*math.radians(5)))
            cone(f'Starless_LockSpire_{gate}_{side}', (side*4.55,y,6.15), 0.55,0.0,1.65,iron,vertices=8)
    # Sparse cold lights define the silver navigation rhythm.
    for i, (x,y) in enumerate(((-3.72,-5.4),(3.72,-2.4),(-3.72,3.1),(3.72,5.5),(-9.7,-9.2),(9.7,9.2))):
        add_lantern(f'Starless_SilverLantern_{i}',x,y,2.3,iron,silver)
    # Corner watch shrines and stair-like silhouette breaks.
    for side in (-1,1):
        for y in (-12.0,12.0):
            box(f'Starless_ShrineBase_{side}_{y}',(side*8.2,y,1.0),(3.2,2.0,2.0),slate,0.22)
            cone(f'Starless_ShrineRoof_{side}_{y}',(side*8.2,y,2.85),2.0,0.35,1.7,stone,vertices=8)
            cone(f'Starless_ShrineNeedle_{side}_{y}',(side*8.2,y,4.3),0.26,0.0,1.5,silver,vertices=8)
    bpy.context.scene['stage_concept'] = 'dark canal aqueduct twin banks lock arches narrow bridges water void silver lights'


def build_shattered():
    reset_scene()
    configure_world('ShatteredCauseway', warm=True)
    rust = make_material('Shattered_Causeway_RustStone', (0.30,0.09,0.055), metallic=0.16, roughness=0.78)
    rose = make_material('Shattered_Rubble_RoseAshlar', (0.38,0.09,0.14), metallic=0.08, roughness=0.74)
    iron = make_material('Shattered_Brace_ChainIron', (0.10,0.035,0.028), metallic=0.80, roughness=0.32)
    seam = make_material('Shattered_Fracture_LuminousSeam', (0.62,0.12,0.24), metallic=0.25, roughness=0.20, emission=(1.0,0.035,0.16), emission_strength=5.0)
    bone = make_material('Shattered_Keystone_ColossusBone', (0.34,0.17,0.15), metallic=0.05, roughness=0.88)
    islands = [
        ('South', (0,-10.4,0.15), (8.8,5.4,1.45), math.radians(-2)),
        ('LowerMid', (-0.35,-4.3,0.42), (7.4,4.6,1.55), math.radians(3)),
        ('UpperMid', (0.42,2.2,0.72), (7.8,5.0,1.65), math.radians(-4)),
        ('North', (-0.2,9.5,0.48), (9.4,6.5,1.5), math.radians(2)),
    ]
    for i,(label,loc,dims,rz) in enumerate(islands):
        box(f'Shattered_{label}Island',loc,dims,rust if i%2==0 else rose,0.32,rotation=(0,0,rz))
        # fractured edge teeth prevent the islands reading as simple blocks.
        for side in (-1,1):
            box(f'Shattered_{label}FractureTooth_{side}',(side*(dims[0]*0.42),loc[1]+(-1 if i%2 else 1)*dims[1]*0.42,loc[2]+0.25),(1.2,1.5,1.0),rose,0.18,rotation=(0,0,rz+side*0.22))
    # Bright traversal seams bridge every break while leaving generous center clearance.
    for i,(y,length,angle) in enumerate(((-7.25,1.35,0.06),(-1.1,1.55,-0.08),(5.55,2.0,0.07))):
        box(f'Shattered_TraversalSeam_{i}',(0,y,1.05),(0.34,length,0.16),seam,0.07,rotation=(0,0,angle))
        for side in (-1,1):
            box(f'Shattered_SeamShard_{i}_{side}',(side*0.42,y+side*0.15,0.92),(0.26,length*0.78,0.22),rose,0.06,rotation=(0,0,angle+side*0.1))
    # Broken colossus ribs rise at the margins, deliberately framing rather than filling the route.
    rib_specs = [(-6.4,-8.6,0.15,1), (6.5,-3.0,-0.12,-1), (-6.6,3.8,0.08,1), (6.3,9.0,-0.18,-1)]
    for i,(x,y,tilt,side) in enumerate(rib_specs):
        curved_segment(f'Shattered_ColossusRib_{i}_Lower',(x,y,2.6),4.4,0.05,1.12,0.72,0.62,bone,rotation=(0,side*0.28,tilt))
        curved_segment(f'Shattered_ColossusRib_{i}_Upper',(x+side*0.32,y,3.15),4.4,1.30,2.35,0.72,0.62,bone,rotation=(0,side*0.28,tilt+side*0.06))
        cylinder(f'Shattered_RibRoot_{i}',(x,y,1.3),0.72,2.6,bone,vertices=10,rotation=(0.08,side*0.18,tilt),bevel=0.12)
        cone(f'Shattered_RibSplinter_{i}',(x+side*0.35,y,5.25),0.42,0.0,1.7,bone,vertices=7,rotation=(0.2,side*0.18,tilt))
    # Fracture arches mark the far approach and repeat the concept's ruined bridge portals.
    arch('Shattered_SouthFractureArch',(0,-12.1,3.5),9.6,7.0,0.92,0.86,rust,rotation=(0.05,0,0.02))
    arch('Shattered_NorthFractureArch',(0,12.0,3.7),10.0,7.4,0.92,0.82,rose,rotation=(-0.06,0,-0.03))
    for gate,y in enumerate((-12.1,12.0)):
        for side in (-1,1):
            add_pillar(f'Shattered_FracturePier_{gate}_{side}',side*5.0,y,4.7,rust,rose)
            cone(f'Shattered_FractureCrown_{gate}_{side}',(side*5.0,y,5.95),0.62,0.0,1.75,bone,vertices=7,rotation=(side*0.1,0,side*0.06))
    # Hanging chains along one broken flank, each link authored as actual geometry.
    for chain_id,(x,y0,y1) in enumerate(((-7.6,-11.0,-3.0),(7.4,2.0,10.8))):
        links = 9
        for i in range(links):
            t = i/(links-1)
            y = y0+(y1-y0)*t
            z = 2.4-1.8*math.sin(math.pi*t)
            torus(f'Shattered_Chain_{chain_id}_Link_{i}',(x,y,z),0.34,0.09,iron,rotation=(math.pi/2,0,(i%2)*math.pi/2))
    # Jagged side islands and signal shards fill the silhouette without narrowing the center route.
    for i,(x,y,sx,sy) in enumerate(((-8.2,-10,3.4,3.0),(8.1,-6.4,3.0,2.8),(-8.0,8.2,3.2,3.5),(8.2,11.0,3.0,2.7))):
        box(f'Shattered_SideIsland_{i}',(x,y,-0.05),(sx,sy,1.3),rose if i%2 else rust,0.30,rotation=(0,0,(i-1.5)*0.12))
        cone(f'Shattered_SideShard_{i}',(x,y,2.1),0.85,0.12,3.1,bone,vertices=7,rotation=(0.14*(i%2),0.12,0.25*i))
        box(f'Shattered_SideGlow_{i}',(x,y+0.35,0.85),(0.20,1.8,0.18),seam,0.05,rotation=(0,0,0.3*(i-1)))
    for i,(x,y) in enumerate(((-3.7,-9.3),(3.5,-3.8),(-3.7,2.5),(3.8,9.6))):
        cylinder(f'Shattered_BrokenBollard_{i}',(x,y,1.55),0.48,2.6,rust,vertices=8,rotation=(0.05*i,0.08*(-1)**i,0),bevel=0.10)
        cone(f'Shattered_BollardFlame_{i}',(x,y,3.05),0.28,0.0,0.9,seam,vertices=7)
    bpy.context.scene['stage_concept'] = 'rust rose collapsed causeway separated islands broken colossus ribs fracture arches chains luminous seams'


def validate_scene(stage_slug):
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
    assert len(meshes) >= 20, (stage_slug, len(meshes))
    for obj in meshes:
        assert obj.data.polygons, obj.name
        assert obj.data.uv_layers and len(obj.data.uv_layers.active.data) > 0, obj.name
        assert obj.data.materials and obj.data.materials[0] is not None, obj.name
    assert len({obj.data.materials[0].name for obj in meshes}) >= 4


build_starless()
validate_scene('starless-canal')
export_stage('starless-canal')
render_views('starless-canal')
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE_DIR / 'starless-canal-shattered-causeway-starless.blend'))

build_shattered()
validate_scene('shattered-causeway')
export_stage('shattered-causeway')
render_views('shattered-causeway')
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE_DIR / 'starless-canal-shattered-causeway-shattered.blend'))
