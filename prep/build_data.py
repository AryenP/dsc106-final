"""Turn the raw ATUS 2003-2024 files into the small CSVs the page loads.

Usage: python3 prep/build_data.py <folder with atussum_0324.dat and atusresp_0324.dat>
Writes data/activities.csv and data/company.csv.
All numbers are survey-weighted means (TUFNWGTP, or TU20FWGT for 2020).
"""
import sys
from pathlib import Path
import numpy as np
import pandas as pd

RAW = Path(sys.argv[1])
OUT = Path(__file__).resolve().parent.parent / "data"

# Activity groups, keyed by code prefix. First matching prefix wins, so
# specific prefixes (sleep, TV, socializing) come before their parents.
GROUPS = [
    ("Sleep", ["0101"]),
    ("Personal care", ["01"]),
    ("Work", ["05"]),
    ("School", ["06"]),
    ("Housework & chores", ["02"]),
    ("Caring for others", ["03", "04"]),
    ("Shopping & errands", ["07", "08", "09", "10"]),
    ("Eating & drinking", ["11"]),
    ("TV & movies", ["120303", "120304"]),
    ("Socializing", ["1201"]),
    ("Games & computer", ["120307", "120308"]),
    ("Other leisure & sports", ["12", "13"]),
    ("Religious & volunteer", ["14", "15"]),
    ("Travel", ["18"]),
    ("Other", [""]),
]

AGE_BINS = [15, 25, 35, 45, 55, 65, 200]
AGE_LABELS = ["15-24", "25-34", "35-44", "45-54", "55-64", "65+"]


def group_of(code):
    for name, prefixes in GROUPS:
        if any(code.startswith(p) for p in prefixes):
            return name
    return "Other"


def add_keys(df):
    df["weight"] = np.where(df["TUYEAR"] == 2020, df["TU20FWGT"], df["TUFNWGTP"])
    df = df[df["weight"] > 0].copy()
    df["age"] = pd.cut(df["TEAGE"], AGE_BINS, right=False, labels=AGE_LABELS).astype(str)
    df["employment"] = np.where(df["TELFS"].isin([1, 2]), "Employed", "Not employed")
    return df


def weighted_means(df, value_cols):
    """Weighted mean of value_cols for every year x age x employment,
    including 'All' rollups for age and employment."""
    frames = []
    for age_all in (False, True):
        for emp_all in (False, True):
            d = df.copy()
            if age_all:
                d["age"] = "All"
            if emp_all:
                d["employment"] = "All"
            w = d["weight"]
            num = d[value_cols].mul(w, axis=0)
            num[["age", "employment", "TUYEAR"]] = d[["age", "employment", "TUYEAR"]]
            num["weight"] = w
            num["n"] = 1
            g = num.groupby(["TUYEAR", "age", "employment"])
            sums = g[value_cols + ["weight", "n"]].sum()
            means = sums[value_cols].div(sums["weight"], axis=0)
            means["n"] = sums["n"]
            frames.append(means.reset_index())
    out = pd.concat(frames, ignore_index=True)
    return out.rename(columns={"TUYEAR": "year"})


def main():
    summ = pd.read_csv(RAW / "atussum_0324.dat")
    summ = add_keys(summ)
    act_cols = [c for c in summ.columns if c.startswith("t") and c[1:].isdigit()]
    groups = {}
    for c in act_cols:
        groups.setdefault(group_of(c[1:]), []).append(c)
    for name, cols in groups.items():
        summ[name] = summ[cols].sum(axis=1)
    names = [g for g, _ in GROUPS if g in groups]
    acts = weighted_means(summ, names)
    # sanity check: groups should add to 1440 minutes for everyone
    total = acts[names].sum(axis=1)
    assert total.between(1439, 1441).all(), total.describe()
    long = acts.melt(id_vars=["year", "age", "employment", "n"], value_vars=names,
                     var_name="activity", value_name="minutes")
    long["minutes"] = long["minutes"].round(1)
    long.sort_values(["year", "age", "employment", "activity"]).to_csv(OUT / "activities.csv", index=False)

    resp = pd.read_csv(RAW / "atusresp_0324.dat",
                       usecols=["TUCASEID", "TRTALONE", "TRTFRIEND", "TRTFAMILY"])
    keys = summ[["TUCASEID", "TUYEAR", "TEAGE", "TELFS", "TUFNWGTP", "TU20FWGT"]]
    resp = add_keys(resp.merge(keys, on="TUCASEID"))
    cols = ["TRTALONE", "TRTFRIEND", "TRTFAMILY"]
    resp[cols] = resp[cols].clip(lower=0)  # negative = not asked / missing
    comp = weighted_means(resp, cols).rename(columns={
        "TRTALONE": "alone", "TRTFRIEND": "friends", "TRTFAMILY": "family"})
    comp[["alone", "friends", "family"]] = comp[["alone", "friends", "family"]].round(1)
    comp.sort_values(["year", "age", "employment"]).to_csv(OUT / "company.csv", index=False)

    print("activities.csv", len(long), "rows;", "company.csv", len(comp), "rows")
    print("respondents per year:\n", summ.groupby("TUYEAR").size().to_string())


if __name__ == "__main__":
    main()
