import { parentPort, workerData } from 'node:worker_threads';
import path from 'node:path';
import { createCanvas, DOMMatrix, Path2D } from '@napi-rs/canvas';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.js';

// pdfjs expects browser globals and falls back to require("canvas") — a
// package we don't ship — when they're missing. Provide them from @napi-rs.
(globalThis as any).DOMMatrix ??= DOMMatrix;
(globalThis as any).Path2D ??= Path2D;

// Define a custom canvas factory for pdfjs in Node
class NodeCanvasFactory {
  create(width: number, height: number) {
    const canvas = createCanvas(width, height);
    const context = canvas.getContext('2d');
    return {
      canvas,
      context,
    };
  }

  reset(canvasAndContext: any, width: number, height: number) {
    canvasAndContext.canvas.width = width;
    canvasAndContext.canvas.height = height;
  }

  destroy(canvasAndContext: any) {
    canvasAndContext.canvas.width = 0;
    canvasAndContext.canvas.height = 0;
    canvasAndContext.canvas = null;
    canvasAndContext.context = null;
  }
}

export type PdfConversionMessage =
  | { type: 'start', numPages: number }
  | { type: 'page', pageNumber: number, buffer: Buffer }
  | { type: 'complete' }

export async function convertPdfToImages(
  pdfBuffer: Uint8Array,
  emit: (message: PdfConversionMessage) => void,
): Promise<void> {
  const standardFontDataUrl = path.join(process.cwd(), 'node_modules/pdfjs-dist/standard_fonts/');
  const canvasFactory = new NodeCanvasFactory();

  const loadingTask = pdfjsLib.getDocument({
    data: pdfBuffer,
    // Disable font face because we don't have DOM
    disableFontFace: true,
    standardFontDataUrl: standardFontDataUrl,
    // pdfjs only honors the canvasFactory passed here; the one given to
    // page.render() is ignored, and the default requires the "canvas" package.
    canvasFactory,
  });

  const pdfDocument = await loadingTask.promise;
  const numPages = pdfDocument.numPages;

  emit({ type: 'start', numPages });

  for (let i = 1; i <= numPages; i++) {
    const page = await pdfDocument.getPage(i);
    
    // Use 150 DPI roughly. Default scale 1.0 is 72 DPI. 
    // 150 / 72 = ~2.08 scale
    const viewport = page.getViewport({ scale: 2.08 });
    
    const canvasAndContext = canvasFactory.create(viewport.width, viewport.height);
    
    const renderContext = {
      canvasContext: canvasAndContext.context as any,
      viewport,
      canvasFactory,
    };

    await page.render(renderContext).promise;
    
    // Encode as JPEG (85% quality by default in napi-rs/canvas if we don't specify, or we can just use 'jpeg')
    const jpegBuffer = await canvasAndContext.canvas.encode('jpeg');
    emit({ type: 'page', pageNumber: i, buffer: jpegBuffer });
    
    canvasFactory.destroy(canvasAndContext);
    
    // Clean up page resources
    page.cleanup();
  }

  // Clean up document resources
  await pdfDocument.destroy();
  
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
