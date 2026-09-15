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
  | { type: 'page', pageNumber: number, buffer: Uint8Array, width?: number, height?: number }
  | { type: 'complete' }

export async function convertPdfToImages(
  pdfBuffer: Uint8Array,
  emit: (message: PdfConversionMessage) => void | Promise<void>,
  pdfJsLoader: () => Promise<PdfJs> = loadPdfJs,
): Promise<void> {
  const pdfjsLib = await pdfJsLoader();
  const pdfjsRoot = path.dirname(require.resolve('pdfjs-dist/package.json'));
  const standardFontDataUrl = path.join(pdfjsRoot, 'standard_fonts/');

  // PDF.js may pass the input through a Node worker. A Buffer-backed view can
  // fail Node's structured-clone transfer on some PDFs/Node versions, so give
  // it an ordinary standalone Uint8Array with its own ArrayBuffer.
  const pdfData = new Uint8Array(pdfBuffer.byteLength)
  pdfData.set(pdfBuffer)
  const loadingTask = pdfjsLib.getDocument({
    data: pdfData,
    // Disable font face because we don't have DOM
    disableFontFace: true,
    standardFontDataUrl: standardFontDataUrl,
  });

  const pdfDocument = await loadingTask.promise;
  const numPages = pdfDocument.numPages;

  await emit({ type: 'start', numPages });

  for (let i = 1; i <= numPages; i++) {
    const page = await pdfDocument.getPage(i);
    
    // Use roughly 150 DPI, but cap the raster size so one large page cannot
    // exhaust the API worker's memory.
    const baseScale = 2.08;
    const naturalViewport = page.getViewport({ scale: 1 });
    const maxPixels = 2_000_000;
    const scale = Math.min(baseScale, Math.sqrt(maxPixels / (naturalViewport.width * naturalViewport.height)));
    const viewport = page.getViewport({ scale: Math.max(0.5, scale) });
    
    const canvas = createCanvas(viewport.width, viewport.height);
    
    const renderContext = {
      canvas: canvas as any,
      viewport,
    };

    await page.render(renderContext).promise;
    
    // Encode as JPEG (85% quality by default in napi-rs/canvas if we don't specify, or we can just use 'jpeg')
    const jpegBuffer = await canvas.encode('jpeg');
    const jpegData = new Uint8Array(jpegBuffer.byteLength)
    jpegData.set(jpegBuffer)
    await emit({ type: 'page', pageNumber: i, buffer: jpegData, width: viewport.width, height: viewport.height });
    
    // Clean up page resources
    page.cleanup();
  }

  // Clean up document resources
  await loadingTask.destroy();
  
  await emit({ type: 'complete' });
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
