# choretwo → choremane Feature-Upgrade Plan

## Status Quo (bereits fertig)
- ✅ Backend `/count` Endpoint (`GET /api/chores/count`)
- ✅ Backend `/household-health` Endpoint (`GET /api/chores/household-health`)
- ✅ `choreBuckets.js` Utility in `/frontend/src/utils/`
- ✅ `choreStore.js` erweitert (totalCounts, bucketedChores, sortedByUrgency, archivedChores, fetchArchivedChores, unarchiveChore)
- ✅ Dev-Server läuft auf :3000

---

## ABGESCHLOSSEN

### ✅ Schritt 1: Feld-Namens-Mapping fixen
**Status**: ERFOLGT (`frontend/src/stores/chore.js`)

**Änderungen**:
- `normalizeChore()`-Funktion hinzugefügt → snake_case ←→ camelCase Map
- `fetchChores()` → `response.data.map(normalizeChore)`
- `fetchArchivedChores()` → `response.data.map(normalizeChore)`
- `addChore()` → `normalizeChore(createdChore)`
- `updateChore()` → `normalizeChore(response.data)`
- `markDone()` → `normalizeChore({...})` mit camelCase keys
- `sortedByUrgency`/`sortedArchivedChores` → nutzen `a.dueDate` (nicht mehr `due_date`)

**choreBuckets.js** angepasst: `chore.due_date` → `chore.dueDate`

---

## NOCH ZU ERLÉDIGIGENDE SCHRITTE

### Schritt 1: Feld-Namens-Mapping fixen
**Problem**: API liefert `due_date`, `done_by`, `interval_days` (snake_case) aber ChoreCard nutzt `dueDate`, `doneBy`, `interval` (camelCase). Ergebnis: Due-Dates, Done-By und Interval werden nie angezeigt. `isOverdue` ist immer `false`.

**Fix in `choreStore.js`**: Mapping-Funktion bei allen Chore-Zuweisungen einbauen:
```javascript
const normalizeChore = (chore) => ({
  ...chore,
  dueDate: chore.due_date,
  doneBy: chore.done_by,
  interval: chore.interval_days,
  lastDone: chore.last_done,
  ownerEmail: chore.owner_email,
  isPrivate: chore.is_private,
})
```

**Betroffene Stellen** in choreStore.js:
- `fetchChores()` — auf `response.data` jedes Eintrags anwenden
- `fetchArchivedChores()` — auf `response.data` jedes Eintrags anwenden  
- `addChore()` — auf `createdChore`
- `updateChore()` — auf aktuelles Element
- `markDone()` — auf aktuelles Element
- `archiveChore()` / `unarchiveChore()` — auf verschobene Elemente

**Abhängigkeiten**: MUSS vor Schritt 6-8 sein (sonst zeigen Views falsche/dummy Werte)

---

### Schritt 2: PerformanceBar.vue (NEUE KOMPONENTE)
**Beschreibung**: Visueller Hausgesundheits-Score-Balken (0-100)

**Props**:
```javascript
props: {
  score: { type: Number, default: 100 },
  label: { type: String, default: null }
}
```

**Design**:
- Horizontaler dünner Balken (~6px hoch), volle Breite
- Farbkodierung: Grün (70-100), Orange (30-69), Rot (0-29)
- Balken-Füllung = `score%` der Gesamtbreite
- Optional: Score-Label links oder rechts daneben

**Wird verwendet in**:
- ChoresView: über FilterPills
- HomeView: unter Welcome-Section

**Datei**: `/frontend/src/components/layout/PerformanceBar.vue`

**Abhängigkeiten**: Keine → kann parallel zu anderen Schritten laufen

---

### Schritt 3: FilterPills.vue erweitern
**Ziel**: Buckets statt grobe Filter, mit Server-Counts

