import type { Variants, Transition } from "framer-motion";

export const CHANNELS_EASE: Transition["ease"] = [0.22, 0.61, 0.36, 1];
export const CHANNELS_DURATION = 0.18;
export const CHANNELS_STAGGER = 0.025;

export const channelsFadeIn: Variants = {
  hidden: { opacity: 0, y: 4 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: CHANNELS_DURATION, ease: CHANNELS_EASE },
  },
};

export const channelsListContainer: Variants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: CHANNELS_STAGGER,
      delayChildren: 0.04,
    },
  },
};

export const channelsListItem: Variants = {
  hidden: { opacity: 0, x: -4 },
  show: {
    opacity: 1,
    x: 0,
    transition: { duration: CHANNELS_DURATION, ease: CHANNELS_EASE },
  },
};
