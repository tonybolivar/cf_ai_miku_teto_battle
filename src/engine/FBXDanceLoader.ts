import * as THREE from "three";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";
import { VRM, VRMHumanBoneName } from "@pixiv/three-vrm";

/**
 * Maps FBX bone suffix (after stripping character prefix) -> VRM bone.
 * Each VRM bone appears only ONCE to avoid conflicting tracks.
 */
const BONE_MAP: Record<string, VRMHumanBoneName> = {
  Hips: VRMHumanBoneName.Hips,
  Spine: VRMHumanBoneName.Spine,
  Spine2: VRMHumanBoneName.Chest,
  Neck: VRMHumanBoneName.Neck,
  Head: VRMHumanBoneName.Head,
  RightShoulder: VRMHumanBoneName.RightShoulder,
  RightArm: VRMHumanBoneName.RightUpperArm,
  RightForeArm: VRMHumanBoneName.RightLowerArm,
  RightHand: VRMHumanBoneName.RightHand,
  LeftShoulder: VRMHumanBoneName.LeftShoulder,
  LeftArm: VRMHumanBoneName.LeftUpperArm,
  LeftForeArm: VRMHumanBoneName.LeftLowerArm,
  LeftHand: VRMHumanBoneName.LeftHand,
  RightUpLeg: VRMHumanBoneName.RightUpperLeg,
  RightLeg: VRMHumanBoneName.RightLowerLeg,
  RightFoot: VRMHumanBoneName.RightFoot,
  LeftUpLeg: VRMHumanBoneName.LeftUpperLeg,
  LeftLeg: VRMHumanBoneName.LeftLowerLeg,
  LeftFoot: VRMHumanBoneName.LeftFoot,
  RightHandThumb1: VRMHumanBoneName.RightThumbMetacarpal,
  RightHandThumb2: VRMHumanBoneName.RightThumbProximal,
  RightHandIndex1: VRMHumanBoneName.RightIndexProximal,
  RightHandIndex2: VRMHumanBoneName.RightIndexIntermediate,
  RightHandIndex3: VRMHumanBoneName.RightIndexDistal,
  RightHandMiddle1: VRMHumanBoneName.RightMiddleProximal,
  RightHandMiddle2: VRMHumanBoneName.RightMiddleIntermediate,
  RightHandMiddle3: VRMHumanBoneName.RightMiddleDistal,
  RightHandRing1: VRMHumanBoneName.RightRingProximal,
  RightHandRing2: VRMHumanBoneName.RightRingIntermediate,
  RightHandRing3: VRMHumanBoneName.RightRingDistal,
  RightHandPinky1: VRMHumanBoneName.RightLittleProximal,
  RightHandPinky2: VRMHumanBoneName.RightLittleIntermediate,
  RightHandPinky3: VRMHumanBoneName.RightLittleDistal,
  LeftHandThumb1: VRMHumanBoneName.LeftThumbMetacarpal,
  LeftHandThumb2: VRMHumanBoneName.LeftThumbProximal,
  LeftHandIndex1: VRMHumanBoneName.LeftIndexProximal,
  LeftHandIndex2: VRMHumanBoneName.LeftIndexIntermediate,
  LeftHandIndex3: VRMHumanBoneName.LeftIndexDistal,
  LeftHandMiddle1: VRMHumanBoneName.LeftMiddleProximal,
  LeftHandMiddle2: VRMHumanBoneName.LeftMiddleIntermediate,
  LeftHandMiddle3: VRMHumanBoneName.LeftMiddleDistal,
  LeftHandRing1: VRMHumanBoneName.LeftRingProximal,
  LeftHandRing2: VRMHumanBoneName.LeftRingIntermediate,
  LeftHandRing3: VRMHumanBoneName.LeftRingDistal,
  LeftHandPinky1: VRMHumanBoneName.LeftLittleProximal,
  LeftHandPinky2: VRMHumanBoneName.LeftLittleIntermediate,
  LeftHandPinky3: VRMHumanBoneName.LeftLittleDistal,
};

