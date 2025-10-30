'use client';

import { motion } from 'framer-motion';
import GradientButton from './GradientButton';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function HeroSection() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({
        x: (e.clientX / window.innerWidth) * 100,
        y: (e.clientY / window.innerHeight) * 100,
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Animated gradient background */}
      <motion.div
        className="absolute inset-0 opacity-30"
        style={{
          background: `radial-gradient(circle at ${mousePosition.x}% ${mousePosition.y}%, #00FFB3 0%, #8A2EFF 50%, #0A2540 100%)`,
        }}
        animate={{
          scale: [1, 1.1, 1],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />

      {/* Flowing wind lines */}
      <svg className="absolute inset-0 w-full h-full opacity-20" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="windGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: '#00FFB3', stopOpacity: 0.8 }} />
            <stop offset="100%" style={{ stopColor: '#8A2EFF', stopOpacity: 0.2 }} />
          </linearGradient>
        </defs>
        {[...Array(5)].map((_, i) => (
          <motion.path
            key={i}
            d={`M 0 ${100 + i * 150} Q 400 ${50 + i * 150} 800 ${100 + i * 150} T 1600 ${100 + i * 150}`}
            stroke="url(#windGradient)"
            strokeWidth="2"
            fill="none"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ 
              pathLength: [0, 1, 0],
              opacity: [0, 0.6, 0]
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              delay: i * 0.3,
              ease: "easeInOut"
            }}
          />
        ))}
      </svg>

      {/* Animated Z symbol */}
      <motion.div
        className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2"
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 0.1, scale: 1 }}
        transition={{ duration: 1.5, ease: "easeOut" }}
      >
        <svg width="400" height="400" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
          <motion.path
            d="M 40 40 L 160 40 L 40 160 L 160 160"
            stroke="url(#windGradient)"
            strokeWidth="8"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 2, delay: 0.5 }}
          />
        </svg>
      </motion.div>

      {/* Content */}
      <div className="relative z-10 text-center px-6 max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.3 }}
        >
          <motion.h1 
            className="text-7xl md:text-8xl lg:text-9xl font-bold mb-6 tracking-tight"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            <span className="inline-block">
              <motion.span
                className="bg-gradient-to-r from-[#00FFB3] via-[#8A2EFF] to-[#FF6B00] bg-clip-text text-transparent"
                animate={{
                  backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
                }}
                transition={{
                  duration: 5,
                  repeat: Infinity,
                  ease: "linear"
                }}
                style={{ backgroundSize: '200% 200%' }}
              >
                ZYPHER
              </motion.span>
            </span>
          </motion.h1>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.6 }}
        >
          <p className="text-2xl md:text-3xl lg:text-4xl font-semibold mb-4 text-[#F5F5F5]">
            Silent Proofs. Loud Impact.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.9 }}
        >
          <p className="text-lg md:text-xl text-[#B8B8B8] mb-12 max-w-3xl mx-auto leading-relaxed">
            Privacy-preserving stablecoins powered by AI agents, zero-knowledge proofs, 
            and real-world assets on Solana. Where cryptographic finance meets intelligence.
          </p>
        </motion.div>

        <motion.div
          className="flex flex-col sm:flex-row gap-6 justify-center items-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 1.2 }}
        >
          <GradientButton variant="primary" href="/mint">
            Mint
          </GradientButton>
          <GradientButton variant="secondary" href="/dashboard">
            Dashboard
          </GradientButton>
          <GradientButton variant="secondary" href="/create-market">
            Create Market
          </GradientButton>
        </motion.div>

        {/* Scroll indicator removed as requested */}
      </div>
    </section>
  );
}
