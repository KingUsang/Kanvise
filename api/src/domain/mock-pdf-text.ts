import path from "node:path";
import { DOMMatrix, Path2D } from "@napi-rs/canvas";

type PdfJs = typeof import("pdfjs-dist/legacy/build/pdf.mjs");
const loadPdfJs = new Function("return import('pdfjs-dist/legacy/build/pdf.mjs')") as () => Promise<PdfJs>;

export type ExtractedPdfPage = {
  page_number: number;
  text: string;
  has_embedded_image: boolean;
};

export type ExtractedPdfText = {
  page_count: number;
  pages: ExtractedPdfPage[];
  has_readable_text: boolean;
};

function normaliseText(items: unknown[]): string {
  return items
    .map((item: any) => typeof item?.str === "string" ? item.str : "")
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Read selectable PDF text locally. This is deliberately separate from figure
 * extraction: PDF.js can tell us a page contains embedded imagery, but it
 * cannot reliably associate that imagery with a particular exam question.
 */
export async function extractPdfText(buffer: Uint8Array, loader: () => Promise<PdfJs> = loadPdfJs): Promise<ExtractedPdfText> {
  ;(globalThis as any).DOMMatrix ??= DOMMatrix;
  ;(globalThis as any).Path2D ??= Path2D;
  const pdfjs = await loader();
  const pdfjsRoot = path.dirname(require.resolve("pdfjs-dist/package.json"));
  const task = pdfjs.getDocument({
    data: buffer,
    disableFontFace: true,
    standardFontDataUrl: path.join(pdfjsRoot, "standard_fonts/"),
  });

  try {
    const document = await task.promise;
    const pages: ExtractedPdfPage[] = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const [textContent, operators] = await Promise.all([page.getTextContent(), page.getOperatorList()]);
      const imageOperations = new Set([
        pdfjs.OPS.paintImageMaskXObject,
        pdfjs.OPS.paintImageMaskXObjectGroup,
        pdfjs.OPS.paintImageXObject,
        pdfjs.OPS.paintInlineImageXObject,
        pdfjs.OPS.paintInlineImageXObjectGroup,
        pdfjs.OPS.paintImageXObjectRepeat,
        pdfjs.OPS.paintImageMaskXObjectRepeat,
        pdfjs.OPS.paintSolidColorImageMask,
      ]);
      pages.push({
        page_number: pageNumber,
        text: normaliseText(textContent.items),
        has_embedded_image: operators.fnArray.some((operation: number) => imageOperations.has(operation)),
      });
      page.cleanup();
    }
    return {
      page_count: document.numPages,
      pages,
      // A few incidental characters are not enough to parse an exam safely.
      has_readable_text: pages.reduce((count, page) => count + page.text.length, 0) >= 20,
    };
  } finally {
    await task.destroy();
  }
}
