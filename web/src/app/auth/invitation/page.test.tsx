import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import InvitationPage from "./page"

const verifyOtp = vi.fn()
const push = vi.fn()
const refresh = vi.fn()

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { verifyOtp } }),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}))

vi.mock("@/components/auth/auth-logo", () => ({
  AuthLogo: () => <div>Kanvise</div>,
}))

describe("InvitationPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.history.replaceState({}, "", "/auth/invitation?token_hash=0123456789abcdef&type=invite")
    verifyOtp.mockResolvedValue({ data: { session: { access_token: "invite-session" } }, error: null })
  })

  it("waits for an explicit click before consuming the invite token", async () => {
    const user = userEvent.setup()
    render(<InvitationPage />)

    const button = await screen.findByRole("button", { name: "Continue to account setup" })
    expect(verifyOtp).not.toHaveBeenCalled()
    expect(window.location.search).toBe("")

    await user.click(button)

    await waitFor(() => expect(verifyOtp).toHaveBeenCalledWith({
      token_hash: "0123456789abcdef",
      type: "invite",
    }))
    expect(push).toHaveBeenCalledWith("/auth/accept-invitation")
    expect(refresh).toHaveBeenCalled()
  })

  it("explains that an expired or reused token cannot be used", async () => {
    verifyOtp.mockResolvedValue({ data: { session: null }, error: new Error("otp_expired") })
    const user = userEvent.setup()
    render(<InvitationPage />)

    await user.click(await screen.findByRole("button", { name: "Continue to account setup" }))

    expect(await screen.findByRole("heading", { name: "This link cannot be used" })).toBeInTheDocument()
    expect(screen.getByRole("alert")).toHaveTextContent("expired or was already used")
    expect(push).not.toHaveBeenCalled()
  })

  it("rejects a link that is not an invitation", async () => {
    window.history.replaceState({}, "", "/auth/invitation?token_hash=0123456789abcdef&type=recovery")
    render(<InvitationPage />)

    expect(await screen.findByRole("heading", { name: "This link cannot be used" })).toBeInTheDocument()
    expect(verifyOtp).not.toHaveBeenCalled()
  })
})
