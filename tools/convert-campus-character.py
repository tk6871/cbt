"""Convert the licensed McPato FBX to GLB without executing embedded scripts.

Run with Blender --background --factory-startup --disable-autoexec --python
tools/convert-campus-character.py -- INPUT.fbx OUTPUT.glb
Only format/material compatibility changes; no anatomy or texture painting.
"""
import bpy
import json
import sys
from pathlib import Path

source, target = [Path(p).resolve() for p in sys.argv[sys.argv.index('--') + 1:]]
if target.exists():
    raise SystemExit('Refusing to overwrite an existing conversion; choose a new output path.')
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=str(source), use_image_search=False)
report = {'source': source.name, 'objects': [], 'images': []}
for image in bpy.data.images:
    report['images'].append({'name': image.name, 'size': list(image.size), 'packed': bool(image.packed_file)})
for obj in bpy.context.scene.objects:
    entry = {'name': obj.name, 'type': obj.type}
    if obj.type == 'ARMATURE':
        entry['bones'] = [bone.name for bone in obj.data.bones]
    if obj.type == 'MESH':
        entry['vertices'] = len(obj.data.vertices)
        entry['materials'] = [mat.name for mat in obj.data.materials if mat]
    report['objects'].append(entry)
for material in bpy.data.materials:
    if material.use_nodes:
        report.setdefault('materials', []).append({'name': material.name, 'textures': [node.image.name for node in material.node_tree.nodes if node.type == 'TEX_IMAGE' and node.image]})
target.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(target), export_format='GLB', export_animations=False, export_yup=True)
print('CAMPUS_ASSET_REPORT', json.dumps(report, ensure_ascii=False))
print('CAMPUS_ASSET_BYTES', target.stat().st_size)
