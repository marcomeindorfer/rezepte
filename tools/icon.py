#!/usr/bin/env python3
"""Erzeugt icon-192.png, icon-512.png und icon-512-maskable.png.

Motiv: ein Topf mit Deckel – kräftige Silhouette, die auch als 40-Pixel-Symbol
auf dem Homescreen noch lesbar ist. Farben aus der Palette der App:
Kräutergrün auf Papierweiß.

Die beiden „any"-Symbole haben eine abgerundete Ecke wie iOS-Symbole; das
maskable ist randlos, weil Android selbst zuschneidet, und hält den Topf im
inneren Sicherheitsbereich von 80 Prozent.

    python3 tools/icon.py        # braucht Pillow, sonst nichts
"""

from math import sin

from PIL import Image, ImageDraw

GROESSE = 1024                 # intern gerechnet, danach verkleinert
GRUEN_OBEN = (37, 138, 87)     # --herb, oben eine Spur heller
GRUEN_UNTEN = (24, 100, 62)
HELL = (247, 246, 242)         # --paper


def flaeche(rund):
    bild = Image.new("RGBA", (GROESSE, GROESSE), (0, 0, 0, 0))
    stift = ImageDraw.Draw(bild)
    for y in range(GROESSE):
        t = y / (GROESSE - 1)
        stift.line([(0, y), (GROESSE, y)],
                   fill=tuple(round(GRUEN_OBEN[i] + (GRUEN_UNTEN[i] - GRUEN_OBEN[i]) * t) for i in range(3)) + (255,))
    if not rund:
        return bild
    maske = Image.new("L", (GROESSE, GROESSE), 0)
    ImageDraw.Draw(maske).rounded_rectangle([0, 0, GROESSE - 1, GROESSE - 1],
                                            radius=round(GROESSE * 0.225), fill=255)
    bild.putalpha(maske)
    return bild


def topf(bild, f):
    """f skaliert vom 512er-Entwurf auf die Zeichenfläche."""
    stift = ImageDraw.Draw(bild)
    m = lambda *w: [round(x * f) for x in w]

    # Deckel: flacher Bogen mit Knauf, etwas breiter als der Topf
    stift.rounded_rectangle(m(126, 186, 386, 226), radius=round(20 * f), fill=HELL)
    stift.rounded_rectangle(m(232, 148, 280, 192), radius=round(21 * f), fill=HELL)

    # Topfkörper: unten stärker gerundet, damit er nicht wie eine Kiste wirkt
    stift.rounded_rectangle(m(146, 240, 366, 396), radius=round(30 * f), fill=HELL)
    stift.rectangle(m(146, 240, 366, 300), fill=HELL)

    # Griffe links und rechts, auf Höhe des oberen Randes
    for x0, x1 in ((92, 146), (366, 420)):
        stift.rounded_rectangle(m(x0, 252, x1, 288), radius=round(18 * f), fill=HELL)

    # Dampf: geschwungene Schwaden statt gerader Striche – gerade Striche lesen
    # sich als Regen. Gezeichnet als Kette von Kreisen entlang einer Wellenlinie,
    # das gibt runde Enden, die ImageDraw für Linien nicht kennt.
    for x, oben, unten, phase in ((188, 84, 132, 0.0), (256, 60, 126, 3.14), (324, 84, 132, 0.0)):
        schritte = 40
        for i in range(schritte + 1):
            t = i / schritte
            y = oben + (unten - oben) * t
            versatz = 13 * sin(phase + t * 3.4)
            r = 9 * (0.62 + 0.38 * t)          # nach oben hin dünner
            stift.ellipse(m(x + versatz - r, y - r, x + versatz + r, y + r), fill=HELL)
    return bild


if __name__ == "__main__":
    rund = topf(flaeche(True), GROESSE / 512)
    for kante in (192, 512):
        rund.resize((kante, kante), Image.LANCZOS).save(f"icon-{kante}.png", optimize=True)
        print(f"icon-{kante}.png geschrieben")

    # maskable: randlos, Motiv auf 78 % geschrumpft und zentriert
    voll = flaeche(False)
    innen = topf(Image.new("RGBA", (GROESSE, GROESSE), (0, 0, 0, 0)), GROESSE / 512 * 0.78)
    versatz = round(GROESSE * 0.11)
    voll.alpha_composite(innen, (versatz, versatz))
    voll.resize((512, 512), Image.LANCZOS).save("icon-512-maskable.png", optimize=True)
    print("icon-512-maskable.png geschrieben")
