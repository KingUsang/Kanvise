"use client";
/* eslint-disable @typescript-eslint/no-explicit-any -- Excalidraw's imperative scene objects are intentionally passed through unchanged. */

import { useState, useRef, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import { Eraser, Hand, Pencil, Redo2, Undo2, ZoomIn, ZoomOut, Maximize2, ChevronLeft, ChevronRight, Wand2, ArrowUpRight, Type } from "lucide-react";
import { usePresentationSession } from "./presentation-session";

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

export type BoardPdfDocument = {
  materialId: string;
  url: string;
  page: number;
  pageCount: number;
};

const CollaborativeWhiteboard = ({
  pdfDocument,
  onPdfRenderStateChange,
  onPdfRenderError,
}: {
  pdfDocument?: BoardPdfDocument
  onPdfRenderStateChange?: (rendering: boolean) => void
  onPdfRenderError?: (error: Error) => void
}) => {
  const [excalidrawAPI, setExcalidrawAPI] = useState<any>(null);
  const [activeTool, setActiveTool] = useState<"hand" | "freedraw" | "eraser" | "arrow" | "text" | "laser">("hand");
  const boardContainerRef = useRef<HTMLDivElement>(null);
  const isUpdatingFromRemote = useRef(false);
  const lastBroadcastRef = useRef<number>(0);
  const redoStackRef = useRef<any[]>([]);
  const localPdfElementsRef = useRef<any[]>([]);
  const pendingPdfPagesRef = useRef(new Set<string>());
  // Cache only in-flight image decodes. Once displayed, the browser's HTTP
  // cache owns the compressed bytes and Excalidraw owns the current file.
  const pdfImageCacheRef = useRef(new Map<string, Promise<{ dataURL: string; width: number; height: number }>>());
  // A presentation must show its current page as soon as it opens. Previously
  // the PDF was only rasterised after the tutor pressed "Place page", leaving
  // the presentation surface as an empty board.
  const displayedPdfPageRef = useRef<string | null>(null);
  const pdfDocumentRef = useRef<BoardPdfDocument | undefined>(pdfDocument);
  const addPdfPageToBoardRef = useRef<((source: BoardPdfDocument, page: number, position?: { x: number; y: number }, requestId?: number) => Promise<{ x: number; y: number } | undefined>) | null>(null);
  // Invalidates an older page request when the tutor clicks back/forward
  // quickly. Only the latest request is allowed to mutate the canvas.
  const pdfRenderRequestRef = useRef(0);
  const slideElementRef = useRef<any>(null);
  const slideFileIdRef = useRef<string | null>(null);
  const room = useRoomContext();
  let isHost = false;
  try {
    isHost = JSON.parse(room.localParticipant.metadata || "{}").isHost;
  } catch {
    // ignore
  }
  const { active, changePage } = usePresentationSession();
  const presentationLocked = Boolean(pdfDocument);

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

      if (data.type === "PDF_PAGE_PLACED") {
        const source = pdfDocumentRef.current;
        const addPage = addPdfPageToBoardRef.current;
        if (source && addPage && source.materialId === data.materialId) {
          void addPage(source, data.page, { x: data.x, y: data.y });
        }
      }

      if (data.type === "PDF_PAGES_SYNC") {
        const source = pdfDocumentRef.current;
        const addPage = addPdfPageToBoardRef.current;
        if (source && addPage && source.materialId === data.materialId) {
          void data.pages.reduce(
            (chain: Promise<unknown>, page: { page: number; x: number; y: number }) => chain.then(() => addPage(source, page.page, page)),
            Promise.resolve(),
          );
        }
      }

      if (data.type === "SYNC_VIEWPORT") {
        const meta = JSON.parse(room.localParticipant.metadata || "{}");
        if (!meta.isHost && excalidrawAPI) {
          const { left, top, right, bottom } = data.bounds;
          const targetWidth = right - left;
          const targetHeight = bottom - top;
          const state = excalidrawAPI.getAppState();
          const studentWidth = state.width;
          const studentHeight = state.height;
          const scaleX = studentWidth / targetWidth;
          const scaleY = studentHeight / targetHeight;
          const nextZoom = Math.min(10, Math.max(0.1, Math.min(scaleX, scaleY)));
          const centerX = (left + right) / 2;
          const centerY = (top + bottom) / 2;
          const nextScrollX = -centerX + (studentWidth / nextZoom) / 2;
          const nextScrollY = -centerY + (studentHeight / nextZoom) / 2;
          isUpdatingFromRemote.current = true;
          excalidrawAPI.updateScene({
            appState: {
              scrollX: nextScrollX,
              scrollY: nextScrollY,
              zoom: { value: nextZoom }
            }
          });
        }
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
              const source = pdfDocumentRef.current;
              if (source) {
                const prefix = `pdf-page-${source.materialId}-`;
                const pages = localPdfElementsRef.current
                  .filter((element) => element.id.startsWith(prefix))
                  .map((element) => ({ page: Number(element.id.slice(prefix.length)), x: element.x, y: element.y }))
                  .filter((page) => Number.isInteger(page.page));
                if (pages.length) {
                  const pdfPayload = JSON.stringify({ type: "PDF_PAGES_SYNC", materialId: source.materialId, pages });
                  const p = send(new TextEncoder().encode(pdfPayload), { reliable: true });
                  if (p) p.catch(() => {});
                }
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

        // Excalidraw's public API only adds files; it does not expose a
        // removeFiles method. Prune the previous slide from its file map
        // before adding the replacement so repeated slide changes cannot
        // retain every decoded bitmap in memory.
        const files = excalidrawAPI.getFiles() as Record<string, unknown>;
        if (slideFileIdRef.current) delete files[slideFileIdRef.current];
        slideFileIdRef.current = fileId;

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

  const addPdfPageToBoard = useCallback(async (source: BoardPdfDocument, pageNumber: number, position?: { x: number; y: number }, requestId?: number) => {
    if (!excalidrawAPI || pageNumber < 1 || pageNumber > source.pageCount) return undefined;
    const elementId = `pdf-page-${source.materialId}-${pageNumber}`;
    const existing = localPdfElementsRef.current.find((element) => element.id === elementId);
    if (existing || pendingPdfPagesRef.current.has(elementId)) return existing ? { x: existing.x, y: existing.y } : undefined;
    pendingPdfPagesRef.current.add(elementId);

    try {
      let imagePromise = pdfImageCacheRef.current.get(source.url);
      if (!imagePromise) {
        imagePromise = (async () => {
          const response = await fetch(source.url, { cache: 'force-cache' });
          if (!response.ok) throw new Error(`Page image request failed (${response.status})`);
          const blob = await response.blob();
          const dataURL = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(String(reader.result));
            reader.onerror = () => reject(reader.error || new Error('Could not read page image'));
            reader.readAsDataURL(blob);
          });
          const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
            const image = new Image();
            image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
            image.onerror = () => reject(new Error('Could not decode page image'));
            image.src = dataURL;
          });
          return { dataURL, ...dimensions };
        })();
        pdfImageCacheRef.current.set(source.url, imagePromise);
        imagePromise.then(
          () => pdfImageCacheRef.current.delete(source.url),
          () => pdfImageCacheRef.current.delete(source.url),
        );
      }
      const { dataURL, width, height } = await imagePromise;
      if (requestId !== undefined && requestId !== pdfRenderRequestRef.current) return undefined;
      // Excalidraw does not replace an existing file when addFiles receives
      // the same ID. Include the page so navigation cannot keep rendering the
      // first decoded bitmap while the scene element changes.
      const fileId = `pdf-file-${source.materialId}-${pageNumber}`;
      // Add the replacement before removing stale files. Deleting first makes
      // the current scene element briefly reference a missing bitmap, causing
      // a visible blank flash during page navigation.
      excalidrawAPI.addFiles([{ id: fileId, dataURL, mimeType: 'image/jpeg', created: Date.now(), lastRetrieved: Date.now() }]);
      // A page is placed in the tutor's current viewport. The tutor can pan to
      // any empty part of the infinite board before pressing "Place page".
      // We never invent a fixed-sized solution area between PDF pages.
      const appState = excalidrawAPI.getAppState();
      const zoom = appState.zoom?.value || 1;
      const pagePosition = position || {
        x: -appState.scrollX + appState.width / (2 * zoom) - width / 2,
        y: -appState.scrollY + appState.height / (2 * zoom) - height / 2,
      };
      const element = {
        type: 'image', version: 1, versionNonce: Date.now(), isDeleted: false, id: elementId,
        fillStyle: 'solid', strokeWidth: 1, strokeStyle: 'solid', roughness: 0, opacity: 100, angle: 0,
        x: pagePosition.x, y: pagePosition.y,
        strokeColor: '#d6d1cd', backgroundColor: '#ffffff',
        width, height, seed: pageNumber, groupIds: [], boundElements: [],
        updated: Date.now(), fileId, scale: [1, 1], locked: true,
      };
      // Page navigation should replace the rendered PDF page. Keeping every
      // previous page in the Excalidraw scene was the primary mobile memory
      // leak and made Chrome crash after a few page changes.
      const previousPdfIds = new Set(localPdfElementsRef.current.map((item: any) => item.id));
      const shouldFitInitialPage = localPdfElementsRef.current.length === 0 || !localPdfElementsRef.current[0].id.startsWith(`pdf-page-${source.materialId}-`);
      localPdfElementsRef.current = [element];
      isUpdatingFromRemote.current = true;
      excalidrawAPI.updateScene({ elements: [...excalidrawAPI.getSceneElements().filter((item: any) => !previousPdfIds.has(item.id)), element] });
      const files = excalidrawAPI.getFiles() as Record<string, unknown>;
      for (const existingFileId of Object.keys(files)) {
        if (existingFileId.startsWith('pdf-file-') && existingFileId !== fileId) delete files[existingFileId];
      }
      if (shouldFitInitialPage) fitPage();
      return pagePosition;
    } finally {
      pendingPdfPagesRef.current.delete(elementId);
    }
  }, [excalidrawAPI]);

  useEffect(() => {
    pdfDocumentRef.current = pdfDocument;
    addPdfPageToBoardRef.current = addPdfPageToBoard;
  }, [addPdfPageToBoard, pdfDocument]);

  useEffect(() => {
    if (!excalidrawAPI) return;
    const requestId = ++pdfRenderRequestRef.current;
    if (!pdfDocument) return;
    const pageKey = `${pdfDocument.materialId}:${pdfDocument.page}:${pdfDocument.url}`;
    if (displayedPdfPageRef.current === pageKey) return;

    onPdfRenderStateChange?.(true)
    void addPdfPageToBoard(pdfDocument, pdfDocument.page, undefined, requestId)
      .then((position) => {
        // Only mark it displayed after the page image has decoded, so a
        // transient signed-URL/network failure can be retried safely.
        if (position) displayedPdfPageRef.current = pageKey;
      })
      .catch((error) => {
        console.error('Failed to render presentation PDF page', error);
        onPdfRenderError?.(error instanceof Error ? error : new Error('Could not load this page'));
      })
      .finally(() => {
        onPdfRenderStateChange?.(false)
      });
  }, [addPdfPageToBoard, excalidrawAPI, onPdfRenderError, onPdfRenderStateChange, pdfDocument]);

  // When mounting, ask the room if anyone has the current scene
  useEffect(() => {
    if (excalidrawAPI && !hasRequestedScene.current && connectionState === ConnectionState.Connected) {
      hasRequestedScene.current = true;
      const payload = JSON.stringify({ type: "REQUEST_SCENE" });
      const promise = send(new TextEncoder().encode(payload), { reliable: true });
      if (promise) promise.catch(() => {}); // silent catch
    }
  }, [excalidrawAPI, send, connectionState]);

  useEffect(() => {
    if (excalidrawAPI && isHost) excalidrawAPI.setActiveTool({ type: "hand" });
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

  const setTool = (type: "hand" | "freedraw" | "eraser" | "arrow" | "text" | "laser") => {
    excalidrawAPI?.setActiveTool({ type });
    setActiveTool(type);
  };

  const adjustZoom = (delta: number) => {
    if (!excalidrawAPI) return;
    const current = excalidrawAPI.getAppState().zoom?.value || 1;
    const next = Math.min(2.5, Math.max(0.5, Math.round((current + delta) * 10) / 10));
    excalidrawAPI.updateScene({ appState: { zoom: { value: next } } });
  };

  const fitPage = () => {
    const page = localPdfElementsRef.current[0];
    if (page && excalidrawAPI) {
      const state = excalidrawAPI.getAppState();
      const fitZoomX = state.width / page.width;
      const fitZoomY = state.height / page.height;
      const minZoom = Math.min(fitZoomX, fitZoomY) * 0.95;
      const centerX = page.x + page.width / 2;
      const centerY = page.y + page.height / 2;
      const nextScrollX = -centerX + (state.width / minZoom) / 2;
      const nextScrollY = -centerY + (state.height / minZoom) / 2 - (30 / minZoom);
      excalidrawAPI.updateScene({ appState: { zoom: { value: minZoom }, scrollX: nextScrollX, scrollY: nextScrollY } });
    }
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

  const constrainPresentationViewport = useCallback((scrollX: number, scrollY: number, zoom: { value: number }) => {
    if (!presentationLocked || !excalidrawAPI || !localPdfElementsRef.current[0]) return;
    const page = localPdfElementsRef.current[0];
    const state = excalidrawAPI.getAppState();
    const fitZoomX = state.width / page.width;
    const fitZoomY = state.height / page.height;
    const minZoom = Math.min(fitZoomX, fitZoomY) * 0.95;
    const nextZoom = Math.min(10, Math.max(minZoom, zoom.value));
    const viewportWidth = state.width / nextZoom;
    const viewportHeight = state.height / nextZoom;
    const clampScroll = (scroll: number, start: number, end: number, viewport: number) => {
      if (end - start <= viewport) return -(start + (end - start - viewport) / 2);
      return Math.min(-start, Math.max(-(end - viewport), scroll));
    };
    const nextScrollX = clampScroll(scrollX, page.x, page.x + page.width, viewportWidth);
    const nextScrollY = clampScroll(scrollY, page.y, page.y + page.height, viewportHeight);
    let updated = false;
    if (Math.abs(nextScrollX - scrollX) > 0.5 || Math.abs(nextScrollY - scrollY) > 0.5 || nextZoom !== zoom.value) {
      excalidrawAPI.updateScene({ appState: { scrollX: nextScrollX, scrollY: nextScrollY, zoom: { value: nextZoom } } });
      updated = true;
    }
    
    if (isHost) {
      const now = Date.now();
      if (now - (lastBroadcastRef.current || 0) > 60 && connectionState === ConnectionState.Connected) {
        lastBroadcastRef.current = now;
        const currentScrollX = updated ? nextScrollX : scrollX;
        const currentScrollY = updated ? nextScrollY : scrollY;
        const payload = JSON.stringify({
          type: "SYNC_VIEWPORT",
          bounds: {
            left: -currentScrollX,
            top: -currentScrollY,
            right: -currentScrollX + viewportWidth,
            bottom: -currentScrollY + viewportHeight
          }
        });
        const promise = send(new TextEncoder().encode(payload), { reliable: false });
        if (promise) promise.catch(() => {});
      }
    }
  }, [excalidrawAPI, presentationLocked, isHost, send, connectionState]);

  return (
    <div ref={boardContainerRef} className="kanvise-teaching-board absolute inset-0 min-h-0 min-w-0 overflow-hidden bg-white">
      <Excalidraw
        excalidrawAPI={(api) => setExcalidrawAPI(api)}
        onChange={handleChange}
        theme="light"
        initialData={{ appState: { viewBackgroundColor: "#e8e6e4", activeTool: { type: "hand", lastActiveTool: null, locked: false, customType: null } } as any }}
        // The stock UI is visually suppressed by the scoped classroom CSS.
        // Kanvise supplies the one touch-oriented toolbar below.
        zenModeEnabled
        viewModeEnabled={!isHost} // Only Host can draw on the whiteboard
        detectScroll={false}
        handleKeyboardGlobally={false}
        aiEnabled={false}
        UIOptions={{
          tools: { image: false },
          canvasActions: {
            changeViewBackgroundColor: false,
            clearCanvas: false,
            loadScene: false,
            saveToActiveFile: false,
            export: false,
            toggleTheme: false,
            saveAsImage: false
          }
        }}
        renderTopRightUI={() => null}
        onScrollChange={constrainPresentationViewport}
      />
      <div className="absolute bottom-3 left-1/2 z-30 flex w-[calc(100%-24px)] md:w-auto md:max-w-none max-w-md -translate-x-1/2 flex-col md:flex-row md:items-center gap-1 md:gap-1 rounded-2xl border border-black/10 bg-white/95 p-1.5 shadow-xl backdrop-blur" aria-label="Board tools">
        {/* TOP TIER / LEFT SIDE: Zoom & Pagination */}
        <div className="flex items-center justify-between border-b border-[#e4e2e1] md:border-b-0 md:border-r md:pr-1.5 pb-1.5 md:pb-0">
          <div className="flex items-center gap-1">
            {pdfDocument && (
              <>
                <button onClick={() => adjustZoom(-0.1)} className="rounded-xl p-2.5 md:p-3 text-[#474551] hover:bg-[#f2f0f4]" aria-label="Zoom out" title="Zoom out"><ZoomOut size={19} /></button>
                <button onClick={() => adjustZoom(0.1)} className="rounded-xl p-2.5 md:p-3 text-[#474551] hover:bg-[#f2f0f4]" aria-label="Zoom in" title="Zoom in"><ZoomIn size={19} /></button>
                <button onClick={fitPage} className="rounded-xl p-2.5 md:p-3 text-[#474551] hover:bg-[#f2f0f4]" aria-label="Fit page" title="Fit page"><Maximize2 size={19} /></button>
              </>
            )}
          </div>
          {isHost && presentationLocked && active?.page_count && (
            <div className="flex items-center gap-1 md:ml-1">
              <button onClick={() => void changePage(active.current_page - 1)} disabled={active.current_page === 1} className="rounded-xl p-2.5 md:p-3 text-[#474551] hover:bg-[#f2f0f4] disabled:opacity-35" aria-label="Previous slide" title="Previous slide"><ChevronLeft size={19} /></button>
              <button 
                onClick={() => {
                  if (!active?.page_count || !active?.current_page) return;
                  const input = window.prompt(`Enter slide number (1-${active.page_count}):`, active.current_page.toString());
                  if (input !== null) {
                    const page = parseInt(input, 10);
                    if (!isNaN(page) && page >= 1 && page <= active.page_count) {
                      void changePage(page);
                    }
                  }
                }}
                className="text-[12px] font-bold px-1 md:px-2 tabular-nums text-[#180d62] hover:text-[#c26627] hover:underline active:scale-95 transition-all"
                title="Jump to slide"
              >
                {active.current_page}/{active.page_count}
              </button>
              <button onClick={() => void changePage(active.current_page + 1)} disabled={active.current_page === active.page_count} className="rounded-xl p-2.5 md:p-3 text-[#474551] hover:bg-[#f2f0f4] disabled:opacity-35" aria-label="Next slide" title="Next slide"><ChevronRight size={19} /></button>
            </div>
          )}
        </div>
        
        {/* BOTTOM TIER / RIGHT SIDE: Scrollable Drawing Tools */}
        {isHost && (
          <div className="flex items-center gap-1 overflow-x-auto pt-1 md:pt-0 md:pl-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <button onClick={() => setTool("hand")} className={`shrink-0 rounded-xl p-2.5 md:p-3 ${activeTool === "hand" ? "bg-[#180d62] text-white shadow-sm" : "text-[#474551] hover:bg-[#f2f0f4]"}`} aria-label="Pan board" title="Pan board"><Hand size={19} /></button>
            <button onClick={() => setTool("laser")} className={`shrink-0 rounded-xl p-2.5 md:p-3 ${activeTool === "laser" ? "bg-[#180d62] text-white shadow-sm" : "text-[#474551] hover:bg-[#f2f0f4]"}`} aria-label="Laser Pointer" title="Laser Pointer"><Wand2 size={19} /></button>
            <button onClick={() => setTool("freedraw")} className={`shrink-0 rounded-xl p-2.5 md:p-3 ${activeTool === "freedraw" ? "bg-[#180d62] text-white shadow-sm" : "text-[#474551] hover:bg-[#f2f0f4]"}`} aria-label="Pen" title="Pen"><Pencil size={19} /></button>
            <button onClick={() => setTool("eraser")} className={`shrink-0 rounded-xl p-2.5 md:p-3 ${activeTool === "eraser" ? "bg-[#180d62] text-white shadow-sm" : "text-[#474551] hover:bg-[#f2f0f4]"}`} aria-label="Eraser" title="Eraser"><Eraser size={19} /></button>
            <button onClick={() => setTool("arrow")} className={`shrink-0 rounded-xl p-2.5 md:p-3 ${activeTool === "arrow" ? "bg-[#180d62] text-white shadow-sm" : "text-[#474551] hover:bg-[#f2f0f4]"}`} aria-label="Arrow" title="Arrow"><ArrowUpRight size={19} /></button>
            <button onClick={() => setTool("text")} className={`shrink-0 rounded-xl p-2.5 md:p-3 ${activeTool === "text" ? "bg-[#180d62] text-white shadow-sm" : "text-[#474551] hover:bg-[#f2f0f4]"}`} aria-label="Text" title="Text"><Type size={19} /></button>
            <span className="mx-1 h-7 w-px shrink-0 bg-[#e4e2e1]" />
            <button onClick={undoLastStroke} className="shrink-0 rounded-xl p-2.5 md:p-3 text-[#474551] hover:bg-[#f2f0f4]" aria-label="Undo last stroke" title="Undo last stroke"><Undo2 size={19} /></button>
            <button onClick={redoLastStroke} className="shrink-0 rounded-xl p-2.5 md:p-3 text-[#474551] hover:bg-[#f2f0f4]" aria-label="Redo last stroke" title="Redo last stroke"><Redo2 size={19} /></button>
          </div>
        )}
      </div>
    </div>
  );
};

CollaborativeWhiteboard.displayName = "CollaborativeWhiteboard";

export default CollaborativeWhiteboard;
