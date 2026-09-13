"use client";
/* eslint-disable @typescript-eslint/no-explicit-any -- Excalidraw's imperative scene objects are intentionally passed through unchanged. */

import { useState, useRef, useCallback, useEffect, forwardRef, useImperativeHandle } from "react";
import dynamic from "next/dynamic";
import { Eraser, MousePointer2, Pencil, Redo2, Undo2 } from "lucide-react";

const Excalidraw = dynamic(
  () => import("@excalidraw/excalidraw").then(({ Excalidraw: Canvas }) => {
    function TeachingCanvas(props: React.ComponentProps<typeof Canvas>) {
      return <Canvas {...props} />;
    }
    return TeachingCanvas;
  }),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center bg-white" aria-busy="true">
        <div className="flex items-center gap-3 rounded-xl bg-[#f5f3f2] px-4 py-3 text-sm font-semibold text-[#180d62]">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#d8d3e4] border-t-[#180d62]" />
          Loading lesson board…
        </div>
      </div>
    ),
  },
);
import { useDataChannel, useRoomContext, useConnectionState } from "@livekit/components-react";
import { ConnectionState } from "livekit-client";

export interface WhiteboardRef {
  setSlide: (imageUrl: string) => Promise<void>;
}

export type BoardPdfDocument = {
  materialId: string;
  url: string;
  page: number;
  pageCount: number;
};

