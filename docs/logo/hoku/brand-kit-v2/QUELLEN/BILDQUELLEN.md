# Bildquellen und Ableitungen

Freigabe: 02.11.2026, „das wird es damit updaten wir unser branding“.

## Bestätigter Master

`hoku-app-icon-cyan-master.png` ist bytegleich zum bestätigten Entwurf `../../entwuerfe/hoku-app-icon-cyan-natuerliche-pupille-v1.png`. Er wurde mit dem eingebauten Image-Gen-Werkzeug erzeugt, ausgehend von Claudes farbigem App-Icon aus dem vom Nutzer bereitgestellten Ordner A-hoku-echt und dem Screenshot des tatsächlichen App-Hoku. Gestaltungsauftrag: bestehendes Hoku mit natürlicher Pupille, aktuelles Cyan #00CCF5, nahezu weißer Pupillenrand, dunkler Hintergrund, keine 3H-Pupille, kein Text.

## Freigestellter Master

`hoku-cyan-freigestellt-master.png` wurde mit dem eingebauten Image-Gen-Werkzeug als Hintergrundentfernung aus dem bestätigten Master abgeleitet. Transparenz und Partikelränder wurden bei der Logo-Erzeugung geprüft. Es handelt sich um eine Rasterableitung; für das App-Icon bleibt der bestätigte Master maßgeblich.

Verwendeter Freistellungs-Prompt:

> Use case: background-extraction. Extract this exact approved Hoku particle-eye mascot onto a TRULY TRANSPARENT background for use in the existing brand logo system. Preserve the SAME individual cyan/teal/white particles, their exact placement, size, color, soft light and depth, complete outer silhouette, round off-center natural pupil and sphere proportions. Remove ONLY the dark background and the broad ambient dark cyan atmospheric background wash. All dark gaps BETWEEN particles and the pupil interior should become transparent too, not just the area outside the sphere. Preserve the white pupil-rim points and fine translucent soft particle edges, without adding new dots or creating a ring. Keep the same square framing and generous margin as the original. No new design, monogram, extra glow, solid black disk or matte box. The result is the approved cyan Hoku as isolated luminous particles with actual alpha transparency everywhere between and around them, including the empty pupil. This is strict background removal, not a redraw.

## Reproduzierbare Exporte

`build.cjs` setzt die vorhandenen Schriften als Vektorpfade und bettet den freigestellten Master ein. Monochrome Fassungen nutzen neutrale SVG-Farbfilter mit reduzierter Randweichheit. App-Icon-Größen werden direkt aus dem bestätigten Bildmaster gerendert. Die Dateien in 07-KI-Button-Symbol wurden unverändert aus v1 kopiert und werden durch `verify.cjs` auf Bytegleichheit geprüft.

## Zusätzliche organische Cyan-Fassung – bestätigt am 03.11.2026

hoku-app-icon-organisch-cyan-v3-master.png ist bytegleich zum bestätigten Entwurf ../../entwuerfe/hoku-app-icon-organisch-cyan-v3.png. Die Bearbeitung mit dem integrierten Imagegen-Werkzeug verwendete den aktuellen Hoku als Identitätsreferenz, das ursprüngliche dunkle Icon als Referenz für ruhige Partikelverteilung und Lichtkerne sowie die vorherige Generierung als Material-/Cyan-Referenz. Auftrag: organischer und räumlicher, aber schlicht und ästhetisch; natürliche Pupille und aktuelles Cyan beibehalten.

hoku-organisch-cyan-freigestellt-master.png ist eine eigene Imagegen-Freistellungsableitung. Auftrag: ausschließlich dunklen Hintergrund und breiten atmosphärischen Farbschleier entfernen; Partikel, Framing, Pupille und unterbrochenen hellen Pupillenrand erhalten; alle Zwischenräume einschließlich Pupille transparent; keine neuen Elemente. Die 1280-px-Freistellung ist keine bytegleiche Kopie des 1254-px-App-Masters. Für das dunkle App-Icon bleibt der bestätigte Originalmaster maßgeblich.

organisch.cjs erstellt die zusätzlichen Formate in 09-Organisch-Cyan; verify-organisch.cjs prüft Originalidentität, Formate, Transparenz, Monochromie, ICO und Maskable-Sicherheitsbereich. SVG/PDF enthalten Rasterbilder. Bestehende Logo-Kompositionen und laufende App werden durch die zusätzliche Freigabe nicht ersetzt.
