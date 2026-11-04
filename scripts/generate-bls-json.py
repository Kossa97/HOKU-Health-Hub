#!/usr/bin/env python3
"""
BLS 4.0 (Max Rubner-Institut, CC BY 4.0) -> public/data/bls-4.0.json

Der Katalog liegt als Datei in der App (statt in der Datenbank): Suche ohne Netz,
kein Datenbank-Import. Die App lädt ihn beim ersten Suchen (services/foodCatalog.ts).

Aufruf:  npm run bls:json -- /pfad/zu/BLS_4_0_Daten_2025_DE.xlsx
Quelle:  https://blsdb.de/download (ZIP mit BLS_4_0_Daten_2025_DE.xlsx)

Nur Python-Standardbibliothek (zipfile + xml), damit das Projekt keine Excel-
Abhängigkeit braucht. Die Datei wird generiert und nicht von Hand gepflegt.

Einheiten in der App (je 100 g): Makros in g, Energie in kcal; die Mikronährstoffe
in der Einheit aus src/features/ernaehrung/lib/micros.ts (MICROS). Der BLS führt
B6, Kupfer und Mangan in µg — sie werden hier in mg umgerechnet.
"""
import json
import re
import sys
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

NS = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}

# App-Schlüssel -> (BLS-Code, Faktor)
MACROS = {
    'kcal_100': ('ENERCC', 1), 'protein_100': ('PROT625', 1), 'carbs_100': ('CHO', 1), 'fat_100': ('FAT', 1),
    'fiber_100': ('FIBT', 1), 'sugar_100': ('SUGAR', 1), 'salt_100': ('NACL', 1), 'sat_fat_100': ('FASAT', 1),
}
MICROS = {
    'vitA': ('VITAA', 1), 'vitD': ('VITD', 1), 'vitE': ('VITE', 1), 'vitK': ('VITK', 1),
    'b1': ('THIA', 1), 'b2': ('RIBF', 1), 'b3': ('NIAEQ', 1), 'b5': ('PANTAC', 1), 'b6': ('VITB6', 0.001),
    'b7': ('BIOT', 1), 'b9': ('FOL', 1), 'b12': ('VITB12', 1), 'vitC': ('VITC', 1),
    'k': ('K', 1), 'ca': ('CA', 1), 'mg': ('MG', 1), 'p': ('P', 1), 'fe': ('FE', 1), 'zn': ('ZN', 1),
    'cu': ('CU', 0.001), 'mn': ('MN', 0.001), 'i': ('ID', 1), 'omega3': ('FAPUN3', 1), 'chol': ('CHORL', 1),
}


def col_index(ref: str) -> int:
    letters = re.match(r'[A-Z]+', ref).group(0)
    n = 0
    for ch in letters:
        n = n * 26 + (ord(ch) - 64)
    return n - 1


def read_rows(xlsx: Path):
    with zipfile.ZipFile(xlsx) as z:
        shared = []
        if 'xl/sharedStrings.xml' in z.namelist():
            for si in ET.fromstring(z.read('xl/sharedStrings.xml')).findall('m:si', NS):
                shared.append(''.join(t.text or '' for t in si.iter('{%s}t' % NS['m'])))
        sheet = sorted(n for n in z.namelist() if re.match(r'xl/worksheets/sheet\d+\.xml$', n))[0]
        with z.open(sheet) as f:
            for _, el in ET.iterparse(f, events=('end',)):
                if el.tag != '{%s}row' % NS['m']:
                    continue
                row = {}
                for c in el.findall('m:c', NS):
                    v = c.find('m:v', NS)
                    t = c.get('t')
                    if t == 'inlineStr':
                        val = ''.join(x.text or '' for x in c.iter('{%s}t' % NS['m']))
                    elif v is None:
                        continue
                    elif t == 's':
                        val = shared[int(v.text)]
                    else:
                        val = v.text
                    row[col_index(c.get('r'))] = val
                el.clear()
                yield row


def num(v):
    if v is None:
        return None
    try:
        x = float(str(v).replace(',', '.'))
    except ValueError:
        return None
    return x if x >= 0 else None


def sig(x: float):
    """4 signifikante Stellen (wie die App rundet); ganze Zahlen ohne „.0“."""
    if x == 0:
        return 0
    v = float(f'{x:.4g}')
    return int(v) if v.is_integer() else v




def main():
    if len(sys.argv) < 2:
        sys.exit('Pfad zur BLS-Datendatei (BLS_4_0_Daten_2025_DE.xlsx) angeben')
    src = Path(sys.argv[1])
    out = Path(__file__).resolve().parent.parent / 'public' / 'data' / 'bls-4.0.json'
    rows = read_rows(src)
    header = next(rows)
    # Spalte je BLS-Code: Kopf „CODE Bezeichnung [Einheit/100g]“ (nicht „Datenherkunft“/„Referenz“).
    code_col = {}
    for i, h in header.items():
        m = re.match(r'^(\S+) .*\[[^\]]+/100g\]$', h.strip())
        if m:
            code_col[m.group(1)] = i
    need = {c for c, _ in list(MACROS.values()) + list(MICROS.values())}
    missing = need - code_col.keys()
    if missing:
        sys.exit(f'Spalten fehlen: {sorted(missing)}')

    keys = list(MICROS)
    rows_out = []
    for r in rows:
        code = (r.get(0) or '').strip()
        name_de = (r.get(1) or '').strip()[:200]
        name_en = (r.get(2) or '').strip()[:200]
        if not code or not name_de:
            continue
        macro = {k: num(r.get(code_col[c])) for k, (c, f) in MACROS.items()}
        if macro['kcal_100'] is None or macro['kcal_100'] > 900:
            continue
        for k in ('protein_100', 'carbs_100', 'fat_100'):
            macro[k] = macro[k] or 0.0
        micros = []
        for k, (c, f) in MICROS.items():
            x = num(r.get(code_col[c]))
            micros.append(None if x is None else sig(x * f))
        rows_out.append([code, name_de, name_en] + [None if macro[k] is None else round(macro[k], 2) for k in MACROS] + [micros])

    doc = {
        'source': 'Max Rubner-Institut (2025): Bundeslebensmittelschlüssel (BLS), Version 4.0',
        'license': 'CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)',
        'url': 'https://blsdb.de',
        'generated': 'scripts/generate-bls-json.py — nicht von Hand ändern',
        'columns': ['code', 'name_de', 'name_en'] + [k.replace('_100', '') for k in MACROS] + ['micros'],
        'micros': keys,
        'rows': rows_out,
    }
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(doc, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print(f'{out.relative_to(out.parents[2])}: {len(rows_out)} Lebensmittel, {out.stat().st_size / 1e6:.2f} MB')


if __name__ == '__main__':
    main()
