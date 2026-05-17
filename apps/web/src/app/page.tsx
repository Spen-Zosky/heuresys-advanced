import { redirect } from "next/navigation";

// Root route always lands on the login screen; once authenticated, /login
// itself redirects forward to /dashboard or /me depending on role.
export default function HomePage(): never {
  redirect("/login");
}
