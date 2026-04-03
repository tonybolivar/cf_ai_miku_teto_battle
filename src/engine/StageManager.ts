import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { Character } from "../types/game";

interface StageEntry {
  group: THREE.Group;
  loaded: boolean;
}

/**
 * Manages GLB concert environment backgrounds.
 * Owns its own THREE.Scene, separate from VRM characters.
 * Does NOT own a renderer — call getScene() and render externally.
 */
export class StageManager {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  private loader = new GLTFLoader();
  private stages = new Map<Character, StageEntry>();
  private activeStage: Character | null = null;

  // Crossfade state
  private _fadeOpacity = 1;
  private fadeTarget = 1;
  private fading = false;
  private pendingSwap: Character | null = null;

  constructor() {
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 500);
    this.camera.position.set(0, 2, 8);
    this.camera.lookAt(0, 1, 0);

    // Stage lighting
    const ambient = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambient);

    const spot = new THREE.SpotLight(0xffffff, 2, 50, Math.PI / 4);
    spot.position.set(0, 10, 5);
    this.scene.add(spot);

    // Colored concert-style lights
    const blueLight = new THREE.PointLight(0x3399ff, 1.5, 30);
    blueLight.position.set(-5, 6, 2);
    this.scene.add(blueLight);

    const pinkLight = new THREE.PointLight(0xff3399, 1.5, 30);
    pinkLight.position.set(5, 6, 2);
    this.scene.add(pinkLight);

    this.scene.fog = new THREE.FogExp2(0x000000, 0.015);
    this.scene.background = new THREE.Color(0x050510);
  }

  updateAspect(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  async loadStage(character: Character, url: string): Promise<void> {
    const gltf = await this.loader.loadAsync(url);
    const group = gltf.scene;

    // Normalize scale: fit into ~10-unit bounding sphere
    const box = new THREE.Box3().setFromObject(group);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim > 0) {
      const scale = 10 / maxDim;
      group.scale.setScalar(scale);
      group.position.sub(center.multiplyScalar(scale));
    }
    group.position.y = 0;
    group.visible = false;

    this.scene.add(group);
    this.stages.set(character, { group, loaded: true });
  }

  crossfadeTo(character: Character): void {
    if (character === this.activeStage) return;

    const target = this.stages.get(character);
    if (!target?.loaded) {
      this.showStage(character);
      return;
    }

    this.fading = true;
    this.fadeTarget = 0;
    this.pendingSwap = character;
  }

  showStage(character: Character): void {
    for (const [, entry] of this.stages) {
      entry.group.visible = false;
    }
    const target = this.stages.get(character);
    if (target?.loaded) {
      target.group.visible = true;
    }
    this.activeStage = character;
    this._fadeOpacity = 1;
    this.fadeTarget = 1;
    this.fading = false;
  }

  update(dt: number): void {
    if (!this.fading) return;

    const speed = 3;
    const dtSec = dt / 1000;

    if (this._fadeOpacity > this.fadeTarget) {
      this._fadeOpacity = Math.max(0, this._fadeOpacity - speed * dtSec);
      if (this._fadeOpacity <= 0 && this.pendingSwap) {
        this.showStage(this.pendingSwap);
        this._fadeOpacity = 0;
        this.fadeTarget = 1;
        this.pendingSwap = null;
      }
    } else if (this._fadeOpacity < this.fadeTarget) {
      this._fadeOpacity = Math.min(1, this._fadeOpacity + speed * dtSec);
      if (this._fadeOpacity >= 1) {
        this.fading = false;
      }
    }
  }

  get fadeOpacity(): number {
    return this._fadeOpacity;
  }

  get hasStages(): boolean {
    return this.stages.size > 0;
  }

  dispose(): void {
    for (const [, entry] of this.stages) {
      this.scene.remove(entry.group);
      entry.group.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
          else obj.material.dispose();
        }
      });
    }
    this.stages.clear();
  }
}
