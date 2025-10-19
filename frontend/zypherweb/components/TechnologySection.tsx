'use client';

import { motion } from 'framer-motion';
import GlassCard from './GlassCard';

export default function TechnologySection() {
  const technologies = [
    {
      title: 'AI Agent Layer',
      icon: '🤖',
      description: 'PyTorch-powered autonomous agents analyze market data, predict volatility, and execute hedging strategies in real-time.',
      features: [
        'Neural network-based risk assessment',
        'Automated collateral rebalancing',
        'Market prediction with >85% accuracy',
        'Gas-optimized transaction batching'
      ],
      gradient: 'from-[#00FFB3] to-[#8A2EFF]'
    },
    {
      title: 'Zero-Knowledge Proofs',
      icon: '🔐',
      description: 'Halo2-based SNARKs ensure complete privacy while maintaining full auditability and regulatory compliance.',
      features: [
        'Encrypted CDP positions',
        'Private transaction history',
        'Verifiable solvency proofs',
        'On-chain privacy guarantees'
      ],
      gradient: 'from-[#8A2EFF] to-[#FF6B00]'
    },
    {
      title: 'RWA Collateral Engine',
      icon: '💎',
      description: 'Multi-asset collateral system supporting tokenized gold, silver, treasuries, and other real-world assets.',
      features: [
        'Pyth oracle price feeds',
        'Dynamic collateral ratios',
        'Automated liquidation protection',
        'Cross-collateral optimization'
      ],
      gradient: 'from-[#FF6B00] to-[#00FFB3]'
    }
  ];

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
          <h2 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-[#8A2EFF] via-[#00FFB3] to-[#FF6B00] bg-clip-text text-transparent">
            Technology Stack
          </h2>
          <p className="text-xl text-[#B8B8B8] max-w-3xl mx-auto leading-relaxed">
            A fusion of artificial intelligence, cryptographic primitives, and decentralized infrastructure
            built on Solana's high-performance blockchain.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-8">
          {technologies.map((tech, index) => (
            <motion.div
              key={tech.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.2 }}
            >
              <GlassCard className="h-full">
                <div className="mb-6">
                  <div className={`inline-block p-4 rounded-xl bg-gradient-to-br ${tech.gradient} mb-4`}>
                    <span className="text-4xl">{tech.icon}</span>
                  </div>
                  <h3 className="text-3xl font-bold mb-3 text-[#F5F5F5]">{tech.title}</h3>
                  <p className="text-[#B8B8B8] leading-relaxed mb-6">{tech.description}</p>
                </div>

                <div className="space-y-3">
                  {tech.features.map((feature, i) => (
                    <motion.div
                      key={i}
                      className="flex items-start gap-3"
                      initial={{ opacity: 0, x: -20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.4, delay: index * 0.2 + i * 0.1 }}
                    >
                      <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${tech.gradient} mt-2 flex-shrink-0`} />
                      <p className="text-[#B8B8B8] text-sm">{feature}</p>
                    </motion.div>
                  ))}
                </div>

                {/* Animated border effect */}
                <motion.div
                  className={`absolute inset-0 rounded-2xl bg-gradient-to-r ${tech.gradient} opacity-0 blur-xl -z-10`}
                  whileHover={{ opacity: 0.2 }}
                  transition={{ duration: 0.3 }}
                />
              </GlassCard>
            </motion.div>
          ))}
        </div>

        {/* Architecture diagram placeholder */}
        <motion.div
          className="mt-20"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <GlassCard className="text-center py-12">
            <h3 className="text-3xl font-bold mb-6 text-[#F5F5F5]">Protocol Architecture</h3>
            <div className="flex flex-col md:flex-row items-center justify-center gap-8 text-[#B8B8B8]">
              <div className="flex flex-col items-center gap-2">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#00FFB3] to-[#8A2EFF] flex items-center justify-center">
                  <span className="text-2xl">👤</span>
                </div>
                <p className="font-semibold">User</p>
              </div>
              
              <div className="text-2xl rotate-90 md:rotate-0">→</div>
              
              <div className="flex flex-col items-center gap-2">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#8A2EFF] to-[#FF6B00] flex items-center justify-center">
                  <span className="text-2xl">📱</span>
                </div>
                <p className="font-semibold">Frontend</p>
              </div>
              
              <div className="text-2xl rotate-90 md:rotate-0">→</div>
              
              <div className="flex flex-col items-center gap-2">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#FF6B00] to-[#00FFB3] flex items-center justify-center">
                  <span className="text-2xl">⚡</span>
                </div>
                <p className="font-semibold">Solana</p>
              </div>
              
              <div className="text-2xl rotate-90 md:rotate-0">→</div>
              
              <div className="flex flex-col items-center gap-2">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#00FFB3] to-[#8A2EFF] flex items-center justify-center">
                  <span className="text-2xl">🧠</span>
                </div>
                <p className="font-semibold">AI Agents</p>
              </div>
            </div>
          </GlassCard>
        </motion.div>
      </div>
    </section>
  );
}
