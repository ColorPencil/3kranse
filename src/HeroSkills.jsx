import { useState } from 'react';
import { StarFour, TreeStructure } from '@phosphor-icons/react';

// Render only game color emphasis as React text. BBCode and translated strings never become HTML.
export function GameText({ children = '' }) {
  return String(children).split(/(\[color=[^\]]+\][\s\S]*?\[\/color\])/g).map((part, index) => {
    const emphasis = /^\[color=[^\]]+\]([\s\S]*?)\[\/color\]$/.exec(part);
    return emphasis ? <mark key={index}>{emphasis[1]}</mark> : part;
  });
}

export default function HeroSkills({ hero, lang, t }) {
  const [tab, setTab] = useState(hero.skill ? 'skill' : 'talents');
  const [level, setLevel] = useState(1);
  const tabs = [['skill', hero.skill?.name[lang] || t.innateSkill], ['talents', t.talentTree]];
  function moveTab(event, index) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? 1 : 1 - index;
    setTab(tabs[next][0]);
    event.currentTarget.parentElement.querySelectorAll('[role="tab"]')[next].focus();
  }
  return <section className="hero-skills" aria-label={t.skillAndTalents}>
    <div className="skill-tabs" role="tablist" aria-label={t.skillAndTalents}>
      {tabs.map(([key, label], index) => <button key={key} type="button" role="tab" id={`hero-${hero.id}-${key}-tab`} aria-controls={`hero-${hero.id}-${key}`} aria-selected={tab === key} tabIndex={tab === key ? 0 : -1} onKeyDown={event => moveTab(event, index)} onClick={() => setTab(key)}>{key === 'skill' ? <StarFour size={20} aria-hidden="true" /> : <TreeStructure size={20} aria-hidden="true" />}<span>{label}</span></button>)}
    </div>
    <div role="tabpanel" id={`hero-${hero.id}-skill`} aria-labelledby={`hero-${hero.id}-skill-tab`} hidden={tab !== 'skill'} tabIndex={0} className="skill-panel">
      {hero.skill ? <><p className="skill-description"><GameText>{hero.skill.description[lang]}</GameText></p><ul className="innate-effects">{hero.skill.effects.map((effect, index) => <li key={index}><span>{effect.label[lang]}</span><p><GameText>{effect.description[lang]}</GameText></p></li>)}</ul></> : <p className="small muted">{t.noInnateSkill}</p>}
    </div>
    <div role="tabpanel" id={`hero-${hero.id}-talents`} aria-labelledby={`hero-${hero.id}-talents-tab`} hidden={tab !== 'talents'} tabIndex={0} className="skill-panel">
      <div className="talent-preview"><label htmlFor={`preview-level-${hero.id}`}>{t.previewLevel}</label><select id={`preview-level-${hero.id}`} value={level} onChange={event => setLevel(Number(event.target.value))}>{Array.from({ length: 10 }, (_, index) => <option key={index} value={index + 1}>{t.level} {index + 1}</option>)}</select></div>
      <p className="talent-note">{t.talentPreviewNote}</p>
      <ol className="talent-tree">{hero.talents.map((node, index) => {
        const unlocked = level >= node.level;
        return <li key={index} className={unlocked ? 'unlocked' : 'locked'}><span className="talent-level">{t.level} {node.level}<small>{unlocked ? t.unlocked : t.locked}</small></span><div className="talent-node"><div className="talent-summary"><span className="talent-label">{node.label[lang]}</span><p><GameText>{node.description[lang]}</GameText></p></div>{node.details && <details><summary>{t.skillDetails}</summary><p><GameText>{node.details[lang]}</GameText></p></details>}</div></li>;
      })}</ol>
      {!hero.talents.length && <p className="small muted">{t.noTalentTree}</p>}
    </div>
  </section>;
}
