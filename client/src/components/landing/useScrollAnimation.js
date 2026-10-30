import { useState, useEffect, useRef } from 'react';

/**
 * Custom hook to detect when an element enters the viewport using IntersectionObserver.
 * Fully compatible with React 18, SSR/Vite, and respects prefers-reduced-motion.
 */
export function useInView(options = {}) {
  // Use a forgiving threshold and positive rootMargin so animations trigger naturally 
  // as elements approach the viewport, preventing empty voids or delayed pops on mobile/tablet.
  const { threshold = 0.05, rootMargin = '100px 0px 50px 0px', triggerOnce = true } = options;
  const [isInView, setIsInView] = useState(false);
  const elementRef = useRef(null);

  useEffect(() => {
    // If user prefers reduced motion, trigger immediately
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setIsInView(true);
      return;
    }

    const element = elementRef.current;
    if (!element) return;

    // Fallback if IntersectionObserver is unsupported
    if (!('IntersectionObserver' in window)) {
      setIsInView(true);
      return;
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsInView(true);
        if (triggerOnce) {
          observer.unobserve(element);
        }
      } else if (!triggerOnce) {
        setIsInView(false);
      }
    }, { threshold, rootMargin });

    observer.observe(element);

    return () => {
      if (element) observer.unobserve(element);
    };
  }, [threshold, rootMargin, triggerOnce]);

  return [elementRef, isInView];
}

/**
 * Animated number counter hook that counts up from 0 to target when triggered.
 */
export function useCounter(targetNumber, decimals = 0, isTriggered = true, duration = 1400) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isTriggered) return;

    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setCount(targetNumber);
      return;
    }

    let startTimestamp = null;
    const startVal = 0;

    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      // Ease out cubic
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      const current = startVal + (targetNumber - startVal) * easeProgress;
      setCount(current);

      if (progress < 1) {
        window.requestAnimationFrame(step);
      } else {
        setCount(targetNumber);
      }
    };

    const animId = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(animId);
  }, [targetNumber, decimals, isTriggered, duration]);

  return decimals > 0 ? count.toFixed(decimals) : Math.round(count);
}
