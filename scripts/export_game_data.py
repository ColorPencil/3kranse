"""Export the deliberately limited public catalogue; never copy raw game resources."""
import argparse
import csv
import hashlib
import json
import re
import shutil
import struct
from pathlib import Path
from PIL import Image, ImageOps, ImageDraw
from catalogue_models import DisplayCatalogue

LANGS = {"zh-cn": "zh", "ja": "ja", "en": "en"}
LOW_IDS = [0, 2, 4, 8, 12, 16, 18, 20, 24, 26, 28, 33, 34, 60, 62, 69, 130, 131, 132, 133]
RESERVED_IDS = [32, 39, 40, 54, 55, 56, 85, 86, 103, 104, 116, 123]
ITEM_NAMES = {
    0: ("短剣", "Short Sword"), 2: ("長剣", "Long Sword"), 4: ("紋鉄剣", "Patterned Iron Sword"),
    8: ("単刀", "Saber"), 12: ("斬馬刀", "Horse-cleaving Saber"), 16: ("矛", "Spear"),
    18: ("鉤鎌槍", "Hooked Spear"), 20: ("双鉤槍", "Double-hook Spear"),
    24: ("手甲", "Bracers"), 26: ("護心甲", "Heartguard Armor"), 28: ("鎖甲", "Mail Armor"),
    33: ("護符", "Protective Amulet"), 34: ("玲瓏玉佩", "Carved Jade Pendant"),
    60: ("大斧", "Great Axe"), 62: ("開山斧", "Mountain-cleaving Axe"), 69: ("鉄槌", "Iron Hammer"),
    130: ("漆葉青黏散", "Qiye Qingnian Powder"), 131: ("麻沸散", "Mafei Powder"),
    132: ("黄鬃馬", "Yellow-maned Horse"), 133: ("黒鬃馬", "Black-maned Horse"),
    32: ("伝国の玉璽", "Imperial Seal"), 39: ("双股剣", "Twin Swords"),
    40: ("孫子兵法", "The Art of War"), 54: ("青龍刀", "Green Dragon Blade"),
    55: ("蛇矛", "Serpent Spear"), 56: ("方天画戟", "Sky Piercer"),
    85: ("青釭剣", "Qinggang Sword"), 86: ("倚天剣", "Yitian Sword"),
    103: ("赤兎馬", "Red Hare"), 104: ("的盧", "Dilu"), 116: ("七星宝刀", "Seven-star Saber"),
    123: ("絶影", "Jueying"),
}
ITEM_DESCRIPTIONS = {
    0: ("短く軽量で、接近しての奇襲や隠密行動に向く剣。", "A short, light blade suited to close ambushes and covert action."),
    2: ("細長く鋭い刀身を持ち、斬撃と刺突を兼ね備え、中距離の交戦に向く。", "A long, sharp blade suited to cuts and thrusts at medium reach."),
    4: ("刀身に鍛造の紋様を持つ、堅牢で美観と実用を兼ねた剣。", "A tough blade with a forged pattern, combining ornament and practical use."),
    8: ("軽快に振るえる制式の片手刀。軍中で広く用いられる近接武器。", "A standard one-handed saber with an agile swing, widely used by soldiers."),
    12: ("長く重厚な刀身で戦馬や重装甲を斬る、攻めに適した武器。", "A long, heavy saber for cutting at warhorses and heavy armor."),
    16: ("簡素で実用的な長柄の刺突武器。隊列を組んだ突撃に向く。", "A simple, practical thrusting polearm suited to charges in formation."),
    18: ("穂先に鉤鎌を備え、突くだけでなく敵の武器や馬の脚を引っ掛ける槍。", "A spear with a hooked head, used to thrust or catch enemy weapons and horses' legs."),
    20: ("両側の鉤で敵兵を絡め取り、相手の動きを制する槍。", "A spear with hooks on both sides to catch foes and constrain their movement."),
    24: ("手首を締めて武器を安定させ、振るう際の負担を減らす防具。", "Bracers that steady the grip and protect the wrists during a swing."),
    26: ("胸の急所を守る簡潔な構造の甲。致命傷を抑えるために用いる。", "Simple armor shielding the chest's vital areas from severe wounds."),
    28: ("鉄の環を連ねた柔軟な鎧。体に沿い、刺突から身を守る。", "Flexible armor of linked iron rings, fitted to the body to resist thrusts."),
    33: ("吉を招き災いを避け、危難から身を守ることを願う護符。", "A charm carried for good fortune and protection in times of danger."),
    34: ("澄んだ光沢を持つ精巧な玉佩。心を鎮める、優美な守りの飾り。", "A clear, lustrous jade pendant, valued for elegance, calm and protection."),
    60: ("幅広い刃を備えた制式の重斧。力強い斬撃を繰り出す。", "A standard heavy axe with a broad blade and a powerful chopping stroke."),
    62: ("分厚く重厚な斧。城や山をも切り開くと称される攻めの重器。", "A thick, heavy axe said to cleave fortifications and mountains."),
    69: ("重い頭部を備えた大型の鉄槌。一撃で敵に大きな打撃を与える。", "A massive iron war hammer with a heavy head and a crushing blow."),
    130: ("城内で使う養生道具。基礎最大体力が1増える。最終最大体力が100に達している場合は使用できず、消費もしない。", "A restorative used in a city. Raises base maximum HP by 1. If final maximum HP is already 100, it cannot be used and is not consumed."),
    131: ("城内の治療用品。現在体力を20回復し、最大体力は増えない。体力が満タンの場合は使用できず、消費もしない。", "A medical item used in a city. Restores 20 current HP without raising the maximum. At full HP it cannot be used and is not consumed."),
    132: ("黄色いたてがみを持つ丈夫な軍馬。足取りが安定し、行軍を少し速める。", "A sturdy yellow-maned warhorse with a steady gait that slightly speeds up marching."),
    133: ("黒く豊かなたてがみと強い体躯を持つ馬。素早く駆け、行軍速度を高める。", "A strong horse with a thick black mane, swift enough to improve marching speed."),
}


