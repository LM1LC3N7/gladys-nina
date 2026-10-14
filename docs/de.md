# NINA (Warnungen in Deutschland)

**Inoffizieller Konnektor, steht in keiner Verbindung zum BBK** (Bundesamt für
Bevölkerungsschutz und Katastrophenhilfe). Er bringt die offiziellen Warnungen,
die die Warn-App NINA für die Gemeinde deines Hauses anzeigt, in Gladys:
Bevölkerungsschutz (MoWaS, KATWARN, BIWAPP), Unwetter (DWD), Hochwasser und
Polizeimeldungen. Er liest die öffentliche NINA-API von warnung.bund.de: kein
Konto, kein Schlüssel. Quelle: BBK / NINA (warnung.bund.de).

> **Kein Sicherheitssystem.** Die Integration fragt die Warnungen alle paar
> Minuten ab und kann eine Warnung verpassen oder verzögern. Verlass dich
> immer auf die offiziellen Kanäle: die NINA-App, die Sirenen, Cell Broadcast,
> Radio und Fernsehen.

## Was du bekommst

| Bereich                                             | Inhalt                                                                                                                                                                                                                                                                                            |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ein Gerät pro **in Deutschland verortetem Haus**    | die Anzahl der aktiven Warnungen, die höchste Warnstufe (0 keine, 1 gering, 2 mäßig, 3 schwer, 4 extrem) und der Titel der schwersten Warnung                                                                                                                                                     |
| Ein Gerät pro **eingetragener Gemeinde** (optional) | dasselbe für eine Gemeinde oder einen ganzen Kreis, die du einträgst (ein Ferienhaus, der Wohnort der Familie, ein Haus ohne Standort)                                                                                                                                                            |
| Szenen-Auslöser                                     | **NINA-Warnung ausgegeben** (Mindest-Warnstufe, Quelle) und **NINA-Warnung beendet** (Entwarnung, abgelaufen oder zurückgezogen)                                                                                                                                                                  |
| Szenen-Aktion                                       | **NINA-Warnungen** eines Hauses: Anzahl, höchste Warnstufe, Titel und eine versandfertige Zusammenfassung                                                                                                                                                                                         |
| Dashboard-Widget                                    | **NINA-Warnungen**: der Status auf einen Blick (ein grüner Haken, oder die Anzahl der Warnungen in der Farbe der schwersten), die aktiven Warnungen mit Warnstufe, Quelle und Zeit; tippe auf eine für den offiziellen Text und den Link zu warnung.bund.de; die Entwarnungen bleiben aufgelistet |

## Einrichtung

1. Lege den Standort deines Hauses in Gladys fest (**Einstellungen →
   Zuhause**) und erlaube den Zugriff auf den Standort, wenn du die
   Integration installierst.
2. Öffne **Entdecken**: Die Integration findet die Gemeinde deines Hauses wie
   die offizielle App (ihr Raster von Deutschland, dann die Umrisse der
   Gemeinden) und bietet ein Gerät „NINA Zuhause“ an. Füge es hinzu.
3. Optional: Trage weitere Gemeinden unter **Zu überwachende Gemeinden** ein,
   durch Kommas getrennt, per Name (`Alsdorf`) oder per ARS, dem 12-stelligen
   Amtlichen Regionalschlüssel (`053340004004`). Bei einem Namen, den mehrere
   Gemeinden tragen, füge den Kreis hinzu: `Neuenkirchen (Diepholz)`. Ein
   Kreisname oder sein 5-stelliger Schlüssel (`05334`) überwacht den ganzen
   Kreis. Die Schaltfläche **Gemeinde suchen** liefert die genauen Namen und
   ARS: Eine Zeile ihrer Antwort
   (`Sandhausen (Rhein-Neckar-Kreis) – 082260076076`) kannst du unverändert
   einfügen. Speichere, öffne erneut **Entdecken** und füge die Geräte hinzu.
4. Lege das Widget **NINA-Warnungen** auf ein Dashboard und wähle das Gerät.

Die Schaltfläche **NINA testen** zeigt, in welcher Gemeinde jedes Haus gefunden
wurde und wie viele Warnungen aktiv sind.

## Quellen und Sprachen

- **Zu berücksichtigende Quellen**: wie in der NINA-App. Wenn die
  DWD-Integration dir die Unwetterwarnungen bereits liefert, entferne hier den
  Haken bei „Unwetter (DWD)“.
