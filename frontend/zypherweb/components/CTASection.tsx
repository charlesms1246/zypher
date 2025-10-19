'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';
import GradientButton from './GradientButton';
import GlassCard from './GlassCard';

export default function CTASection() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Integrate with email service
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3000);
  };

  return (
    <section className="relative py-24 px-6">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <GlassCard className="text-center py-16 relative overflow-hidden">
            {/* Animated background gradient */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-br from-[#00FFB3]/20 via-[#8A2EFF]/20 to-[#FF6B00]/20 blur-3xl"
              animate={{
                scale: [1, 1.2, 1],
                rotate: [0, 90, 0],
              }}
              transition={{
                duration: 10,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />

            <div className="relative z-10">
              <motion.h2
                className="text-5xl md:text-6xl font-bold mb-6"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
              >
                <span className="bg-gradient-to-r from-[#00FFB3] via-[#8A2EFF] to-[#FF6B00] bg-clip-text text-transparent">
                  Join the Revolution
                </span>
              </motion.h2>

              <motion.p
                className="text-xl text-[#B8B8B8] mb-12 max-w-2xl mx-auto leading-relaxed"
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.2 }}
              >
                Be among the first to experience privacy-preserving finance. 
                Launch your encrypted CDP, participate in prediction markets, or contribute to the ecosystem.
              </motion.p>

              {/* Waitlist form */}
              <motion.div
                className="mb-12"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.4 }}
              >
                <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    className="flex-1 px-6 py-4 rounded-lg bg-[#121212] border border-[#00FFB3]/30 text-[#F5F5F5] placeholder-[#B8B8B8] focus:outline-none focus:border-[#00FFB3] transition-colors"
                    required
                  />
                  <button
                    type="submit"
                    className="px-8 py-4 rounded-lg bg-gradient-to-r from-[#00FFB3] to-[#8A2EFF] text-black font-bold hover:scale-105 transition-transform"
                  >
                    {submitted ? '✓ Subscribed!' : 'Join Waitlist'}
                  </button>
                </form>
                <p className="text-sm text-[#B8B8B8] mt-4">
                  No spam. Only protocol updates and launch announcements.
                </p>
              </motion.div>

              {/* Action buttons */}
              <motion.div
                className="flex flex-col sm:flex-row gap-6 justify-center items-center"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.6 }}
              >
                <GradientButton variant="primary">
                  Launch App
                </GradientButton>
                <GradientButton variant="secondary">
                  View Documentation
                </GradientButton>
              </motion.div>

              {/* Social links */}
              <motion.div
                className="mt-12 flex gap-6 justify-center"
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.8 }}
              >
                {['Twitter', 'Discord', 'GitHub', 'Telegram'].map((platform) => (
                  <motion.a
                    key={platform}
                    href="#"
                    className="text-[#B8B8B8] hover:text-[#00FFB3] transition-colors"
                    whileHover={{ scale: 1.1 }}
                  >
                    {platform}
                  </motion.a>
                ))}
              </motion.div>
            </div>
          </GlassCard>
        </motion.div>

        {/* Footer */}
        <motion.div
          className="mt-16 text-center text-[#B8B8B8] text-sm"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <p className="mb-4">Built on Solana • Powered by AI • Secured by ZK</p>
          <p>© 2025 Zypher Protocol. All rights reserved.</p>
        </motion.div>
      </div>
    </section>
  );
}
