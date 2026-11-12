"""Export a clothed, baked-atlas campus avatar from an inspected Blender source.

Use Blender --background --factory-startup --disable-autoexec SOURCE
--python tools/export-campus-companion.py -- OUTPUT.glb
"""
from pathlib import Path
import sys

import bpy

target = Path(sys.argv[sys.argv.index("--") + 1])
full_rig = "--full-rig" in sys.argv[sys.argv.index("--") + 2:]
if target.exists():
    raise SystemExit("Choose a new output path")

def atlas(material):
    if not material or not material.node_tree:
        return None
    group = material.node_tree.nodes.get("Gentex")
    light = group.node_tree.nodes.get("light") if group and group.node_tree else None
    if light and light.type == "TEX_IMAGE" and light.image:
        return light.image, False
    for node in material.node_tree.nodes:
        if node.type == "TEX_IMAGE" and node.image and "Atlas" in node.image.name:
            return node.image, True
    return None

mapping = {material: source for material in bpy.data.materials if (source := atlas(material))}
if not mapping:
    raise SystemExit("No baked atlas materials found")

bpy.ops.object.select_all(action="DESELECT")
for obj in bpy.context.scene.objects:
    if obj.type == "ARMATURE" or (
        obj.type == "MESH" and obj.visible_get() and not obj.hide_render
        and any(mat in mapping for mat in obj.data.materials)
    ):
        obj.select_set(True)
        if obj.type == "MESH":
            for name in ("uv_main", "UVMap"):
                if uv := obj.data.uv_layers.get(name):
                    uv.active_render = True
                    break
for image in {image for image, _ in mapping.values()}:
    width, height = image.size
    if max(width, height) > 4096:
        factor = 4096 / max(width, height)
        image.scale(round(width * factor), round(height * factor))
        image.pack()
for material, (image, already_pbr) in mapping.items():
    if already_pbr:
        # Drawing skin, hair and clothing as blended surfaces sorts them as
        # entire meshes in glTF. Preserve atlas cutouts using alpha test.
        tree = material.node_tree
        for shader in tree.nodes:
            if shader.type != "BSDF_PRINCIPLED" or not shader.inputs["Alpha"].is_linked:
                continue
            alpha = shader.inputs["Alpha"]
            source = alpha.links[0].from_socket
            clip = tree.nodes.new("ShaderNodeMath")
            clip.operation = "GREATER_THAN"
            clip.inputs[1].default_value = .2
            tree.links.new(source, clip.inputs[0])
            tree.links.new(clip.outputs[0], alpha)
        continue
    tree = material.node_tree
    tree.nodes.clear()
    tex = tree.nodes.new("ShaderNodeTexImage")
    tex.image = image
    shader = tree.nodes.new("ShaderNodeBsdfPrincipled")
    shader.inputs["Roughness"].default_value = .82
    shader.inputs["Specular IOR Level"].default_value = .18
    output = tree.nodes.new("ShaderNodeOutputMaterial")
    tree.links.new(tex.outputs["Color"], shader.inputs["Base Color"])
    if any(word in material.name.lower() for word in ("hair", "aritos", "eyeline", "eyebrow", "hitomi")):
        clip = tree.nodes.new("ShaderNodeMath")
        clip.operation = "GREATER_THAN"
        clip.inputs[1].default_value = .35
        tree.links.new(tex.outputs["Alpha"], clip.inputs[0])
        tree.links.new(clip.outputs[0], shader.inputs["Alpha"])
    tree.links.new(shader.outputs["BSDF"], output.inputs["Surface"])

result = bpy.ops.export_scene.gltf(
    filepath=str(target), export_format="GLB", use_selection=True,
    export_yup=True, export_animations=False, export_def_bones=not full_rig,
    export_morph=True, export_image_format="AUTO",
)
if "FINISHED" not in result:
    raise SystemExit("GLB export failed")
print("CAMPUS_COMPANION_GLB_BYTES", target.stat().st_size)
