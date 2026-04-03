import * as THREE from "three";
import { MMDLoader, MMDAnimationHelper } from "three-stdlib";

export interface MMDCharacter {
  mesh: THREE.SkinnedMesh;
  helper: MMDAnimationHelper;
}

/** Fetch a URL, transparently decompressing .gz files */
async function fetchMaybeGz(url: string): Promise<ArrayBuffer> {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Failed to fetch ${url}: ${resp.status}`);
  if (url.endsWith(".gz") && typeof DecompressionStream !== "undefined") {
    const ds = new DecompressionStream("gzip");
    const decompressed = resp.body!.pipeThrough(ds);
    return new Response(decompressed).arrayBuffer();
  }
  return resp.arrayBuffer();
}

export async function loadMMDCharacter(
  pmxUrl: string,
  vmdUrls: string[],
): Promise<MMDCharacter> {
  const loader = new MMDLoader();

  let mesh: THREE.SkinnedMesh;
  let animation: THREE.AnimationClip | undefined;

  // Check if any VMD URLs need decompression (.gz)
  const hasGzVmd = vmdUrls.some((u) => u.endsWith(".gz"));

  if (vmdUrls.length > 0 && !hasGzVmd) {
    // Standard path: load model + first VMD together
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
  } else if (vmdUrls.length > 0) {
    // Compressed VMD path: load model first, then fetch+decompress VMDs and parse manually
    mesh = await new Promise<THREE.SkinnedMesh>((resolve, reject) => {
      loader.load(pmxUrl, (m: any) => resolve(m), undefined, reject);
    });
    console.log(`[MMD] Model loaded: ${mesh.geometry.attributes.position.count} verts`);

    for (let i = 0; i < vmdUrls.length; i++) {
      try {
        const buffer = await fetchMaybeGz(vmdUrls[i]);
        const vmd = (loader as any).parser.parseVmd(buffer, true);
        const clip: THREE.AnimationClip = (loader as any).animationBuilder.build(vmd, mesh);
        if (!animation) {
          animation = clip;
        } else {
          animation = new THREE.AnimationClip(
            animation.name,
            Math.max(animation.duration, clip.duration),
            [...animation.tracks, ...clip.tracks],
          );
        }
        console.log(`[MMD] Loaded VMD (gz): +${clip.tracks.length} tracks from ${vmdUrls[i]}`);
      } catch (e) {
        console.warn(`[MMD] Failed to load VMD ${vmdUrls[i]}:`, e);
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
