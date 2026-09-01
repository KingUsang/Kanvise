"use client";
/* eslint-disable @typescript-eslint/no-explicit-any -- Excalidraw's imperative scene objects are intentionally passed through unchanged. */

import { useState, useRef, useCallback, useEffect, forwardRef, useImperativeHandle } from "react";
import dynamic from "next/dynamic";

const Excalidraw = dynamic(
  () => import("@excalidraw/excalidraw").then(({ Excalidraw: Canvas, MainMenu }) => {
    function TeachingCanvas(props: React.ComponentProps<typeof Canvas>) {
      return <Canvas {...props}><MainMenu /></Canvas>;
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

const CollaborativeWhiteboard = forwardRef<WhiteboardRef>((props, ref) => {
  const [excalidrawAPI, setExcalidrawAPI] = useState<any>(null);
  const isUpdatingFromRemote = useRef(false);
  const lastBroadcastRef = useRef<number>(0);
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
          elements: [slideElementRef.current, ...data.elements].filter(Boolean),
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
                .filter((element: any) => element.id !== "slide-element");
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

  const handleChange = useCallback((elements: readonly any[]) => {
    // If this onChange was triggered programmatically by updateScene,
    // clear the guard flag and DO NOT broadcast to prevent infinite loops!
    if (isUpdatingFromRemote.current) {
      isUpdatingFromRemote.current = false;
      return;
    }

    const now = Date.now();
    // Throttle broadcasts slightly to avoid flooding LiveKit DataChannels
    if (now - lastBroadcastRef.current > 50 && connectionState === ConnectionState.Connected) {
      lastBroadcastRef.current = now;

      const annotations = elements.filter((element: any) => element.id !== "slide-element");
      const payload = JSON.stringify({
        type: "SYNC_SCENE",
        elements: annotations,
        // Removed appState sync so viewports are independent
      });

      const promise = send(new TextEncoder().encode(payload), { reliable: false });
      if (promise) promise.catch(() => {}); // silent catch
    }
  }, [send, connectionState]);

  return (
    <div className="absolute inset-0 overflow-hidden bg-white">
      {/* Excalidraw dynamically imports itself, works fine in Next.js CSR */}
      <Excalidraw
        excalidrawAPI={(api) => setExcalidrawAPI(api)}
        onChange={handleChange}
        theme="light"
        zenModeEnabled={!isHost}
        viewModeEnabled={!isHost} // Only Host can draw on the whiteboard
        detectScroll={false}
        handleKeyboardGlobally={false}
        aiEnabled={false}
        UIOptions={{
          canvasActions: {
            changeViewBackgroundColor: false,
            clearCanvas: true,
            loadScene: false,
            saveToActiveFile: false,
            export: false,
            toggleTheme: false
          }
        }}
      />
    </div>
  );
});

CollaborativeWhiteboard.displayName = "CollaborativeWhiteboard";

export default CollaborativeWhiteboard;