**Neues `filters`-Array**:
```javascript
const filters = [
  { value: 'all', label: 'Alle', color: null },
  { value: 'overdue', label: 'Verpasst', 
    color: 'var(--md-sys-color-overdue)' },
  { value: 'today', label: 'Heute', 
    color: 'var(--md-sys-color-due-soon)' },
  { value: 'tomorrow', label: 'Morgen', 
    color: 'var(--md-sys-color-primary)' },
  { value: 'thisWeek', label: 'Diese Woche', 
    color: 'var(--md-sys-color-secondary)' },
  { value: 'upcoming', label: 'Später', 
    color: null },
]
```

**Props-Änderungen**: Statt nur `stats` zusätzlich:
```javascript
props: {
  currentFilter: ...,
  stats: ...,          // alt: für backward compat
  bucketCounts: {      // neu: totalCounts vom Store
    type: Object,
    default: null
  },
  showCounts: {
    type: Boolean,
    default: true
  }
}
```

**Anzeige der Counts**:
- `stats[filter.value]` als Fallback
- Bei `bucketCounts !== null` → `bucketCounts[filter.value]` verwenden
- Count-Zahl als kleiner Badge links neben Text (choremane-Stil)

**Stilik-up**: Choremane-Pills mit `pill-count` Badge und aktiver Pill-Hintergrund

**Abhängigkeiten**: Benötigt `choreStore.totalCounts` (bereits existierend)

---

### Schritt 4: ChoreCard vereinfachen (keine Buttons)
**Ziel**: Nur Swipe-Aktionen, Buttons entfernen

**Aktuell**: Buttons für Edit und Archive auf der Karte

**Änderungen**:
1. `chore-actions` div entfernen (Zeile 49-64 in ChoreCard.vue)
2. Swipe nach **rechts** → mark as done (besteht bereits)
3. Swipe nach **links** → Edit-Modal öffnen (besteht bereits → `emit('edit', id)`)
4. Archive: **nicht** direkt auf Karte, sondern nur im Edit-Formular
5. `swipeDirection`-Feedback bleiben (Hintergrundfarbe + Icon während Swipe)

---

### Schritt 5: AddChoreForm erweitern für Archive
**Beschreibung**: Wenn Edit-Modus (`chore` prop ist gesetzt), "Archive"-Button im Formular anzeigen

**Änderungen in AddChoreForm.vue**:
- Falls `chore` prop gesetzt → Edit-Modus, nicht Add-Modus
- Edit-Modus: "Archive" Button neben Submit (rot, mit Bestätigungsdialog)
- Add-Modus: nur "Add Chore" Button
- Archivierte Chores können NICHT bearbeitet werden

**Abhängigkeiten**: Schritt 1 (Namings-Mapping) für korrekte Daten anzeige

---

### Schritt 6: HomeView.vue aktualisieren
**Änderungen**:
1. `PerformanceBar` unter Welcome-Section einfügen (`{{ choreStore.householdHealth }}/ 100`)
2. Stats-Grid ersetzen: Statt (Overdue, DueSoon, Completed) → neu (verpasst, heute, morgen, dieseWoche, später) mit `totalCounts`
3. Quick-Actions: AddChore + AddArchivedChores (öffnet ChoresView auf Archiv-Tab) + Import/Export
4. `choreStore.filteredChores` → `choreStore.bucketedChores.buckets.today` für "Today's Chores" Preview
5. `stats` durch `totalCounts` ersetzen für konsistente Zahlen

**Abhängigkeiten**: Schritt 1 (Namings-Mapping), Schritt 2 (PerformanceBar)

---

### Schritt 7: ChoresView.vue umstrukturieren
**Ziel**: choremane-inspirierte Hauptlist-Ansicht

**Neue Layout-Struktur**:
```
┌──────────────────────────────┐
│  PerformanceBar              │
│  ─────────────────────────── │
│  [Active | Archived] Tab     │
│  ─────────────────────────── │
│  [X] [Verpasst] [Heute] [Morgen] ... | ← FilterPills 
│  ─────────────────────────── │
│                              │
│  ChoreCard (swipe only)      │
│  ChoreCard (swipe only)      │
│      ...                     │
│                              │
│                   [ + ] FAB  │
└──────────────────────────────┘
```

