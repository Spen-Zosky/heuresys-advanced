import { Facebook, Github, Linkedin } from "lucide-react";
import { HeuresysComLogo } from "@/components/brand/HeuresysComLogo";

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <path d="M18.244 2H21.5l-7.11 8.13L22.75 22h-6.54l-5.12-6.69L5.23 22H1.97l7.6-8.69L1.55 2h6.7l4.63 6.12L18.244 2Zm-1.14 17.91h1.8L7.27 3.98H5.34l11.764 15.93Z" />
    </svg>
  );
}

export function Footer() {
  const currentYear = new Date().getFullYear();

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
      id: "x",
      label: "Open Heuresys on X",
      href: "https://x.com/heuresys",
      icon: XIcon,
    },
    {
      id: "facebook",
      label: "Open Heuresys on Facebook",
      href: "https://www.facebook.com/heuresys",
      icon: Facebook,
    },
  ];

  return (
    <footer className="z-30 flex h-11 items-center justify-between border-t border-border bg-background px-4 text-xs text-muted-foreground">
      <div className="flex items-center gap-3">
        <span>© {currentYear}</span>
        <span aria-hidden="true" className="text-border">|</span>
        <a
          href="https://heuresys.com"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Open Heuresys website"
          className="inline-flex items-center text-muted-foreground hover:text-foreground"
        >
          <HeuresysComLogo className="h-5 w-auto" />
        </a>
        <span aria-hidden="true" className="text-border">|</span>
        <div className="flex items-center gap-2">
          {socialLinks.map((link) => {
            const Icon = link.icon;
            return (
              <a
                key={link.id}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={link.label}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <Icon className="h-4 w-4" />
              </a>
            );
          })}
        </div>
      </div>

      <div className="hidden items-center gap-3 md:flex">
        <span>Environment: Development</span>
        <span>Version: UX/IX v1</span>
      </div>
    </footer>
  );
}
