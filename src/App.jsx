import { useEffect, useRef, useState } from 'react';
import { ArrowRight, ArrowUpRight, ArrowLeft, Desktop, DeviceMobile, GameController, List, X, MagnifyingGlass, Play, ChatCircle, EnvelopeSimple, CaretRight, SteamLogo } from '@phosphor-icons/react';
import { copy, languages } from './i18n';
import catalogue from './generated/catalogue.json';
import content from './generated/content.json';
import Guestbook from './Guestbook';
import HeroSkills, { GameText } from './HeroSkills';
import './styles.css';

export function routeInfo(pathname) {
  const parts = pathname.split('?')[0].split('/').filter(Boolean);
  const lang = languages.includes(parts[0]) ? parts[0] : 'ja';
  const section = parts[1] || 'home';
  const slug = parts[2];
  const korean = parts[0] === 'ko';
  let article = content.find(item => item.lang === lang && item.category === section && item.slug === slug);
  if (section === 'data' && slug === 'controls') article = content.find(item => item.lang === lang && item.category === 'manual');
  const officer = section === 'data' && slug === 'officers' && parts[3] ? catalogue.officers.find(item => String(item.id) === parts[3]) : null;
  const valid = !korean && (!parts.length || languages.includes(parts[0])) && (
    (section === 'home' && parts.length <= 1) ||
    (['guides', 'creators', 'devlog'].includes(section) && (!slug || (article && parts.length === 3))) ||
    (section === 'data' && ((!slug && parts.length === 2) || (['officers', 'equipment', 'controls'].includes(slug) && parts.length === 3) || (officer && parts.length === 4))) ||
    (['guestbook', 'privacy'].includes(section) && parts.length === 2)
  );
  const t = copy[lang];
  const title = !valid ? `404 · ${t.title}` : officer ? `${officer.name[lang]} · ${t.title}` : article ? `${article.title} · ${t.title}` : section === 'home' ? t.title : `${t[section] || t.data} · ${t.title}`;
  return { lang, section, slug, article, officer, valid, korean, title };
}
const external = { target: '_blank', rel: 'noopener noreferrer' };
const IconArrow = () => <ArrowRight size={19} aria-hidden="true" />;
function LinkButton({ href, children, secondary = false, ...rest }) { return <a className={`button ${secondary ? 'secondary' : ''}`} href={href} {...rest}>{children}<IconArrow /></a>; }
function Kicker({ children }) { return <p className="kicker">{children}</p>; }
function SectionTitle({ eyebrow, title, text }) { return <div className="page-heading"><Kicker>{eyebrow}</Kicker><h1>{title}</h1>{text && <p>{text}</p>}</div>; }

