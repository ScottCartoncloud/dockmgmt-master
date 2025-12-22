import { useEffect, useRef, useCallback } from 'react';

declare global {
  interface Window {
    grecaptcha: {
      ready: (callback: () => void) => void;
      render: (container: HTMLElement, options: {
        sitekey: string;
        callback: (token: string) => void;
        'expired-callback': () => void;
        'error-callback': () => void;
      }) => number;
      reset: (widgetId: number) => void;
    };
    onRecaptchaLoad?: () => void;
  }
}

interface ReCaptchaProps {
  siteKey: string;
  onVerify: (token: string) => void;
  onExpire?: () => void;
  onError?: () => void;
}

export function ReCaptcha({ siteKey, onVerify, onExpire, onError }: ReCaptchaProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<number | null>(null);
  const scriptLoadedRef = useRef(false);

  const renderRecaptcha = useCallback(() => {
    if (!containerRef.current || widgetIdRef.current !== null) return;

    try {
      widgetIdRef.current = window.grecaptcha.render(containerRef.current, {
        sitekey: siteKey,
        callback: onVerify,
        'expired-callback': () => onExpire?.(),
        'error-callback': () => onError?.(),
      });
    } catch (error) {
      console.error('Error rendering reCAPTCHA:', error);
    }
  }, [siteKey, onVerify, onExpire, onError]);

  useEffect(() => {
    // Check if script already exists
    const existingScript = document.querySelector('script[src*="recaptcha"]');
    
    if (existingScript && window.grecaptcha) {
      window.grecaptcha.ready(renderRecaptcha);
      return;
    }

    if (scriptLoadedRef.current) return;
    scriptLoadedRef.current = true;

    // Load reCAPTCHA script
    const script = document.createElement('script');
    script.src = 'https://www.google.com/recaptcha/api.js?onload=onRecaptchaLoad&render=explicit';
    script.async = true;
    script.defer = true;

    window.onRecaptchaLoad = () => {
      window.grecaptcha.ready(renderRecaptcha);
    };

    document.head.appendChild(script);

    return () => {
      // Cleanup
      if (widgetIdRef.current !== null && window.grecaptcha) {
        try {
          window.grecaptcha.reset(widgetIdRef.current);
        } catch (e) {
          // Ignore reset errors
        }
      }
    };
  }, [renderRecaptcha]);

  return (
    <div 
      ref={containerRef} 
      className="flex justify-center"
    />
  );
}
