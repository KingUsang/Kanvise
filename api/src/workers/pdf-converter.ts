import { parentPort, workerData } from 'node:worker_threads';
import path from 'node:path';
import { createCanvas, DOMMatrix, Path2D } from '@napi-rs/canvas';

type PdfJs = typeof import('pdfjs-dist/legacy/build/pdf.mjs');

// The API compiles to CommonJS, while maintained PDF.js releases are ESM-only.
// Constructing the import at runtime preserves native import() instead of
// letting TypeScript rewrite it to require(), which cannot load the ESM build.
const loadPdfJs = new Function(
  'return import("pdfjs-dist/legacy/build/pdf.mjs")',
) as () => Promise<PdfJs>;

// pdfjs expects browser globals and falls back to require("canvas") — a
// package we don't ship — when they're missing. Provide them from @napi-rs.
(globalThis as any).DOMMatrix ??= DOMMatrix;
(globalThis as any).Path2D ??= Path2D;

export type PdfConversionMessage =
  | { type: 'start', numPages: number }
  | { type: 'page', pageNumber: number, buffer: Buffer }
  | { type: 'complete' }

export async function convertPdfToImages(
  pdfBuffer: Uint8Array,
  emit: (message: PdfConversionMessage) => void,
  pdfJsLoader: () => Promise<PdfJs> = loadPdfJs,
): Promise<void> {
  const pdfjsLib = await pdfJsLoader();
  const pdfjsRoot = path.dirname(require.resolve('pdfjs-dist/package.json'));
  const standardFontDataUrl = path.join(pdfjsRoot, 'standard_fonts/');

  const loadingTask = pdfjsLib.getDocument({
    data: pdfBuffer,
    // Disable font face because we don't have DOM
    disableFontFace: true,
    standardFontDataUrl: standardFontDataUrl,
  });

  const pdfDocument = await loadingTask.promise;
  const numPages = pdfDocument.numPages;

  emit({ type: 'start', numPages });

  for (let i = 1; i <= numPages; i++) {
    const page = await pdfDocument.getPage(i);
    
    // Use 150 DPI roughly. Default scale 1.0 is 72 DPI. 
    // 150 / 72 = ~2.08 scale
    const viewport = page.getViewport({ scale: 2.08 });
    
    const canvas = createCanvas(viewport.width, viewport.height);
    
    const renderContext = {
      canvas: canvas as any,
      viewport,
    };

    await page.render(renderContext).promise;
    
    // Encode as JPEG (85% quality by default in napi-rs/canvas if we don't specify, or we can just use 'jpeg')
    const jpegBuffer = await canvas.encode('jpeg');
    emit({ type: 'page', pageNumber: i, buffer: jpegBuffer });
    
    // Clean up page resources
    page.cleanup();
  }

  // Clean up document resources
  await loadingTask.destroy();
  
  emit({ type: 'complete' });
}

// Worker entry point. Importing this module in tests does not execute it.
const workerPort = parentPort
if (workerPort) void (async () => {
  try {
    const { pdfBuffer } = workerData;
    await convertPdfToImages(new Uint8Array(pdfBuffer), message => workerPort.postMessage(message));
  } catch (error: any) {
    console.error('[pdf-converter worker] error:', error);
    workerPort.postMessage({ type: 'error', error: error.message });
  }
})();
