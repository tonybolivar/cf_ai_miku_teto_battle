import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { VRMLoaderPlugin, VRM, VRMExpressionPresetName, VRMHumanBoneName } from "@pixiv/three-vrm";
import type { Lane } from "../types/game";
import type { StageManager } from "./StageManager";

/** Arm/head poses for each lane's sing animation */
const SING_POSES: Record<Lane, { headY: number; armAngle: number; side: "left" | "right" | "both" }> = {
  0: { headY: -0.15, armAngle: -0.8, side: "left" },
  1: { headY: -0.2,  armAngle: -0.4, side: "both" },
  2: { headY: 0.2,   armAngle: 0.8,  side: "both" },
  3: { headY: 0.15,  armAngle: 0.8,  side: "right" },
};

interface CharacterState {
  vrm: VRM;
  currentPose: Lane | null;
  poseTimer: number;
  idleBob: number;
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
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.renderer.autoClear = false;

    // Character scene (foreground, transparent background)
    this.charScene = new THREE.Scene();

    this.charCamera = new THREE.PerspectiveCamera(25, 1, 0.1, 100);
    this.charCamera.position.set(0, 1.2, 4);
    this.charCamera.lookAt(0, 1, 0);

    // Character lighting
    const ambient = new THREE.AmbientLight(0xffffff, 0.8);
    this.charScene.add(ambient);

    const key = new THREE.DirectionalLight(0xffffff, 1.5);
    key.position.set(2, 3, 3);
    this.charScene.add(key);

    const fill = new THREE.DirectionalLight(0x8888ff, 0.4);
    fill.position.set(-2, 1, 2);
    this.charScene.add(fill);

    const rim = new THREE.DirectionalLight(0xff88ff, 0.3);
    rim.position.set(0, 2, -2);
    this.charScene.add(rim);

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
    });
  }

  triggerSing(characterId: string, lane: Lane): void {
    const char = this.characters.get(characterId);
    if (!char) return;
    char.currentPose = lane;
    char.poseTimer = 300;
  }

  update(dt: number): void {
    const delta = this.clock.getDelta();

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

        const head = humanoid.getNormalizedBoneNode(VRMHumanBoneName.Head);
        if (head) head.rotation.x = THREE.MathUtils.lerp(head.rotation.x, pose.headY, 0.3);

        const leftArm = humanoid.getNormalizedBoneNode(VRMHumanBoneName.LeftUpperArm);
        const rightArm = humanoid.getNormalizedBoneNode(VRMHumanBoneName.RightUpperArm);

        // Singing poses are relative offsets from the idle arms-down position
        if (pose.side === "left" || pose.side === "both") {
          if (leftArm) leftArm.rotation.z = THREE.MathUtils.lerp(leftArm.rotation.z, IDLE_LEFT_ARM_Z + pose.armAngle, 0.3);
        }
        if (pose.side === "right" || pose.side === "both") {
          if (rightArm) rightArm.rotation.z = THREE.MathUtils.lerp(rightArm.rotation.z, IDLE_RIGHT_ARM_Z - pose.armAngle, 0.3);
        }

        // Keep non-singing arm in idle position
        if (pose.side === "left") {
          if (rightArm) rightArm.rotation.z = THREE.MathUtils.lerp(rightArm.rotation.z, IDLE_RIGHT_ARM_Z, 0.15);
        }
        if (pose.side === "right") {
          if (leftArm) leftArm.rotation.z = THREE.MathUtils.lerp(leftArm.rotation.z, IDLE_LEFT_ARM_Z, 0.15);
        }

        vrm.expressionManager?.setValue(VRMExpressionPresetName.Aa, 0.7);
      } else {
        // Idle: arms down, gentle body sway
        const bobHead = Math.sin(char.idleBob) * 0.04;
        const bobSway = Math.sin(char.idleBob * 0.7) * 0.02;

        const head = humanoid.getNormalizedBoneNode(VRMHumanBoneName.Head);
        if (head) {
          head.rotation.x = THREE.MathUtils.lerp(head.rotation.x, bobHead, 0.1);
          head.rotation.y = THREE.MathUtils.lerp(head.rotation.y, bobSway, 0.1);
        }

        const spine = humanoid.getNormalizedBoneNode(VRMHumanBoneName.Spine);
        if (spine) {
          spine.rotation.x = THREE.MathUtils.lerp(spine.rotation.x, Math.sin(char.idleBob * 0.5) * 0.015, 0.1);
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
    if (this.characters.size > 0) {
      this.renderer.clearDepth();
      this.renderer.render(this.charScene, this.charCamera);
    }

    // 3. Render fade overlay (for stage crossfade)
    if (this.fadeQuad?.visible) {
      this.renderer.clearDepth();
      this.renderer.render(this.fadeScene, this.fadeCamera);
    }
  }

  setCameraDual(): void {
    this.charCamera.position.set(0, 1.2, 5);
    this.charCamera.lookAt(0, 1, 0);
    this.charCamera.fov = 30;
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
