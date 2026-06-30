import sharp from "sharp";

const MAX_DIMENSION = 800;
const MAX_BYTES = 900_000;

export async function normalizePhotoForControlId(bytes: Buffer): Promise<Buffer> {
  let output = await sharp(bytes)
    .rotate()
    .resize(MAX_DIMENSION, MAX_DIMENSION, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({
      quality: 85,
      mozjpeg: true,
    })
    .toBuffer();

  if (output.length > MAX_BYTES) {
    output = await sharp(output).jpeg({ quality: 70, mozjpeg: true }).toBuffer();
  }

  if (output.length > MAX_BYTES) {
    throw new Error(
      "Foto muito grande para o ControlID mesmo após compressão. Use uma imagem menor.",
    );
  }

  return output;
}
