import React, { useState, useEffect, RefObject } from 'react';

interface TurnstileWidgetProps {
  siteKey: string;
  onToken: (token: string) => void;
}

export default function TurnstileWidget({ siteKey, onToken }: TurnstileWidgetProps) {
  const [loaded, setLoaded] = useState(!!(window as any).turnstile);

  useEffect(() => {
    if ((window as any).turnstile) {
      setLoaded(true);
      return;
    }
    const interval = setInterval(() => {
      if ((window as any).turnstile) {
        setLoaded(true);
        clearInterval(interval);
      }
    }, 200);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      key={`turnstile-${loaded}`}
      ref={(el) => {
        if (el && el.childNodes.length === 0 && (window as any).turnstile) {
          try {
            (window as any).turnstile.render(el, {
              sitekey: siteKey,
              callback: onToken,
              'expired-callback': () => onToken(''),
            });
          } catch (err) {
            // ignore
          }
        }
      }}
      className="my-2 flex justify-center"
    ></div>
  );
}
