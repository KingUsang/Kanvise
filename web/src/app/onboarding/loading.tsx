import { OnboardingSkeleton } from "@/components/onboarding/onboarding-skeleton";

/** Streams at once while the page checks the sign-in (16 R-08). */
export default function OnboardingLoading() {
  return <OnboardingSkeleton />;
}
