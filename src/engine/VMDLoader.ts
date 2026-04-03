import * as THREE from "three";
import { VRM, VRMHumanBoneName, VRMExpressionPresetName } from "@pixiv/three-vrm";

/**
 * Parses VMD (Vocaloid Motion Data) files and creates Three.js AnimationClips
 * mapped to VRM humanoid bone names.
 */

// MMD bone name (Shift_JIS/Japanese) -> VRM humanoid bone name
const MMD_TO_VRM_BONE: Record<string, VRMHumanBoneName> = {
  "センター": VRMHumanBoneName.Hips,
  "上半身": VRMHumanBoneName.Spine,
  "上半身2": VRMHumanBoneName.Chest,
  "首": VRMHumanBoneName.Neck,
  "頭": VRMHumanBoneName.Head,
  "左肩": VRMHumanBoneName.LeftShoulder,
  "左腕": VRMHumanBoneName.LeftUpperArm,
  "左ひじ": VRMHumanBoneName.LeftLowerArm,
  "左手首": VRMHumanBoneName.LeftHand,
  "右肩": VRMHumanBoneName.RightShoulder,
  "右腕": VRMHumanBoneName.RightUpperArm,
  "右ひじ": VRMHumanBoneName.RightLowerArm,
  "右手首": VRMHumanBoneName.RightHand,
  "左足": VRMHumanBoneName.LeftUpperLeg,
  "左ひざ": VRMHumanBoneName.LeftLowerLeg,
  "左足首": VRMHumanBoneName.LeftFoot,
  "右足": VRMHumanBoneName.RightUpperLeg,
  "右ひざ": VRMHumanBoneName.RightLowerLeg,
  "右足首": VRMHumanBoneName.RightFoot,
  "左つま先": VRMHumanBoneName.LeftToes,
  "右つま先": VRMHumanBoneName.RightToes,
  "下半身": VRMHumanBoneName.Hips,
  "腰": VRMHumanBoneName.Hips,
  "グルーブ": VRMHumanBoneName.Hips,
  "全ての親": VRMHumanBoneName.Hips,
  "上半身1": VRMHumanBoneName.Chest,
  "左目": VRMHumanBoneName.LeftEye,
  "右目": VRMHumanBoneName.RightEye,
  // Finger bones
  "左親指１": VRMHumanBoneName.LeftThumbMetacarpal,
  "左親指２": VRMHumanBoneName.LeftThumbProximal,
  "左人指１": VRMHumanBoneName.LeftIndexProximal,
  "左人指２": VRMHumanBoneName.LeftIndexIntermediate,
  "左人指３": VRMHumanBoneName.LeftIndexDistal,
  "左中指１": VRMHumanBoneName.LeftMiddleProximal,
  "左中指２": VRMHumanBoneName.LeftMiddleIntermediate,
  "左中指３": VRMHumanBoneName.LeftMiddleDistal,
  "左薬指１": VRMHumanBoneName.LeftRingProximal,
  "左薬指２": VRMHumanBoneName.LeftRingIntermediate,
  "左薬指３": VRMHumanBoneName.LeftRingDistal,
  "左小指１": VRMHumanBoneName.LeftLittleProximal,
  "左小指２": VRMHumanBoneName.LeftLittleIntermediate,
  "左小指３": VRMHumanBoneName.LeftLittleDistal,
  "右親指１": VRMHumanBoneName.RightThumbMetacarpal,
  "右親指２": VRMHumanBoneName.RightThumbProximal,
  "右人指１": VRMHumanBoneName.RightIndexProximal,
  "右人指２": VRMHumanBoneName.RightIndexIntermediate,
  "右人指３": VRMHumanBoneName.RightIndexDistal,
  "右中指１": VRMHumanBoneName.RightMiddleProximal,
  "右中指２": VRMHumanBoneName.RightMiddleIntermediate,
  "右中指３": VRMHumanBoneName.RightMiddleDistal,
  "右薬指１": VRMHumanBoneName.RightRingProximal,
  "右薬指２": VRMHumanBoneName.RightRingIntermediate,
  "右薬指３": VRMHumanBoneName.RightRingDistal,
  "右小指１": VRMHumanBoneName.RightLittleProximal,
  "右小指２": VRMHumanBoneName.RightLittleIntermediate,
  "右小指３": VRMHumanBoneName.RightLittleDistal,
};

