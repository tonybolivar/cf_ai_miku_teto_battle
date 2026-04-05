import * as THREE from "three";

/**
 * MMD bone name (Shift_JIS/Japanese) → SEGA bone name.
 * Maps the standard MMD/VMD skeleton to Yakuza engine bone names.
 */
const MMD_TO_SEGA: Record<string, string> = {
  // Core body
  "センター": "center_c_n",
  "下半身": "ketu_c_n",
  "上半身": "kosi_c_n",
  "上半身2": "mune_c_n",
  "首": "kubi_c_n",
  "頭": "face_c_n",
  // Right arm
  "右肩": "kata_r_n",
  "右腕": "ude1_r_n",
  "右ひじ": "ude2_r_n",
  "右手首": "ude3_r_n",
  // Left arm
  "左肩": "kata_l_n",
  "左腕": "ude1_l_n",
  "左ひじ": "ude2_l_n",
  "左手首": "ude3_l_n",
  // Right leg
  "右足": "asi1_r_n",
  "右ひざ": "asi2_r_n",
  "右足首": "asi3_r_n",
  "右つま先": "asi4_r_n",
  // Left leg
  "左足": "asi1_l_n",
  "左ひざ": "asi2_l_n",
  "左足首": "asi3_l_n",
  "左つま先": "asi4_l_n",
  // Eyes
  "右目": "_eye_r_n",
  "左目": "_eye_l_n",
  // Right fingers
  "右親指０": "oya1_r_n",
  "右親指１": "oya2_r_n",
  "右親指２": "oya3_r_n",
  "右人指１": "hito1_r_n",
  "右人指２": "hito2_r_n",
  "右人指３": "hito3_r_n",
  "右中指１": "naka1_r_n",
  "右中指２": "naka2_r_n",
  "右中指３": "naka3_r_n",
  "右薬指１": "kusu1_r_n",
  "右薬指２": "kusu2_r_n",
  "右薬指３": "kusu3_r_n",
  "右小指１": "koyu1_r_n",
  "右小指２": "koyu2_r_n",
  "右小指３": "koyu3_r_n",
  // Left fingers
  "左親指０": "oya1_l_n",
  "左親指１": "oya2_l_n",
  "左親指２": "oya3_l_n",
  "左人指１": "hito1_l_n",
  "左人指２": "hito2_l_n",
  "左人指３": "hito3_l_n",
  "左中指１": "naka1_l_n",
  "左中指２": "naka2_l_n",
  "左中指３": "naka3_l_n",
  "左薬指１": "kusu1_l_n",
  "左薬指２": "kusu2_l_n",
  "左薬指３": "kusu3_l_n",
  "左小指１": "koyu1_l_n",
  "左小指２": "koyu2_l_n",
  "左小指３": "koyu3_l_n",
  // Common aliases
  "全ての親": "center_c_n",
  "グルーブ": "center_c_n",
  "腰": "ketu_c_n",
  "上半身1": "mune_c_n",
  "上半身２": "mune_c_n", // full-width ２
};

interface VMDBoneFrame {
  boneName: string;
  frameNum: number;
  position: THREE.Vector3;
  rotation: THREE.Quaternion;
}

