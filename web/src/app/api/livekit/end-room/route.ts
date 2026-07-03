import { RoomServiceClient } from "livekit-server-sdk";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const roomId = body.roomId;

    if (!roomId) {
      return NextResponse.json({ error: 'Missing "roomId"' }, { status: 400 });
    }

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const wsUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;

    if (!apiKey || !apiSecret || !wsUrl) {
      return NextResponse.json({ error: "Server misconfigured. Check ENV variables." }, { status: 500 });
    }

    const roomService = new RoomServiceClient(wsUrl, apiKey, apiSecret);
    
    // deleteRoom forcefully evicts all participants and closes the room
    await roomService.deleteRoom(roomId);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("Failed to end room:", error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
