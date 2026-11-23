/**
 * Mode Double — version WEB : assemble les deux photos dans un <canvas>
 * (photo arrière en plein cadre, photo avant en vignette en haut à gauche).
 * Même rendu que sur iPhone/Android, où l'assemblage est fait par react-native-view-shot.
 */
const WIDTH = 1080;
const HEIGHT = 1440; // format 3:4

function load(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image_load_failed'));
    img.src = src;
  });
}

/** Dessine l'image en la recadrant pour remplir la zone (équivalent de « cover »). */
function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const sw = w / scale;
  const sh = h / scale;
  const sx = (img.naturalWidth - sw) / 2;
  const sy = (img.naturalHeight - sh) / 2;
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Renvoie l'image assemblée (data-uri JPEG). */
export async function composeDual(mainUri: string, insetUri: string): Promise<string> {
  const [main, inset] = await Promise.all([load(mainUri), load(insetUri)]);
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas_unavailable');

  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  drawCover(ctx, main, 0, 0, WIDTH, HEIGHT);

  const margin = 48;
  const w = Math.round(WIDTH * 0.3);
  const h = Math.round((w * 4) / 3);
  ctx.save();
  roundedRect(ctx, margin, margin, w, h, 28);
  ctx.clip();
  drawCover(ctx, inset, margin, margin, w, h);
  ctx.restore();
  roundedRect(ctx, margin, margin, w, h, 28);
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#000';
  ctx.stroke();

  return canvas.toDataURL('image/jpeg', 0.9);
}
