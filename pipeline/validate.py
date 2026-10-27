"""
pipeline/validate.py
Automated validation checks for Life Path data JSONs and i18n translation completeness.
Must fail with exit code 1 if:
1. Any data sum or check fails
2. Any i18n key is missing in en, rw, or fr
3. Any {placeholders} are mismatched between translations
"""

import json
import os
import re
import sys

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "public", "data")
I18N_DIR = os.path.join(BASE_DIR, "public", "i18n")


def validate_data_jsons():
    print("[1/2] Validating scene JSON files...")
    errors = []

    # 1. Intro
    intro_path = os.path.join(DATA_DIR, "intro.json")
    if not os.path.exists(intro_path):
        errors.append("Missing public/data/intro.json")
    else:
        with open(intro_path, "r", encoding="utf-8") as f:
            intro = json.load(f)
        sum_total = sum(intro["series"]["total"])
        expected = intro["checks"]["sum_total"]
        if sum_total != expected:
            errors.append(f"intro.json sum mismatch: {sum_total} != {expected}")
        else:
            print(f"  [OK] Intro total population matches: {sum_total:,}")

    # 2. Birth
    birth_path = os.path.join(DATA_DIR, "birth.json")
    if not os.path.exists(birth_path):
        errors.append("Missing public/data/birth.json")
    else:
        with open(birth_path, "r", encoding="utf-8") as f:
            birth = json.load(f)
        reg_births = birth["indicators"]["registered_births"]
        expected = birth["checks"]["registered_births"]
        if reg_births != expected:
            errors.append(f"birth.json births mismatch: {reg_births} != {expected}")
        else:
            print(f"  [OK] Birth registered count matches: {reg_births:,}")

    # 3. Marriage
    marriage_path = os.path.join(DATA_DIR, "marriage.json")
    if not os.path.exists(marriage_path):
        errors.append("Missing public/data/marriage.json")
    else:
        with open(marriage_path, "r", encoding="utf-8") as f:
            marr = json.load(f)
        sum_grooms = sum(marr["series"]["male"])
        sum_brides = sum(marr["series"]["female"])
        if sum_grooms != 50256 or sum_brides != 50256:
            errors.append(f"marriage.json sum mismatch: grooms={sum_grooms}, brides={sum_brides} (expected 50256)")
        else:
            print(f"  [OK] Marriage registered count matches: {sum_grooms:,}")

    # 4. Divorce
    divorce_path = os.path.join(DATA_DIR, "divorce.json")
    if not os.path.exists(divorce_path):
        errors.append("Missing public/data/divorce.json")
    else:
        with open(divorce_path, "r", encoding="utf-8") as f:
            div = json.load(f)
        sum_div = sum(div["series"]["total"])
        expected = div["checks"]["sum_total"]
        if sum_div != expected:
            errors.append(f"divorce.json sum mismatch: {sum_div} != {expected}")
        else:
            print(f"  [OK] Divorce registered count matches: {sum_div:,}")

    # 5. Death
    death_path = os.path.join(DATA_DIR, "death.json")
    if not os.path.exists(death_path):
        errors.append("Missing public/data/death.json")
    else:
        with open(death_path, "r", encoding="utf-8") as f:
            death = json.load(f)
        sum_death = sum(death["series"]["total"])
        expected = death["checks"]["sum_total"]
        if sum_death != expected:
            errors.append(f"death.json sum mismatch: {sum_death} != {expected}")
        else:
            print(f"  [OK] Death registered count matches: {sum_death:,}")

    if errors:
        for err in errors:
            print(f"  [ERROR] {err}")
        return False
    return True


def extract_placeholders(text):
    return set(re.findall(r"\{([a-zA-Z0-9_]+)\}", str(text)))


def validate_i18n():
    print("[2/2] Validating i18n completeness and placeholder consistency...")
    langs = ["en", "rw", "fr"]
    data = {}
    errors = []

    for lang in langs:
        path = os.path.join(I18N_DIR, f"{lang}.json")
        if not os.path.exists(path):
            errors.append(f"Missing i18n file: {path}")
            continue
        with open(path, "r", encoding="utf-8") as f:
            data[lang] = json.load(f)

    if errors:
        for err in errors:
            print(f"  [ERROR] {err}")
        return False

    en_keys = set(data["en"].keys())
    rw_keys = set(data["rw"].keys())
    fr_keys = set(data["fr"].keys())

    missing_in_rw = en_keys - rw_keys
    missing_in_fr = en_keys - fr_keys
    extra_in_rw = rw_keys - en_keys
    extra_in_fr = fr_keys - en_keys

    if missing_in_rw:
        errors.append(f"Missing keys in rw.json: {missing_in_rw}")
    if missing_in_fr:
        errors.append(f"Missing keys in fr.json: {missing_in_fr}")
    if extra_in_rw:
        errors.append(f"Extra keys in rw.json not in en.json: {extra_in_rw}")
    if extra_in_fr:
        errors.append(f"Extra keys in fr.json not in en.json: {extra_in_fr}")

    # Check empty strings and placeholders
    for key in en_keys:
        en_val = str(data["en"].get(key, ""))
        en_places = extract_placeholders(en_val)

        for lang in ["rw", "fr"]:
            val = str(data[lang].get(key, ""))
            if not val.strip():
                errors.append(f"Empty value for key '{key}' in {lang}.json")
            places = extract_placeholders(val)
            if places != en_places:
                errors.append(f"Placeholder mismatch for key '{key}' in {lang}.json: {places} != {en_places}")

    if errors:
        for err in errors:
            print(f"  [ERROR] {err}")
        return False

    print(f"  [OK] All {len(en_keys)} translation keys present and consistent across EN, RW, and FR.")
    return True


if __name__ == "__main__":
    ok_data = validate_data_jsons()
    ok_i18n = validate_i18n()

    if not ok_data or not ok_i18n:
        print("\nPipeline validation FAILED.")
        sys.exit(1)
    else:
        print("\nAll pipeline validation checks PASSED successfully.")
        sys.exit(0)
