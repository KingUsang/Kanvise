import { describe, expect, it, vi } from "vitest";
import { extractPdfText } from "./mock-pdf-text";

describe("local mock PDF text extraction", () => {
  it("keeps page boundaries and flags embedded-image pages", async () => {
    const cleanup = vi.fn();
    const destroy = vi.fn();
    const result = await extractPdfText(new Uint8Array([1]), async () => ({
      OPS: {
        paintImageMaskXObject: 83,
        paintImageMaskXObjectGroup: 84,
        paintImageXObject: 85,
        paintInlineImageXObject: 86,
        paintInlineImageXObjectGroup: 87,
        paintImageXObjectRepeat: 88,
        paintImageMaskXObjectRepeat: 89,
        paintSolidColorImageMask: 90,
      },
      getDocument: () => ({
        promise: Promise.resolve({
          numPages: 2,
          getPage: async (pageNumber: number) => ({
            getTextContent: async () => ({ items: pageNumber === 1 ? [{ str: "1. Solve the following equation:" }, { str: "x = 2" }] : [] }),
            getOperatorList: async () => ({ fnArray: pageNumber === 2 ? [85] : [44] }),
            cleanup,
          }),
        }),
        destroy,
      }),
    }) as any);

    expect(result).toEqual({
      page_count: 2,
      has_readable_text: true,
      pages: [
        { page_number: 1, text: "1. Solve the following equation: x = 2", has_embedded_image: false },
        { page_number: 2, text: "", has_embedded_image: true },
      ],
    });
    expect(cleanup).toHaveBeenCalledTimes(2);
    expect(destroy).toHaveBeenCalledOnce();
  });
});
