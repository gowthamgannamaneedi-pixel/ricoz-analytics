import React, { useState } from 'react';
import LandingNavbar from '../components/landing/LandingNavbar';
import LandingHero from '../components/landing/LandingHero';
import StatsBanner from '../components/landing/StatsBanner';
import FeaturesGrid from '../components/landing/FeaturesGrid';
import TestimonialBanner from '../components/landing/TestimonialBanner';
import PlatformShowcase from '../components/landing/PlatformShowcase';
import CapabilitiesMatrix from '../components/landing/CapabilitiesMatrix';
import SecurityGovernance from '../components/landing/SecurityGovernance';
import LandingFAQ from '../components/landing/LandingFAQ';
import HelpBanner from '../components/landing/HelpBanner';
import CallToAction from '../components/landing/CallToAction';
import LandingFooter from '../components/landing/LandingFooter';
import DemoModal from '../components/landing/DemoModal';

/**
 * Public Landing Page for RicozAnalytics
 * Re-architected to closely match the Ricoz brand experience (https://ricoz.in/franchise)
 * Communicates enterprise BI, multi-source data ingestion, KPI engine, AI anomaly alerts, and automated reporting.
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
    <div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-red-600 selection:text-white">
      {/* Top Navigation Bar */}
      <LandingNavbar onOpenDemo={handleOpenDemo} />

      {/* Main Content Sections */}
      <main id="platform">
        {/* Hero Section with Live Product Preview Simulator */}
        <LandingHero onOpenDemo={handleOpenDemo} />

        {/* 4-Column Platform Metrics & Stats Banner */}
        <StatsBanner />

        {/* Core Value Pillars: Why RicozAnalytics (6 Core Cards) */}
        <FeaturesGrid />

        {/* Executive Testimonial & Partner Endorsement Banner */}
        <TestimonialBanner />

        {/* Interactive Platform Showcase (One Unified Platform, Complete Visibility) */}
        <PlatformShowcase onOpenDemo={handleOpenDemo} />

        {/* What Can You Analyze & What Can You Do With Your Data Matrix */}
        <CapabilitiesMatrix />

        {/* Enterprise Security, Granular RBAC & Compliance */}
        <SecurityGovernance />

        {/* Interactive FAQ Accordion */}
        <LandingFAQ />

        {/* Specialist Consultation & Help Banner */}
        <HelpBanner onOpenDemo={handleOpenDemo} />

        {/* Bottom High-Conversion Hero Callout */}
        <CallToAction onOpenDemo={handleOpenDemo} />
      </main>

      {/* Solid Crimson Red Ricoz Brand Footer */}
      <LandingFooter />

      {/* Interactive Architecture Consultation / Demo Modal */}
      <DemoModal isOpen={isDemoModalOpen} onClose={handleCloseDemo} />
    </div>
  );
}