**Tab-Bar**:
- Zwei Tabs: "Active" und "Archived"
- Aktiviert -> ändert lokalen Tab-State
- "Active" -> zeigt `filteredChores` (bucketed)
- "Archived" -> zeigt `sortedArchivedChores`

**PerformanceBar einfügen** über Tab-Bar

**Import/Export-Button** oben rechts (als Icon-Button im Header-Bereich)

**onMounted erweitern**: `await choreStore.fetchChores(); await choreStore.fetchArchivedChores()`

**Abhängigkeiten**: Schritt 3 (FilterPills), Schritt 4 (swipe-only Cards), Schritt 2 (PerformanceBar)

---

### Schritt 8: ImportExport.vue erstellen (NEUE KOMPONENTE)
**Vorbild**: choremane's ImportExport.vue (Modal)

**Feature**:
- **Export-Button**: Ruft `GET /api/export` → Blob-Download als `choretwo-backup-YYYY-MM-DD.json`
- **Import-Button**: Öffnet Datei-Dialog → liest JSON → sendet `POST /api/import`
- Erfolgs-/Fehlermeldungen
- "Done"-Button zum Schließen

**UI**:
- Overlay mit zentriertem Modal
- Zwei Buttons nebeneinander (Export links, Import rechts)
- Error-Anzeige unter Buttons

**Änderungen**: choremane-Vorlage adaptieren
- `api` durch `choreApi` ersetzen  
- Filename: `choreto-backup-YYYY-MM-DD.json`
- Modal-Overlay-Styling anpassen an Design-System

**Abhängigkeiten**: Keine → kann parallel zu anderen Schritten laufen

---

## IMPLEMENTIERUNGSREIHENFOLGE

| # | Schritt | Risiko | Aufwand | Voraussetzungen |
|---|---------|--------|---------|-----------------|
| 1 | Namings-Mapping fixen | **Niedrig** | Kurz | Keine |
| 2 | PerformanceBar.vue | **Niedrig** | Kurz | Keine |
| 3 | FilterPills.vue | **Mittel** | Mittel | Schritt 1 |
| 4 | ChoreCard vereinfachen | **Niedrig** | Kurz | Schritt 1 |
| 5 | AddChoreForm Archiv | **Niedrig** | Kurz | Schritt 1 |
| 6 | HomeView.vue | **Mittel** | Mittel | 1, 2 |
| 7 | ChoresView.vue | **Mittel** | Mittel | 2, 3, 4 |
| 8 | ImportExport.vue | **Niedrig** | Kurz | Keine |

**Gesamtschätzung**: ~90 Minuten (mit Testen)

### Parallelisierbare Schritte
- Schritt 1 und 2 können parallel beginnen (keine Abhängigkeiten)
- Schritt 8 kann jederzeit parallel laufen (volle Unabhängigkeit)
- Schritt 3, 4, 5 hängen nur von Schritt 1 ab → können parallel zu 2 laufen
- Schritt 6 benötigt 1 + 2
- Schritt 7 benötigt 2 + 3 + 4

---

## TEST-SZENARIEN MITTLERES

1. **Chore erstellen** → erscheint sofort in Liste
2. **Swipe-right** → mark as done (mit Haken-Feedback)
3. **Swipe-left** → Edit-Modal öffnet sich mit Vorschau der Chore-Daten
4. **Edit-Modal** → Änderungen speichern ODER Archive (mit Bestätigungsdialog)
5. **Tab "Archived"** → archivierte Chores sichtbar, Unarchive-Button
6. **Filter "Verpasst"** → nur overdue Chores (Counts aus Backend)
7. **Filter "Heute"** → nur heute fällige Chores
8. **PerformanceBar** → korrekter Hausgesundheit-Score (0-100)
9. **Export** → JSON-Download korrekt
10. **Import** → JSON-Upload + Chore-Liste aktualisiert
11. **HomeView Stats** → übereinstimmend mit FilterPills Counts
12. **ChoreCard ohne Buttons** → nur Swipe-Aktionen
