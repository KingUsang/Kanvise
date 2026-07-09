"use client";

import { useState, useRef, useCallback, useEffect, forwardRef, useImperativeHandle } from "react";
import dynamic from "next/dynamic";

const Excalidraw = dynamic(() => import("@excalidraw/excalidraw").then((mod) => mod.Excalidraw), { ssr: false });
import { useDataChannel, useRoomContext, useConnectionState } from "@livekit/components-react";
import { ConnectionState } from "livekit-client";

export interface WhiteboardRef {
  setSlide: (imageUrl: string) => Promise<void>;
}

const CollaborativeWhiteboard = forwardRef<WhiteboardRef>((props, ref) => {
  const [excalidrawAPI, setExcalidrawAPI] = useState<any>(null);
  const isUpdatingFromRemote = useRef(false);
  const lastBroadcastRef = useRef<number>(0);
  const room = useRoomContext();

  const { send } = useDataChannel("whiteboard", (msg) => {
    if (!excalidrawAPI) return;
    try {
      const data = JSON.parse(new TextDecoder().decode(msg.payload));
      
      if (data.type === "SYNC_SCENE") {
        isUpdatingFromRemote.current = true;
        // Viewport sync is removed so students can zoom independently
        excalidrawAPI.updateScene({ elements: data.elements });
      }
      
      if (data.type === "SLIDE_CHANGE") {
        isUpdatingFromRemote.current = true;
        loadSlideToCanvas(data.imageUrl);
      }
      
      if (data.type === "REQUEST_SCENE") {
        try {
          const meta = JSON.parse(room.localParticipant.metadata || "{}");
          if (meta.isHost) {
              const elements = excalidrawAPI.getSceneElements();
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
        } catch (e) {
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
    currentSlideUrlRef.current = imageUrl;
    try {
      const response = await fetch(imageUrl);
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
          
          excalidrawAPI.updateScene({ elements: [imageElement] });
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
      // Wait a moment then sync the new scene to peers (as elements)
      setTimeout(() => {
        const elements = excalidrawAPI?.getSceneElements() || [];
        const payload = JSON.stringify({ type: "SYNC_SCENE", elements });
        const promise = send(new TextEncoder().encode(payload), { reliable: true });
        if (promise) promise.catch(() => {});
      }, 500);
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
  } catch (e) {
    // ignore
  }

  const handleChange = useCallback((elements: readonly any[], appState: any) => {
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
      
      const payload = JSON.stringify({ 
        type: "SYNC_SCENE", 
        elements,
        // Removed appState sync so viewports are independent
      });
      
      const promise = send(new TextEncoder().encode(payload), { reliable: false });
      if (promise) promise.catch(() => {}); // silent catch
    }
  }, [send, connectionState, isHost]);

  return (
    <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
      {/* Excalidraw dynamically imports itself, works fine in Next.js CSR */}
      <Excalidraw 
        excalidrawAPI={(api) => setExcalidrawAPI(api)} 
        onChange={handleChange}
        theme="light"
        viewModeEnabled={!isHost} // Only Host can draw on the whiteboard
        UIOptions={{
          canvasActions: {
            changeViewBackgroundColor: false,
            clearCanvas: true,
            loadScene: false,
            saveToActiveFile: false,
            export: { saveFileToDisk: true },
            toggleTheme: false
          }
        }}
      />
    </div>
  );
});

export default CollaborativeWhiteboard;
