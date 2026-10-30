import React, { useState } from 'react';
import LandingNavbar from '../components/landing/LandingNavbar';
import LandingHero from '../components/landing/LandingHero';
import StatsBanner from '../components/landing/StatsBanner';
import ProductShowcase from '../components/landing/ProductShowcase';
import KeyFeaturesSection from '../components/landing/KeyFeaturesSection';
import AnalyticsShowcase from '../components/landing/AnalyticsShowcase';
import AIInsightsSection from '../components/landing/AIInsightsSection';
import DataIntegrationsSection from '../components/landing/DataIntegrationsSection';
import SecuritySection from '../components/landing/SecuritySection';
import PricingSection from '../components/landing/PricingSection';
import LandingFAQ from '../components/landing/LandingFAQ';
import CallToAction from '../components/landing/CallToAction';
import LandingFooter from '../components/landing/LandingFooter';
import DemoModal from '../components/landing/DemoModal';

/**
 * Public Landing Page for RicozAnalytics
 * Complete Visual Redesign implementing a premium enterprise SaaS identity.
 * Structures:
 * 1. Professional navigation bar
 * 2. Hero section with headline, description, CTAs and realistic dashboard visual
 * 3. Product dashboard showcase (interactive multi-tab views)
 * 4. Key features with custom graphics
 * 5. Analytics & visualization showcase (interactive chart studio)
 * 6. AI Insights section (natural language copilot simulator)
 * 7. Data integration section (16+ connectors & Zero-ETL pipeline)
 * 8. Security & collaboration section (Enterprise RBAC, team threads)
 * 9. Pricing preview (Monthly / Annual toggle, 3 transparent tiers)
 * 10. FAQ section (Interactive accordion with search)
 * 11. Professional footer (Dark slate enterprise styling, system status, legal links)
 */
export default function LandingPage() {
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);

  const handleOpenDemo = () => {
    setIsDemoModalOpen(true);
  };

  const handleCloseDemo = () => {
    setIsDemoModalOpen(false);
  };

  return (
    <div className="min-h-screen bg-white dark:bg-[#0B0F19] text-slate-900 dark:text-slate-100 font-sans selection:bg-red-600 selection:text-white transition-colors duration-200">
      {/* 1. Professional Navigation Bar */}
      <LandingNavbar onOpenDemo={handleOpenDemo} />

      <main id="overview">
        {/* 2. Hero Section with Headline, CTAs, and Realistic Dashboard Visual */}
        <LandingHero onOpenDemo={handleOpenDemo} />

        {/* Supporting Platform Metric Counters Ticker */}
        <StatsBanner />

        {/* 3. Product Dashboard Showcase */}
        <ProductShowcase onOpenDemo={handleOpenDemo} />

        {/* 4. Key Features with Custom Graphics */}
        <KeyFeaturesSection />

        {/* 5. Analytics & Visualization Showcase */}
        <AnalyticsShowcase />

        {/* 6. AI Insights Section */}
        <AIInsightsSection onOpenDemo={handleOpenDemo} />

        {/* 7. Data Integration Section */}
        <DataIntegrationsSection onOpenDemo={handleOpenDemo} />

        {/* 8. Security & Collaboration Section */}
        <SecuritySection onOpenDemo={handleOpenDemo} />

        {/* 9. Pricing Preview */}
        <PricingSection onOpenDemo={handleOpenDemo} />

        {/* 10. FAQ Section */}
        <LandingFAQ />

        {/* Pre-Footer High-Conversion Callout */}
        <CallToAction onOpenDemo={handleOpenDemo} />
      </main>

      {/* 11. Professional Footer */}
      <LandingFooter />

      {/* Interactive Architecture Consultation / Demo Modal */}
      <DemoModal isOpen={isDemoModalOpen} onClose={handleCloseDemo} />
    </div>
  );
}
