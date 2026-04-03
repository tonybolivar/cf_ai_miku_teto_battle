import * as THREE from "three";
import { MMDLoader, MMDAnimationHelper } from "three-stdlib";

export interface MMDCharacter {
  mesh: THREE.SkinnedMesh;
  helper: MMDAnimationHelper;
}

export async function loadMMDCharacter(
  pmxUrl: string,
  vmdUrls: string[],
): Promise<MMDCharacter> {
  const loader = new MMDLoader();

  let mesh: THREE.SkinnedMesh;
  let animation: THREE.AnimationClip | undefined;

  if (vmdUrls.length > 0) {
    // Load model + first VMD together (proper API that sets up skeleton)
    const result = await new Promise<{ mesh: THREE.SkinnedMesh; animation: THREE.AnimationClip }>((resolve, reject) => {
      loader.loadWithAnimation(
        pmxUrl,
        vmdUrls[0],
        (res: any) => resolve(res),
        undefined,
        reject,
      );
    });
    mesh = result.mesh;
    animation = result.animation;
    console.log(`[MMD] Model + animation loaded: ${mesh.geometry.attributes.position.count} verts`);

    // If there are additional VMDs (e.g. facial), load and merge them
    if (vmdUrls.length > 1) {
      for (let i = 1; i < vmdUrls.length; i++) {
        try {
          const extraAnim = await new Promise<THREE.AnimationClip>((resolve, reject) => {
            loader.loadAnimation(
              vmdUrls[i],
              mesh,
              (clip: any) => resolve(clip as THREE.AnimationClip),
              undefined,
              reject,
            );
          });
          // Merge tracks from extra animation into main clip
          animation = new THREE.AnimationClip(
            animation.name,
            Math.max(animation.duration, extraAnim.duration),
            [...animation.tracks, ...extraAnim.tracks],
          );
          console.log(`[MMD] Merged extra VMD: +${extraAnim.tracks.length} tracks`);
        } catch (e) {
          console.warn(`[MMD] Failed to load extra VMD ${vmdUrls[i]}:`, e);
        }
      }
    }
  } else {
    // Load model only
    mesh = await new Promise<THREE.SkinnedMesh>((resolve, reject) => {
      loader.load(pmxUrl, (m: any) => resolve(m), undefined, reject);
    });
    console.log(`[MMD] Model loaded: ${mesh.geometry.attributes.position.count} verts`);
  }

  const helper = new MMDAnimationHelper({ afterglow: 0 });
  helper.add(mesh, { animation, physics: false });

  return { mesh, helper };
}
