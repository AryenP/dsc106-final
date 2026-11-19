"""Build data/minutes.csv from the BLS ATUS 2003-2024 activity summary file.

Usage: python3 -I prep/prep.py path/to/atussum_0324.dat data/minutes.csv

Weighted mean minutes per day = sum(w * minutes) / sum(w), using TUFNWGTP,
or TU20FWGT for 2020 (TUFNWGTP is not set that year). BLS did not collect
data from mid-March to mid-May 2020, so 2020 is flagged as partial.
"""
import sys
import pandas as pd

src, out = sys.argv[1], sys.argv[2]
d = pd.read_csv(src)
acts = [c for c in d.columns if c.startswith("t") and c[1:].isdigit()]


def cols(*prefixes):
    return [c for c in acts if c[1:].startswith(prefixes)]


groups = {
    "Sleep": cols("0101"),
    "Personal care": [c for c in cols("01") if not c[1:].startswith("0101")],
    "Work": cols("05"),
    "Education": cols("06"),
    "Housework": cols("02"),
    "Caring for others": cols("03", "04"),
    "Shopping & errands": cols("07", "08", "09", "10"),
    "Eating & drinking": cols("11"),
    "Socializing": cols("1201"),
    "TV": cols("120303", "120304"),
    "Religious & volunteer": cols("14", "15"),
    "Travel": cols("18"),
}
leisure = [c for c in cols("12", "13") if c not in groups["Socializing"] + groups["TV"]]
groups["Other leisure & sports"] = leisure
used = {c for v in groups.values() for c in v}
groups["Other"] = [c for c in acts if c not in used]

g = pd.DataFrame({k: d[v].sum(axis=1) for k, v in groups.items()})
assert (g.sum(axis=1) == d[acts].sum(axis=1)).all()

g["year"] = d["TUYEAR"]
g["w"] = d["TUFNWGTP"].where(d["TUFNWGTP"] > 0, d["TU20FWGT"])
g["age"] = pd.cut(d["TEAGE"], [14, 24, 34, 44, 54, 64, 200],
                  labels=["15-24", "25-34", "35-44", "45-54", "55-64", "65+"]).astype(str)
g["emp"] = d["TELFS"].map({1: "Employed", 2: "Employed"}).fillna("Not employed")

names = list(groups)
rows = []
for age_all in (False, True):
    for emp_all in (False, True):
        keys = ["year"] + ([] if age_all else ["age"]) + ([] if emp_all else ["emp"])
        for key, sub in g.groupby(keys):
            key = dict(zip(keys, key))
            w = sub["w"]
            means = (sub[names].mul(w, axis=0).sum() / w.sum()).round(1)
            for act, m in means.items():
                rows.append({
                    "year": key["year"],
                    "age": "All ages" if age_all else key["age"],
                    "emp": "Everyone" if emp_all else key["emp"],
                    "activity": act,
                    "minutes": m,
                    "n": len(sub),
                })

o = pd.DataFrame(rows)
o["partial"] = (o["year"] == 2020).astype(int)
o.to_csv(out, index=False)
print(len(o), "rows ->", out)
