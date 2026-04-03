import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { VRMLoaderPlugin, VRM, VRMExpressionPresetName, VRMHumanBoneName } from "@pixiv/three-vrm";
import { loadMMDCharacter, type MMDCharacter } from "./MMDDanceLoader";
import type { Lane } from "../types/game";
import type { StageManager } from "./StageManager";
/** Linear interpolation sample from a keyframe track */
function sampleTrack(times: Float32Array, values: Float32Array, t: number): number {
  if (times.length === 0) return 0;
  if (t <= times[0]) return values[0];
  if (t >= times[times.length - 1]) return values[values.length - 1];
  for (let i = 0; i < times.length - 1; i++) {
    if (t >= times[i] && t < times[i + 1]) {
      const alpha = (t - times[i]) / (times[i + 1] - times[i]);
      return values[i] + (values[i + 1] - values[i]) * alpha;
    }
  }
  return values[values.length - 1];
}

/** Dramatic sing poses per lane - arm angles are offsets from idle (arms-down) position */
const SING_POSES: Record<Lane, {
  headX: number; headZ: number;
  armAngle: number; side: "left" | "right" | "both";
  spineX: number; spineZ: number;
}> = {
  0: { headX: 0,    headZ: 0.3,  armAngle: -1.4, side: "left",  spineX: 0,    spineZ: 0.1  }, // left: lean left, left arm up
  1: { headX: 0.25, headZ: 0,    armAngle: -0.6, side: "both",  spineX: 0.1,  spineZ: 0    }, // down: nod down, arms out
  2: { headX: -0.2, headZ: 0,    armAngle: -1.6, side: "both",  spineX: -0.1, spineZ: 0    }, // up: look up, both arms raised
  3: { headX: 0,    headZ: -0.3, armAngle: -1.4, side: "right", spineX: 0,    spineZ: -0.1 }, // right: lean right, right arm up
};

interface CharacterState {
  vrm: VRM;
  currentPose: Lane | null;
  poseTimer: number;
  idleBob: number;
  // VMD dance animation
  mixer: THREE.AnimationMixer | null;
  danceAction: THREE.AnimationAction | null;
  morphTracks: Map<string, { times: Float32Array; values: Float32Array }> | null;
  hasDance: boolean;
}

/**
 * Manages VRM character models and owns the shared WebGL renderer.
 * Renders stage scene (background) then character scene (foreground)
 * in a single pass using autoClear control.
 */
export class VRMManager {
  private renderer: THREE.WebGLRenderer;
  private charScene: THREE.Scene;
  private charCamera: THREE.PerspectiveCamera;
  private clock = new THREE.Clock();
  private loader: GLTFLoader;
  private stageManager: StageManager | null = null;

  private characters = new Map<string, CharacterState>();
  private mmdCharacters = new Map<string, MMDCharacter>();

  // Fade overlay (for stage crossfade)
  private fadeQuad: THREE.Mesh | null = null;
  private fadeScene: THREE.Scene;
  private fadeCamera: THREE.OrthographicCamera;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.autoClear = false;

    // Character scene (foreground, transparent background)
    this.charScene = new THREE.Scene();

    this.charCamera = new THREE.PerspectiveCamera(25, 1, 1, 10000);
    this.charCamera.position.set(0, 15, 50);
    this.charCamera.lookAt(0, 1, 0);

    // Character lighting -- even on both sides for MMD toon materials
    const ambient = new THREE.AmbientLight(0xffffff, 1.8);
    this.charScene.add(ambient);

    const front = new THREE.DirectionalLight(0xffffff, 1.5);
    front.position.set(0, 2, 5);
    this.charScene.add(front);

