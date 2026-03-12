import { useState } from 'react';

export function useAdmin() {
const [adminUsers, setAdminUsers] = useState<AdminUser[]>([])
const [adminUserPlans, setAdminUserPlans] = useState<Record<number, "basis" | "starter" | "pro" | "scale">>({})
const [adminLoading, setAdminLoading] = useState(false)

const loadAdminUsers = async () => {
  setAdminLoading(true)
  try {
    const r = await fetchWithAuth("/api/admin/users")
    const d = await r.json()
    if (d.ok) {
      setAdminUsers(d.users || [])
      const plans: Record<number, "basis" | "starter" | "pro" | "scale"> = {}
      for (const u of d.users || []) { plans[u.id] = u.plan || "basis" }
      setAdminUserPlans(plans)
    } else alert(d.error || t("Admin load failed"))
  } catch { alert(t("Admin load failed")) } finally { setAdminLoading(false) }
}
const deleteUser = async (userId: number, userEmail: string) => {
  if (!confirm(`Are you sure you want to delete user "${userEmail}"? This will also delete all their projects.`)) {
    return
  }
  
  try {
    const r = await fetchWithAuth(`/api/admin/users/${userId}`, { 
      method: "DELETE", 
    })
    const d = await r.json()
    if (d.ok) {
      alert("User deleted successfully")
      loadAdminUsers()
    } else {
      alert(d.error || t("Delete failed"))
    }
  } catch {
    alert(t("Delete failed"))
  }
}

const addCredits = async (userId: number, userEmail: string) => {
  const credits = prompt(`How many dollars in credits to add to "${userEmail}"?\n\nExample: 25 = $25.00 credits`)
  if (!credits || isNaN(Number(credits)) || Number(credits) <= 0) {
    if (credits !== null) alert(t("Please enter a valid positive number"))
    return
  }
  
  try {
    const r = await fetchWithAuth(`/api/admin/users/${userId}/add-credits`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credits: Number(Number(credits) * 100) }), // Convert dollars to cents
    })
    const d = await r.json()
    if (d.ok) {
      alert(`✅ Successfully added $${Number(credits).toFixed(2)} credits to ${userEmail}`)
      loadAdminUsers()
    } else {
      alert(`❌ Failed to add credits: ${d.error || "Unknown error"}`)
    }
  } catch {
    alert("❌ Failed to add credits - network error")
  }
}

const resetPassword = async (userId: number, userEmail: string) => {
  if (!confirm(`Send password reset link to "${userEmail}"?`)) {
    return
  }
  
  try {
    const r = await fetchWithAuth("/api/admin/send-reset", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId }),
    })
    const d = await r.json()
    if (d.ok) {
      alert(`Password reset link sent to ${userEmail}`)
    } else {
      alert(`Failed to send reset: ${d.error || "Unknown error"}`)
    }
  } catch {
    alert("Failed to send reset - network error")
  }
}
const assignPlan = async (userId: number, userEmail: string) => {
  const current = adminUserPlans[userId] || "basis"
  const next = prompt(`Assign plan to "${userEmail}"\n\nOptions: basis, starter, pro, scale`, current)
  if (!next) return
  const normalized = String(next).trim().toLowerCase()
  if (!["basis", "starter", "pro", "scale"].includes(normalized)) { alert("Invalid plan"); return }
  const plan = normalized as "basis" | "starter" | "pro" | "scale"
  setAdminUserPlans(prev => ({ ...prev, [userId]: plan }))
  try {
    const response = await fetchWithAuth(`/api/admin/users/${userId}/set-plan`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ plan }),
    })
    const data = await response.json()
    if (!data.ok) {
      setAdminUserPlans(prev => ({ ...prev, [userId]: current }))
      alert("Failed: " + data.error)
      return
    }

    await loadAdminUsers()

    if (authUser && authUser !== "loading" && authUser.id === userId) {
      const refreshedPlan = await apiGetPlan().catch(() => null)
      setDemoPlan(refreshedPlan || plan)
    }

    alert(`✅ Plan "${plan}" saved`)
  } catch {
    setAdminUserPlans(prev => ({ ...prev, [userId]: current }))
    alert("Network error")
  }
}

const createUser = async () => {
  if (!newUser.email || !newUser.password) {
    alert("Email and password required")
    return
  }
  
  try {
    const r = await fetchWithAuth("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({...newUser, credits: Number(newUser.credits * 100)}), // Convert dollars to cents
    })
    const d = await r.json()
    if (d.ok) {
      alert("User created successfully")
      setShowCreateUser(false)
      setNewUser({ email: "", password: "", name: "", credits: 0 })
      loadAdminUsers()
    } else {
      alert(d.error || "Create user failed")
    }
  } catch {
    alert("Create user failed")
  }
}

  return { adminUsers, adminUserPlans, adminLoading, loadAdminUsers, deleteUser, addCredits, resetPassword, assignPlan, createUser };
}
