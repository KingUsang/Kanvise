import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import ResetPasswordPage from "./page"

const getUser = vi.fn()
const getSession = vi.fn()
const updateUser = vi.fn()

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { getUser, getSession, updateUser } }),
}))
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }))

const student = { app_metadata: { kanvise_role: "student" }, user_metadata: { first_name: "Ada", last_name: "Obi" } }

describe("ResetPasswordPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getUser.mockResolvedValue({ data: { user: student } })
    getSession.mockResolvedValue({ data: { session: { access_token: "tok" } } })
    updateUser.mockResolvedValue({ error: null })
    vi.spyOn(console, "error").mockImplementation(() => {})
  })

  async function submit() {
    const user = userEvent.setup()
    render(<ResetPasswordPage />)
    await user.type(await screen.findByLabelText("New password"), "Password1")
    await user.type(screen.getByLabelText("Confirm password"), "Password1")
    await user.click(screen.getByRole("button", { name: /Update password/ }))
  }

  it("sends names to profile activation and checks the response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)
    await submit()
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ first_name: "Ada", last_name: "Obi" })
    expect(screen.queryByRole("alert")).toBeNull()
  })

  it("tells the learner when activation fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 400 })))
    await submit()
    expect(await screen.findByRole("alert")).toHaveTextContent(/could not finish activating/i)
  })
})
