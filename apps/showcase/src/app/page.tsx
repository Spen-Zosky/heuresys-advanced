import { redirect } from "next/navigation";

/**
 * Root entrypoint for the static-export deploy. Redirects to /showcase which
 * carries the actual index page (copied from apps/web by sync-showcase.sh).
 *
 * In static export mode, `redirect()` from a server component generates an
 * HTML page that performs a client-side navigation on load.
 */
export default function RootPage(): never {
  redirect("/showcase");
}
