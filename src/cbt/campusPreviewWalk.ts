import { Bone, Group, Quaternion, Vector3 } from 'three';

export const previewPoseLabels = { walk:'산책', idle:'편하게 서기', tpose:'T자 자세' } as const;
export type PreviewPose = keyof typeof previewPoseLabels;

/** Match the known Shiho deform rig; leave other uploaded previews untouched. */
export function makePreviewWalker(model: Group, station = {x:20.2,z:19.5,yaw:-.85}) {
  const rig = new Map<string, Bone>();
  model.traverse(node => {
    if (node instanceof Bone) rig.set(node.name.toLowerCase().replace(/[^a-z0-9]/g, ''), node);
  });
  const names = ['leftarm','rightarm','leftleg','rightleg','leftknee','rightknee'];
  const joints = names.map(name => rig.get('def' + name));
  if (joints.some(joint => !joint?.parent)) return;
  const [leftArm,rightArm,leftLeg,rightLeg,leftKnee,rightKnee] = joints as Bone[];
  const axisY = new Vector3(0,1,0), facingX = new Vector3(), facingZ = new Vector3();
  const accents = ['defspine','defhead','defleftwrist','defrightwrist']
    .map(name => rig.get(name));
  const hair = Array.from(rig).filter(([name,bone]) => /hair|cattail/.test(name) &&
    bone.parent && !/hair|cattail/i.test(bone.parent.name)).slice(0,14).map(([,bone])=>bone);
  const posedBones = [...new Set([...joints, ...accents, ...hair].filter((bone): bone is Bone => Boolean(bone?.parent)))];
  const rest = posedBones.map(bone=>bone.quaternion.clone());
  const armSign = (bone: Bone) => Math.sign(bone.getWorldPosition(new Vector3()).x) || 1;
  const signs = [armSign(leftArm), armSign(rightArm)];
  const parentRotation = new Quaternion(), turn = new Quaternion(), axis = new Vector3();
  function bend(bone: Bone, worldAxis: Vector3, radians: number) {
    bone.parent!.getWorldQuaternion(parentRotation).invert();
    axis.copy(worldAxis).applyQuaternion(parentRotation);
    bone.quaternion.premultiply(turn.setFromAxisAngle(axis,radians));
  }
  const pivot = new Group(); pivot.add(model);
  let elapsed = 0;
  let detailTime = 0;
  let impact = 0;
  function update(dt: number, quiet: boolean, pose: PreviewPose | 'seat' = 'walk') {
    const moving = pose === 'walk' && !quiet;
    if (!quiet && pose !== 'tpose') detailTime += dt;
    impact = quiet ? 0 : Math.max(0,impact-dt*3.4);
    if (moving) elapsed += dt;
    const path = elapsed * .46, stride = moving ? Math.sin(elapsed * 6) : 0;
    if (pose === 'walk') pivot.position.set(20 + 1.32 * Math.sin(path), Math.abs(stride)*.018, 21.8 + 1.05 * Math.cos(path));
    else pivot.position.set(station.x,pose === 'seat' ? -.37 : 0,station.z);
    pivot.rotation.y = moving ? Math.atan2(1.32*Math.cos(path),-1.05*Math.sin(path)) : station.yaw;
    // Pose axes are expressed in the avatar's facing frame, not the rig's roll.
    facingX.set(1,0,0).applyAxisAngle(axisY,pivot.rotation.y);
    facingZ.set(0,0,1).applyAxisAngle(axisY,pivot.rotation.y);
    posedBones.forEach((bone,i)=>bone.quaternion.copy(rest[i]));
    if (pose === 'tpose') return false;
    bend(leftArm,facingZ,-signs[0]*1.35); bend(rightArm,facingZ,-signs[1]*1.35);
    bend(leftArm,facingX,-stride*.17); bend(rightArm,facingX,stride*.17);
    bend(leftLeg,facingX,stride*.26); bend(rightLeg,facingX,-stride*.26);
    bend(leftKnee,facingX,Math.max(0,-stride)*.27); bend(rightKnee,facingX,Math.max(0,stride)*.27);
    if (pose === 'seat') {
      bend(leftLeg,facingX,-1.42); bend(rightLeg,facingX,-1.42);
      bend(leftKnee,facingX,1.43); bend(rightKnee,facingX,1.43);
      bend(leftArm,facingX,-.18); bend(rightArm,facingX,-.18);
    }
    if (!quiet) {
      const sway = Math.sin(detailTime * 1.45);
      const [spine,head,leftWrist,rightWrist] = accents;
      const recoil = impact * .12 * Math.sin(impact * 15);
      if (spine?.parent) bend(spine,facingZ,.012*sway + .025*stride + recoil);
      if (head?.parent) bend(head,axisY,.04*Math.sin(detailTime*.8)-.02*stride);
      if (leftWrist?.parent) bend(leftWrist,facingX,.035*sway + .045*stride);
      if (rightWrist?.parent) bend(rightWrist,facingX,-.035*sway - .045*stride);
      hair.forEach((bone,i)=>{
        bend(bone,facingZ,.027*Math.sin(detailTime*2.1+i*.28)+.045*stride+recoil*.7);
        bend(bone,facingX,.02*Math.sin(detailTime*1.6+i*.35));
      });
    }
    return !quiet;
  }
  return { pivot, update, react(){ impact=1; } };
}
