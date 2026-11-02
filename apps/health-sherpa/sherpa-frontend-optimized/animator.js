// modules/animator.js - Performance-Optimized Animation System
export class Animator {
  constructor() {
    this.activeAnimations = new Map();
    this.rafId = null;
  }

  // Hardware-accelerated animation helper
  async performSequence(element, keyframes, options = {}) {
    const animationId = `${element.id || 'element'}-${Date.now()}`;

    try {
      // Use Web Animations API for better performance
      const animation = element.animate(keyframes, {
        duration: options.duration || 300,
        easing: options.easing || 'cubic-bezier(0.4, 0, 0.2, 1)',
        fill: 'forwards',
        ...options
      });

      this.activeAnimations.set(animationId, animation);

      // Yield control periodically for better responsiveness
      if (window.scheduler?.yield) {
        await window.scheduler.yield('user-visible');
      }

      await animation.finished;
      this.activeAnimations.delete(animationId);

      return animation;
    } catch (error) {
      this.activeAnimations.delete(animationId);
      throw error;
    }
  }

  // Sherpa-specific animations
  async animateLogoAnalyzing(logoElement) {
    return this.performSequence(logoElement, [
      { transform: 'scale(1)', opacity: 1 },
      { transform: 'scale(1.05)', opacity: 0.8 },
      { transform: 'scale(1)', opacity: 1 }
    ], {
      duration: 1500,
      iterations: Infinity,
      direction: 'alternate'
    });
  }

  async animateLogoSuccess(logoElement) {
    return this.performSequence(logoElement, [
      { transform: 'scale(1)', backgroundColor: 'transparent' },
      { transform: 'scale(1.1)', backgroundColor: '#16a34a' }
    ], {
      duration: 500,
      easing: 'cubic-bezier(0.4, 0, 0.2, 1)'
    });
  }

  async animateMessageEntry(messageElement) {
    return this.performSequence(messageElement, [
      { transform: 'translateY(20px)', opacity: 0 },
      { transform: 'translateY(0)', opacity: 1 }
    ], {
      duration: 300,
      easing: 'cubic-bezier(0.4, 0, 0.2, 1)'
    });
  }

  // Cleanup all animations
  stopAll() {
    for (const [id, animation] of this.activeAnimations) {
      animation.cancel();
    }
    this.activeAnimations.clear();
  }

  // Reduced motion support
  get shouldReduceMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
}

export const animator = new Animator();