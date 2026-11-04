#!/usr/bin/env python3
"""Baut die Dateien fuer die Link-Karte (`api/_lib/profileCard.js`) nach `api/_assets/profile-card/`.

Bilder: Brand-Kit v2 (`docs/logo/hoku/brand-kit-v2/`, liegt auf `main`), nur verkleinert, genau auf die
Pixelbreite, in der die Karte sie zeigt (1200 x 630, Masse aus dem Mockup
`docs/profil/mockups/profil-2c-karten-auswahl.html`, 1cqw = 12 px). Nie vergroessert.

Schriften (alle SIL OFL 1.1):
- Space Grotesk 600 und Inter 500 / 500 kursiv / 600: statische Instanzen der variablen Schriften aus
  google/fonts (`ofl/spacegrotesk/SpaceGrotesk[wght].ttf`, `ofl/inter/Inter[opsz,wght].ttf`,
  `ofl/inter/Inter-Italic[opsz,wght].ttf`), dieselben Dateien, die Google Fonts im Mockup ausliefert.
  Beide ohne Reserved Font Name, eine Instanz ist also erlaubt. Inter mit opsz 14 (Standard von Google Fonts).
- IBM Plex Mono Medium: unveraendert aus dem Brand-Kit (Reserved Font Name "Plex", daher nicht angefasst).

Aufruf:
  python3 scripts/build-profile-card-assets.py --brand-kit <brand-kit-v2> --google-fonts <ordner>
Der Ordner `--google-fonts` enthaelt SpaceGrotesk-VF.ttf, Inter-VF.ttf, Inter-Italic-VF.ttf und die OFL.txt
beider Familien als SpaceGrotesk-OFL.txt / Inter-OFL.txt. Braucht Pillow und fontTools.
"""
import argparse
import os
import shutil

from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from PIL import Image

OUT = os.path.join(os.path.dirname(__file__), '..', 'api', '_assets', 'profile-card')

# Ziel: (Datei im Brand-Kit, Breite in px auf der Karte)
IMAGES = {
    'hauptlogo-cyan-360.png': ('01-Hauptlogo/hoku-health-hub-cyan-schrift-weiss-transparent-1200.png', 360),
    'hauptlogo-weiss-480.png': ('01-Hauptlogo/hoku-health-hub-weiss-transparent-1200.png', 480),
    'kompaktlogo-weiss-240.png': ('02-Kompaktlogo/hoku-kompakt-weiss-transparent-1200.png', 240),
    'hoku-504.png': ('04-Icons/hoku-symbol-cyan-transparent-1024.png', 504),
    'hoku-672.png': ('04-Icons/hoku-symbol-cyan-transparent-1024.png', 672),
}

# Ziel: (Quelle, Achsen, Gewicht fuer OS/2)
FONTS = {
    'SpaceGrotesk-SemiBold.ttf': ('SpaceGrotesk-VF.ttf', {'wght': 600}),
    'Inter-Medium.ttf': ('Inter-VF.ttf', {'wght': 500, 'opsz': 14}),
    'Inter-SemiBold.ttf': ('Inter-VF.ttf', {'wght': 600, 'opsz': 14}),
    'Inter-MediumItalic.ttf': ('Inter-Italic-VF.ttf', {'wght': 500, 'opsz': 14}),
}


def build_images(brand_kit):
    for name, (src, width) in IMAGES.items():
        im = Image.open(os.path.join(brand_kit, src)).convert('RGBA')
        if width > im.width:
            raise SystemExit(f'{src}: {width} px waere vergroessert ({im.width} px)')
        height = round(im.height * width / im.width)
        # Pillow rechnet RGBA beim Verkleinern vormultipliziert, die Kanten bleiben sauber.
        im.resize((width, height), Image.LANCZOS).save(os.path.join(OUT, name), optimize=True)
        print(f'{name}: {width} x {height}')


WEIGHT_NAMES = {500: 'Medium', 600: 'SemiBold'}


def rename(font, weight, italic):
    """Namen und OS/2 der statischen Instanz setzen: Familie bleibt (ID 16), Stil wird z. B. "Medium Italic"."""
    name = font['name']
    family = name.getDebugName(16) or name.getDebugName(1)
    style = WEIGHT_NAMES[weight] + (' Italic' if italic else '')
    for rec in list(name.names):
        if rec.nameID in (1, 2, 3, 4, 6, 16, 17, 25):
            name.removeNames(nameID=rec.nameID)
    name.setName(f'{family} {WEIGHT_NAMES[weight]}', 1, 3, 1, 0x409)
    name.setName('Italic' if italic else 'Regular', 2, 3, 1, 0x409)
    name.setName(f'{family} {style}', 4, 3, 1, 0x409)
    name.setName(f'{family}-{style.replace(" ", "")}', 6, 3, 1, 0x409)
    name.setName(f'{family}-{style.replace(" ", "")};instance', 3, 3, 1, 0x409)
    name.setName(family, 16, 3, 1, 0x409)
    name.setName(style, 17, 3, 1, 0x409)
    os2 = font['OS/2']
    os2.usWeightClass = weight
    # fsSelection: Bit 0 kursiv, Bit 5 fett, Bit 6 regulaer
    os2.fsSelection = (os2.fsSelection & ~0b1100001) | (0b1 if italic else 0)
    font['head'].macStyle = 0b10 if italic else 0


def build_fonts(google_fonts, brand_kit):
    for name, (src, axes) in FONTS.items():
        font = TTFont(os.path.join(google_fonts, src))
        static = instancer.instantiateVariableFont(font, axes)
        rename(static, axes['wght'], 'Italic' in src)
        static.save(os.path.join(OUT, name))
        print(f'{name}: {axes}')
    shutil.copyfile(os.path.join(brand_kit, '05-Schriften', 'IBMPlexMono-Medium.ttf'),
                    os.path.join(OUT, 'IBMPlexMono-Medium.ttf'))
    shutil.copyfile(os.path.join(brand_kit, '05-Schriften', 'IBMPlexMono-OFL.txt'),
                    os.path.join(OUT, 'IBMPlexMono-OFL.txt'))
    for fam in ('SpaceGrotesk', 'Inter'):
        shutil.copyfile(os.path.join(google_fonts, f'{fam}-OFL.txt'), os.path.join(OUT, f'{fam}-OFL.txt'))


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--brand-kit', required=True)
    ap.add_argument('--google-fonts', required=True)
    args = ap.parse_args()
    os.makedirs(OUT, exist_ok=True)
    build_images(args.brand_kit)
    build_fonts(args.google_fonts, args.brand_kit)
