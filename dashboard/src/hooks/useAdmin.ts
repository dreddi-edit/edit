import { useState } from "react"
import { fetchWithAuth } from "../api/client"

type AdminPlan = "basis" | "starter" | "pro" | "scale"

type AdminUser = {
  id: number
  email: string
  name?: string
  credits?: number
  created_at?: string
  plan?: AdminPlan
}

type NewUserPayload = {
  email: string
  password: string
  name?: string
  credits?: number
}

async function parseResponse(response: Response) {
  const data = await response.json().catch(() => ({}))
  if (!response.ok || data?.ok === false) {
    throw new Error(data?.error || `${response.status} ${response.statusText}`)
  }
  return data
}

export function useAdmin() {
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([])
  const [adminUserPlans, setAdminUserPlans] = useState<Record<number, AdminPlan>>({})
  const [adminLoading, setAdminLoading] = useState(false)

  const loadAdminUsers = async () => {
    setAdminLoading(true)
    try {
      const response = await fetchWithAuth("/api/admin/users")
      const data = await parseResponse(response)
      const users: AdminUser[] = Array.isArray(data?.users) ? data.users : []
      const plans: Record<number, AdminPlan> = {}
      users.forEach((user) => {
        plans[user.id] = (user.plan as AdminPlan) || "basis"
      })
      setAdminUsers(users)
      setAdminUserPlans(plans)
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Admin load failed")
      setAdminUsers([])
      setAdminUserPlans({})
    } finally {
      setAdminLoading(false)
    }
  }

  const deleteUser = async (userId: number, userEmail: string) => {
    if (!window.confirm(`Delete user "${userEmail}" and all related data?`)) return
    try {
      const response = await fetchWithAuth(`/api/admin/users/${userId}`, { method: "DELETE" })
      await parseResponse(response)
      await loadAdminUsers()
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Delete failed")
    }
  }

  const addCredits = async (userId: number, userEmail: string) => {
    const value = window.prompt(`How many euros in credits should be added for "${userEmail}"?`, "25")
    if (value == null) return
    const numeric = Number(value)
    if (!Number.isFinite(numeric) || numeric <= 0) {
      window.alert("Enter a valid positive number")
      return
    }
    try {
      const response = await fetchWithAuth(`/api/admin/users/${userId}/add-credits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credits: Math.round(numeric * 100) }),
      })
      await parseResponse(response)
      await loadAdminUsers()
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Add credits failed")
    }
  }

  const resetPassword = async (userId: number, userEmail: string) => {
    if (!window.confirm(`Send password reset link to "${userEmail}"?`)) return
    try {
      const response = await fetchWithAuth("/api/admin/send-reset", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId }),
      })
      await parseResponse(response)
      window.alert(`Password reset link sent to ${userEmail}`)
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Reset link failed")
    }
  }

  const assignPlan = async (userId: number, userEmail: string) => {
    const current = adminUserPlans[userId] || "basis"
    const next = window.prompt(`Assign plan to "${userEmail}" (basis, starter, pro, scale)`, current)
    if (!next) return
    const normalized = String(next).trim().toLowerCase()
    if (!["basis", "starter", "pro", "scale"].includes(normalized)) {
      window.alert("Invalid plan")
      return
    }
    const plan = normalized as AdminPlan
    setAdminUserPlans((previous) => ({ ...previous, [userId]: plan }))
    try {
      const response = await fetchWithAuth(`/api/admin/users/${userId}/set-plan`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan }),
      })
      await parseResponse(response)
      await loadAdminUsers()
    } catch (error) {
      setAdminUserPlans((previous) => ({ ...previous, [userId]: current }))
      window.alert(error instanceof Error ? error.message : "Plan update failed")
    }
  }

  const createUser = async (payload?: NewUserPayload) => {
    const email = String(payload?.email || "").trim() || window.prompt("Email")?.trim() || ""
    const password = String(payload?.password || "").trim() || window.prompt("Password")?.trim() || ""
    const name = String(payload?.name || "").trim()
    const creditsEuros = Number(payload?.credits || 0)
    if (!email || !password) {
      window.alert("Email and password are required")
      return false
    }
    try {
      const response = await fetchWithAuth("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          name,
          credits: Math.max(0, Math.round(creditsEuros * 100)),
        }),
      })
      await parseResponse(response)
      await loadAdminUsers()
      return true
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Create user failed")
      return false
    }
  }

  return {
    adminUsers,
    adminUserPlans,
    adminLoading,
    loadAdminUsers,
    deleteUser,
    addCredits,
    resetPassword,
    assignPlan,
    createUser,
  }
}
