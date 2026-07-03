"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";

const Excalidraw = dynamic(() => import("@excalidraw/excalidraw").then((mod) => mod.Excalidraw), { ssr: false });
import { useDataChannel, useRoomContext, useConnectionState } from "@livekit/components-react";
import { ConnectionState } from "livekit-client";

export default function CollaborativeWhiteboard() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [excalidrawAPI, setExcalidrawAPI] = useState<any>(null);
  const isUpdatingFromRemote = useRef(false);
  const lastBroadcastRef = useRef<number>(0);
  const room = useRoomContext();

  const { send } = useDataChannel("whiteboard", (msg) => {
    if (!excalidrawAPI) return;
    try {
      const data = JSON.parse(new TextDecoder().decode(msg.payload));
      
      if (data.type === "SYNC_SCENE") {
        // Set the guard flag to true immediately before updating the scene
        isUpdatingFromRemote.current = true;
        
        // Merge the incoming elements and viewport state (if provided by host)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const updatePayload: any = { elements: data.elements };
        if (data.appState) {
          updatePayload.appState = {
            scrollX: data.appState.scrollX,
            scrollY: data.appState.scrollY,
            zoom: data.appState.zoom
          };
        }
        excalidrawAPI.updateScene(updatePayload);
      }
      
      if (data.type === "REQUEST_SCENE") {
        // If someone joins and requests the scene, the first person to receive this 
        // (usually the host or someone who has been here a while) can reply.
        // To prevent everyone replying at once, we can just let the Host reply.
        try {
          const meta = JSON.parse(room.localParticipant.metadata || "{}");
          if (meta.isHost) {
              const elements = excalidrawAPI.getSceneElements();
              const appState = excalidrawAPI.getAppState();
              if (elements.length > 0) {
                const payload = JSON.stringify({ 
                  type: "SYNC_SCENE", 
                  elements,
                  appState: { zoom: appState.zoom, scrollX: appState.scrollX, scrollY: appState.scrollY }
                });
                const promise = send(new TextEncoder().encode(payload), { reliable: true });
                if (promise) promise.catch(() => {}); // silent catch
              }
          }
        } catch (_e) {
          // ignore
        }
      }
    } catch (e) {
      console.error("Failed to parse whiteboard message:", e);
    }
  });

  const connectionState = useConnectionState();
  const hasRequestedScene = useRef(false);

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
  } catch (_e) {
    // ignore
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
        // Only the host can dictate the viewport panning/zooming to the rest of the class
        appState: isHost ? { zoom: appState.zoom, scrollX: appState.scrollX, scrollY: appState.scrollY } : undefined
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
}
