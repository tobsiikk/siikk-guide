"""Postet neue Addon-Versionen aus dem Changelog von siikk-guide.de in einen Discord-Channel.
Vergleicht DATA.addon.changelog im alten und neuen Stand von index.html.
Aufruf: python discord/posten.py <alter_commit|-> [--test]
Webhook-Adresse kommt aus der Umgebungsvariable DISCORD_WEBHOOK (GitHub-Secret)."""
import json, os, subprocess, sys, time, urllib.request

FARBEN = {'oberflaeche': 0xC9A24A, 'damagemeter': 0xC0392B, 'questhilfe': 0xF1C40F, 'auktionshaus': 0xE67E22,
          'schadenszahlen': 0xFFCF3A, 'infoleiste': 0x3498DB, 'minimapsammler': 0x1ABC9C, 'layer': 0x9B59B6,
          'farmhelfer': 0x2ECC71, 'talentplaner': 0x8E44AD}

def daten(text):
    i = text.index('var DATA = ') + len('var DATA = ')
    return json.JSONDecoder().raw_decode(text[i:])[0]

def changelog(rev):
    if rev in (None, '', '-') or set(rev) == {'0'}:
        return {}
    try:
        t = subprocess.run(['git', 'show', rev + ':index.html'], capture_output=True, text=True, check=True).stdout
        return daten(t).get('addon', {}).get('changelog', {})
    except Exception:
        return {}

def projekte():
    try:
        return json.load(open('curseforge/projekte.json', encoding='utf-8'))
    except Exception:
        return {}

def posten(webhook, key, name, e, cf):
    punkte = '\n'.join('• ' + p for p in e.get('punkte', []))[:3900]
    links = ['[Download auf siikk-guide.de](https://siikk-guide.de/#changelog)']
    if key in cf and cf[key].get('id'):
        links.append('[CurseForge](https://www.curseforge.com/projects/%s)' % cf[key]['id'])
    emb = {'title': '%s – Version %s' % (name, e.get('version', '?')),
           'description': punkte + '\n\n' + ' · '.join(links),
           'color': FARBEN.get(key, 0xC9A24A),
           'footer': {'text': 'siikk-guide.de · ' + e.get('datum', '')}}
    body = json.dumps({'username': 'siikk-Updates', 'embeds': [emb]}).encode()
    req = urllib.request.Request(webhook, data=body, headers={'Content-Type': 'application/json', 'User-Agent': 'siikk-guide-bot'})
    for versuch in range(3):
        try:
            urllib.request.urlopen(req, timeout=20).read()
            print('gepostet:', emb['title'])
            return
        except urllib.error.HTTPError as err:
            if err.code == 429:
                time.sleep(float(json.loads(err.read() or b'{}').get('retry_after', 2)) + 0.5)
                continue
            raise
    raise RuntimeError('Discord hat nicht angenommen')

def main():
    webhook = os.environ.get('DISCORD_WEBHOOK', '').strip()
    if not webhook:
        print('Kein DISCORD_WEBHOOK gesetzt – nichts zu tun.')
        return
    alt_rev = sys.argv[1] if len(sys.argv) > 1 else '-'
    test = '--test' in sys.argv
    neu = daten(open('index.html', encoding='utf-8').read()).get('addon', {}).get('changelog', {})
    alt = changelog(alt_rev)
    cf = projekte()
    posts = []
    for key, cl in neu.items():
        eintraege = cl.get('eintraege', [])
        if not eintraege:
            continue
        if test:
            posts.append((eintraege[0].get('datum', ''), key, cl.get('name', key), eintraege[0]))
            continue
        alte_versionen = {e.get('version') for e in alt.get(key, {}).get('eintraege', [])}
        if not alt:  # ohne Vergleichsstand nichts nachträglich posten
            continue
        for e in reversed(eintraege):
            if e.get('version') not in alte_versionen:
                posts.append((e.get('datum', ''), key, cl.get('name', key), e))
    if test and posts:
        # nur den neuesten Eintrag als Test
        def dkey(p):
            d = p[0].split('.')
            return (d[2], d[1], d[0]) if len(d) == 3 else ('', '', '')
        posts = [max(posts, key=dkey)]
    if not posts:
        print('Keine neuen Versionen.')
    for _, key, name, e in posts:
        posten(webhook, key, name, e, cf)
        time.sleep(1)

if __name__ == '__main__':
    main()
