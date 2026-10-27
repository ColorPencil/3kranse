import { useEffect, useRef, useState } from 'react';
import { ArrowRight, ArrowSquareOut, ChatCircle } from '@phosphor-icons/react';

async function getJSON(url, options) {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.code || 'UPSTREAM_UNAVAILABLE');
  return data;
}
export default function Guestbook({ lang, t }) {
  const [service, setService] = useState(null);
  const [messages, setMessages] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [nickname, setNickname] = useState('');
  const [message, setMessage] = useState('');
  const [consent, setConsent] = useState(false);
  const [captcha, setCaptcha] = useState(null);
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const idempotency = useRef(null);
  const canSubmit = service?.available && captcha && !busy;
  async function refreshCaptcha() {
    setCaptcha(null); setAnswer('');
    try { setCaptcha(await getJSON('/api/guestbook/captcha')); }
    catch (error) { setError(error.message); }
  }
  async function loadMessages(more = false) {
    setLoading(true);
    try {
      const data = await getJSON(`/api/guestbook/messages${more && cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`);
      setMessages(previous => more ? [...previous, ...data.items] : data.items);
      setCursor(data.nextCursor);
    } catch (error) { setError(error.message); }
    finally { setLoading(false); }
  }
  useEffect(() => {
    let active = true;
    getJSON('/api/guestbook/status').then(data => {
      if (!active) return;
      setService(data);
      if (data.available) { loadMessages(); refreshCaptcha(); }
    }).catch(() => { if (active) { setService({ available: false }); setError('UPSTREAM_UNAVAILABLE'); } });
    return () => { active = false; };
  }, []);
  function edit(callback) { return event => { callback(event.target.value); idempotency.current = null; setSuccess(''); }; }
  async function submit(event) {
    event.preventDefault();
    if (!canSubmit) return;
    setBusy(true); setError(''); setSuccess('');
    // A retry reuses its key, preventing duplicate posts if the first response was lost.
    idempotency.current ||= crypto.randomUUID();
    try {
      const data = await getJSON('/api/guestbook/messages', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotency.current },
        body: JSON.stringify({ nickname, content: message, locale: lang, consent, captcha: { challengeId: captcha.challengeId, answer }, browser: { languages: navigator.languages, platform: navigator.platform, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, screen: `${screen.width}x${screen.height}`, viewport: `${window.innerWidth}x${window.innerHeight}` } }),
      });
      setSuccess(data.status); setMessage(''); idempotency.current = null;
      if (data.status === 'published') loadMessages();
      refreshCaptcha();
    } catch (error) {
      setError(error.message);
      // One-time CAPTCHA challenges must be renewed while the player's text is retained.
      refreshCaptcha();
    } finally { setBusy(false); }
  }
  return <div className="wrap page-body guestbook-page"><div className="page-heading"><p className="kicker">LETTERS TO THE STUDIO</p><h1>{t.guestTitle}</h1><p>{t.guestDescription}</p></div><div className="guestbook-layout"><form onSubmit={submit} className="guestbook-form"><div className="service-status" role="status"><span className={`status-dot ${service?.available ? 'online' : ''}`} />{service === null ? t.loading : service.available ? t.guestDescription : t.servicePreparing}</div><label htmlFor="nickname">{t.nickname}</label><input id="nickname" name="nickname" autoComplete="nickname" maxLength="64" placeholder={service?.defaultNickname || '玩家_IP'} value={nickname} onChange={edit(setNickname)} aria-describedby="nickname-hint" /><p className="field-hint" id="nickname-hint">{t.nicknameHint}</p><label htmlFor="message">{t.message} <span>{t.required}</span></label><textarea id="message" name="message" rows="7" minLength="4" maxLength="2000" required value={message} onChange={edit(setMessage)} aria-describedby="message-hint" /><div className="message-caption"><p className="field-hint" id="message-hint">{t.messageHint}</p><span>{message.length}/2000</span></div>{service?.available && <div className="captcha-field"><label htmlFor="captcha">{t.captcha}</label><div>{captcha ? <img src={captcha.image} alt={t.captcha} /> : <span>{t.captchaLoading}</span>}<button type="button" onClick={refreshCaptcha}>{t.refresh}</button></div><input id="captcha" value={answer} onChange={event => setAnswer(event.target.value)} maxLength="100" required autoComplete="off" /></div>}<p className="privacy-explanation">{t.privacy} <a href={`/${lang}/privacy/`}>{t.privacyTitle}<ArrowSquareOut size={13} /></a></p><label className="checkbox-label"><input type="checkbox" required checked={consent} onChange={event => setConsent(event.target.checked)} />{t.consent}</label><div aria-live="polite">{error && <p className="form-error" role="alert">{t.errors[error] || t.errors.UPSTREAM_UNAVAILABLE}</p>}{success && <p className="form-success">{t[success]}</p>}</div><button className="button" type="submit" disabled={!canSubmit}>{busy ? t.submitting : t.submit}<ArrowRight size={19} /></button></form><section className="messages" aria-label={t.guestbook}><h2>{t.guestbook}</h2>{messages.length ? messages.map(item => <article key={item.id}><div><strong>{item.nickname}</strong><time dateTime={item.createdAt}>{item.createdAt.slice(0, 10)}</time></div><p>{item.content}</p></article>) : <div className="empty-state"><ChatCircle size={33} weight="light" /><p>{loading ? t.loading : t.empty}</p></div>}{cursor && <button type="button" className="text-link" onClick={() => loadMessages(true)} disabled={loading}>{loading ? t.loading : t.loadMore}<ArrowRight size={19} /></button>}</section></div></div>;
}
