import { Vector3, type Object3D } from 'three';

export type CampusReaction = 'head' | 'spine' | 'leftArm' | 'rightArm' | 'leftLeg' | 'rightLeg';
export type ReactionAnchor = readonly [CampusReaction, Object3D, Object3D?];

export function campusReactionAt(point: Vector3, anchors: readonly ReactionAnchor[]): CampusReaction {
  const a = new Vector3(), b = new Vector3(), segment = new Vector3(), offset = new Vector3();
  let result: CampusReaction = 'spine', best = Infinity;
  for (const [part, start, end] of anchors) {
    start.getWorldPosition(a);
    if (end) {
      segment.subVectors(end.getWorldPosition(b), a);
      const length = segment.lengthSq();
      if (length) a.addScaledVector(segment, Math.max(0, Math.min(1, offset.subVectors(point, a).dot(segment) / length)));
    }
    const distance = a.distanceToSquared(point);
    if (distance < best) { best = distance; result = part; }
  }
  return result;
}

export const campusReactionDuration = .42;
export function campusReactionWave(remaining: number) {
  const strength = Math.max(0, Math.min(1, remaining / campusReactionDuration));
  return Math.sin((1 - strength) * Math.PI * 3) * strength;
}
