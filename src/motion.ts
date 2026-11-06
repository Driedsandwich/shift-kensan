export const motionPreference = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)");

export const scrollBehavior = (): ScrollBehavior =>
  motionPreference().matches ? "instant" : "smooth";
