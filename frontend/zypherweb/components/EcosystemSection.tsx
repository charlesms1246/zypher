'use client';

import { motion } from 'framer-motion';
import GlassCard from './GlassCard';
import NeonDivider from './NeonDivider';

export default function EcosystemSection() {
  const modules = [
    {
      title: 'CDP Vault',
      description: 'Lock collateral, mint encrypted stablecoins, manage positions with full privacy',
      icon: '🏦',
      stats: ['150% Min Collateral', 'Sub-second Minting', 'ZK-Protected']
    },
    {
      title: 'Prediction Markets',
      description: 'Forecast market events, earn rewards, influence protocol decisions',
      icon: '🎯',
      stats: ['Decentralized Oracle', 'Community Driven', 'Transparent Results']
    },
    {
      title: 'AI Hedging Engine',
      description: 'Autonomous risk management, automated rebalancing, 24/7 monitoring',
      icon: '⚡',
      stats: ['Real-time Analysis', 'Smart Execution', 'Gas Optimized']
    },
    {
      title: 'Privacy Layer',
      description: 'Zero-knowledge proofs, encrypted transactions, anonymous positions',
      icon: '🛡️',
      stats: ['Halo2 SNARKs', 'Full Privacy', 'Verifiable Security']
    },
    {
      title: 'Oracle Network',
      description: 'Multi-source price feeds, RWA valuations, real-time market data',
      icon: '📡',
      stats: ['Pyth Integration', 'High Accuracy', 'Low Latency']
    },
    {
      title: 'Governance',
      description: 'Vote on proposals, shape the future, earn protocol rewards',
      icon: '🗳️',
      stats: ['DAO Controlled', 'Token Voting', 'Transparent']
    }
  ];

  return (
    <section className="relative py-24 px-6">
      <div className="max-w-7xl mx-auto">
        <NeonDivider />
        
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center mb-20"
        >
          <h2 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-[#FF6B00] via-[#8A2EFF] to-[#00FFB3] bg-clip-text text-transparent">
            Modular Ecosystem
          </h2>
          <p className="text-xl text-[#B8B8B8] max-w-3xl mx-auto leading-relaxed">
            Six interconnected modules working in harmony to create a seamless, 
            privacy-preserving financial experience on Solana.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {modules.map((module, index) => (
            <motion.div
              key={module.title}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <GlassCard className="h-full relative overflow-hidden group">
                {/* Gradient overlay on hover */}
                <div className="absolute inset-0 bg-gradient-to-br from-[#00FFB3]/10 via-[#8A2EFF]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                
                <div className="relative z-10">
                  <div className="text-5xl mb-4">{module.icon}</div>
                  <h3 className="text-2xl font-bold mb-3 text-[#F5F5F5]">{module.title}</h3>
                  <p className="text-[#B8B8B8] mb-6 leading-relaxed">{module.description}</p>
                  
                  <div className="flex flex-wrap gap-2">
                    {module.stats.map((stat, i) => (
                      <span
                        key={i}
                        className="text-xs px-3 py-1 rounded-full bg-[#0A2540]/50 text-[#00FFB3] border border-[#00FFB3]/30"
                      >
                        {stat}
                      </span>
                    ))}
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          ))}
        </div>

        {/* Integration visualization */}
        <motion.div
          className="mt-20"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <GlassCard className="text-center py-12">
            <h3 className="text-3xl font-bold mb-6 text-[#F5F5F5]">
              Seamlessly Integrated
            </h3>
            <p className="text-lg text-[#B8B8B8] max-w-2xl mx-auto mb-8">
              All modules communicate through Solana's high-speed runtime, 
              ensuring atomic transactions and real-time synchronization.
            </p>
            
            <div className="flex items-center justify-center gap-4 flex-wrap">
              <motion.div
                className="px-6 py-3 rounded-lg bg-gradient-to-r from-[#00FFB3] to-[#8A2EFF] text-black font-semibold"
                whileHover={{ scale: 1.05 }}
              >
                400ms Avg Latency
              </motion.div>
              <motion.div
                className="px-6 py-3 rounded-lg bg-gradient-to-r from-[#8A2EFF] to-[#FF6B00] text-black font-semibold"
                whileHover={{ scale: 1.05 }}
              >
                65k TPS Capacity
              </motion.div>
              <motion.div
                className="px-6 py-3 rounded-lg bg-gradient-to-r from-[#FF6B00] to-[#00FFB3] text-black font-semibold"
                whileHover={{ scale: 1.05 }}
              >
                $0.00025 Gas Fee
              </motion.div>
            </div>
          </GlassCard>
        </motion.div>
      </div>
    </section>
  );
}
