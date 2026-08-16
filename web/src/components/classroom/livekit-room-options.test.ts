import { describe, expect, it } from "vitest";
import { VideoPresets } from "livekit-client";
import { CLASSROOM_ROOM_OPTIONS } from "./livekit-room-options";

describe("classroom LiveKit room options", () => {
  it("caps camera video at 360p and publishes only a 180p fallback layer", () => {
    expect(CLASSROOM_ROOM_OPTIONS).toMatchObject({
      adaptiveStream: true,
      dynacast: true,
      videoCaptureDefaults: {
        resolution: VideoPresets.h360.resolution,
      },
      publishDefaults: {
        videoCodec: "vp8",
        simulcast: true,
        videoEncoding: VideoPresets.h360.encoding,
        videoSimulcastLayers: [VideoPresets.h180],
      },
    });

    expect(CLASSROOM_ROOM_OPTIONS.publishDefaults.videoEncoding.maxBitrate).toBe(450_000);
    expect(CLASSROOM_ROOM_OPTIONS.publishDefaults.videoSimulcastLayers).toHaveLength(1);
    expect(CLASSROOM_ROOM_OPTIONS.publishDefaults.videoSimulcastLayers[0].encoding.maxBitrate).toBe(160_000);
  });
});
