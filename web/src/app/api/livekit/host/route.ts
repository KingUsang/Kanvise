import { RoomServiceClient } from "livekit-server-sdk";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { action, room, identity, trackSid } = await req.json();

    if (!action || !room || !identity) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const wsUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;

    if (!apiKey || !apiSecret || !wsUrl) {
      return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
    }

    // Initialize RoomServiceClient
    const httpUrl = wsUrl.replace("wss://", "https://").replace("ws://", "http://");
    const roomService = new RoomServiceClient(httpUrl, apiKey, apiSecret);

    if (action === "kick") {
      await roomService.removeParticipant(room, identity);
      return NextResponse.json({ success: true, action: "kick", identity });
    }

    if (action === "mute") {
      if (!trackSid) {
        return NextResponse.json({ error: "trackSid is required for mute" }, { status: 400 });
      }
      // Set muted=true
      await roomService.mutePublishedTrack(room, identity, trackSid, true);
      return NextResponse.json({ success: true, action: "mute", identity });
    }

    if (action === "lowerHand") {
      await roomService.updateParticipant(room, identity, {
        attributes: { handRaised: "" }
      });
      return NextResponse.json({ success: true, action: "lowerHand", identity });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: unknown) {
    console.error("LiveKit Host Action Error:", error);
    return NextResponse.json({ error: (error as Error).message || "Unknown error" }, { status: 500 });
  }
}
