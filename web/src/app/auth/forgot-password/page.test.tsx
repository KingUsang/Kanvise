import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import ForgotPasswordPage from "./page"

const resetPasswordForEmail = vi.fn()
const verifyOtp = vi.fn()
const push = vi.fn()
const refresh = vi.fn()

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { resetPasswordForEmail, verifyOtp } }),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}))

vi.mock("@/components/auth/auth-logo", () => ({
  AuthLogo: () => <div>Kanvise</div>,
}))

describe("ForgotPasswordPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetPasswordForEmail.mockResolvedValue({ error: null })
    verifyOtp.mockResolvedValue({ data: { session: { access_token: "recovery-session" } }, error: null })
  })

  it("sends a recovery email then verifies its six-digit code", async () => {
    const user = userEvent.setup()
    render(<ForgotPasswordPage />)

    await user.type(screen.getByLabelText("Email address"), "student@example.com")
    await user.click(screen.getByRole("button", { name: "Send reset code" }))

    await waitFor(() => expect(resetPasswordForEmail).toHaveBeenCalledWith("student@example.com"))
    expect(await screen.findByRole("heading", { name: "Check your email" })).toBeInTheDocument()

    await user.type(screen.getByLabelText("Reset code"), "123456")
    await user.click(screen.getByRole("button", { name: "Continue" }))

    await waitFor(() => expect(verifyOtp).toHaveBeenCalledWith({
      email: "student@example.com",
      token: "123456",
      type: "recovery",
    }))
    expect(push).toHaveBeenCalledWith("/auth/reset-password")
    expect(refresh).toHaveBeenCalled()
  })
})
