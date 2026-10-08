// Compõe a imagem visual da assinatura do representante em um único PNG
// transparente: traço em cima, identificação embaixo. O mesmo PNG é usado
// no preview e enviado ao backend, evitando divergência visual.
export async function composeStampImage(drawDataUrl: string, stampLines: string[]): Promise<string> {
  try {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return drawDataUrl;
    const draw = await loadImage(drawDataUrl);
    const cropped = trimTransparent(draw);
    const font = '700 30px Manrope, Arial, sans-serif';
    context.font = font;
    const lines = stampLines.map((line) => line.toUpperCase()).filter(Boolean);
    const padding = 16;
    const gap = 24;
    const lineHeight = 36;
    const textWidth = lines.reduce((max, line) => Math.max(max, context.measureText(line).width), 0);
    const drawWidth = Math.min(cropped.width, 640);
    const drawHeight = Math.round(drawWidth * (cropped.height / (cropped.width || 1)));
    canvas.width = Math.ceil(Math.max(textWidth, drawWidth)) + padding * 2;
    canvas.height = drawHeight + gap + lines.length * lineHeight + padding * 2;
    context.drawImage(cropped.canvas, cropped.x, cropped.y, cropped.width, cropped.height, (canvas.width - drawWidth) / 2, padding, drawWidth, drawHeight);
    context.font = font;
    context.fillStyle = '#194d40';
    context.textAlign = 'center';
    context.textBaseline = 'top';
    lines.forEach((line, index) => {
      context.fillText(line, canvas.width / 2, padding + drawHeight + gap + index * lineHeight);
    });
    return canvas.toDataURL('image/png');
  } catch {
    return drawDataUrl;
  }
}

// Recorta as margens transparentes do desenho para que ele centralize de
// verdade com o carimbo (o PNG do pad vem do tamanho do canvas inteiro).
function trimTransparent(image: HTMLImageElement): { canvas: HTMLCanvasElement; x: number; y: number; width: number; height: number } {
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  const probe = document.createElement('canvas');
  probe.width = width;
  probe.height = height;
  const context = probe.getContext('2d');
  if (!context) return { canvas: probe, x: 0, y: 0, width, height };
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, width, height).data;
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (pixels[(y * width + x) * 4 + 3] > 8) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return { canvas: probe, x: 0, y: 0, width, height };
  const margin = 8;
  const x = Math.max(0, minX - margin);
  const y = Math.max(0, minY - margin);
  return { canvas: probe, x, y, width: Math.min(width - x, maxX - x + margin * 2), height: Math.min(height - y, maxY - y + margin * 2) };
}

function loadImage(source: string): Promise<HTMLImageElement> {  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Imagem inválida.'));
    image.src = source;
  });
}
