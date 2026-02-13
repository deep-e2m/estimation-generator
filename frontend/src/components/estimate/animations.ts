/**
 * Animation variants for Framer Motion
 * Consistent animation patterns across the estimation UI
 */

import { Variants } from 'framer-motion';

// Fade in with slight upward movement
export const fadeInUp: Variants = {
  hidden: {
    opacity: 0,
    y: 20,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.3,
      ease: 'easeOut',
    },
  },
};

// Fade in with scale
export const fadeInScale: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.95,
  },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.2,
      ease: 'easeOut',
    },
  },
};

// Stagger children container
export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
};

// Fast stagger for lists
export const staggerFast: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.03,
    },
  },
};

// Item for staggered lists
export const staggerItem: Variants = {
  hidden: {
    opacity: 0,
    x: -10,
  },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.2,
    },
  },
};

// Slide in from left
export const slideInLeft: Variants = {
  hidden: {
    opacity: 0,
    x: -30,
  },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.3,
      ease: 'easeOut',
    },
  },
};

// Slide in from right
export const slideInRight: Variants = {
  hidden: {
    opacity: 0,
    x: 30,
  },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.3,
      ease: 'easeOut',
    },
  },
};

// Collapse/expand animation
export const collapse: Variants = {
  hidden: {
    height: 0,
    opacity: 0,
    overflow: 'hidden',
  },
  visible: {
    height: 'auto',
    opacity: 1,
    transition: {
      height: {
        duration: 0.3,
        ease: 'easeOut',
      },
      opacity: {
        duration: 0.2,
        delay: 0.1,
      },
    },
  },
};

// Highlight animation (for updated sections)
export const highlight = {
  animate: {
    backgroundColor: ['rgba(59, 130, 246, 0.15)', 'rgba(59, 130, 246, 0)'],
    transition: {
      duration: 2,
      ease: 'easeOut',
    },
  },
};

// Pulse animation
export const pulse: Variants = {
  animate: {
    scale: [1, 1.05, 1],
    transition: {
      duration: 1.5,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
};

// Button hover/tap animations
export const buttonTap = {
  whileHover: { scale: 1.02 },
  whileTap: { scale: 0.98 },
};

// Card hover animation
export const cardHover = {
  whileHover: {
    y: -2,
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
    transition: { duration: 0.2 },
  },
};

// Spring transition for bouncy animations
export const springTransition = {
  type: 'spring',
  stiffness: 300,
  damping: 25,
};

// Ease transition for smooth animations
export const easeTransition = {
  duration: 0.3,
  ease: [0.4, 0, 0.2, 1],
};