function Header({ route, t }) {
  const [open, setOpen] = useState(false);
  const button = useRef(null);
  useEffect(() => {
    function close(event) { if (event.key === 'Escape') { setOpen(false); button.current?.focus(); } }
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, []);
  const path = language => language === 'ko' ? '/ko/' : `/${language}/${route.valid && route.section !== 'home' ? `${route.section}/${route.slug ? `${route.slug}/` : ''}${route.officer ? `${route.officer.id}/` : ''}` : ''}`;
  return <header className="site-header"><a className="skip-link" href="#main">{t.skip}</a><div className="header-inner"><a href={`/${route.lang}/`} className="brand" aria-label={t.title}><span>{route.lang === 'en' ? '三国：乱世苍生' : t.title}</span>{route.lang === 'en' && <small>FATE OF THE PEOPLE</small>}</a><button ref={button} type="button" className="menu-toggle" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="primary-navigation" aria-label={open ? t.close : t.menu}>{open ? <X size={25} /> : <List size={25} />}</button><div className={`navigation ${open ? 'is-open' : ''}`} id="primary-navigation"><nav aria-label={t.menu}>{['home', 'guides', 'data', 'devlog', 'creators', 'guestbook'].map(key => <a key={key} className={route.section === key && route.valid ? 'active' : ''} aria-current={route.section === key && route.valid ? 'page' : undefined} href={`/${route.lang}/${key === 'home' ? '' : `${key}/`}`}>{t[key]}</a>)}</nav><nav className="languages" aria-label={t.language}>{[['ja', '日本語'], ['zh-cn', '中文'], ['en', 'EN'], ['ko', '한국어']].map(([lang, label]) => <a key={lang} href={path(lang)} lang={lang} hrefLang={lang} className={route.lang === lang && !route.korean ? 'selected' : ''} aria-current={route.lang === lang && !route.korean ? 'true' : undefined}>{label}</a>)}</nav></div></div></header>;
}
function Footer({ lang, t }) { return <footer className="site-footer"><div className="footer-lattice" aria-hidden="true" /><div className="footer-inner"><div><a className="footer-brand" href={`/${lang}/`}>{t.title}</a><p>{t.footerLine}</p><span className="small">© Wood Pencil Studio · 木头铅笔</span></div><div className="footer-links"><a href="https://space.bilibili.com/288185013" {...external}>Bilibili <ArrowUpRight /></a><a href="https://x.com/woodpencil922" {...external}>X <ArrowUpRight /></a><a href="mailto:fl345034301@gmail.com">{t.contact} <EnvelopeSimple /></a><a href={`/${lang}/privacy/`}>{t.privacyTitle}</a><span>{t.qq}</span></div></div></footer>; }
function PlatformRow({ t }) { return <><div className="platform-row">{[[Desktop, t.pc, t.pcStatus], [DeviceMobile, t.mobile, t.mobileStatus], [GameController, t.ns, t.nsStatus]].map(([Icon, title, status]) => <div className="platform" key={title}><Icon size={27} weight="light" /><div><strong>{title}</strong><span>{status}</span></div></div>)}</div><p className="platform-note">{t.platformNote}</p></>; }
function Screenshot({ name, label, t, onOpen }) { return <figure className="game-figure"><button type="button" onClick={() => onOpen({ src: `/assets/screens/${name}.webp`, label })} aria-label={`${t.screenshot} · ${label}`}><img src={`/assets/screens/${name}.webp`} alt={label} loading="lazy" width="1600" height="900" /><span className="enlarge"><MagnifyingGlass size={18} /></span></button><figcaption>{t.historical}</figcaption></figure>; }
function News({ lang, t }) {
  const news = [['2026.10.24', t.categoryDev, t.newsAndroid, 'https://www.bilibili.com/opus/1262555088971366406'], ['2026.10.11', t.categoryDev, t.newsYears, `/${lang}/creators/ten-years/`], ['2026.10.27', t.categoryPlan, t.newsRoadmap, `/${lang}/devlog/roadmap/`]];
  return <section className="news-section wrap" aria-labelledby="news-title"><div className="news-heading"><Kicker>NEWS</Kicker><h2 id="news-title">{t.news}</h2><a className="text-link" href={`/${lang}/devlog/`}>{t.newsAll}<IconArrow /></a></div><div className="news-list">{news.map(([date, category, title, href]) => <a key={title} href={href} {...(href.startsWith('http') ? external : {})}><div className="news-meta"><time dateTime={date.replaceAll('.', '-')}>{date}</time><span>{category}</span></div><strong>{title}</strong><ArrowUpRight size={20} /></a>)}</div></section>;
}
function OfficerCard({ hero, lang, t, attribute = 'all' }) {
  // HP and courage are now public, but the featured score still follows the selection's three attributes.
  const max = attribute !== 'all' ? [attribute, hero.stats[attribute]] : ['stre', 'inte', 'ste'].map(key => [key, hero.stats[key]]).sort((a, b) => b[1] - a[1])[0];
  const labels = { stre: t.strength, inte: t.intelligence, ste: t.prestige };
  return <a className="officer-card" href={`/${lang}/data/officers/${hero.id}/`}><img src={hero.portrait} alt="" width="109" height="142" loading="lazy" /><div className="officer-card-copy"><h3>{hero.name[lang]}</h3><span>{labels[max[0]]} <b>{max[1]}</b></span></div><ArrowUpRight size={18} /><dl className="officer-card-vitals">{[['max_hp', t.hp], ['cou', t.courage]].map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{hero.stats[key]}</dd></div>)}</dl></a>;
}
function Home({ lang, t, onOpen }) {
  const [video, setVideo] = useState(false);
  const entries = content.filter(item => item.category === 'guides' && item.lang === lang).sort((a, b) => a.order - b.order);
  return <><div className="hero-art"><img fetchPriority="high" src={lang === 'ja' ? '/assets/hero-ja.webp' : '/assets/hero-global.webp'} alt={t.title} width="2172" height="724" /></div><div className="home-atmosphere"><section className="hero-intro wrap"><p className="genre">{t.genre}</p><h1>{lang === 'ja' ? <><span>乱世を治め、</span><span>民とともに天下へ。</span></> : t.headline}</h1><span className="red-rule" /><p className="intro-text">{t.intro}</p><div className="main-actions"><div className="steam-unavailable" role="status"><SteamLogo size={42} weight="fill" /><div><strong>{t.steam}</strong><span>{t.steamNote}</span></div><span className="soon-dot" /></div><a className="button video-button" href="https://space.bilibili.com/288185013" {...external}><Play size={27} weight="fill" /><span>{t.watch}</span><ArrowUpRight size={23} /></a></div><PlatformRow t={t} /></section><News lang={lang} t={t} /></div>
    <section className="feature-section wrap"><div className="feature-copy"><Kicker>THE REALM</Kicker><h2>{t.feature1Title}</h2><span className="short-rule" /><p>{t.feature1Text}</p><a className="text-link" href={`/${lang}/guides/city/`}>{t.guideMore}<IconArrow /></a></div><Screenshot name="governance" label={t.feature1Title.replace('\n', '')} t={t} onOpen={onOpen} /></section>
    <section className="feature-section wrap reverse"><div className="feature-copy"><Kicker>THE BATTLEFIELD</Kicker><h2>{t.feature2Title}</h2><span className="short-rule" /><p>{t.feature2Text}</p><a className="text-link" href={`/${lang}/guides/battle/`}>{t.guideMore}<IconArrow /></a></div><Screenshot name="water" label={t.feature2Title.replace('\n', '')} t={t} onOpen={onOpen} /></section>
    <section className="feature-section wrap"><div className="feature-copy"><Kicker>THE DUEL</Kicker><h2>{t.feature3Title}</h2><span className="short-rule" /><p>{t.feature3Text}</p><button className="text-link" type="button" onClick={() => setVideo(!video)} aria-expanded={video}><Play size={18} />{video ? t.close : t.playClip}</button><span className="small muted">{t.clipNote}</span></div>{video ? <figure className="game-figure"><video controls autoPlay muted playsInline poster="/assets/screens/duel.webp" width="1280" height="720"><source src="/assets/duel-silent.mp4" type="video/mp4" /></video><figcaption>{t.historical}</figcaption></figure> : <Screenshot name="duel" label={t.feature3Title.replace('\n', '')} t={t} onOpen={onOpen} />}</section>
    <section className="selected-section"><div className="wrap"><div className="section-heading"><div><Kicker>PEOPLE OF THE THREE KINGDOMS</Kicker><h2>{t.selected}</h2><p>{t.selectedIntro}</p></div><a className="text-link" href={`/${lang}/data/officers/`}>{t.viewOfficers}<IconArrow /></a></div><div className="officer-grid home-officers">{[0, 1, 2, 11, 12, 13].map(id => <OfficerCard key={id} hero={catalogue.officers.find(hero => hero.id === id)} lang={lang} t={t} />)}</div><p className="small muted">{t.officerRule}</p></div></section>
    <section className="guide-home wrap"><div><Kicker>THE FIRST CAMPAIGN</Kicker><h2>{t.guideCTA}</h2><p>{t.guideIntro}</p><a className="text-link" href={`/${lang}/guides/`}>{t.guideMore}<IconArrow /></a></div><div className="compact-guides">{entries.slice(0, 3).map((item, index) => <a href={`/${lang}/guides/${item.slug}/`} key={item.slug}><span className="number">0{index + 1}</span><div><h3>{item.title}</h3><p>{item.summary}</p></div><CaretRight size={20} /></a>)}</div></section>
    <section className="studio-section"><div className="wrap studio-inner"><div className="studio-mark"><img src="/assets/studio-logo.png" alt="木头铅笔 Wood Pencil Studio" width="381" height="101" loading="lazy" /><p><span>{t.wood} <small>{t.art}</small></span><span>{t.pencil} <small>{t.code}</small></span></p></div><div><Kicker>FROM OUR STUDIO</Kicker><h2>{t.studioStory}</h2><p>{t.studioIntro}</p><a className="text-link" href={`/${lang}/creators/ten-years/`}>{t.readStory}<IconArrow /></a></div></div></section>
    <section className="guest-invite wrap"><ChatCircle size={35} weight="light" /><div><h2>{t.guestTitle}</h2><p>{t.guestDescription}</p></div><LinkButton href={`/${lang}/guestbook/`} secondary>{t.guestbook}</LinkButton></section></>;
}
function ReviewNote({ t }) { return <div className="review-note"><span className="badge">{t.draft}</span><p>{t.draftNote}</p></div>; }
function Roadmap({ t }) { return <div className="roadmap">{[[t.roadmapNow, t.roadmapPC, t.roadmapPCText, Desktop], [t.roadmapLater, t.roadmapMobile, t.roadmapMobileText, DeviceMobile], [t.roadmapFuture, t.roadmapNS, t.roadmapNSText, GameController]].map(([label, title, text, Icon], index) => <div key={title}><span className="roadmap-label">0{index + 1} — {label}</span><Icon size={31} weight="light" /><h2>{title}</h2><p>{text}</p></div>)}</div>; }
function ArticleList({ category, lang, t }) {
  const entries = content.filter(item => item.category === category && item.lang === lang).sort((a, b) => a.order - b.order);
  const titles = { guides: [t.guideTitle, t.guideDescription, 'PLAYER GUIDES'], creators: [t.developerTitle, t.developerDescription, 'DEVELOPER’S COLUMN'], devlog: [t.devlogTitle, t.devlogDescription, 'DEVELOPMENT NOTES'] };
  const [title, text, eyebrow] = titles[category];
  return <div className="wrap page-body"><SectionTitle title={title} text={text} eyebrow={eyebrow} />{category === 'devlog' && <Roadmap t={t} />}{category === 'guides' && entries.some(item => item.editorialReview) && <ReviewNote t={t} />}<div className={`article-list ${category !== 'guides' ? 'single' : ''}`}>{entries.map((item, index) => <a key={item.slug} href={`/${lang}/${category}/${item.slug}/`}><span className="number">0{index + 1}</span><div><span className="article-meta">2026.10.27 {item.editorialReview && <span>{t.draft}</span>}</span><h2>{item.title}</h2><p>{item.summary}</p></div><ArrowUpRight size={23} /></a>)}</div></div>;
}
function Article({ article, lang, t }) {
  const category = article.category === 'manual' ? 'data' : article.category;
  const studioSource = { ja: '開発者の公開投稿と現在の制作方針をもとに編集。本文のリンクから原文をご覧いただけます。', 'zh-cn': '依据作者公开动态与当前开发安排整理，可从正文链接阅读原文。', en: 'Prepared from the developer’s public posts and current plans. Original posts are linked in the article.' };
  return <div className="wrap page-body"><a className="back-link" href={`/${lang}/${category}/`}><ArrowLeft size={17} />{t[category]}</a><header className="article-heading"><Kicker>{category === 'guides' ? 'PLAYER GUIDE' : category === 'creators' ? 'FROM OUR STUDIO' : 'STUDIO NOTES'}</Kicker><h1>{article.title}</h1><p>{article.summary}</p><span className="article-meta">{t.updated} {article.updated}{article.editorialReview ? ` · ${t.draft}` : ''}</span></header><div className="article-layout"><aside className="article-toc"><h2>{t.contents}</h2><ol>{article.toc.map(item => <li key={item.id}><a href={`#${item.id}`}>{item.text}</a></li>)}</ol></aside><article className="prose">{article.editorialReview && <ReviewNote t={t} />}<div dangerouslySetInnerHTML={{ __html: article.html }} /><aside className="source-note"><strong>{t.sources}</strong><p>{['creators', 'devlog'].includes(category) ? studioSource[lang] : t.sourceNote}</p></aside></article></div></div>;
}
function DataTabs({ slug, lang, t }) { return <nav className="data-tabs" aria-label={t.data}>{[['officers', t.officers], ['equipment', t.equipment], ['controls', t.controls]].map(([key, label]) => <a key={key} className={slug === key || (!slug && key === 'officers') ? 'active' : ''} href={`/${lang}/data/${key}/`}>{label}<ArrowUpRight size={17} /></a>)}</nav>; }
function CatalogueSummary({ t }) {
  return <section className="catalogue-summary" aria-label={t.codexTotals}><p className="kicker">{t.codexTotals}</p><dl><div><dt>{t.totalOfficers}</dt><dd>{catalogue.officers.length}</dd></div><div><dt>{t.totalItems}</dt><dd>{catalogue.equipment.length + catalogue.reservedNames.length}</dd></div><div><dt>{t.detailedItems}</dt><dd>{catalogue.equipment.length}</dd></div><div><dt>{t.namesOnlyItems}</dt><dd>{catalogue.reservedNames.length}</dd></div></dl></section>;
}
function Catalogue({ route, t }) {
  const { lang, slug } = route;
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const equipment = slug === 'equipment';
  const list = equipment ? catalogue.equipment : catalogue.officers;
  const reservedResults = equipment ? catalogue.reservedNames.filter(item => Object.values(item).join(' ').toLowerCase().includes(query.toLowerCase().trim())) : [];
  const counter = useRef(null);
  function changePage(value) { setPage(value); counter.current?.scrollIntoView({ block: 'start' }); }
  const results = list.filter(item => Object.values(item.name).join(' ').toLowerCase().includes(query.trim().toLowerCase()) && (equipment || filter === 'all' || item.stats[filter] >= 90));
  const pages = Math.max(1, Math.ceil(results.length / 12));
  const setSearch = value => { setQuery(value); setPage(1); };
  return <div className="wrap page-body"><SectionTitle eyebrow="THE CODEX" title={t.dataTitle} text={t.dataDescription} /><CatalogueSummary t={t} /><DataTabs slug={slug} lang={lang} t={t} /><p className="catalogue-description">{equipment ? t.equipmentIntro : t.officerRule}</p><div className="catalogue-toolbar"><label className="search-field"><MagnifyingGlass size={22} /><span className="sr-only">{equipment ? t.searchEquipment : t.search}</span><input type="search" value={query} onChange={event => setSearch(event.target.value)} placeholder={equipment ? t.searchEquipment : t.search} /></label>{!equipment && <div className="filter-group" role="group" aria-label={t.baseStats}>{[['all', t.all], ['stre', `${t.strength} 90+`], ['inte', `${t.intelligence} 90+`], ['ste', `${t.prestige} 90+`]].map(([key, label]) => <button type="button" key={key} onClick={() => { setFilter(key); setPage(1); }} className={filter === key ? 'selected' : ''} aria-pressed={filter === key}>{label}</button>)}</div>}</div><p ref={counter} className="result-count" aria-live="polite">{results.length} {equipment ? t.results : t.count}{equipment && ` · ${reservedResults.length} ${t.namesOnly}`}</p>{results.length ? <div className={equipment ? 'equipment-grid' : 'officer-grid'}>{results.slice((page - 1) * 12, page * 12).map(item => equipment ? <EquipmentCard item={item} lang={lang} t={t} key={item.id} /> : <OfficerCard hero={item} lang={lang} t={t} attribute={filter} key={item.id} />)}</div> : reservedResults.length ? null : <div className="empty-state"><p>{t.noResults}</p><button type="button" className="text-link" onClick={() => { setSearch(''); setFilter('all'); }}>{t.reset}<IconArrow /></button></div>}{pages > 1 && <nav className="pagination" aria-label={t.data}><button type="button" onClick={() => changePage(page - 1)} disabled={page <= 1}><ArrowLeft size={17} />{t.previous}</button><span aria-live="polite">{page} / {pages}</span><button type="button" onClick={() => changePage(page + 1)} disabled={page >= pages}>{t.next}<ArrowRight size={17} /></button></nav>}{equipment && reservedResults.length > 0 && <section className="reserved-names"><Kicker>LEGENDARY NAMES</Kicker><h2>{t.reservedTitle}</h2><p>{t.reservedIntro}</p><ul>{reservedResults.map(item => <li key={item.en}>{item[lang]}</li>)}</ul></section>}<p className="catalogue-footnote">{t.hidden} · {t.updated} {catalogue.sourceDate}</p></div>;
}
function EquipmentCard({ item, lang, t }) {
  const type = t.equipmentTypes[item.type] || (item.type === 8 ? t.armor : item.type === 9 ? t.treasure : t.special);
  // Zero means no contribution for these fields. Preserve nonzero values, including penalties.
  const stats = [[t.attack, item.attack], [t.defense, item.defense], [t.weight, item.weight]].filter(([, value]) => value !== 0);
  return <article className="equipment-card"><div className="equipment-title"><img src={item.icon} alt="" width="60" height="60" loading="lazy" /><div><span>{type} · {t.level} {item.level}</span><h2>{item.name[lang]}</h2></div></div><p>{item.description[lang]}</p>{item.bonuses.length > 0 && <ul className="equipment-bonuses" aria-label={t.equipmentBonuses}>{item.bonuses.map((bonus, index) => <li key={index}><GameText>{bonus[lang]}</GameText></li>)}</ul>}{stats.length > 0 && <dl className="equipment-stats">{stats.map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl>}</article>;
}
function OfficerNavigation({ hero, lang, t }) {
  // Follow the public collection order; IDs are not consecutive and hidden officers must never be linked.
  const index = catalogue.officers.findIndex(item => item.id === hero.id);
  const entries = [
    { direction: 'previous', officer: catalogue.officers[index - 1], label: t.previousOfficer, Icon: ArrowLeft, rel: 'prev' },
    { direction: 'next', officer: catalogue.officers[index + 1], label: t.nextOfficer, Icon: ArrowRight, rel: 'next' },
  ];
  return <nav className="officer-switcher" aria-label={t.officerNavigation}>{entries.map(({ direction, officer, label, Icon, rel }) => {
    const body = <><Icon size={18} aria-hidden="true" /><span><small>{label}</small><strong>{officer ? officer.name[lang] : '—'}</strong></span></>;
    return officer ? <a key={direction} className={`officer-step ${direction}`} rel={rel} href={`/${lang}/data/officers/${officer.id}/`}>{body}</a> : <button key={direction} className={`officer-step ${direction}`} type="button" disabled aria-label={label}>{body}</button>;
  })}</nav>;
}
function Officer({ hero, lang, t }) {
  const stats = [['stre', t.strength], ['inte', t.intelligence], ['ste', t.prestige], ['comm', t.command], ['max_hp', t.hp], ['cou', t.courage]];
  return <div className="wrap page-body officer-page"><div className="officer-toolbar"><a className="back-link" href={`/${lang}/data/officers/`}><ArrowLeft size={18} />{t.officers}</a><OfficerNavigation hero={hero} lang={lang} t={t} /></div><article className="officer-dossier"><header className="officer-profile"><div className="portrait-frame"><span className="portrait-caption">{t.officers}</span><img src={hero.portrait} alt={hero.name[lang]} width="109" height="142" /></div><div className="officer-summary"><Kicker>PEOPLE OF THE THREE KINGDOMS</Kicker><span className="officer-edition">{t.selectedOfficer}</span><h1>{hero.name[lang]}</h1></div><section className="officer-biography" aria-labelledby="officer-bio-title"><h2 id="officer-bio-title">{t.profile}</h2><p className="officer-bio">{hero.profile[lang]}</p></section><section className="officer-attributes" aria-labelledby="officer-attributes-title"><div className="officer-section-heading"><h2 id="officer-attributes-title">{t.baseStats}</h2><span aria-hidden="true" /></div><dl className="attribute-grid">{stats.map(([key, label]) => <div key={key}><dt>{label}</dt><dd className={hero.stats[key] >= 90 ? 'high' : ''}>{hero.stats[key]}</dd><span className="attribute-track" aria-hidden="true"><span style={{ width: `${Math.min(100, Math.max(0, hero.stats[key]))}%` }} /></span></div>)}</dl><p className="small muted">{t.baseAttributeNote}</p></section></header><div className="officer-abilities"><div className="officer-section-heading"><h2>{t.skillAndTalents}</h2><span aria-hidden="true" /></div><HeroSkills key={hero.id} hero={hero} lang={lang} t={t} /></div><p className="catalogue-footnote">{t.hidden}</p></article></div>;
}
function Privacy({ lang, t }) {
  const paragraphs = {
    ja: ['任意のニックネームと本文を送信します。ニックネームを空欄にすると、IPアドレスを含む「玩家_IPアドレス」が公開名になります。IPを公開したくない方は、別の名前を入力してください。', '不正な送信への対応のため、IPとブラウザのUser-Agent、言語、申告プラットフォーム、タイムゾーン、画面と表示領域を記録します。位置情報、連絡先、端末内のファイルは収集しません。', '公開一覧はニックネーム、本文、日時のみ。IP・ブラウザ情報は管理用ですが、既定のニックネームを使う場合はIPも名前として公開されます。本文は確認後に公開される場合があります。', '削除や訂正を希望する場合は、投稿の日時と内容を添えて作者へご連絡ください。運用開始前に保存期間と対応方針を確認し、ここに掲載します。現在、メッセージサービスは準備中です。'],
    'zh-cn': ['提交内容包括可选昵称与留言正文。昵称留空时，服务端会使用含真实IP地址的“玩家_IP地址”作为公开昵称；不希望公开IP时，请填写其他昵称。', '为处理滥用提交，将记录IP地址、浏览器User-Agent、语言、平台自报信息、时区、屏幕与页面尺寸。不读取地理定位、通讯录或设备文件。', '公开列表仅展示昵称、正文与时间。IP和浏览器信息供管理使用，但使用默认昵称时，IP也会作为昵称的一部分公开。留言可能经审核后发布。', '如需删除或更正留言，请附上投稿时间与内容联系作者。正式开放留言前，需要确认保存期限与处理规则并更新本页。目前留言服务尚在准备中。'],
    en: ['You submit an optional nickname and a message. If the nickname is blank, the server uses “玩家_IP address”, including your actual IP, as the public name. Enter another nickname if you do not want your IP displayed.', 'To address abusive submissions, the service records your IP, browser User-Agent, languages, reported platform, time zone, screen size and viewport size. It does not read geolocation, contacts or files on your device.', 'The public list shows nickname, message and time. IP and browser data are used for administration, but your IP also appears publicly if you use the default nickname. Messages may be reviewed before publication.', 'For removal or correction, contact the developer with the posting time and message. Retention and handling rules need to be confirmed here before the guestbook opens. The service is currently being prepared.'],
  };
  return <div className="wrap page-body"><SectionTitle eyebrow="GUESTBOOK INFORMATION" title={t.privacyTitle} text={t.privacyDescription} /><article className="prose privacy-prose">{paragraphs[lang].map(text => <p key={text}>{text}</p>)}<a className="text-link" href="mailto:fl345034301@gmail.com">fl345034301@gmail.com<EnvelopeSimple size={19} /></a></article></div>;
}
function NotFound({ route, t }) { return <div className="wrap not-found"><Kicker>404 · {route.korean ? 'COMING LATER' : 'PAGE NOT FOUND'}</Kicker><h1>{route.korean ? t.korean : t.notFound}</h1><p>{route.korean ? t.koreanText : t.notFoundText}</p><LinkButton href={`/${route.lang}/`}>{t.returnHome}</LinkButton></div>; }
function ImageDialog({ selected, onClose, t }) {
  const dialog = useRef(null);
  useEffect(() => { const previousFocus = document.activeElement; dialog.current.showModal(); document.body.classList.add('dialog-open'); return () => { document.body.classList.remove('dialog-open'); previousFocus?.focus(); }; }, []);
  return <dialog ref={dialog} className="image-dialog" onCancel={onClose} onClick={event => { if (event.target === dialog.current) onClose(); }}><button className="dialog-close" type="button" onClick={onClose} aria-label={t.close}><X size={25} /></button><img src={selected.src} alt={selected.label} /><p>{selected.label}</p><span>{t.historical}</span></dialog>;
}
export default function App({ initialPath = '/' }) {
  const route = routeInfo(initialPath);
  const t = copy[route.lang];
  // One illustration family per content section; article and officer detail routes inherit their parent.
  const artwork = !route.valid ? 'guides' : route.section === 'privacy' ? 'guestbook' : route.section;
  const innerPage = !route.valid || route.section !== 'home';
  const [selected, setSelected] = useState(null);
  useEffect(() => { document.title = route.title; document.documentElement.lang = route.korean ? 'ko' : route.lang === 'zh-cn' ? 'zh-CN' : route.lang; }, [route.title]);
  return <><Header route={route} t={t} /><main id="main" tabIndex="-1" className={innerPage ? `inner-page inner-page--${artwork}` : undefined}>{!route.valid ? <NotFound route={route} t={t} /> : route.officer ? <Officer hero={route.officer} lang={route.lang} t={t} /> : route.article ? <Article article={route.article} lang={route.lang} t={t} /> : route.section === 'home' ? <Home lang={route.lang} t={t} onOpen={setSelected} /> : route.section === 'data' ? <Catalogue route={route} t={t} /> : route.section === 'guestbook' ? <Guestbook lang={route.lang} t={t} /> : route.section === 'privacy' ? <Privacy lang={route.lang} t={t} /> : <ArticleList category={route.section} lang={route.lang} t={t} />}</main><Footer lang={route.lang} t={t} />{selected && <ImageDialog selected={selected} onClose={() => setSelected(null)} t={t} />}</>;
}
