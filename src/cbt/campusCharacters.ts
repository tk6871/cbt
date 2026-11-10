import { Box3, Group, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils, type VRM } from '@pixiv/three-vrm';

/** One request, independent skeletons. No character download on the normal CBT page. */
export function loadCampusCharacters(parent: Group, changed: () => void, failed: () => void) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 30000);
  const avatars: VRM[] = [];
  let disposed = false;
  const loader = new GLTFLoader();
  loader.register(parser => new VRMLoaderPlugin(parser));
  void (async () => {
    const files = new Map<string, ArrayBuffer>();
    for (const placement of [
      { file: 'victoria', x: 1.5, z: 16, rotation: 0, height: 1.7 },
      { file: 'victoria', x: 6.6, z: -5.8, rotation: -.25, height: 1.7 },
      { file: 'student', x: 8.1, z: -4.7, rotation: -.5, height: 1.8 },
    ]) {
      if (disposed) return;
      const { file, x, z, rotation, height } = placement;
      if (!files.has(file)) {
        const response = await fetch(new URL(`assets/campus/models/${file}.vrm`, document.baseURI), { signal: controller.signal });
        if (!response.ok) throw new Error(`Avatar HTTP ${response.status}`);
        files.set(file, await response.arrayBuffer());
      }
      const bytes = files.get(file)!;
      const gltf = await loader.parseAsync(bytes.slice(0), '');
      const avatar: VRM = gltf.userData.vrm;
      if (disposed) { VRMUtils.deepDispose(avatar.scene); return; }
      VRMUtils.rotateVRM0(avatar);
      avatar.humanoid.setNormalizedPose({
        leftUpperArm: { rotation: [0, 0, Math.sin(.65), Math.cos(.65)] },
        rightUpperArm: { rotation: [0, 0, Math.sin(-.65), Math.cos(-.65)] },
      });
      avatar.update(0);
      avatar.scene.updateMatrixWorld(true);
      const bounds = new Box3().setFromObject(avatar.scene);
      const scale = height / bounds.getSize(new Vector3()).y;
      avatar.scene.scale.multiplyScalar(scale);
      avatar.scene.position.y -= bounds.min.y * scale;
      const anchor = new Group();
      anchor.position.set(x, .08, z); anchor.rotation.y = rotation;
      anchor.add(avatar.scene); parent.add(anchor); avatars.push(avatar);
      avatar.scene.traverse(object => { object.frustumCulled = false; });
    }
    changed();
  })().catch(() => { if (!disposed) failed(); }).finally(() => window.clearTimeout(timeout));
  return () => {
    disposed = true; controller.abort(); window.clearTimeout(timeout);
    for (const avatar of avatars) VRMUtils.deepDispose(avatar.scene);
    parent.clear();
  };
}
