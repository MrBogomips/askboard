# Cross-check of fixtures/whitelist.json against a second spreadsheet implementation:
# writes the cases into an .xlsx (inputs as cells, wildcards as ranges), lets LibreOffice
# recalculate it headless, and compares. LibreOffice is not Excel: where they are known to
# differ (booleans as numbers, 0^0), the fixture keeps Excel's documented value.
# Usage, from probe/: python3 tools/libreoffice-check.py <run>   (needs openpyxl and soffice)
import csv, datetime, json, os, subprocess, sys

import openpyxl

here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
run = sys.argv[1] if len(sys.argv) > 1 else "lo-check"
out_dir = os.path.join(here, "runs", run)
os.makedirs(out_dir, exist_ok=True)
cases = json.load(open(os.path.join(here, "fixtures", "whitelist.json")))["cases"]

wb = openpyxl.Workbook()
ws = wb.active
ws.title = "out"
ws["H2"] = True; ws["H3"] = "5"; ws["H4"] = "abc"; ws["H5"] = 0
for i, (v, w, u) in enumerate([(1, 4, "n/a"), (2, 5, 2), (3, 6, 3)], 1):
    ws[f"I{i}"] = v; ws[f"J{i}"] = w; ws[f"K{i}"] = u
ws["L1"] = 1; ws["L2"] = 2; ws["M1"] = 1; ws["M2"] = "=1/0"
sub = {"[x.e]": "H1", "[x.b]": "H2", "[x.t]": "H3", "[x.s]": "H4", "[x.zero]": "H5", "[x.l.*.v]": "I1:I3",
       "[x.l.*.w]": "J1:J3", "[x.l.*.u]": "K1:K3", "[x.m.*.v]": "L1:L2", "[x.k.*.v]": "M1:M2"}
dates = {"mon": "2026-11-02", "fri": "2026-11-06", "sat": "2026-11-07", "dec31": "2026-12-31", "leap": "2028-02-28"}
for i, (k, d) in enumerate(dates.items(), 1):
    ws[f"N{i}"] = datetime.date.fromisoformat(d)
    ws[f"N{i}"].number_format = "yyyy-mm-dd"
    sub[f"[x.{k}]"] = f"N{i}"
row = 1
for c in cases:
    f = c["formula"]
    for a, b in sub.items():
        f = f.replace(a, b)
    if "[" in f:
        continue
    ws[f"A{row}"] = c["id"]
    ws[f"B{row}"] = "=" + f
    ws[f"B{row}"].number_format = "yyyy-mm-dd" if c.get("type") == "date" else "General"
    row += 1
xlsx = os.path.join(out_dir, "whitelist.xlsx")
wb.save(xlsx)
version = subprocess.run(["soffice", "--version"], capture_output=True, text=True).stdout.strip()
subprocess.run(["soffice", "--headless", "--calc", "--convert-to",
                "csv:Text - txt - csv (StarCalc):44,34,76,1,,0,false,true,false,false,false,-1",
                "--outdir", out_dir, xlsx], check=True, capture_output=True)
errors = {"#VALUE!": "value", "#DIV/0!": "division-by-zero", "#NUM!": "value", "Err:502": "value"}
by_id = {c["id"]: c for c in cases}
rows = []
for r in csv.reader(open(os.path.join(out_dir, "whitelist-out.csv"))):
    cid, text = r[0], r[1]
    if cid not in by_id:
        continue
    exp = by_id[cid]["expected"]
    if text in ("TRUE", "FALSE"):
        got = text == "TRUE"
    elif text in errors:
        got = {"error": errors[text]}
    else:
        try:
            got = float(text)
        except ValueError:
            got = text
    if isinstance(exp, bool) or isinstance(got, bool) or not isinstance(exp, (int, float)) or not isinstance(got, float):
        same = got == exp and isinstance(got, bool) == isinstance(exp, bool)
    else:
        same = abs(got - exp) <= 1e-9 * max(1, abs(exp))
    rows.append({"id": cid, "formula": by_id[cid]["formula"], "expected": exp, "libreoffice": text, "agrees": same})
result = {"libreoffice": version, "cases": len(rows), "agree": sum(r["agrees"] for r in rows),
          "differ": [r for r in rows if not r["agrees"]], "rows": rows}
json.dump(result, open(os.path.join(out_dir, "libreoffice.json"), "w"), indent=2)
print(f"libreoffice: {result['agree']}/{result['cases']} agree; differ: {', '.join(r['id'] for r in result['differ'])}")