def read_csv(path):
    with path.open(encoding="utf-8-sig", newline="") as stream:
        return {row["id"]: row for row in csv.DictReader(stream)}


def clean(value):
    return re.sub(r"\[/?[^\]]+\]", "", value).strip()


def localized(row, fallback=""):
    return {lang: clean(row.get(col, "") or fallback) for lang, col in LANGS.items()}


def parse_resource(block):
    result = {}
    for key, value in re.findall(r"^(\w+) = (.*)$", block, flags=re.M):
        try:
            result[key] = json.loads(value)
        except (ValueError, TypeError):
            pass
    return result


def webp(source, destination, width=None):
    with Image.open(source) as img:
        if width and img.width > width:
            img = ImageOps.contain(img, (width, width * 2), Image.Resampling.LANCZOS)
        img.save(destination, "WEBP", quality=88, method=6)


def item_icon(root, item, destination):
    directory = root / "resources/graphics/items"
    direct = directory / f'equip_icon_{item["id"]}.png'
    if not direct.exists():
        # UID-backed icons must be resolved from their import sidecar, not guessed.
        uid = item.get("icon_texture_uid", "")
        for sidecar in directory.glob("*.png.import"):
            if uid and uid in sidecar.read_text(encoding="utf-8"):
                direct = Path(str(sidecar)[:-7])
                break
    if direct.exists():
        with Image.open(direct) as img:
            img.save(destination)
        return
    atlas = directory / f'equip_icon_{item["id"]:02d}.atlastex'
    raw = atlas.read_bytes()
    match = re.search(rb"res://([^\x00]+?\.png)", raw)
    marker = raw.find(b"\x03\x00\x00\x00\x0b\x00\x00\x00")
    if not match or marker < 0:
        raise ValueError(f"Cannot safely read atlas: {atlas}")
    x, y, width, height = struct.unpack_from("<ffff", raw, marker + 8)
    with Image.open(root / match.group(1).decode("utf-8")) as img:
        assert 0 <= x < img.width and 0 <= y < img.height
        assert width > 0 and height > 0 and x + width <= img.width and y + height <= img.height
        img.crop((int(x), int(y), int(x + width), int(y + height))).save(destination)


