'use client';

import { motion } from 'framer-motion';
import GlassCard from './GlassCard';
import NeonDivider from './NeonDivider';

export default function AboutSection() {
  return (
    <section className="relative py-24 px-6">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center mb-20"
        >
          <h2 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-[#00FFB3] to-[#8A2EFF] bg-clip-text text-transparent">
            The Silent Movement of Truth
          </h2>
          <p className="text-xl text-[#B8B8B8] max-w-3xl mx-auto leading-relaxed">
            Zypher represents the convergence of privacy, artificial intelligence, and cryptographic finance—
            a protocol where encrypted stablecoins meet autonomous decision-making.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-8 mb-16">
          <GlassCard>
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-[#00FFB3] to-[#8A2EFF] flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <div>
                <h3 className="text-2xl font-semibold mb-3 text-[#F5F5F5]">Privacy-First Architecture</h3>
                <p className="text-[#B8B8B8] leading-relaxed">
                  Every transaction is shielded by zero-knowledge proofs. Your financial activity remains 
                  encrypted while maintaining full verifiability on Solana's high-performance blockchain.
                </p>
              </div>
            </div>
          </GlassCard>

          <GlassCard>
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-[#FF6B00] to-[#8A2EFF] flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <h3 className="text-2xl font-semibold mb-3 text-[#F5F5F5]">Real-World Asset Backing</h3>
                <p className="text-[#B8B8B8] leading-relaxed">
                  Stablecoins backed by tokenized RWAs—from precious metals to treasury bonds—
                  creating a bridge between traditional finance and decentralized systems.
                </p>
              </div>
            </div>
          </GlassCard>

          <GlassCard>
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-[#8A2EFF] to-[#00FFB3] flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <h3 className="text-2xl font-semibold mb-3 text-[#F5F5F5]">AI-Powered Risk Management</h3>
                <p className="text-[#B8B8B8] leading-relaxed">
                  Autonomous agents continuously monitor market conditions, executing hedging strategies 
                  to maintain stability without human intervention.
                </p>
              </div>
            </div>
          </GlassCard>

          <GlassCard>
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-[#00FFB3] to-[#FF6B00] flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-2xl font-semibold mb-3 text-[#F5F5F5]">Decentralized Governance</h3>
                <p className="text-[#B8B8B8] leading-relaxed">
                  Community-driven decision making through prediction markets and transparent voting, 
                  ensuring the protocol evolves with its users.
                </p>
              </div>
            </div>
          </GlassCard>
        </div>

        <NeonDivider />
      </div>
    </section>
  );
}
