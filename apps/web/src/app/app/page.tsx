import { redirect } from "next/navigation";

// The branded DashboardHeader links its logo to "/app" as the authenticated
// home. We don't have a dedicated /app screen — forward to /login, which
// itself redirects an authenticated session on to /dashboard or /me by role
// (same contract as the root "/" route).
export default function AppHomePage(): never {
  redirect("/login");
}
