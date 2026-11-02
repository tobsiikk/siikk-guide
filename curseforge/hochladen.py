# Lädt neue Addon-Versionen zu CurseForge hoch (läuft in GitHub Actions).
# Liest curseforge/upload.json:
#   { "uploads": [ { "projekt": "layer", "datei": "downloads/siikk-Layer_v1.1.zip",
#                    "anzeige": "siikk-Layer v1.1", "changelog": "…", "typ": "release" } ] }
# Projekt-IDs und Spielversionen stehen in curseforge/projekte.json.
# Spielversionen: "Typ:Version" – Typ ist der Name bei CurseForge (z. B. "WoW Forever"),
# Version eine Nummer oder "neueste" (= höchste Version dieses Typs).
import json, os, sys, urllib.request, urllib.error, uuid

BASIS = "https://wow.curseforge.com"
TOKEN = os.environ.get("CF_API_TOKEN", "")
if not TOKEN:
    sys.exit("Kein CF_API_TOKEN gesetzt (GitHub → Settings → Secrets → Actions).")

def holen(pfad):
    req = urllib.request.Request(BASIS + pfad, headers={"X-Api-Token": TOKEN})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)

def ver_tupel(n):
    t = []
    for x in str(n).split("."):
        try: t.append(int(x))
        except ValueError: t.append(0)
    return tuple(t)

typen = holen("/api/game/version-types")
versionen = holen("/api/game/versions")
print("Versionstypen bei CurseForge:", ", ".join(f'{t["id"]}={t["name"]}' for t in typen))

def version_ids(liste):
    ids = []
    for eintrag in liste:
        typ, _, ver = eintrag.partition(":")
        # zuerst exakter Name (z. B. "WoW Classic"), nur wenn es den nicht gibt: Namensteil
        passende_typen = [t["id"] for t in typen if t["name"].lower() == typ.lower()]
        if not passende_typen:
            passende_typen = [t["id"] for t in typen if typ.lower() in t["name"].lower()]
            if len(passende_typen) > 1:
                print(f"  ! „{typ}“ passt zu mehreren Typen – bitte genauen Namen in projekte.json eintragen"); continue
        kandidaten = [v for v in versionen if v.get("gameVersionTypeID") in passende_typen]
        if not kandidaten:
            print(f"  ! Kein Versionstyp passt zu „{typ}“ – übersprungen"); continue
        if ver in ("", "neueste", "latest"):
            v = max(kandidaten, key=lambda v: ver_tupel(v["name"]))
        else:
            treffer = [v for v in kandidaten if v["name"] == ver]
            if not treffer:
                print(f"  ! Version {ver} für „{typ}“ nicht gefunden – nehme die neueste"); v = max(kandidaten, key=lambda v: ver_tupel(v["name"]))
            else: v = treffer[0]
        print(f"  Spielversion {eintrag} → {v['name']} (ID {v['id']})")
        ids.append(v["id"])
    return ids

projekte = json.load(open("curseforge/projekte.json", encoding="utf-8"))
auftrag = json.load(open("curseforge/upload.json", encoding="utf-8"))
fehler = 0
for u in auftrag.get("uploads", []):
    p = projekte.get(u["projekt"])
    if not p or not p.get("id"):
        print(f"! Keine Projekt-ID für „{u['projekt']}“ – übersprungen"); fehler += 1; continue
    if not os.path.isfile(u["datei"]):
        print(f"! Datei fehlt: {u['datei']}"); fehler += 1; continue
    print(f"→ {u['anzeige']} nach Projekt {p['id']} ({u['projekt']})")
    meta = {"changelog": u.get("changelog", ""), "changelogType": "text", "displayName": u["anzeige"],
            "gameVersions": version_ids(p["versionen"]), "releaseType": u.get("typ", "release")}
    grenze = uuid.uuid4().hex
    daten = open(u["datei"], "rb").read()
    body = (f"--{grenze}\r\nContent-Disposition: form-data; name=\"metadata\"\r\n\r\n{json.dumps(meta)}\r\n"
            f"--{grenze}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{os.path.basename(u['datei'])}\"\r\n"
            f"Content-Type: application/zip\r\n\r\n").encode() + daten + f"\r\n--{grenze}--\r\n".encode()
    req = urllib.request.Request(f"{BASIS}/api/projects/{p['id']}/upload-file", data=body, method="POST",
                                 headers={"X-Api-Token": TOKEN, "Content-Type": f"multipart/form-data; boundary={grenze}"})
    try:
        with urllib.request.urlopen(req, timeout=300) as r:
            print("  hochgeladen:", r.read().decode()[:200])
    except urllib.error.HTTPError as e:
        print("  FEHLER", e.code, e.read().decode()[:500]); fehler += 1
sys.exit(1 if fehler else 0)
