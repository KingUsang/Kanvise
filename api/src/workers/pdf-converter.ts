import { parentPort, workerData } from 'node:worker_threads';
import path from 'node:path';
import { createCanvas } from '@napi-rs/canvas';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.js';

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

async function convertPdfToImages(pdfBuffer: Uint8Array): Promise<void> {
  const standardFontDataUrl = path.join(process.cwd(), 'node_modules/pdfjs-dist/standard_fonts/');

  const loadingTask = pdfjsLib.getDocument({
    data: pdfBuffer,
    // Disable font face because we don't have DOM
    disableFontFace: true,
    standardFontDataUrl: standardFontDataUrl,
  });

  const pdfDocument = await loadingTask.promise;
  const numPages = pdfDocument.numPages;
  const canvasFactory = new NodeCanvasFactory();

  parentPort!.postMessage({ type: 'start', numPages });

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
    parentPort!.postMessage({ type: 'page', pageNumber: i, buffer: jpegBuffer });
    
    canvasFactory.destroy(canvasAndContext);
    
    // Clean up page resources
    page.cleanup();
  }

  // Clean up document resources
  await pdfDocument.destroy();
  
  parentPort!.postMessage({ type: 'complete' });
}

if (!parentPort) {
  throw new Error('This file must be run as a worker thread.');
}

// The worker entry point
(async () => {
  try {
    const { pdfBuffer } = workerData;
    await convertPdfToImages(new Uint8Array(pdfBuffer));
  } catch (error: any) {
    console.error('[pdf-converter worker] error:', error);
    parentPort!.postMessage({ type: 'error', error: error.message });
  }
})();
