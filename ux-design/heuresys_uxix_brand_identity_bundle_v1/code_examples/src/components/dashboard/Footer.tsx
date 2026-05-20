import { Facebook, Github, Linkedin } from "lucide-react";

// Inlined for X (Twitter) and Discord because Lucide does not ship these brand marks.
function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <path d="M18.244 2H21.5l-7.11 8.13L22.75 22h-6.54l-5.12-6.69L5.23 22H1.97l7.6-8.69L1.55 2h6.7l4.63 6.12L18.244 2Zm-1.14 17.91h1.8L7.27 3.98H5.34l11.764 15.93Z" />
    </svg>
  );
}

function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19.27 5.33A16.5 16.5 0 0 0 15 4l-.5 1.05a14.5 14.5 0 0 0-5 0L9 4a16.5 16.5 0 0 0-4.27 1.33C2.13 9.21 1.6 13.04 1.92 16.81c1.86 1.4 3.66 2.24 5.42 2.79a.6.6 0 0 0 .07-.02c.4-.55.77-1.13 1.07-1.73a10.5 10.5 0 0 1-1.65-.78c.14-.1.27-.2.4-.3a11.6 11.6 0 0 0 9.55 0c.13.1.26.2.4.3-.53.31-1.08.57-1.65.79.3.6.66 1.18 1.07 1.73 1.77-.55 3.57-1.4 5.43-2.79.32-3.77-.21-7.6-2.81-11.48z"/>
      <circle cx="8.5" cy="13" r="1.5"/>
      <circle cx="15.5" cy="13" r="1.5"/>
    </svg>
  );
}

export function Footer() {
  const currentYear = new Date().getFullYear();

  // Canonical order: LinkedIn → GitHub → Discord → Facebook → X (see docs/08_footer_specification.md)
  // Note: URLs marked PLACEHOLDER will be confirmed in the brand-identity link-confirmation session.
  const socialLinks = [
    {
      id: "linkedin",
      label: "Open Heuresys on LinkedIn",
      href: "https://www.linkedin.com/company/heuresys",
      icon: Linkedin,
    },
    {
      id: "github",
      label: "Open Heuresys on GitHub",
      href: "https://github.com/heuresys",
      icon: Github,
    },
    {
      id: "discord",
      label: "Join Heuresys on Discord",
      href: "#", // PLACEHOLDER — confirm in next session
      icon: DiscordIcon,
    },
    {
      id: "facebook",
      label: "Open Heuresys on Facebook",
      href: "https://www.facebook.com/heuresys",
      icon: Facebook,
    },
    {
      id: "x",
      label: "Open Heuresys on X (Twitter)",
      href: "https://x.com/heuresys",
      icon: XIcon,
    },
  ];

  return (
    <footer className="z-30 flex h-11 items-center justify-between border-t border-border bg-background px-4 text-xs text-muted-foreground">
      <div className="flex items-center gap-3">
        <span className="tabular-nums">© {currentYear}</span>
        <span aria-hidden="true" className="text-border">·</span>
        <a
          href="https://www.heuresys.com"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Open Heuresys public website"
          className="font-medium text-muted-foreground transition hover:text-foreground hover:underline"
        >
          heuresys.com
        </a>
        <span aria-hidden="true" className="text-border">·</span>
        <div className="flex items-center gap-1">
          {socialLinks.map((link) => {
            const Icon = link.icon;
            return (
              <a
                key={link.id}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={link.label}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-foreground"
              >
                <Icon className="h-4 w-4" />
              </a>
            );
          })}
        </div>
      </div>

      {/* Right area — context-specific. Override per surface. */}
      <div className="hidden items-center gap-3 md:flex">
        <span>Environment: Development</span>
        <span aria-hidden="true" className="text-border">·</span>
        <span>UX/IX v1</span>
      </div>
    </footer>
  );
}
