import { VideoPresets, type RoomOptions } from "livekit-client";

/**
 * The classroom renders camera video in small PiP circles, so publishing 720p
 * wastes bandwidth. Keep a 360p ceiling and a 180p layer for normal tiles.
 */
export const CLASSROOM_ROOM_OPTIONS = {
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
} satisfies RoomOptions;
