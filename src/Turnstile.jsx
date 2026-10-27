import { useEffect, useRef, useState } from 'react';

let loading;
function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (!loading) loading = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.onload = () => window.turnstile ? resolve(window.turnstile) : reject(new Error('CAPTCHA_UNAVAILABLE'));
    script.onerror = () => reject(new Error('CAPTCHA_UNAVAILABLE'));
    document.head.append(script);
  }).catch(error => { loading = null; throw error; });
  return loading;
}

export default function Turnstile({ siteKey, lang, onToken, onError, label }) {
  const container = useRef(null);
  const callbacks = useRef({ onToken, onError });
  const [size, setSize] = useState('compact');
  useEffect(() => { callbacks.current = { onToken, onError }; }, [onToken, onError]);
  useEffect(() => {
    const observer = new ResizeObserver(entries => {
      // A padded phone form may be narrower than Turnstile's 300px flexible minimum.
      setSize(entries[0].contentRect.width < 300 ? 'compact' : 'flexible');
    });
    observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    let active = true;
    let api;
    let widget;
    callbacks.current.onToken('');
    loadTurnstile().then(value => {
      if (!active || !container.current) return;
      api = value;
      widget = api.render(container.current, {
        sitekey: siteKey, action: 'guestbook', language: lang,
        theme: 'light', size, retry: 'never', 'response-field': false,
        callback: token => { if (active) callbacks.current.onToken(token); },
        'expired-callback': () => { if (active) callbacks.current.onToken(''); },
        'error-callback': () => {
          if (active) { callbacks.current.onToken(''); callbacks.current.onError('CAPTCHA_UNAVAILABLE'); }
        },
      });
    }).catch(() => { if (active) callbacks.current.onError('CAPTCHA_UNAVAILABLE'); });
    return () => { active = false; if (api && widget !== undefined) api.remove(widget); };
  }, [siteKey, lang, size]);
  return <div className="turnstile-widget" ref={container} aria-label={label} />;
}
