import Navbar from "@/components/landing/Navbar";
import HeroSection from "@/components/landing/HeroSection";
import ProblemSection from "@/components/landing/ProblemSection";
import FeaturesSection from "@/components/landing/FeaturesSection";
import FoundersSection from "@/components/landing/FoundersSection";
import WhyInviteOnly from "@/components/landing/WhyInviteOnly";
import FinalCTA from "@/components/landing/FinalCTA";
import Footer from "@/components/landing/Footer";

export default function LandingPage() {
  return (
    <main className="landing">
      <Navbar />
      <HeroSection />
      <ProblemSection />
      <FeaturesSection />
      <FoundersSection />
      <WhyInviteOnly />
      <FinalCTA />
      <Footer />
    </main>
  );
}
