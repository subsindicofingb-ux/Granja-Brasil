import sharp from "sharp";

const MAX_WIDTH = 400;
const MAX_HEIGHT = 400;
const MAX_BYTES = 70_000;
const DIMENSION_STEPS = [400, 320, 240] as const;
const QUALITY_STEPS = [80, 70, 60, 50, 40, 30] as const;

export async function normalizePhotoForControlId(bytes: Buffer): Promise<Buffer> {
  let lastOutput: Buffer | null = null;

  for (const maxSize of DIMENSION_STEPS) {
    let output = await sharp(bytes)
      .rotate()
      .resize(maxSize, maxSize, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({
        quality: QUALITY_STEPS[0],
        mozjpeg: true,
      })
      .toBuffer();

    for (const quality of QUALITY_STEPS) {
      if (quality !== QUALITY_STEPS[0]) {
        output = await sharp(output).jpeg({ quality, mozjpeg: true }).toBuffer();
      }

      lastOutput = output;

      if (output.length <= MAX_BYTES) {
        return output;
      }
    }
  }

  if (lastOutput && lastOutput.length <= 1_000_000) {
    return lastOutput;
  }

  throw new Error(
    "Foto muito grande para o ControlID mesmo após compressão. Use uma imagem menor ou mais nítida.",
  );
}