// MMD morph name -> VRM expression preset
const MMD_TO_VRM_EXPRESSION: Record<string, string> = {
  "あ": VRMExpressionPresetName.Aa,
  "い": VRMExpressionPresetName.Ih,
  "う": VRMExpressionPresetName.Ou,
  "え": VRMExpressionPresetName.Ee,
  "お": VRMExpressionPresetName.Oh,
  "まばたき": VRMExpressionPresetName.Blink,
  "笑い": VRMExpressionPresetName.Happy,
  "怒り": VRMExpressionPresetName.Angry,
  "困る": VRMExpressionPresetName.Sad,
  "にやり": VRMExpressionPresetName.Happy,
  "ウィンク": VRMExpressionPresetName.BlinkLeft,
  "ウィンク右": VRMExpressionPresetName.BlinkRight,
  "ウィンク２": VRMExpressionPresetName.BlinkLeft,
  "a": VRMExpressionPresetName.Aa,
  "i": VRMExpressionPresetName.Ih,
  "u": VRMExpressionPresetName.Ou,
  "e": VRMExpressionPresetName.Ee,
  "o": VRMExpressionPresetName.Oh,
  "blink": VRMExpressionPresetName.Blink,
};

interface VMDBoneFrame {
  boneName: string;
  frameNum: number;
  rotation: THREE.Quaternion;
}

interface VMDMorphFrame {
  morphName: string;
  frameNum: number;
  weight: number;
}

/** Read a Shift_JIS encoded string from a DataView, trimming null bytes */
function readSJISString(view: DataView, offset: number, length: number): string {
  const bytes: number[] = [];
  for (let i = 0; i < length; i++) {
    const b = view.getUint8(offset + i);
    if (b === 0) break;
    bytes.push(b);
  }
  try {
    return new TextDecoder("shift_jis").decode(new Uint8Array(bytes));
  } catch {
    return new TextDecoder("utf-8").decode(new Uint8Array(bytes));
  }
}

/** Parse a VMD binary file into bone and morph keyframes */
function parseVMD(buffer: ArrayBuffer): { bones: VMDBoneFrame[]; morphs: VMDMorphFrame[] } {
  const view = new DataView(buffer);
  let offset = 0;

  // Header: 30 bytes
  offset += 30;
  // Model name: 20 bytes
  offset += 20;

  // Bone keyframes
  const boneCount = view.getUint32(offset, true);
  offset += 4;

  const bones: VMDBoneFrame[] = [];
  for (let i = 0; i < boneCount; i++) {
    const boneName = readSJISString(view, offset, 15);
    offset += 15;
    const frameNum = view.getUint32(offset, true);
    offset += 4;
    offset += 12; // skip position xyz (3 * float32)
    const rx = view.getFloat32(offset, true); offset += 4;
    const ry = view.getFloat32(offset, true); offset += 4;
    const rz = view.getFloat32(offset, true); offset += 4;
    const rw = view.getFloat32(offset, true); offset += 4;
    offset += 64; // interpolation data

    bones.push({
      boneName,
      frameNum,
      rotation: new THREE.Quaternion(rx, ry, rz, rw),
    });
  }

  // Morph keyframes
  const morphs: VMDMorphFrame[] = [];
  if (offset + 4 <= buffer.byteLength) {
    const morphCount = view.getUint32(offset, true);
    offset += 4;

    for (let i = 0; i < morphCount; i++) {
      if (offset + 23 > buffer.byteLength) break;
      const morphName = readSJISString(view, offset, 15);
      offset += 15;
      const frameNum = view.getUint32(offset, true);
      offset += 4;
      const weight = view.getFloat32(offset, true);
      offset += 4;

      morphs.push({ morphName, frameNum, weight });
    }
  }

  return { bones, morphs };
}

