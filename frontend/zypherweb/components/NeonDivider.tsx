'use client';

import { motion } from 'framer-motion';

interface NeonDividerProps {
  className?: string;
}

export default function NeonDivider({ className = '' }: NeonDividerProps) {
  return (
    <div className={`relative h-px w-full my-16 ${className}`}>
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-[#00FFB3] to-transparent opacity-50"
        animate={{
          opacity: [0.3, 0.7, 0.3],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-[#8A2EFF] to-transparent blur-sm"
        animate={{
          opacity: [0.2, 0.5, 0.2],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 0.5
        }}
      />
    </div>
  );
}
