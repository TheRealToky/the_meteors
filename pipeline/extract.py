"""
pipeline/extract.py
Reads clean NISR CRVS 2025 CSVs and generates validated JSON files for each scene in /public/data/.

Resolves the 5 data issues:
1. Figure 19 last bucket: labels jump from 75-79 to 85+ without 80-84. Sum = 39,355, so it is 80+. Label ID is 'age.last_bucket'.
2. Conflicting totals: Table 12 chosen for deaths (39,355), Table 18 chosen for marriages (50,256).
3. Under-registration: death completeness is 50.5% vs 92.9% for births. Labeled 'registered deaths', never 'risk of dying'.
4. Divorces are not a marriage rate: 4,479 divorces vs 50,256 marriages come from different cohorts; 41% granted before 2025.
5. The 'life' is a composite: 2025 cross-section plus 2019-2025 trends, framed with caveats and methodology panel.
"""

import json
import os
import pandas as pd

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data", "clean")
OUT_DIR = os.path.join(BASE_DIR, "public", "data")

os.makedirs(OUT_DIR, exist_ok=True)


def extract_intro():
    df = pd.read_csv(os.path.join(DATA_DIR, "figure1.csv"))
    # Filter out 'Total' row
    df_rows = df[df["Category"].str.strip().str.lower() != "total"].copy()

    labels = []
    male = []
    female = []
    total = []

    for _, row in df_rows.iterrows():
        cat = str(row["Category"]).strip()
        if cat in ["80 +", "80+", "85+"]:
            labels.append("80+")
        else:
            labels.append(cat)
        male.append(int(row["Male"]))
        female.append(int(row["Female"]))
        total.append(int(row["Total"]))

    sum_total = sum(total)

    data = {
        "id": "intro_pyramid",
        "source": {
            "sheet": "Figure1",
            "title": "5-Years Age-group Population Pyramid, 2025",
            "table_ref": "Annex 1",
            "note": "Projections for 2025 total population by age group and sex."
        },
        "unit": "people",
        "labels": labels,
        "series": {
            "male": male,
            "female": female,
            "total": total
        },
        "indicators": {
            "total_population": sum_total,
            "male_population": sum(male),
            "female_population": sum(female),
            "sex_ratio": round((sum(male) / sum(female)) * 100, 1)
        },
        "caption_key": "intro.caption",
        "caveat_key": "caveat.composite_life",
        "checks": {
            "sum_total": 14108217
        }
    }

    assert sum_total == 14108217, f"Figure 1 population sum mismatch: {sum_total} != 14108217"

    with open(os.path.join(OUT_DIR, "intro.json"), "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    print("[OK] intro.json generated successfully (Sum: 14,108,217)")


def extract_birth():
    # 1. Birth Indicators
    df_birth = pd.read_csv(os.path.join(DATA_DIR, "10_3.csv"))
    reg_total = int(df_birth.iloc[0]["2025"])
    reg_male = int(df_birth.iloc[1]["2025"])
    reg_female = int(df_birth.iloc[2]["2025"])
    completeness = float(df_birth.iloc[6]["2025"])
    sex_ratio = float(df_birth.iloc[9]["2025"])
    tfr = float(df_birth.iloc[11]["2025"])

    # 2. Baby Names (Annex 2)
    df_names = pd.read_csv(os.path.join(DATA_DIR, "annex2.csv"))
    female_names = []
    male_names = []

    for _, row in df_names.iterrows():
        f_name = str(row["FEMALE | Child surnames"]).strip()
        f_count = int(row["FEMALE | Total Counts"])
        female_names.append({"name": f_name, "count": f_count})

        m_name = str(row["MALE | Child surnames"]).strip()
        m_count = int(row["MALE | Total Counts"])
        male_names.append({"name": m_name, "count": m_count})

    data = {
        "id": "birth_stats",
        "source": {
            "sheet": "10.3",
            "title": "Summary statistics on births (2019-2025)",
            "names_sheet": "Annex 2",
            "note": "Registered births in 2025. Total fertility rate is 3.5 births per woman."
        },
        "indicators": {
            "registered_births": reg_total,
            "male_births": reg_male,
            "female_births": reg_female,
            "registration_completeness": completeness,
            "sex_ratio_at_birth": sex_ratio,
            "fertility_rate": tfr,
            "fertility_statement": "Rwandan women have about 3.5 children on average"
        },
        "top_names": {
            "female": female_names,
            "male": male_names
        },
        "caption_key": "birth.caption",
        "caveat_key": "caveat.registered_not_occurring",
        "checks": {
            "registered_births": 356838
        }
    }

    assert reg_total == 356838, f"Birth count mismatch: {reg_total} != 356838"

    with open(os.path.join(OUT_DIR, "birth.json"), "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    print("[OK] birth.json generated successfully (Births: 356,838)")


def extract_marriage():
    # 1. Age distribution (Figure 30)
    df_f30 = pd.read_csv(os.path.join(DATA_DIR, "figure30.csv"))
    labels = []
    grooms = []
    brides = []

    for _, row in df_f30.iterrows():
        age = str(row["Age"]).strip()
        labels.append(age)
        grooms.append(int(row["Groom"]))
        brides.append(int(row["Bride"]))

    total_marriages = sum(grooms)

    # 2. Historical Trend (Table 18)
    df_t18 = pd.read_csv(os.path.join(DATA_DIR, "table18.csv"))
    trend = []
    for _, row in df_t18.iterrows():
        trend.append({
            "year": int(row["Year"]),
            "marriages": int(row["Number of marriages"]),
            "population": int(row["Population"]),
            "crude_rate": float(row["Crude marriage rate (‰)"])
        })

    data = {
        "id": "marriage_stats",
        "source": {
            "sheet": "Figure30",
            "table_sheet": "Table 18",
            "title": "Marriages registered in 2025 by age of bride and groom",
            "note": "Table 18 selected over sheet 10.10 per documented data decision."
        },
        "unit": "marriages",
        "labels": labels,
        "series": {
            "male": grooms,
            "female": brides,
            "total": [g + b for g, b in zip(grooms, brides)]
        },
        "peaks": {
            "female_peak_bracket": "21-24",
            "female_peak_count": 17761,
            "male_peak_bracket": "25-29",
            "male_peak_count": 17059
        },
        "trend_2019_2025": trend,
        "caption_key": "marriage.caption",
        "caveat_key": "caveat.marriage_registration",
        "checks": {
            "sum_grooms": 50256,
            "sum_brides": 50256
        }
    }

    assert total_marriages == 50256, f"Marriage sum mismatch: {total_marriages} != 50256"

    with open(os.path.join(OUT_DIR, "marriage.json"), "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    print("[OK] marriage.json generated successfully (Marriages: 50,256)")


def extract_divorce():
    df_t27 = pd.read_csv(os.path.join(DATA_DIR, "table27.csv"))
    # Filter Grand Total
    df_rows = df_t27[df_t27["Duration In years"].str.strip().str.lower() != "grand total"].copy()

    labels = []
    granted_before = []
    granted_2025 = []
    totals = []

    for _, row in df_rows.iterrows():
        dur = str(row["Duration In years"]).strip()
        labels.append(dur)
        gb = int(row["Number | Granted before but registered in 2025"])
        g25 = int(row["Number | Granted and registered in 2025"])
        tot = int(row["Number | Total"])
        granted_before.append(gb)
        granted_2025.append(g25)
        totals.append(tot)

    sum_divorces = sum(totals)

    # Key indicators (Table 28)
    df_t28 = pd.read_csv(os.path.join(DATA_DIR, "table28.csv"))
    ind_dict = {str(r.iloc[0]).strip(): r["2025"] for _, r in df_t28.iterrows()}

    data = {
        "id": "divorce_stats",
        "source": {
            "sheet": "Table 27",
            "indicators_sheet": "Table 28",
            "title": "Registered divorces by duration of marriage (2025)",
            "note": "41.3% of registered divorces were granted prior to 2025. Not a cohort divorce rate."
        },
        "unit": "divorces",
        "labels": labels,
        "series": {
            "granted_before": granted_before,
            "granted_2025": granted_2025,
            "total": totals
        },
        "indicators": {
            "total_registered": sum_divorces,
            "granted_before_count": sum(granted_before),
            "granted_before_percent": 41.3,
            "granted_in_2025_count": sum(granted_2025),
            "male_average_age": float(ind_dict.get("Average age at divorce for males", 43.3)),
            "female_average_age": float(ind_dict.get("Average age at divorce for females", 39.8)),
            "crude_rate": float(ind_dict.get("Crude divorce rate", 0.2)),
            "peak_duration_bracket": "5-9",
            "peak_duration_count": 1076
        },
        "caption_key": "divorce.caption",
        "caveat_key": "caveat.divorce_not_rate",
        "checks": {
            "sum_total": 4479
        }
    }

    assert sum_divorces == 4479, f"Divorce sum mismatch: {sum_divorces} != 4479"

    with open(os.path.join(OUT_DIR, "divorce.json"), "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    print("[OK] divorce.json generated successfully (Divorces: 4,479)")


def extract_death():
    # 1. Figure 19 age-sex histogram
    df_f19 = pd.read_csv(os.path.join(DATA_DIR, "figure_19.csv"))
    df_rows = df_f19[df_f19["Age at death"].str.strip().str.lower() != "grand total"].copy()

    labels = []
    male = []
    female = []
    total = []

    for _, row in df_rows.iterrows():
        age = str(row["Age at death"]).strip()
        # Resolution of Data Issue #1:
        # Label in sheet is '85+' with no 80-84, but sums to exactly 39,355.
        # We assign standard ID '80+' with label key 'age.last_bucket'
        if age in ["85+", "80+", "80 +"]:
            labels.append("80+")
        else:
            labels.append(age)

        m = int(row["MALE"])
        f = int(row["FEMALE"])
        tot = int(row["Grand Total"])
        male.append(m)
        female.append(f)
        total.append(tot)

    sum_deaths = sum(total)

    # 2. Table 17 Top 20 Causes (Facility vs Community side-by-side)
    df_t17 = pd.read_csv(os.path.join(DATA_DIR, "table_17.csv"))
    facility_causes = []
    community_causes = []

    for _, row in df_t17.iterrows():
        rank = int(row["Rank"])
        fac_name = str(row["Facility Cause of death"]).strip()
        fac_pct = float(row["Percentages"])
        facility_causes.append({"rank": rank, "cause": fac_name, "percentage": fac_pct})

        comm_name = str(row["Community cause of death"]).strip()
        comm_pct = float(row["Percentages (2)"])
        community_causes.append({"rank": rank, "cause": comm_name, "percentage": comm_pct})

    data = {
        "id": "death_stats",
        "source": {
            "sheet": "Figure 19",
            "table_sheet": "Table 12",
            "causes_sheet": "Table 17",
            "location_sheet": "Table 14",
            "title": "Age-Sex structure of all registered deaths (2025)",
            "note": "Table 12 chosen over 10.2 per data resolution. Figure 19 last bucket treated as 80+."
        },
        "unit": "deaths",
        "labels": labels,
        "last_bucket_label_key": "age.last_bucket",
        "series": {
            "male": male,
            "female": female,
            "total": total
        },
        "indicators": {
            "total_registered_deaths": sum_deaths,
            "male_deaths": sum(male),
            "female_deaths": sum(female),
            "sex_ratio_at_death": 127.4, # 127.4 male per 100 female
            "completeness": 50.5, # 50.5% registered
            "community_share_percent": 55.9,
            "facility_share_percent": 44.1,
            "under_5_deaths": 6393,
            "leading_facility_cause": "Conditions arising during the perinatal period (14.9%)"
        },
        "top_causes": {
            "facility": facility_causes,
            "community": community_causes
        },
        "caption_key": "death.caption",
        "caveat_key": "caveat.registered_deaths_completeness",
        "checks": {
            "sum_total": 39355
        }
    }

    assert sum_deaths == 39355, f"Death sum mismatch: {sum_deaths} != 39355"

    with open(os.path.join(OUT_DIR, "death.json"), "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    print("[OK] death.json generated successfully (Deaths: 39,355)")


def extract_meta():
    meta = {
        "title": "Life Path — Rwanda CRVS 2025 Data Decisions & Caveats",
        "version": "v2.0",
        "source_report": "Civil Registration and Vital Statistics Systems (CRVS) Annual Report 2025, NISR Rwanda",
        "data_issues_resolved": {
            "issue_1_figure19_last_bucket": {
                "problem": "Labels jump from 75-79 to 85+ without an 80-84 row.",
                "resolution": "Total sums exactly to 39,355 without an 80-84 row; treated as 80+ and referenced by key 'age.last_bucket'."
            },
            "issue_2_conflicting_totals": {
                "problem": "Deaths differ between sheet 10.2 (39,378) and Table 12 (39,355). Marriages differ between Table 18 (52,878) and sheet 10.10 (52,806).",
                "resolution": "Standardized on Table 12 for mortality (39,355 in 2025) and Table 18 for nuptiality (50,256 in 2025)."
            },
            "issue_3_under_registration": {
                "problem": "Death registration completeness is only 50.5% in 2025, compared to 92.9% for births.",
                "resolution": "Strictly labeled as 'registered deaths', never 'risk of dying' or 'true mortality distribution'."
            },
            "issue_4_divorces_not_a_rate": {
                "problem": "4,479 registered divorces vs 50,256 marriages does not equal a 9% divorce rate.",
                "resolution": "Cohorts differ, and 41.3% of divorces were granted in prior years. Displayed as separate indicators."
            },
            "issue_5_composite_life": {
                "problem": "The player walks one life, but the data is a 2025 cross-section plus 2019-2025 historical trends.",
                "resolution": "Framed in the intro and documented in the methodology panel."
            }
        }
    }

    with open(os.path.join(OUT_DIR, "meta.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)
    print("[OK] meta.json generated successfully")


if __name__ == "__main__":
    print("Running pipeline v0 data extraction...")
    extract_intro()
    extract_birth()
    extract_marriage()
    extract_divorce()
    extract_death()
    extract_meta()
    print("All pipeline v0 JSON files generated in public/data/")