- **Sprache**: Die Konfiguration, die Schaltflächen und das Widget erscheinen
  auf Deutsch, wenn Gladys auf Deutsch eingestellt ist. Die Option **Sprache
  der Warnungstitel** gilt für die Namen der Geräte-Eigenschaften und die
  Szenen-Variablen: Wähle **Deutsch**, dann erhältst du die Originaltitel.
- **Texte**: Die Warnungen werden von den Behörden auf Deutsch verfasst und
  unverändert angezeigt (das BBK erlaubt die Nutzung der Warnungen nur
  inhaltlich unverändert und nicht zu kommerziellen Zwecken). Auf Englisch
  oder Französisch zeigt die Integration die Übersetzung des Ereignisnamens,
  die NINA für die meisten Warnungen des Bevölkerungsschutzes liefert; die
  Überschrift, die Beschreibung und die Handlungsempfehlungen bleiben deutsch.

## Szenen

- **NINA-Warnung ausgegeben**: Wähle das Gerät, die **Mindest-Warnstufe** und
  optional die **Quelle** (leer: alle). Die Szene läuft einmal pro Warnung,
  wenn sie die gewählte Warnstufe erreicht: eine neue Warnung oder eine aktive
  Warnung, die verschärft wurde. Eine neue Version einer Warnung mit gleicher
  Warnstufe startet sie nicht erneut. Wähle „Gering (jede Warnung)“, um über
  jede Warnung informiert zu werden.
- **NINA-Warnung beendet**: dieselben Felder, dazu der **Grund** (leer: alle):
  Die Behörde hat Entwarnung gegeben, die Warnung ist abgelaufen oder wurde
  zurückgezogen. Die Szene läuft einmal pro Warnung, die die gewählte
  Warnstufe erreicht hatte.
- Variablen, in einer Nachricht aus der Variablenliste eingefügt oder als
  `{{triggerEvent.data.<Schlüssel>}}` geschrieben (zum Beispiel
  `{{triggerEvent.data.title}}`): `title`, `headline`, `description`,
  `instruction`, `severity` (1 bis 4), `severity_name`, `source`, `provider`
  (MoWaS, DWD...), `area`, `place`, `sent`, `expires`, `link` (die offizielle
  Meldung).

Die Aktion **NINA-Warnungen** liefert `count`, `highest_severity`, `titles`
(einer pro Zeile) und `summary` („1 Warnung für Alsdorf: Geruchsbelästigung -
Alsdorf - Mariadorf (gering, MoWaS).“) für eine Nachricht oder eine Bedingung. Die folgenden
Aktionen der Szene finden sie in ihrer Variablenliste (geschrieben
`{{<Schritt>.<Aktion>.<Schlüssel>}}`, zum Beispiel `{{0.0.summary}}`, wenn
diese Aktion die erste der Szene ist).

## Funktionsweise

NINA veröffentlicht die Warnungen pro Kreis. Alle 5 Minuten (Option
**Aktualisierungsintervall**, mindestens 2 Minuten) liest die Integration den
Kreis jedes Geräts (eine Anfrage, beantwortet mit „nicht geändert“, wenn sich
nichts geändert hat), behält die Warnungen, die die Gemeinde betreffen, genau
wie die offizielle App, und liest den vollständigen Text einer Warnung einmal
pro Version. Die Gemeindeliste der offiziellen App wird einmal am Tag gelesen.

## Fehlerbehebung

- **„Das Haus ... liegt in keiner deutschen Gemeinde“**: NINA deckt nur
  Deutschland ab. Prüfe den Standort des Hauses oder trage seine Gemeinde ein.
- **„Mehrere Gemeinden heißen ...“**: Füge die Zeile ein, die **Gemeinde
  suchen** liefert, oder trage ihren ARS oder `Name (Kreis)` ein.
- **„NINA (warnung.bund.de) ist nicht erreichbar“**: Die Integration behält
  die letzte Abfrage und versucht es bei jeder Aktualisierung erneut.
- Eine Warnung, die die NINA-App für deinen **aktuellen Standort** anzeigt
  (ihre Ortungsfunktion), kann eine Nachbargemeinde betreffen: Die Integration
  folgt der Gemeinde des Hauses.
- Logs: Die Protokollstufe der Integration wird mit der Variable `LOG_LEVEL`
  eingestellt.

## Datenschutz

Der Standort des Hauses verlässt die Integration nie: Er wird lokal, mit den
Dateien der offiziellen App, einer Gemeinde zugeordnet. warnung.bund.de erhält
nur Anfragen nach den Warnungen des Kreises, den Gemeindedateien und den
Umrissen der Gemeinden rund um das Haus.
