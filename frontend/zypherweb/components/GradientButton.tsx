'use client';

import { motion } from 'framer-motion';
import { ReactNode } from 'react';

interface GradientButtonProps {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary';
  className?: string;
}

export default function GradientButton({ 
  children, 
  onClick, 
  variant = 'primary',
  className = '' 
}: GradientButtonProps) {
  const gradients = {
    primary: 'from-[#00FFB3] to-[#8A2EFF]',
    secondary: 'from-[#FF6B00] to-[#8A2EFF]'
  };

  return (
    <motion.button
      onClick={onClick}
      className={`relative px-8 py-4 rounded-lg font-semibold text-lg overflow-hidden group ${className}`}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      transition={{ duration: 0.2 }}
    >
      {/* Gradient background */}
      <div className={`absolute inset-0 bg-gradient-to-r ${gradients[variant]} opacity-100 transition-opacity duration-300`} />
      
      {/* Animated glow effect */}
      <motion.div
        className={`absolute inset-0 bg-gradient-to-r ${gradients[variant]} opacity-0 group-hover:opacity-100 blur-xl transition-opacity duration-300`}
        animate={{
          scale: [1, 1.2, 1],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />
      
      {/* Button content */}
      <span className="relative z-10 text-black font-bold tracking-wide">
        {children}
      </span>
    </motion.button>
  );
}
