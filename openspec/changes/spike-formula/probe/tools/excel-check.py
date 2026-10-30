# Workbook for the product owner's check in Excel (findings.md, Product owner checks): the cases of
# fixtures/whitelist.json as live formulas over the same input cells as tools/libreoffice-check.py,
# each beside the fixture's expected value and a cell that compares them once Excel recalculates.
# Usage, from probe/: python3 tools/excel-check.py <out.xlsx>   (needs openpyxl)
import datetime, json, os, sys

import openpyxl

here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(here, "runs", "excel-check.xlsx")
cases = json.load(open(os.path.join(here, "fixtures", "whitelist.json")))["cases"]
excel_errors = {"value": "#VALUE!", "division-by-zero": "#DIV/0!"}

wb = openpyxl.Workbook()
ws = wb.active
ws.title = "check"
inputs = wb.create_sheet("inputs")
inputs["H2"] = True; inputs["H3"] = "5"; inputs["H4"] = "abc"; inputs["H5"] = 0
for i, (v, w, u) in enumerate([(1, 4, "n/a"), (2, 5, 2), (3, 6, 3)], 1):
    inputs[f"I{i}"] = v; inputs[f"J{i}"] = w; inputs[f"K{i}"] = u
inputs["L1"] = 1; inputs["L2"] = 2; inputs["M1"] = 1; inputs["M2"] = "=1/0"
sub = {"[x.e]": "H1", "[x.b]": "H2", "[x.t]": "H3", "[x.s]": "H4", "[x.zero]": "H5", "[x.l.*.v]": "I1:I3",
       "[x.l.*.w]": "J1:J3", "[x.l.*.u]": "K1:K3", "[x.m.*.v]": "L1:L2", "[x.k.*.v]": "M1:M2"}
dates = {"mon": "2026-11-02", "fri": "2026-11-06", "sat": "2026-11-07", "dec31": "2026-12-31", "leap": "2028-02-28"}
for i, (k, d) in enumerate(dates.items(), 1):
    inputs[f"N{i}"] = datetime.date.fromisoformat(d)
    inputs[f"N{i}"].number_format = "yyyy-mm-dd"
    sub[f"[x.{k}]"] = f"N{i}"

ws.append(["case", "formula as written", "Excel's result", "fixture expects", "same?"])
row = 2
for c in cases:
    f = c["formula"]
    for a, b in sub.items():
        f = f.replace(a, "inputs!" + b)
    if "[" in f:
        continue
    exp = c["expected"]
    ws[f"A{row}"] = c["id"]
    ws[f"B{row}"] = c["formula"]
    ws[f"C{row}"] = "=" + f
    if isinstance(exp, dict):
        # The port folds #NUM! into `value`; the fixture's `excel` field names Excel's own code.
        ws[f"D{row}"] = (c.get("excel") or excel_errors.get(exp["error"], "#VALUE!")).split(":")[0]
        # ERROR.TYPE of a literal error constant is valid Excel: ERROR.TYPE(#DIV/0!) = 2.
        ws[f"E{row}"] = f'=IF(ISERROR(C{row}),IF(ERROR.TYPE(C{row})=ERROR.TYPE({ws[f"D{row}"].value}),"same","DIFFERENT"),"DIFFERENT")'
    elif isinstance(exp, bool):
        ws[f"D{row}"] = exp
        ws[f"E{row}"] = f'=IF(ISERROR(C{row}),"DIFFERENT",IF(AND(ISLOGICAL(C{row}),C{row}=D{row}),"same","DIFFERENT"))'
    elif isinstance(exp, (int, float)):
        ws[f"D{row}"] = exp
        ws[f"E{row}"] = f'=IF(ISERROR(C{row}),"DIFFERENT",IF(ABS(C{row}-D{row})<=1E-9*MAX(1,ABS(D{row})),"same","DIFFERENT"))'
    else:
        ws[f"D{row}"] = exp
        ws[f"E{row}"] = f'=IF(ISERROR(C{row}),"DIFFERENT",IF(TEXT(C{row},"yyyy-mm-dd")=D{row},"same",IF(C{row}=D{row},"same","DIFFERENT")))'
    if c.get("type") == "date":
        ws[f"C{row}"].number_format = "yyyy-mm-dd"
    row += 1
ws["G1"] = "cases"; ws["H1"] = row - 2
ws["G2"] = "DIFFERENT"; ws["H2"] = f'=COUNTIF(E2:E{row - 1},"DIFFERENT")'
wb.save(out)
print(f"excel-check: {row - 2} cases written to {os.path.basename(out)}")
