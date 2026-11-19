# Your day, against twenty years of diaries

DSC 106 final project (Fall 2026), team Data brokers: Aryen Palkar, Jayden Liauw, Haoyu Lin.

Live page: https://aryenp.github.io/dsc106-final/

Data: [American Time Use Survey 2003–2024 multi-year microdata files](https://www.bls.gov/tus/data/datafiles-0324.htm), Bureau of Labor Statistics (activity summary file and respondent file).

## Rebuilding the data

The raw files are too large for the repo. Download `atussum-0324.zip` and `atusresp-0324.zip` from the BLS page above, unzip both into one folder, then run:

```
python3 prep/build_data.py /path/to/that/folder
```

This writes `data/activities.csv` (weighted average minutes per day by year, age group, job status and activity group) and `data/company.csv` (minutes alone, with friends and with family). Weights are `TUFNWGTP`, or `TU20FWGT` for 2020.