def export_promo_assets(root, site, assets, promo, design):
    webp(promo / "X/TK_Fate_of_the_People-ja-20261026-v01.png", assets / "hero-ja.webp", 2172)
    webp(promo / "X/TK_Fate_of_the_People.png", assets / "hero-global.webp", 2172)
    webp(promo / "indienova/中文/main-scene-reference-original-20261022.png", assets / "screens/governance.webp", 1600)
    frames = {"battlefield": "S04-battlefield-v002-0200.png", "army": "S03-army-setup-v002-0120.png", "water": "S07-water-v003-0215.png", "duel": "S09-duel-rain-v004-0121.png"}
    for name, filename in frames.items():
        webp(design / "video-assets/frames" / filename, assets / "screens" / f"{name}.webp", 1440)
    shutil.copy2(design / "video-assets/clips/v004-0120-0126-duel-rain-silent.mp4", assets / "duel-silent.mp4")
    # Preserve the studio logo's original pixel colors and alpha; do not convert it into a silhouette.
    shutil.copy2(root / "resources/graphics/loading/starting_logo_txt.png", assets / "studio-logo.png")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--game-root", type=Path, required=True)
    parser.add_argument("--site-root", type=Path, required=True)
    parser.add_argument("--promo-root", type=Path, required=True)
    parser.add_argument("--design-root", type=Path, required=True)
    parser.add_argument("--catalogue-only", action="store_true")
    parser.add_argument("--asset-fallback-root", type=Path)
    args = parser.parse_args()
    root, site = args.game_root.resolve(), args.site_root.resolve()
    assets = site / "public/assets"
    for folder in [assets, assets / "officers", assets / "equipment", assets / "screens", site / "src/generated"]:
        folder.mkdir(parents=True, exist_ok=True)

    display = DisplayCatalogue(root)
    profiles = read_csv(root / "resources/languages/hero_profile.csv")
    heroes = json.loads((root / "data/Heroes.json").read_text(encoding="utf-8-sig"))
    selected = []
    for hero in heroes:
        if max(hero.get(key, 0) for key in ("stre", "inte", "ste")) < 90:
            continue
        hero_id = hero["id"]
        portrait = root / "resources/graphics/hero" / f'{hero.get("portraiture_name", "")}.png'
        if portrait.exists():
            webp(portrait, assets / "officers" / f"{hero_id}.webp")
        else:
            # Reuse only the same officer's earlier approved website asset, never another person's portrait.
            previous = (args.asset_fallback_root or site) / "public/assets/officers" / f"{hero_id}.webp"
            if not previous.exists():
                raise FileNotFoundError(f"Missing portrait for {hero_id}")
            if previous.resolve() != (assets / "officers" / previous.name).resolve():
                shutil.copy2(previous, assets / "officers" / previous.name)
        skill, talents = display.hero_details(hero_id)
        # Only the selected hero's displayed skill and tree are authorized; other hidden links stay private.
        selected.append({
            "id": hero_id,
            "name": localized(profiles.get(f"hero_name_{hero_id}", {}), hero["name"]),
            "profile": localized(profiles.get(f"hero_profile_{hero_id}", {})),
            # Base maximum HP is stable across injuries; never expose scenario current HP or equipped bonuses.
            "stats": {key: hero.get(key, 0) for key in ("stre", "inte", "ste", "comm", "max_hp", "cou")},
            "skill": skill, "talents": talents,
            "portrait": f"/assets/officers/{hero_id}.webp",
        })

    equipment = display.items
    translations = json.loads((Path(__file__).parent / "equipment_copy.json").read_text(encoding="utf-8"))
    # Retain the original curated level 1–5 set and add the newly authorized level 6–7 range.
    public_ids = sorted(set(LOW_IDS) | {key for key, value in equipment.items() if 6 <= value.get("level", 0) < 8})
    public_items = []
    attribute_keys = {0: "STRE", 1: "INTE", 2: "STE", 3: "COU", 4: "COMM", 5: "EXP", 6: "LEVEL", 7: "LIFESPAN", 8: "HP", 9: "MP", 10: "ACTION", 11: "MOVE", 16: "RECOVER", 19: "ATT", 20: "DEF"}
    for item_id in public_ids:
        item = equipment[item_id]
        assert item.get("level", 0) < 8, "Privacy gate: level 8 and above is names-only"
        item_icon(root, item, assets / "equipment" / f"{item_id}.png")
        if item_id in LOW_IDS:
            names, descriptions = ITEM_NAMES[item_id], ITEM_DESCRIPTIONS[item_id]
        elif item.get("attr_type") == 15:
            unit = display.localized(f'UNITY_TYPE_{item["attr_value"]}')
            names = (unit["ja"], unit["en"])
            descriptions = (f'兵符。「{unit["ja"]}」の編成を可能にする。', f'A troop token permitting the formation of {unit["en"]}.')
        else:
            names = translations[str(item_id)][:2]
            descriptions = translations[str(item_id)][2:]
        zh_description = clean(item.get("description", "").replace("[br]", "\n").replace("调用治疗入口", ""))
        # The source flavor text says +3 but the actual current horse configuration grants +2.
        if item_id == 124:
            zh_description = zh_description.replace("行军增加3点", "行军增加2点")
        bonuses = []
        attribute = item.get("attr_type", 99)
        value = item.get("attr_value", 0)
        if value and attribute in attribute_keys:
            bonuses.append({lang: f'{display.text("UI_L_" + attribute_keys[attribute], lang)} +{value}' for lang in LANGS})
        if item.get("effect_type", 0):
            bonuses.append(display.effect(item["effect_type"], item.get("effect_val", 0))["description"])
        public_items.append({
            "id": item_id, "level": item.get("level", 0), "type": item.get("type", 0),
            "name": {"zh-cn": item["name"], "ja": names[0], "en": names[1]},
            "description": {"zh-cn": zh_description, "ja": descriptions[0], "en": descriptions[1]},
            "attack": item.get("att", 0), "defense": item.get("def", 0), "weight": item.get("weight", 0),
            "bonuses": bonuses, "icon": f"/assets/equipment/{item_id}.png",
        })
    # High-level selections have only names. Never export their level, ID, effect or icon path.
    reserved = [{"zh-cn": equipment[i]["name"], "ja": ITEM_NAMES[i][0], "en": ITEM_NAMES[i][1]}
                for i in RESERVED_IDS if equipment[i].get("level", 0) >= 8]
    result = {"sourceDate": "2026-10-27", "officers": selected, "equipment": public_items, "reservedNames": reserved}
    # These two directories contain only this exporter’s numeric assets. Remove obsolete exports,
    # so lowering an item's public status cannot leave an old icon accessible by its URL.
    for folder, allowed, suffix in [
        (assets / "officers", {f'{hero["id"]}.webp' for hero in selected}, ".webp"),
        (assets / "equipment", {f'{item["id"]}.png' for item in public_items}, ".png"),
    ]:
        for old in folder.glob(f"*{suffix}"):
            if re.fullmatch(r"\d+" + re.escape(suffix), old.name) and old.name not in allowed:
                assert old.parent.resolve() == folder.resolve()
                old.unlink()
    (site / "src/generated/catalogue.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")

    if not args.catalogue_only:
        export_promo_assets(root, site, assets, args.promo_root, args.design_root)
    source_names = ["data/Heroes.json", "data/game_data.tres", "data/hero_skills.tres", "resources/languages/hero_profile.csv", "resources/languages/ability_info.csv", "resources/languages/effect_info.csv", "resources/languages/ui_info.csv"]
    manifest = {
        "sourceDate": result["sourceDate"], "officerCount": len(selected),
        "publicEquipmentCount": len(public_items), "reservedNameCount": len(reserved),
        "equipmentTotal": len(public_items) + len(reserved), "sources": source_names,
        "policy": "Only base STR/INT/prestige >= 90. Selected equipment < 8: public fields. Equipment >= 8: localized names only. Selected hero base maximum HP, courage, skill descriptions and level-ordered talent nodes included. No hidden acquisition or hero equipment links.",
        "sourceHashes": {name: hashlib.sha256((root / name).read_bytes()).hexdigest() for name in source_names},
        "editorialNotes": ["Effect 367 has a website-only trilingual draft until the game CSV supplies it.", "Zhuahuang Feidian movement uses configured +2 rather than the older +3 flavor text."],
    }
    (site / "docs/catalogue-export.json").parent.mkdir(parents=True, exist_ok=True)
    (site / "docs/catalogue-export.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    sheet = Image.new("RGB", (600, 100 * ((len(public_items) + 5) // 6)), "#f2ebdd")
    draw = ImageDraw.Draw(sheet)
    for n, item in enumerate(public_items):
        icon = Image.open(assets / "equipment" / f'{item["id"]}.png').convert("RGBA")
        icon.thumbnail((60, 60))
        x, y = (n % 6) * 100 + 20, (n // 6) * 100 + 6
        sheet.paste(icon, (x, y), icon)
        draw.text((x, y + 64), str(item["id"]), fill="#18251f")
    (site / "docs/qa").mkdir(parents=True, exist_ok=True)
    sheet.save(site / "docs/qa/equipment-extraction.png")
    print(json.dumps({"officers": len(selected), "equipment": len(public_items), "namesOnly": len(reserved)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
