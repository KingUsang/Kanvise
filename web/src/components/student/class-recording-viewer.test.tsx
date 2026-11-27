import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ClassRecordingViewer } from "./class-recording-viewer";

const { authenticatedFetch } = vi.hoisted(() => ({ authenticatedFetch: vi.fn() }));
vi.mock("@/lib/authenticated-fetch", () => ({ authenticatedFetch }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));
vi.mock("@/config/api", () => ({ getApiUrl: () => "https://api.test" }));

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const session = { id: "s1", title: "Algebra", scheduled_at: "2026-07-22T12:00:00Z" };

function renderViewer(recording: Response) {
  authenticatedFetch.mockImplementation(async (_client: unknown, url: string) => {
    if (url.endsWith("/recording")) return recording;
    if (url.endsWith("/recap")) return json({ data: { published_body: null } });
    return json({ data: session });
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}><ClassRecordingViewer sessionId="s1" /></QueryClientProvider>);
}

describe("ClassRecordingViewer lifecycle", () => {
  beforeEach(() => vi.clearAllMocks());

  it("says the recording is being prepared when it is processing", async () => {
    renderViewer(json({ error: "This recording is still being prepared. Please check back shortly.", recording_status: "processing" }, 409));
    expect(await screen.findByRole("heading", { name: "Recording is being prepared" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Check again" })).toBeInTheDocument();
  });

  it("says the recording failed when preparation failed", async () => {
    renderViewer(json({ error: "This recording could not be prepared.", recording_status: "failed" }, 409));
    expect(await screen.findByRole("heading", { name: "Recording could not be prepared" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("could not be prepared");
  });

  it("keeps the generic message for other errors", async () => {
    renderViewer(json({ error: "Recording is not ready" }, 404));
    expect(await screen.findByRole("heading", { name: "Recording unavailable" }, { timeout: 4000 })).toBeInTheDocument();
  });
});