const CollaborativeWhiteboard = forwardRef<WhiteboardRef, { pdfDocument?: BoardPdfDocument }>(({ pdfDocument }, ref) => {
  const [excalidrawAPI, setExcalidrawAPI] = useState<any>(null);
  const [activeTool, setActiveTool] = useState<"selection" | "freedraw" | "eraser">("freedraw");
  const boardContainerRef = useRef<HTMLDivElement>(null);
  const isUpdatingFromRemote = useRef(false);
  const lastBroadcastRef = useRef<number>(0);
  const redoStackRef = useRef<any[]>([]);
  const localPdfElementsRef = useRef<any[]>([]);
  const pendingPdfPagesRef = useRef(new Set<string>());
  const slideElementRef = useRef<any>(null);
  const room = useRoomContext();

  const { send } = useDataChannel("whiteboard", (msg) => {
    if (!excalidrawAPI) return;
    try {
      const data = JSON.parse(new TextDecoder().decode(msg.payload));

      if (data.type === "SYNC_SCENE") {
        isUpdatingFromRemote.current = true;
        // The slide file is loaded locally on every client. Only annotations
        // travel over LiveKit, avoiding broken image file references.
        excalidrawAPI.updateScene({
          elements: [slideElementRef.current, ...localPdfElementsRef.current, ...data.elements].filter(Boolean),
        });
      }

      if (data.type === "SLIDE_CHANGE") {
        isUpdatingFromRemote.current = true;
        void loadSlideToCanvas(data.imageUrl);
      }

      if (data.type === "REQUEST_SCENE") {
        try {
          const meta = JSON.parse(room.localParticipant.metadata || "{}");
          if (meta.isHost) {
              const elements = excalidrawAPI
                .getSceneElements()
                .filter((element: any) => element.id !== "slide-element" && !element.id.startsWith("pdf-page-"));
              if (elements.length > 0) {
                const payload = JSON.stringify({
                  type: "SYNC_SCENE",
                  elements,
                });
                const promise = send(new TextEncoder().encode(payload), { reliable: true });
                if (promise) promise.catch(() => {});
              }
              // Also send the current slide if there is one
              if (currentSlideUrlRef.current) {
                const slidePayload = JSON.stringify({
                  type: "SLIDE_CHANGE",
                  imageUrl: currentSlideUrlRef.current
                });
                const p = send(new TextEncoder().encode(slidePayload), { reliable: true });
                if (p) p.catch(() => {});
              }
          }
        } catch {
          // ignore
        }
      }
    } catch (e) {
      console.error("Failed to parse whiteboard message:", e);
    }
  });

  const connectionState = useConnectionState();
  const hasRequestedScene = useRef(false);
  const currentSlideUrlRef = useRef<string | null>(null);

  // Keep Excalidraw's offsets current when the classroom stage changes size.
  useEffect(() => {
    if (!excalidrawAPI || !boardContainerRef.current) return;

    let animationFrame = 0;
    let delayedRefresh = 0;
    const refresh = () => {
      cancelAnimationFrame(animationFrame);
      animationFrame = requestAnimationFrame(() => excalidrawAPI.refresh());
    };
    const observer = new ResizeObserver(refresh);
    observer.observe(boardContainerRef.current);
    refresh();
    delayedRefresh = window.setTimeout(refresh, 150);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(animationFrame);
      window.clearTimeout(delayedRefresh);
    };
  }, [excalidrawAPI]);

  const loadSlideToCanvas = async (imageUrl: string) => {
    if (!excalidrawAPI) return;
    currentSlideUrlRef.current = imageUrl || null;
    slideElementRef.current = null;

    if (!imageUrl) {
      isUpdatingFromRemote.current = true;
      excalidrawAPI.updateScene({ elements: [] });
      return;
    }

    try {
      const response = await fetch(imageUrl);
      if (!response.ok) throw new Error(`Slide request failed (${response.status})`);
      const blob = await response.blob();
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64data = reader.result as string;
        const mimeType = blob.type;
        const fileId = "slide-" + Date.now();

        excalidrawAPI.addFiles([{
          id: fileId,
          dataURL: base64data,
          mimeType,
          created: Date.now(),
          lastRetrieved: Date.now(),
        }]);

        // Get an image object to check natural width/height
        const img = new Image();
        img.onload = () => {
          // Create the locked image element
          const imageElement = {
            type: "image",
            version: 1,
            versionNonce: Date.now(),
            isDeleted: false,
            id: "slide-element",
            fillStyle: "hachure",
            strokeWidth: 1,
            strokeStyle: "solid",
            roughness: 1,
            opacity: 100,
            angle: 0,
            x: 0,
            y: 0,
            strokeColor: "transparent",
            backgroundColor: "transparent",
            width: img.width,
            height: img.height,
            seed: Date.now(),
            groupIds: [],
            strokeSharpness: "round",
            boundElements: [],
            updated: Date.now(),
            fileId,
            scale: [1, 1],
            locked: true, // Keep it locked in the background
          };

          slideElementRef.current = imageElement;
          excalidrawAPI.updateScene({
            elements: [
              imageElement,
              ...excalidrawAPI.getSceneElements().filter((element: any) => element.id !== "slide-element"),
            ],
            appState: { scrollX: 0, scrollY: 0 },
          });
          excalidrawAPI.scrollToContent(imageElement, {
            fitToContent: true,
            animate: false,
          });
        };
        img.src = base64data;
      };
      reader.readAsDataURL(blob);
    } catch (e) {
      console.error("Failed to load slide image into whiteboard", e);
    }
  };

  const addPdfPageToBoard = useCallback(async (source: BoardPdfDocument, pageNumber: number) => {
    if (!excalidrawAPI || pageNumber < 1 || pageNumber > source.pageCount) return;
    const elementId = `pdf-page-${source.materialId}-${pageNumber}`;
    if (localPdfElementsRef.current.some((element) => element.id === elementId) || pendingPdfPagesRef.current.has(elementId)) return;
    pendingPdfPagesRef.current.add(elementId);

    try {
      const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
      pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/legacy/build/pdf.worker.min.mjs', import.meta.url).toString();
      const loaded = await pdfjs.getDocument({ url: source.url }).promise;
      const page = await loaded.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = window.document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext('2d', { alpha: false });
      if (!context) return;
      await page.render({ canvas, canvasContext: context, viewport }).promise;
      const fileId = `pdf-file-${source.materialId}-${pageNumber}`;
      const dataURL = canvas.toDataURL('image/jpeg', 0.9);
      excalidrawAPI.addFiles([{ id: fileId, dataURL, mimeType: 'image/jpeg', created: Date.now(), lastRetrieved: Date.now() }]);
      const element = {
        type: 'image', version: 1, versionNonce: Date.now(), isDeleted: false, id: elementId,
        fillStyle: 'solid', strokeWidth: 1, strokeStyle: 'solid', roughness: 0, opacity: 100, angle: 0,
        // Leave a generous work area below each page. The canvas itself is
        // still infinite, so a tutor can pan anywhere for a longer solution.
        x: 0, y: (pageNumber - 1) * 2600, strokeColor: 'transparent', backgroundColor: 'transparent',
        width: viewport.width, height: viewport.height, seed: pageNumber, groupIds: [], boundElements: [],
        updated: Date.now(), fileId, scale: [1, 1], locked: true,
      };
      localPdfElementsRef.current = [...localPdfElementsRef.current, element];
      isUpdatingFromRemote.current = true;
      excalidrawAPI.updateScene({ elements: [...excalidrawAPI.getSceneElements(), element] });
    } finally {
      pendingPdfPagesRef.current.delete(elementId);
    }
  }, [excalidrawAPI]);

  useEffect(() => {
    if (!pdfDocument || !excalidrawAPI) return;
    // Keep mobile memory bounded: render the current page and only one page
    // on either side. More pages appear as the tutor navigates the document.
    void Promise.all([pdfDocument.page - 1, pdfDocument.page, pdfDocument.page + 1].map((page) => addPdfPageToBoard(pdfDocument, page)))
      .then(() => {
        const currentPage = localPdfElementsRef.current.find((element) => element.id === `pdf-page-${pdfDocument.materialId}-${pdfDocument.page}`);
        if (currentPage) excalidrawAPI.scrollToContent(currentPage, { fitToContent: true, animate: true });
      })
      .catch((error) => console.error('Could not place PDF page on board', error));
  }, [addPdfPageToBoard, excalidrawAPI, pdfDocument?.materialId, pdfDocument?.page, pdfDocument?.pageCount, pdfDocument?.url]);

  useImperativeHandle(ref, () => ({
    setSlide: async (imageUrl: string) => {
      // Discard previous drawings and load new slide
      isUpdatingFromRemote.current = true;
      await loadSlideToCanvas(imageUrl);
      // Send the URL so every participant loads the image file locally.
      const payload = JSON.stringify({ type: "SLIDE_CHANGE", imageUrl });
      const promise = send(new TextEncoder().encode(payload), { reliable: true });
      if (promise) promise.catch(() => {});
    }
  }));

  // When mounting, ask the room if anyone has the current scene
  useEffect(() => {
    if (excalidrawAPI && !hasRequestedScene.current && connectionState === ConnectionState.Connected) {
      hasRequestedScene.current = true;
      const payload = JSON.stringify({ type: "REQUEST_SCENE" });
      const promise = send(new TextEncoder().encode(payload), { reliable: true });
      if (promise) promise.catch(() => {}); // silent catch
    }
  }, [excalidrawAPI, send, connectionState]);

  let isHost = false;
  try {
    isHost = JSON.parse(room.localParticipant.metadata || "{}").isHost;
  } catch {
    // ignore
  }

  useEffect(() => {
    if (excalidrawAPI && isHost) excalidrawAPI.setActiveTool({ type: "freedraw" });
  }, [excalidrawAPI, isHost]);

  const handleChange = useCallback((elements: readonly any[]) => {
    // If this onChange was triggered programmatically by updateScene,
    // clear the guard flag and DO NOT broadcast to prevent infinite loops!
    if (isUpdatingFromRemote.current) {
      isUpdatingFromRemote.current = false;
      return;
    }

    redoStackRef.current = [];

    const now = Date.now();
    // Throttle broadcasts slightly to avoid flooding LiveKit DataChannels
    if (now - lastBroadcastRef.current > 50 && connectionState === ConnectionState.Connected) {
      lastBroadcastRef.current = now;

      const annotations = elements.filter((element: any) => element.id !== "slide-element" && !element.id.startsWith("pdf-page-"));
      const payload = JSON.stringify({
        type: "SYNC_SCENE",
        elements: annotations,
        // Removed appState sync so viewports are independent
      });

      const promise = send(new TextEncoder().encode(payload), { reliable: false });
      if (promise) promise.catch(() => {}); // silent catch
    }
  }, [send, connectionState]);

  const setTool = (type: "selection" | "freedraw" | "eraser") => {
    excalidrawAPI?.setActiveTool({ type });
    setActiveTool(type);
  };

  // Mobile tutors need a dependable one-tap undo. Excalidraw's public API
  // exposes no undo action, so keep this deliberately scoped to the latest
  // complete annotation rather than trying to mirror its internal history.
  const undoLastStroke = () => {
    if (!excalidrawAPI || !isHost) return;
    const elements = excalidrawAPI.getSceneElements();
    const last = [...elements].reverse().find((element: any) => element.id !== "slide-element" && !element.id.startsWith("pdf-page-") && !element.isDeleted);
    if (!last) return;
    redoStackRef.current.push(last);
    isUpdatingFromRemote.current = true;
    excalidrawAPI.updateScene({ elements: elements.filter((element: any) => element.id !== last.id) });
    const payload = JSON.stringify({ type: "SYNC_SCENE", elements: elements.filter((element: any) => element.id !== "slide-element" && !element.id.startsWith("pdf-page-") && element.id !== last.id) });
    void send(new TextEncoder().encode(payload), { reliable: true }).catch(() => undefined);
  };

  const redoLastStroke = () => {
    if (!excalidrawAPI || !isHost) return;
    const stroke = redoStackRef.current.pop();
    if (!stroke) return;
    const elements = excalidrawAPI.getSceneElements();
    isUpdatingFromRemote.current = true;
    excalidrawAPI.updateScene({ elements: [...elements, stroke] });
    const payload = JSON.stringify({ type: "SYNC_SCENE", elements: [...elements.filter((element: any) => element.id !== "slide-element" && !element.id.startsWith("pdf-page-")), stroke] });
    void send(new TextEncoder().encode(payload), { reliable: true }).catch(() => undefined);
  };

  return (
    <div ref={boardContainerRef} className="absolute inset-0 min-h-0 min-w-0 overflow-hidden bg-white">
      <Excalidraw
        excalidrawAPI={(api) => setExcalidrawAPI(api)}
        onChange={handleChange}
        theme="light"
        // Hide Excalidraw's desktop-first chrome. Kanvise supplies the small,
        // touch-friendly teaching toolbar below instead.
        zenModeEnabled
        viewModeEnabled={!isHost} // Only Host can draw on the whiteboard
        detectScroll={false}
        handleKeyboardGlobally={false}
        aiEnabled={false}
        UIOptions={{
          canvasActions: {
            changeViewBackgroundColor: false,
            clearCanvas: false,
            loadScene: false,
            saveToActiveFile: false,
            export: false,
            toggleTheme: false
          }
        }}
      />
      {isHost && (
        <div className="absolute bottom-3 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1 rounded-2xl border border-black/10 bg-white/95 p-1.5 shadow-xl backdrop-blur" aria-label="Board tools">
          <button onClick={() => setTool("selection")} className={`rounded-xl p-3 ${activeTool === "selection" ? "bg-[#180d62] text-white shadow-sm" : "text-[#474551] hover:bg-[#f2f0f4]"}`} aria-label="Move around board" title="Move around board"><MousePointer2 size={19} /></button>
          <button onClick={() => setTool("freedraw")} className={`rounded-xl p-3 ${activeTool === "freedraw" ? "bg-[#180d62] text-white shadow-sm" : "text-[#474551] hover:bg-[#f2f0f4]"}`} aria-label="Pen" title="Pen"><Pencil size={19} /></button>
          <button onClick={() => setTool("eraser")} className={`rounded-xl p-3 ${activeTool === "eraser" ? "bg-[#180d62] text-white shadow-sm" : "text-[#474551] hover:bg-[#f2f0f4]"}`} aria-label="Eraser" title="Eraser"><Eraser size={19} /></button>
          <span className="mx-0.5 h-7 w-px bg-[#e4e2e1]" />
          <button onClick={undoLastStroke} className="rounded-xl p-3 text-[#474551] hover:bg-[#f2f0f4]" aria-label="Undo last stroke" title="Undo last stroke"><Undo2 size={19} /></button>
          <button onClick={redoLastStroke} className="rounded-xl p-3 text-[#474551] hover:bg-[#f2f0f4]" aria-label="Redo last stroke" title="Redo last stroke"><Redo2 size={19} /></button>
        </div>
      )}
    </div>
  );
});

CollaborativeWhiteboard.displayName = "CollaborativeWhiteboard";

export default CollaborativeWhiteboard;
