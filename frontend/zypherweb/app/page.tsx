import HeroSection from '@/components/HeroSection';
import AboutSection from '@/components/AboutSection';
import TechnologySection from '@/components/TechnologySection';
import EcosystemSection from '@/components/EcosystemSection';
import CTASection from '@/components/CTASection';
import ParticleBackground from '@/components/ParticleBackground';

export default function Home() {
  return (
    <div className="relative min-h-screen">
      {/* Particle background animation */}
      <ParticleBackground />
      
      {/* Main content */}
      <main className="relative z-10">
        <HeroSection />
        <AboutSection />
        <TechnologySection />
        <EcosystemSection />
        <CTASection />
      </main>
    </div>
  );
}