const MMD_FPS = 30; // VMD files use 30fps frame numbers

/**
 * Load a VMD file and create a Three.js AnimationClip mapped to VRM bones.
 * Returns the clip and a separate morph track map for expression application.
 */
export async function loadVMDAnimation(
  url: string,
  vrm: VRM,
): Promise<{ clip: THREE.AnimationClip; morphTracks: Map<string, { times: Float32Array; values: Float32Array }> }> {
  const resp = await fetch(url);
  const buffer = await resp.arrayBuffer();
  const { bones, morphs } = parseVMD(buffer);

  console.log(`[VMD] Parsed ${bones.length} bone frames, ${morphs.length} morph frames from ${url}`);

  // Group bone frames by bone name
  const boneGroups = new Map<string, VMDBoneFrame[]>();
  for (const frame of bones) {
    if (!boneGroups.has(frame.boneName)) boneGroups.set(frame.boneName, []);
    boneGroups.get(frame.boneName)!.push(frame);
  }

  const tracks: THREE.KeyframeTrack[] = [];

  for (const [mmdName, frames] of boneGroups) {
    const vrmBoneName = MMD_TO_VRM_BONE[mmdName];
    if (!vrmBoneName) continue;

    const boneNode = vrm.humanoid?.getNormalizedBoneNode(vrmBoneName);
    if (!boneNode) continue;

    // Sort by frame number
    frames.sort((a, b) => a.frameNum - b.frameNum);

    const times = new Float32Array(frames.length);
    const rotValues = new Float32Array(frames.length * 4);

    for (let i = 0; i < frames.length; i++) {
      const f = frames[i];
      times[i] = f.frameNum / MMD_FPS;

      // MMD uses left-handed coords; VRM uses right-handed
      // Flip X and Z rotation for handedness conversion
      rotValues[i * 4 + 0] = -f.rotation.x;
      rotValues[i * 4 + 1] = f.rotation.y;
      rotValues[i * 4 + 2] = -f.rotation.z;
      rotValues[i * 4 + 3] = f.rotation.w;
    }

    // Rotation track only -- skip position tracks to keep characters in place
    tracks.push(new THREE.QuaternionKeyframeTrack(
      `${boneNode.name}.quaternion`,
      Array.from(times),
      Array.from(rotValues),
    ));
  }

  // Group morph frames
  const morphGroups = new Map<string, VMDMorphFrame[]>();
  for (const frame of morphs) {
    if (!morphGroups.has(frame.morphName)) morphGroups.set(frame.morphName, []);
    morphGroups.get(frame.morphName)!.push(frame);
  }

  const morphTracks = new Map<string, { times: Float32Array; values: Float32Array }>();
  for (const [mmdName, frames] of morphGroups) {
    const vrmExpr = MMD_TO_VRM_EXPRESSION[mmdName];
    if (!vrmExpr) continue;

    frames.sort((a, b) => a.frameNum - b.frameNum);
    const times = new Float32Array(frames.length);
    const values = new Float32Array(frames.length);

    for (let i = 0; i < frames.length; i++) {
      times[i] = frames[i].frameNum / MMD_FPS;
      values[i] = frames[i].weight;
    }

    morphTracks.set(vrmExpr, { times, values });
  }

  let maxFrame = 0;
  for (const b of bones) {
    if (b.frameNum > maxFrame) maxFrame = b.frameNum;
  }
  const duration = maxFrame / MMD_FPS;

  const clip = new THREE.AnimationClip("vmd_dance", duration, tracks);
  console.log(`[VMD] Created clip: ${tracks.length} tracks, ${duration.toFixed(1)}s`);

  return { clip, morphTracks };
}
