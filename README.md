# QR Stúdió

Ingyenes, **böngészőben futó** QR kód generátor. Nincs szerver, nincs feltöltés – minden adat a saját gépeden marad. Tiszta HTML/CSS/JS, build-lépés nélkül; ingyen kitehető **GitHub Pages**-re.

👉 **Élő demó:** <https://tardoscode.github.io/qr-generator/>

## Mit tud

QR kódot generál a következő típusokhoz:

| Típus | Mit csinál beolvasáskor |
|-------|--------------------------|
| 🔗 **URL** | Megnyit egy weboldalt (a `https://` automatikusan bekerül) |
| 📝 **Szöveg** | Tetszőleges szöveget jelenít meg |
| ✉️ **E-mail** | Előre kitöltött e-mailt nyit (címzett, tárgy, szöveg) |
| 📞 **Telefon** | Felajánlja a hívást |
| 💬 **SMS** | Megírt SMS-t nyit a megadott számra |
| 📶 **WiFi** | Csatlakozik a hálózathoz (SSID, jelszó, titkosítás) |
| 👤 **Névjegy (vCard)** | Mentendő kontaktot ajánl fel |
| 📍 **Helyszín** | Térképen nyitja a koordinátát |
| 📅 **Esemény** | Naptárbejegyzést hoz létre |
| 🟢 **WhatsApp** | WhatsApp csevegést nyit megírt üzenettel |

### Testreszabás
- pötty- és sarokszín, háttérszín (vagy **átlátszó** háttér),
- pötty- és sarokstílus (négyzet, lekerekített, pöttyök, elegáns…),
- méret és **hibajavítási szint** (L/M/Q/H),
- **logó** a közepére (saját kép feltöltése),
- letöltés **PNG / SVG / JPEG** formátumban, vagy **vágólapra másolás**,
- világos / sötét téma.

## Helyi futtatás

A projekt gyökér-relatív utakat használ, ezért **helyi szerver kell** (a `file://` nem jó):

```bash
# Python 3
python -m http.server 4188
# majd: http://localhost:4188/
```

Vagy bármilyen statikus szerver (pl. VS Code „Live Server").

## Élesítés – GitHub Pages

1. Push a `main` ágra.
2. A repo **Settings → Pages** menüben: *Source* = `Deploy from a branch`, ág = `main`, mappa = `/ (root)`.
3. Pár perc múlva elérhető: `https://<felhasználónév>.github.io/<repo-név>/`.

## Felépítés

```
qr-generator/
├─ index.html              # a teljes felület
├─ assets/
│  ├─ css/style.css        # stílusok (világos/sötét téma)
│  ├─ js/app.js            # logika: payload-építők + renderelés
│  └─ vendor/
│     └─ qr-code-styling.js  # QR motor (lokálisan, CDN nélkül)
├─ README.md
└─ LICENSE
```

## Technológia

- [qr-code-styling](https://github.com/kozakdenys/qr-code-styling) – a QR renderelő motor (MIT), lokálisan beágyazva.
- Vanilla JS, külső futásidejű függőség és build nélkül.

## Licenc

[MIT](LICENSE)

---

> A „QR Code" a DENSO WAVE Incorporated bejegyzett védjegye.
