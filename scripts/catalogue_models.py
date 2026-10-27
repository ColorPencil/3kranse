"""Read display data with the same defaults and reference rules as the Godot detail panel.

Only the explicit public model is returned. Resource IDs, owner links and acquisition
conditions are used locally for resolution and must never become browser payloads.
"""
import csv
import json
import re

LANGS = {'zh-cn': 'zh', 'ja': 'ja', 'en': 'en'}


def resource_blocks(source):
    result = {}
    for block in re.split(r'(?=^\[sub_resource )', source, flags=re.M):
        block = block.split('\n[resource]')[0]
        header = re.match(r'\[sub_resource [^\n]*id="([^"]+)"\]', block)
        if not header:
            continue
        fields = {}
        # Multiline strings occur in descriptions; taking just one line silently loses them.
        matches = list(re.finditer(r'^(\w+) = ', block, re.M))
        for index, match in enumerate(matches):
            raw = block[match.end():matches[index + 1].start() if index + 1 < len(matches) else len(block)].strip()
            if raw.startswith('SubResource('):
                fields[match[1]] = re.search(r'"([^"]+)"', raw)[1]
            elif raw.startswith('Array[') and 'SubResource(' in raw:
                fields[match[1]] = re.findall(r'SubResource\("([^"]+)"\)', raw)
            elif raw.startswith('Array[int]'):
                fields[match[1]] = json.loads(raw[raw.index('(') + 1:-1])
            elif raw.startswith('ExtResource('):
                fields[match[1]] = re.search(r'"([^"]+)"', raw)[1]
            else:
                try:
                    fields[match[1]] = json.loads(raw, strict=False)
                except (ValueError, TypeError):
                    pass
        result[header[1]] = fields
    return result


class DisplayCatalogue:
    def __init__(self, root):
        self.root = root
        self.rows = {}
        for name in ['ability_info.csv', 'effect_info.csv', 'ui_info.csv', 'hero_profile.csv']:
            with (root / 'resources/languages' / name).open(encoding='utf-8-sig', newline='') as stream:
                self.rows.update({row['id']: row for row in csv.DictReader(stream)})
        # Effect 367 exists in the current enum and trees but is absent from the language CSV.
        # Website-only draft wording follows LEARN_FLOOD_AND_FIRE; a later game translation takes precedence.
        self.rows.setdefault('EFFECT_NAME_367', {'zh': '全谋', 'ja': '全謀', 'en': 'Master Strategist'})
        self.rows.setdefault('EFFECT_367', {'zh': '习得谋略「{0}」与「{1}」', 'ja': '謀略「{0}」と「{1}」を習得', 'en': 'Learn the stratagems {0} and {1}'})
        self.resources = resource_blocks((root / 'data/game_data.tres').read_text(encoding='utf-8'))
        self.abilities = {row.get('id', 0): row for row in self.resources.values() if row.get('script') == '1_vllua'}
        self.trees = {row.get('id', 0): row for row in self.resources.values() if row.get('script') == '5_k2o1c'}
        self.items = {row.get('id', 0): row for row in self.resources.values() if row.get('script') == '1_y2yqy'}
        for item_id, item in self.items.items():
            item.setdefault('id', item_id)
        configurations = resource_blocks((root / 'data/hero_skills.tres').read_text(encoding='utf-8'))
        self.heroes = {row['hero_id']: row for row in configurations.values() if 'hero_id' in row}

    def text(self, key, lang, fallback=''):
        text = self.rows.get(key, {}).get(LANGS[lang], '') or fallback
        if not text:
            raise ValueError(f'Missing {lang} display text for {key}')
        # Keep only color emphasis supported by the React text renderer; never export game UI markup.
        text = text.replace('[br]', '\n')
        return re.sub(r'\[(?!/?color(?:=|\]))[^\]]+\]', '', text).strip()

    def localized(self, key, fallback=''):
        return {lang: self.text(key, lang, fallback) for lang in LANGS}

    def effect(self, kind, value):
        descriptions = {}
        details = None
        for lang in LANGS:
            args = [str(value)]
            if kind in (264, 267):
                args = [self.text(f'UI_TERRAIN_NAME_{value}', lang)]
            elif kind in (268, 339):
                args = [self.text(f'UNITY_TYPE_{value}', lang)]
            elif kind in (282, 347):
                args = [self.text(f'UI_EQUIP_TYPE_{value}', lang)]
            elif kind == 308:
                args = [self.text(f'hero_name_{value}', lang)]
            elif kind == 333:
                ability = self.abilities[value]
                category = {'zh-cn': '战法', 'ja': '戦法', 'en': 'tactic'} if ability.get('type', 0) == 1 else {'zh-cn': '谋略', 'ja': '謀略', 'en': 'stratagem'}
                args = [category[lang], self.text(f'ABILITY_NAME_{value}', lang, ability.get('name', ''))]
                details = self.localized(f'ABILITY_DESC_{value}', ability.get('description', ''))
            elif kind == 334:
                args = [self.text(f'UI_L_TACTICS_{value}', lang)]
                details = self.localized(f'UI_L_TACTICS_DESC_{value}')
            elif kind == 361:
                args = [self.text('UNITY_TYPE_21', lang), self.text('ABILITY_NAME_13', lang)]
                details = self.localized('ABILITY_DESC_13')
            elif kind == 367:
                args = [self.text('ABILITY_NAME_12', lang), self.text('ABILITY_NAME_14', lang)]
                details = {locale: self.text('ABILITY_DESC_12', locale) + '\n' + self.text('ABILITY_DESC_14', locale) for locale in LANGS}
            text = self.text(f'EFFECT_{kind}', lang)
            for index, argument in enumerate(args):
                text = text.replace('{' + str(index) + '}', argument)
            if re.search(r'\{\d+\}', text):
                raise ValueError(f'Unresolved effect {kind}, {lang}: {text}')
            descriptions[lang] = text
        result = {'label': self.localized(f'EFFECT_NAME_{kind}'), 'description': descriptions}
        if details:
            result['details'] = details
        return result

    def hero_details(self, hero_id):
        config = self.heroes.get(hero_id, {})
        ids = config.get('skill_ids', [])
        ability = self.abilities.get(ids[0]) if ids else None
        skill = None
        if ability:
            effects = []
            for key in ['effect_1', 'effect_2']:
                effect = self.resources.get(ability.get(key), {})
                if effect.get('effect_type', 0):
                    effects.append(self.effect(effect['effect_type'], effect.get('effect_value', 0)))
            skill = {'name': self.localized(f'ABILITY_NAME_{ability["id"]}', ability.get('name', '')),
                     'description': self.localized(f'ABILITY_DESC_{ability["id"]}', ability.get('description', '')),
                     'effects': effects}
        nodes = []
        for key in self.trees.get(config.get('talent_tree_id'), {}).get('nodes', []):
            node = self.resources[key]
            if not node.get('effect_type', 0):
                continue
            # Godot defaults unlock_level to 3; explicit zero-value effects still exist and must render.
            nodes.append({'level': node.get('unlock_level', 3), **self.effect(node['effect_type'], node.get('effect_value', 0))})
        return skill, sorted(nodes, key=lambda node: node['level'])
