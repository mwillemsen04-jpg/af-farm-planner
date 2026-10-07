# AF Farm Planner op GitHub – samen werken

Deze map is de planner als eigen website. Alle farms worden opgeslagen in **Firebase** (gratis, van Google).
Iedereen die de site opent, ziet **dezelfde farms**, kan ze aanpassen en opslaan, en ziet de wijzigingen van de anderen **meteen** ("Updated by a teammate").

Bestanden:
- `index.html` – de planner
- `firebase-config.js` – hier komt de sleutel van jouw Firebase-project (stap 4)
- `firestore.rules` – de regels voor de database (stap 3)
- `farm_Farm_1.json` – je huidige farm, om te importeren (stap 7)

---

## Stap 1 – Firebase-project maken (eenmalig)
1. Ga naar **console.firebase.google.com** en log in met je Google-account.
2. Klik **Add project** (Project toevoegen), naam bijvoorbeeld `af-farm-planner`.
3. Google Analytics mag **uit**. Klik **Create project**.

## Stap 2 – Anoniem inloggen aanzetten
1. Links: **Build → Authentication → Get started**.
2. Tabblad **Sign-in method** → kies **Anonymous** → zet op **Enable** → **Save**.

(Niemand hoeft een account te maken; de site logt zelf onzichtbaar in. Zo kunnen alleen mensen die de site openen erin schrijven.)

## Stap 3 – Database maken
1. Links: **Build → Firestore Database → Create database**.
2. Locatie: kies **eur3 (europe-west)**. Kies **Start in production mode**.
3. Ga naar het tabblad **Rules**, haal alles weg en plak de inhoud van `firestore.rules`. Klik **Publish**.

## Stap 4 – De sleutel kopiëren
1. Klik linksboven op het **tandwiel → Project settings**.
2. Onder **Your apps** klik je op het **</>**-icoon (Web). Geef een naam (bijv. `planner`) en klik **Register app**.
3. Je ziet nu een stukje code met `firebaseConfig = { apiKey: ..., authDomain: ..., ... }`.
4. Open `firebase-config.js` en vervang de lege waarden door die van jou (apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId).
   *Liever niet zelf? Stuur die 6 regels naar Claude, dan vult hij het in.*

## Stap 5 – Op GitHub zetten (zonder git op je pc)
1. Ga naar **github.com** → **New repository**, naam `af-farm-planner`, **Public**, klik **Create repository**.
2. Klik **uploading an existing file** en sleep `index.html` en `firebase-config.js` erin. Klik **Commit changes**.
3. Ga naar **Settings → Pages**. Bij *Source*: **Deploy from a branch**, branch **main**, map **/ (root)** → **Save**.
4. Na ongeveer een minuut staat de site op: `https://JOUWNAAM.github.io/af-farm-planner/`

## Stap 6 – GitHub toestaan in Firebase
1. Firebase → **Authentication → Settings → Authorized domains → Add domain**.
2. Vul in: `JOUWNAAM.github.io` → **Add**.

## Stap 7 – Je farm erin zetten
1. Open de site. Ga naar **⚙️ Farm** en klik **Import file**. Kies `farm_Farm_1.json`.
2. Onderaan staat dan "Saved in your account". Iedereen die de site opent, ziet nu deze farm.

---

## Goed om te weten
- **Iedereen werkt in dezelfde farms.** Met **New farm** of **Save as copy** maak je een eigen farm die ook iedereen kan zien.
- **Tegelijk werken:** wat het laatst wordt opgeslagen, wint. Wijzigt iemand anders de farm die jij open hebt, dan wordt jouw scherm meteen bijgewerkt.
- **Wie de link heeft, kan aanpassen.** Deel de link dus alleen in de clan.
- **Gratis:** Firebase is gratis voor dit gebruik (ruim genoeg voor een clan).
- **Werkt het opslaan niet?** Onderaan bij Farm staat dan "Saved in this browser only". Controleer stap 2, 3, 4 en 6.
