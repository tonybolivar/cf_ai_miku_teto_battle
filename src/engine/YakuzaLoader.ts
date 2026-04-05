import * as THREE from "three";
import { DDSLoader } from "three-stdlib";
import { GMDLoader } from "@three-yakuza/three-gmd";
import { parsePAR, extractFile } from "@three-yakuza/par-parser";

export interface YakuzaModel {
  scene: THREE.Group;
}

function loadDDSFromPAR(
  parBuffer: ArrayBuffer,
  target?: Map<string, THREE.Texture>,
): Map<string, THREE.Texture> {
  const result = target ?? new Map<string, THREE.Texture>();
  const archive = parsePAR(parBuffer);
  const ddsLoader = new DDSLoader();

  for (const file of archive.files) {
    if (!file.name.endsWith(".dds")) continue;
    try {
      const data = extractFile(parBuffer, file);
      const buf = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
      const texData = (ddsLoader as any).parse(buf, false);

      const texture = new THREE.CompressedTexture(
        texData.mipmaps, texData.width, texData.height, texData.format,
      );
      texture.mipmaps = texData.mipmaps;
      texture.minFilter = texData.mipmaps.length > 1
        ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;

      if (file.name.toLowerCase().includes("_di")) {
        texture.colorSpace = THREE.SRGBColorSpace;
      }

      texture.needsUpdate = true;
      const baseName = file.name.replace(/\.dds$/i, "").toLowerCase();
      result.set(baseName, texture);
    } catch {
      // Skip unparseable textures
    }
  }

  return result;
}

export async function loadYakuzaModel(
  meshParUrl: string,
  commonTexParUrl: string,
): Promise<YakuzaModel> {
  const [meshBuf, commonBuf] = await Promise.all([
    fetch(meshParUrl).then((r) => r.arrayBuffer()),
    fetch(commonTexParUrl).then((r) => r.arrayBuffer()),
  ]);

  // Common textures as fallback, character textures override
  const commonTextures = loadDDSFromPAR(commonBuf);
  const charTextures = loadDDSFromPAR(meshBuf);

  const meshArchive = parsePAR(meshBuf);
  const gmdFile = meshArchive.files.find((f) => f.name.endsWith(".gmd"));
  if (!gmdFile) throw new Error("No GMD file found in mesh PAR");

  const gmdData = extractFile(meshBuf, gmdFile);
  const gmdBuf = (gmdData.buffer as ArrayBuffer).slice(
    gmdData.byteOffset,
    gmdData.byteOffset + gmdData.byteLength,
  );

  const gmdLoader = new GMDLoader();
  gmdLoader.setCommonTextures(commonTextures);
  const result = gmdLoader.parse(gmdBuf, charTextures);

  console.log(
    `[Yakuza] Model loaded: ${result.matchedTextures.length} textures, ${result.missingTextures.length} missing`,
  );
  if (result.missingTextures.length > 0) {
    console.log(`[Yakuza] Missing: ${result.missingTextures.join(", ")}`);
  }

  return { scene: result.scene };
}