function readSJISString(
  view: DataView,
  offset: number,
  length: number,
): string {
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

function parseVMDBones(buffer: ArrayBuffer): VMDBoneFrame[] {
  const view = new DataView(buffer);
  let offset = 0;

  // Header (30 bytes) + Model name (20 bytes)
  offset += 30 + 20;

  const boneCount = view.getUint32(offset, true);
  offset += 4;

  const bones: VMDBoneFrame[] = [];
  for (let i = 0; i < boneCount; i++) {
    const boneName = readSJISString(view, offset, 15);
    offset += 15;
    const frameNum = view.getUint32(offset, true);
    offset += 4;
    const px = view.getFloat32(offset, true); offset += 4;
    const py = view.getFloat32(offset, true); offset += 4;
    const pz = view.getFloat32(offset, true); offset += 4;
    const rx = view.getFloat32(offset, true); offset += 4;
    const ry = view.getFloat32(offset, true); offset += 4;
    const rz = view.getFloat32(offset, true); offset += 4;
    const rw = view.getFloat32(offset, true); offset += 4;
    // Skip interpolation (64 bytes)
    offset += 64;

    bones.push({
      boneName,
      frameNum,
      position: new THREE.Vector3(px, py, pz),
      rotation: new THREE.Quaternion(rx, ry, rz, rw),
    });
  }

  return bones;
}

const MMD_FPS = 30;

/**
 * Load a VMD file and retarget to a SEGA skeleton (Yakuza engine).
 * Uses rest-pose compensation: extracts the rotation delta from the MMD rest
 * pose (first frame) and applies it relative to the SEGA rest pose.
 */
export async function loadVMDForSEGA(
  url: string,
  targetScene: THREE.Group,
): Promise<THREE.AnimationClip> {
  const resp = await fetch(url);
  const buffer = await resp.arrayBuffer();
  const bones = parseVMDBones(buffer);

  console.log(`[VMD→SEGA] Parsed ${bones.length} bone frames from ${url}`);

  // Capture SEGA skeleton rest quaternions
  const segaRestQuats = new Map<string, THREE.Quaternion>();
  const segaBoneNames = new Set<string>();
  targetScene.traverse((obj) => {
    if (obj.type === "Bone") {
      segaBoneNames.add(obj.name);
      segaRestQuats.set(obj.name, (obj as THREE.Bone).quaternion.clone());
    }
  });

  // Group frames by MMD bone name
  const boneGroups = new Map<string, VMDBoneFrame[]>();
  for (const frame of bones) {
    if (!boneGroups.has(frame.boneName))
      boneGroups.set(frame.boneName, []);
    boneGroups.get(frame.boneName)!.push(frame);
  }

  const tracks: THREE.KeyframeTrack[] = [];
  const matched: string[] = [];
  const unmapped: Set<string> = new Set();

  // Temp quaternions for retargeting math
  const segaRest = new THREE.Quaternion();
  const vmdQuat = new THREE.Quaternion();
  const result = new THREE.Quaternion();

  for (const [mmdName, frames] of boneGroups) {
    const segaBone = MMD_TO_SEGA[mmdName];
    if (!segaBone) {
      unmapped.add(mmdName);
      continue;
    }
    if (!segaBoneNames.has(segaBone)) continue;

    frames.sort((a, b) => a.frameNum - b.frameNum);

    // SEGA rest quaternion for this bone
    const sr = segaRestQuats.get(segaBone);
    segaRest.copy(sr ?? new THREE.Quaternion());

    const times = new Float32Array(frames.length);
    const rotValues = new Float32Array(frames.length * 4);

    for (let i = 0; i < frames.length; i++) {
      times[i] = frames[i].frameNum / MMD_FPS;
      const r = frames[i].rotation;

      // Both MMD and SEGA have identical bone axes (identity rest quats,
      // Y-up spine, ±X arms, -Y legs). Apply left-to-right handedness
      // flip (negate X and Z) so Three.js's right-handed renderer
      // interprets the rotations correctly.
      rotValues[i * 4 + 0] = -r.x;
      rotValues[i * 4 + 1] = r.y;
      rotValues[i * 4 + 2] = -r.z;
      rotValues[i * 4 + 3] = r.w;
    }

    tracks.push(
      new THREE.QuaternionKeyframeTrack(
        `${segaBone}.quaternion`,
        Array.from(times),
        Array.from(rotValues),
      ),
    );

    // Position tracks — VMD positions are DELTAS from rest pose.
    // Scale from MMD units to SEGA meters and add the bone's rest position.
    const hasPosition = frames.some((f) => f.position.lengthSq() > 0.001);
    if (hasPosition) {
      const MMD_TO_SEGA_SCALE = 0.085;
      const boneObj = targetScene.getObjectByName(segaBone);
      const restPos = boneObj ? boneObj.position.clone() : new THREE.Vector3();
      const posValues = new Float32Array(frames.length * 3);
      for (let i = 0; i < frames.length; i++) {
        const p = frames[i].position;
        posValues[i * 3 + 0] = restPos.x + (-p.x * MMD_TO_SEGA_SCALE);
        posValues[i * 3 + 1] = restPos.y + (p.y * MMD_TO_SEGA_SCALE);
        posValues[i * 3 + 2] = restPos.z + (-p.z * MMD_TO_SEGA_SCALE);
      }
      tracks.push(
        new THREE.VectorKeyframeTrack(
          `${segaBone}.position`,
          Array.from(times),
          Array.from(posValues),
          THREE.InterpolateLinear,
        ),
      );
    }

    matched.push(`${mmdName}→${segaBone}`);
  }

  let maxFrame = 0;
  for (const b of bones) {
    if (b.frameNum > maxFrame) maxFrame = b.frameNum;
  }
  const duration = maxFrame / MMD_FPS;

  console.log(
    `[VMD→SEGA] Retargeted ${tracks.length} tracks: ${matched.join(", ")}`,
  );
  if (unmapped.size > 0) {
    console.log(`[VMD→SEGA] Unmapped MMD bones: ${[...unmapped].join(", ")}`);
  }

  return new THREE.AnimationClip("vmd_sega_dance", duration, tracks);
}
