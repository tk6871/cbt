"""Prepare a licensed static GLB for campus preview; preserve original textures.

blender --background --factory-startup --disable-autoexec --python
tools/prepare-campus-glb.py -- INPUT.glb OUTPUT.glb
"""
import bpy
import json
import sys
from pathlib import Path

source, target = map(Path, sys.argv[sys.argv.index('--') + 1:])
if target.exists():
    raise SystemExit('Output exists; refusing to overwrite.')
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(source.resolve()))
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
before = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in meshes)
ratio = min(1, 90000 / max(1, before))
for obj in meshes:
    bpy.context.view_layer.objects.active = obj
    mod = obj.modifiers.new('Campus mesh budget', 'DECIMATE')
    mod.ratio = ratio
    bpy.ops.object.modifier_apply(modifier=mod.name)
after = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in meshes)
bpy.ops.export_scene.gltf(filepath=str(target.resolve()), export_format='GLB', export_animations=False)
print('CAMPUS_PREPARE', json.dumps({'trianglesBefore': before, 'trianglesAfter': after, 'bytes': target.stat().st_size}))
