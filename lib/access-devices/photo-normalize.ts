import sharp from "sharp";

const MAX_WIDTH = 400;
const MAX_HEIGHT = 400;
const MAX_BYTES = 70_000;

export async function normalizePhotoForControlId(bytes: Buffer): Promise<Buffer> {
  let output = await sharp(bytes)
    .rotate()
    .resize(MAX_WIDTH, MAX_HEIGHT, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({
      quality: 80,
      mozjpeg: true,
    })
    .toBuffer();

  for (const quality of [70, 60, 50]) {
    if (output.length <= MAX_BYTES) {
      break;
    }

    output = await sharp(output).jpeg({ quality, mozjpeg: true }).toBuffer();
  }

  if (output.length > MAX_BYTES) {
    throw new Error(
      "Foto muito grande para o ControlID mesmo após compressão. Use uma imagem menor.",
    );
  }

  return output;
}
