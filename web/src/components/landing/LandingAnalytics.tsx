"use client";

import { useEffect } from "react";
import { trackLandingEvent } from "@/lib/landing-analytics";

export default function LandingAnalytics() {
  useEffect(() => {
    trackLandingEvent("landing_view");
    const seen = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const element = entry.target as HTMLElement;
          const section = element.dataset.analyticsSection;
          const feature = element.dataset.analyticsFeature;
          const key = feature ? `feature:${feature}` : `section:${section}`;
          if (!key || seen.has(key)) continue;
          seen.add(key);
          if (feature) trackLandingEvent("feature_explored", { feature });
          else if (section) trackLandingEvent("section_viewed", { section });
        }
      },
      { threshold: 0.18, rootMargin: "0px 0px -18% 0px" },
    );

    const elements = document.querySelectorAll<HTMLElement>(
      "[data-analytics-section], [data-analytics-feature]",
    );
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  return null;
}