    // Fade overlay scene (full-screen black quad for crossfade)
    this.fadeScene = new THREE.Scene();
    this.fadeCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const fadeGeo = new THREE.PlaneGeometry(2, 2);
    const fadeMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0,
      depthTest: false,
    });
    this.fadeQuad = new THREE.Mesh(fadeGeo, fadeMat);
    this.fadeScene.add(this.fadeQuad);

    // VRM loader
    this.loader = new GLTFLoader();
    this.loader.register((parser) => new VRMLoaderPlugin(parser));
  }

  setStageManager(stage: StageManager): void {
    this.stageManager = stage;
  }

  resize(width: number, height: number): void {
    this.renderer.setSize(width, height);
    this.charCamera.aspect = width / height;
    this.charCamera.updateProjectionMatrix();
    this.stageManager?.updateAspect(width / height);
  }

  async loadCharacter(id: string, url: string, position: THREE.Vector3): Promise<void> {
    const gltf = await this.loader.loadAsync(url);
    const vrm = gltf.userData.vrm as VRM;

    vrm.scene.position.copy(position);
    vrm.scene.rotation.y = Math.PI; // face camera
    this.charScene.add(vrm.scene);

    this.characters.set(id, {
      vrm,
      currentPose: null,
      poseTimer: 0,
      idleBob: Math.random() * Math.PI * 2,
      mixer: null,
      danceAction: null,
      morphTracks: null,
      hasDance: false,
    });
  }

  getCharacter(id: string): VRM | null {
    return this.characters.get(id)?.vrm ?? null;
  }

  /** Load a PMX model with VMD dance animation (native MMD, no retargeting) */
  async loadMMDCharacter(
    id: string,
    pmxUrl: string,
    vmdUrls: string[],
    position: THREE.Vector3,
    nativeScale = false,
  ): Promise<void> {
    const mmd = await loadMMDCharacter(pmxUrl, vmdUrls);

    if (!nativeScale) {
      mmd.mesh.scale.setScalar(0.08);
    }
    mmd.mesh.position.copy(position);

    this.charScene.add(mmd.mesh);
    this.mmdCharacters.set(id, mmd);
    console.log(`[VRM] MMD character "${id}" loaded, nativeScale=${nativeScale}`);
  }

  /** Apply a pre-built AnimationClip as the dance for a character */
  applyDance(characterId: string, clip: THREE.AnimationClip): void {
    const char = this.characters.get(characterId);
    if (!char) return;

    const mixer = new THREE.AnimationMixer(char.vrm.scene);
    const action = mixer.clipAction(clip);
    action.play();

    char.mixer = mixer;
    char.danceAction = action;
    char.hasDance = true;
    char.morphTracks = null;

    console.log(`[VRM] Dance applied to ${characterId}, ${clip.tracks.length} tracks, ${clip.duration.toFixed(1)}s`);
  }

  /** Start all dance animations from a given time offset */
  startDances(offsetSeconds = 0): void {
    for (const [, char] of this.characters) {
      if (char.mixer && char.danceAction) {
        char.mixer.setTime(offsetSeconds);
      }
    }
  }

  triggerSing(characterId: string, lane: Lane): void {
    if (this.mmdCharacters.has(characterId)) return; // MMD characters have their own dance
    const char = this.characters.get(characterId);
    if (!char || char.hasDance) return;
    char.currentPose = lane;
    char.poseTimer = 450; // hold pose longer so it's visible
  }

  update(dt: number): void {
    const delta = this.clock.getDelta();

    // Update MMD characters (native animation, no manual poses)
    for (const [, mmd] of this.mmdCharacters) {
      mmd.helper.update(delta);
    }

    // Update camera animation if present
    if (this._cameraHelper) {
      this._cameraHelper.update(delta);
    }

    // Update stage crossfade
    this.stageManager?.update(dt);

    // Update fade overlay opacity
    if (this.fadeQuad && this.stageManager) {
      const mat = this.fadeQuad.material as THREE.MeshBasicMaterial;
      mat.opacity = 1 - this.stageManager.fadeOpacity;
      this.fadeQuad.visible = mat.opacity > 0.01;
    }

    for (const [, char] of this.characters) {
      const { vrm } = char;

      // If this character has a VMD dance, advance the mixer and apply morph tracks
      if (char.hasDance && char.mixer) {
        char.mixer.update(delta);

        // Apply facial morph tracks manually
        if (char.morphTracks) {
          const time = char.mixer.time;
          for (const [exprName, track] of char.morphTracks) {
            const value = sampleTrack(track.times, track.values, time);
            vrm.expressionManager?.setValue(exprName, value);
          }
        }

        vrm.update(delta);
        continue; // skip manual pose logic
      }

      if (char.poseTimer > 0) {
        char.poseTimer -= dt;
        if (char.poseTimer <= 0) char.currentPose = null;
      }

      char.idleBob += delta * 2.5;

      // Idle arm-down targets (VRM rest = T-pose at z=0; positive z = left arm down, negative = right arm down)
      const IDLE_LEFT_ARM_Z = 1.2;
      const IDLE_RIGHT_ARM_Z = -1.2;

      const humanoid = vrm.humanoid;
      if (!humanoid) continue;

      if (char.currentPose !== null) {
        const pose = SING_POSES[char.currentPose];
        const lerpSpeed = 0.4; // fast snap into pose

        // Head movement
        const head = humanoid.getNormalizedBoneNode(VRMHumanBoneName.Head);
        if (head) {
          head.rotation.x = THREE.MathUtils.lerp(head.rotation.x, pose.headX, lerpSpeed);
          head.rotation.z = THREE.MathUtils.lerp(head.rotation.z, pose.headZ, lerpSpeed);
        }

        // Spine lean
        const spine = humanoid.getNormalizedBoneNode(VRMHumanBoneName.Spine);
        if (spine) {
          spine.rotation.x = THREE.MathUtils.lerp(spine.rotation.x, pose.spineX, lerpSpeed);
          spine.rotation.z = THREE.MathUtils.lerp(spine.rotation.z, pose.spineZ, lerpSpeed);
        }

        // Arms - offset from idle arms-down position
        const leftArm = humanoid.getNormalizedBoneNode(VRMHumanBoneName.LeftUpperArm);
        const rightArm = humanoid.getNormalizedBoneNode(VRMHumanBoneName.RightUpperArm);

        if (pose.side === "left" || pose.side === "both") {
          if (leftArm) leftArm.rotation.z = THREE.MathUtils.lerp(leftArm.rotation.z, IDLE_LEFT_ARM_Z + pose.armAngle, lerpSpeed);
        } else {
          if (leftArm) leftArm.rotation.z = THREE.MathUtils.lerp(leftArm.rotation.z, IDLE_LEFT_ARM_Z, 0.15);
        }

        if (pose.side === "right" || pose.side === "both") {
          if (rightArm) rightArm.rotation.z = THREE.MathUtils.lerp(rightArm.rotation.z, IDLE_RIGHT_ARM_Z - pose.armAngle, lerpSpeed);
        } else {
          if (rightArm) rightArm.rotation.z = THREE.MathUtils.lerp(rightArm.rotation.z, IDLE_RIGHT_ARM_Z, 0.15);
        }

        // Open mouth
        vrm.expressionManager?.setValue(VRMExpressionPresetName.Aa, 0.8);
      } else {
        // Idle: arms down, gentle body sway
        const bobHead = Math.sin(char.idleBob) * 0.04;
        const bobSway = Math.sin(char.idleBob * 0.7) * 0.02;

        const head = humanoid.getNormalizedBoneNode(VRMHumanBoneName.Head);
        if (head) {
          head.rotation.x = THREE.MathUtils.lerp(head.rotation.x, bobHead, 0.1);
          head.rotation.y = THREE.MathUtils.lerp(head.rotation.y, bobSway, 0.1);
          head.rotation.z = THREE.MathUtils.lerp(head.rotation.z, 0, 0.1);
        }

        const spine = humanoid.getNormalizedBoneNode(VRMHumanBoneName.Spine);
        if (spine) {
          spine.rotation.x = THREE.MathUtils.lerp(spine.rotation.x, Math.sin(char.idleBob * 0.5) * 0.015, 0.1);
          spine.rotation.z = THREE.MathUtils.lerp(spine.rotation.z, 0, 0.1);
        }

        const leftArm = humanoid.getNormalizedBoneNode(VRMHumanBoneName.LeftUpperArm);
        const rightArm = humanoid.getNormalizedBoneNode(VRMHumanBoneName.RightUpperArm);
        if (leftArm) leftArm.rotation.z = THREE.MathUtils.lerp(leftArm.rotation.z, IDLE_LEFT_ARM_Z, 0.1);
        if (rightArm) rightArm.rotation.z = THREE.MathUtils.lerp(rightArm.rotation.z, IDLE_RIGHT_ARM_Z, 0.1);

        vrm.expressionManager?.setValue(VRMExpressionPresetName.Aa, 0);

        const blinkCycle = (Math.sin(char.idleBob * 1.5) + 1) / 2;
        vrm.expressionManager?.setValue(VRMExpressionPresetName.Blink, blinkCycle > 0.97 ? 1 : 0);
      }

      vrm.update(delta);
    }
  }

  /** Render pipeline: stage (bg) → characters (fg) → fade overlay */
  render(): void {
    this.renderer.clear();

    // 1. Render stage background (if available)
    if (this.stageManager?.hasStages) {
      this.renderer.render(this.stageManager.scene, this.stageManager.camera);
    }

    // 2. Render characters on top (depth buffer cleared so characters always show)
    if (this.characters.size > 0 || this.mmdCharacters.size > 0) {
      this.renderer.clearDepth();
      this.renderer.render(this.charScene, this.charCamera);
    }

    // 3. Render fade overlay (for stage crossfade)
    if (this.fadeQuad?.visible) {
      this.renderer.clearDepth();
      this.renderer.render(this.fadeScene, this.fadeCamera);
    }
  }

  /** Load a PMX stage (static, no animation) */
  async loadMMDStage(pmxUrl: string, nativeScale = false): Promise<void> {
    const { MMDLoader } = await import("three-stdlib");
    const loader = new MMDLoader();
    const mesh = await new Promise<THREE.SkinnedMesh>((resolve, reject) => {
      loader.load(pmxUrl, (m: any) => resolve(m), undefined, reject);
    });
    if (!nativeScale) {
      mesh.scale.setScalar(0.08);
      mesh.position.set(0, 0, -1);
    }
    this.charScene.add(mesh);
    console.log(`[VRM] MMD stage loaded: ${pmxUrl}, nativeScale=${nativeScale}`);
  }

  /** Load a VMD camera animation */
  async loadMMDCamera(vmdUrl: string): Promise<void> {
    const { MMDLoader, MMDAnimationHelper } = await import("three-stdlib");
    const loader = new MMDLoader();

    const vmd = await new Promise<any>((resolve, reject) => {
      loader.loadVMD(vmdUrl, resolve, undefined, reject);
    });

    // Create a camera animation helper
    const cameraHelper = new MMDAnimationHelper({ afterglow: 0 });
    const animation = (loader as any).animationBuilder.buildCameraAnimation(vmd);
    cameraHelper.add(this.charCamera as any, { animation, physics: false });

    // Store the helper to update each frame
    this._cameraHelper = cameraHelper;
    console.log(`[VRM] Camera VMD loaded: ${vmdUrl}`);
  }

  private _cameraHelper: any = null;

  setCameraMMD(): void {
    // Native MMD scale: character ~20 units tall
    this.charCamera.near = 1;
    this.charCamera.far = 10000;
    this.charCamera.position.set(0, 12, 45);
    this.charCamera.lookAt(0, 10, 0);
    this.charCamera.fov = 30;
    this.charCamera.updateProjectionMatrix();
  }

  setCameraSolo(): void {
    this.charCamera.near = 0.1;
    this.charCamera.far = 100;
    this.charCamera.position.set(0, 1.0, 3.5);
    this.charCamera.lookAt(0, 0.8, 0);
    this.charCamera.fov = 35;
    this.charCamera.updateProjectionMatrix();
  }

  setCameraDual(): void {
    this.charCamera.near = 0.1;
    this.charCamera.far = 100;
    this.charCamera.position.set(0, 0.9, 5.5);
    this.charCamera.lookAt(0, 0.7, 0);
    this.charCamera.fov = 35;
    this.charCamera.updateProjectionMatrix();
  }

  dispose(): void {
    for (const [, char] of this.characters) {
      this.charScene.remove(char.vrm.scene);
      char.vrm.scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
          else obj.material.dispose();
        }
      });
    }
    this.characters.clear();
    this.stageManager?.dispose();
    this.renderer.dispose();
  }
}
