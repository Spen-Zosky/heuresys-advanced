import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Brownfield Adaptation | Heuresys",
};

export default function BrownfieldAdaptationLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