export async function loadFBXDance(
  url: string,
  vrm: VRM,
  fbxPrefix = "",
): Promise<THREE.AnimationClip | null> {
  const loader = new FBXLoader();
  const fbxScene = await loader.loadAsync(url);

  if (fbxScene.animations.length === 0) {
    console.warn("[FBX] No animations found");
    return null;
  }

  // Auto-detect prefix
  if (!fbxPrefix) {
    const counts = new Map<string, number>();
    fbxScene.traverse((obj) => {
      if (obj instanceof THREE.Bone) {
        const m = obj.name.match(/^([A-Z][a-z]+)(?=[A-Z])/);
        if (m) counts.set(m[1], (counts.get(m[1]) ?? 0) + 1);
      }
    });
    let best = "", bestN = 0;
    for (const [p, n] of counts) { if (n > bestN) { best = p; bestN = n; } }
    fbxPrefix = best;
  }

  const srcClip = fbxScene.animations[0];
  console.log(`[FBX] Clip: ${srcClip.tracks.length} tracks, ${srcClip.duration.toFixed(1)}s, prefix "${fbxPrefix}"`);

  // Build track index: fbxBoneName -> rotation QuaternionKeyframeTrack
  const fbxRotTracks = new Map<string, THREE.QuaternionKeyframeTrack>();
  for (const track of srcClip.tracks) {
    const dot = track.name.indexOf(".");
    if (dot === -1) continue;
    const bone = track.name.substring(0, dot);
    const prop = track.name.substring(dot + 1);
    if (prop === "quaternion") {
      fbxRotTracks.set(bone, track as THREE.QuaternionKeyframeTrack);
    }
  }

  // Capture VRM bone rest quaternions (T-pose, before any animation)
  // These are the quaternions the bones have right now in the loaded VRM
  const vrmRestQuats = new Map<string, THREE.Quaternion>();
  for (const [, vrmBoneName] of Object.entries(BONE_MAP)) {
    const node = vrm.humanoid?.getNormalizedBoneNode(vrmBoneName);
    if (node) {
      vrmRestQuats.set(node.name, node.quaternion.clone());
    }
  }

  // Build retargeted tracks
  const newTracks: THREE.KeyframeTrack[] = [];
  const matched: string[] = [];

  const tempFbxRest = new THREE.Quaternion();
  const tempFbxRestInv = new THREE.Quaternion();
  const tempVrmRest = new THREE.Quaternion();
  const tempDelta = new THREE.Quaternion();
  const tempResult = new THREE.Quaternion();

  for (const [suffix, vrmBoneName] of Object.entries(BONE_MAP)) {
    const fbxBoneName = fbxPrefix + suffix;
    const fbxTrack = fbxRotTracks.get(fbxBoneName);
    if (!fbxTrack) continue;

    const vrmNode = vrm.humanoid?.getNormalizedBoneNode(vrmBoneName);
    if (!vrmNode) continue;

    const vrmRest = vrmRestQuats.get(vrmNode.name) ?? new THREE.Quaternion();

    // Use FIRST FRAME of FBX track as the rest pose
    // This is more reliable than reading from the scene bind pose
    tempFbxRest.set(
      fbxTrack.values[0],
      fbxTrack.values[1],
      fbxTrack.values[2],
      fbxTrack.values[3],
    );
    tempFbxRestInv.copy(tempFbxRest).invert();

    // Retarget every keyframe: result = vrmRest * fbxRestInv * fbxAnim
    const values = new Float32Array(fbxTrack.values.length);

    for (let i = 0; i < fbxTrack.values.length; i += 4) {
      // fbxAnim quaternion at this keyframe
      tempDelta.set(
        fbxTrack.values[i],
        fbxTrack.values[i + 1],
        fbxTrack.values[i + 2],
        fbxTrack.values[i + 3],
      );

      // delta = fbxRestInv * fbxAnim (rotation relative to FBX rest)
      tempResult.copy(tempFbxRestInv).multiply(tempDelta);

      // result = vrmRest * delta (apply same relative rotation to VRM rest)
      tempResult.premultiply(vrmRest);

      values[i] = tempResult.x;
      values[i + 1] = tempResult.y;
      values[i + 2] = tempResult.z;
      values[i + 3] = tempResult.w;
    }

    newTracks.push(new THREE.QuaternionKeyframeTrack(
      `${vrmNode.name}.quaternion`,
      Array.from(fbxTrack.times),
      Array.from(values),
    ));

    matched.push(suffix);
  }

  console.log(`[FBX] Retargeted ${newTracks.length} bones: ${matched.join(", ")}`);
  if (newTracks.length === 0) return null;

  return new THREE.AnimationClip("dance", srcClip.duration, newTracks);
}
