# NINA (German warnings)

**Unofficial connector, not affiliated with the BBK** (Bundesamt für
Bevölkerungsschutz und Katastrophenhilfe, the German Federal Office of Civil
Protection and Disaster Assistance). It brings into Gladys the official
warnings that the NINA warning app shows for the municipality of your house:
civil protection (MoWaS, KATWARN, BIWAPP), severe weather (DWD), floods and
police messages. It reads the public NINA API of warnung.bund.de: no account,
no key. Source: BBK / NINA (warnung.bund.de).

> **Not a safety system.** The integration reads the warnings every few
> minutes and may miss or delay one. Always rely on the official channels:
> the NINA app, the sirens, cell broadcast, radio and TV.

## What you get

| Surface                                        | Content                                                                                                                                                                                                                                                                    |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| One device per **house located in Germany**    | the number of warnings in force, the highest severity (0 none, 1 minor, 2 moderate, 3 severe, 4 extreme) and the title of the most severe warning                                                                                                                          |
| One device per **typed municipality** (option) | the same, for a municipality or a whole district you type (a holiday home, your family's town, a house without location)                                                                                                                                                   |
| Scene triggers                                 | **NINA warning issued** (minimum severity, source) and **NINA warning ended** (all clear, expired or withdrawn)                                                                                                                                                            |
| Scene action                                   | **NINA warnings** of a house: count, highest severity, titles and a summary ready to send                                                                                                                                                                                  |
| Dashboard widget                               | **NINA warnings**: a status at a glance (a green check, or the number of warnings in the colour of the most severe), the warnings in force with their severity, source and time; tap one for the official text and the link to warnung.bund.de; the all-clears stay listed |

## Setup

1. Set the location of your house in Gladys (**Settings → Houses**) and
   accept the location access when you install the integration.
2. Open **Discovery**: the integration finds the municipality of your house
   the way the official app does (its grid of Germany, then the outline of
   the municipalities) and offers a device "NINA Home". Add it.
3. Optional: type other municipalities in **Municipalities to watch**,
   separated by commas, by name (`Alsdorf`) or by ARS, the 12-digit official
   regional key (`053340004004`). For a name shared by several municipalities,
   add the district: `Neuenkirchen (Diepholz)`. A district name or its 5-digit
   code (`05334`) watches the whole district. The **Search a municipality**
   button gives the exact names and ARS: a line of its answer
   (`Sandhausen (Rhein-Neckar-Kreis) – 082260076076`) can be pasted as it is.
   Save, open **Discovery** again and add the devices.
4. Put the **NINA warnings** widget on a dashboard and pick the device.

The **Test NINA** button says in which municipality each house was found and
how many warnings are in force.

## Sources and languages

- **Sources to keep**: as in the NINA app. If the DWD integration already gives
  you the weather warnings, uncheck "Severe weather (DWD)" here.
- **Texts**: the warnings are written in German by the authorities. NINA
  translates the event name of most civil protection warnings ("Odour
  nuisance", "Nuisance olfactive"): the title is shown in English or French
  when the translation exists, in German otherwise. The official headline, the
  description and the instructions are always the German originals, shown
  unchanged (the BBK allows the use of the warnings only unchanged in content
  and not for commercial purposes). The **Language** option sets the titles of
  the devices and of the scene variables; the widget follows the language of
  the user.

## Scenes

- **NINA warning issued**: pick the device, the **minimum severity** and,
  optionally, the **source** (empty: any). The scene runs once per warning
  when it reaches the chosen severity: a new warning, or a warning in force
  that got more severe. A new version of a warning with the same severity does
  not run it again. Pick "Minor (any warning)" to hear about every warning.
- **NINA warning ended**: same fields, plus the **reason** (empty: any): the
  authority sent an all clear, the warning expired, or it was withdrawn. The
  scene runs once per warning that had reached the chosen severity.
- Variables, inserted in a message from the variable list or written
  `{{triggerEvent.data.<key>}}` (for instance `{{triggerEvent.data.title}}`):
  `title`, `headline`, `description`, `instruction`, `severity` (1 to 4),
  `severity_name`, `source`, `provider` (MoWaS, DWD...), `area`, `place`,
  `sent`, `expires`, `link` (the official message).

The action **NINA warnings** gives `count`, `highest_severity`, `titles` (one
per line) and `summary` ("1 warning in force for Alsdorf: Odour nuisance
(minor, MoWaS).") for a message or a condition. The following actions of the
scene find them in their variable list (written `{{<step>.<action>.<key>}}`,
for instance `{{0.0.summary}}` when this action is the first of the scene).

## How it works

NINA publishes the warnings per district. Every 5 minutes (option **Refresh
interval**, 2 minutes at least) the integration reads the district of each
device (one request, answered "not modified" when nothing changed), keeps the
warnings that concern the municipality, exactly like the official app, and
reads the full text of a warning once per version. The municipality list of
the official app is read once a day.

## Troubleshooting

- **"House ... is not in a German municipality"**: NINA covers Germany only.
  Check the location of the house, or type its municipality.
- **"Several municipalities are named ..."**: paste the line given by **Search
  a municipality**, or type its ARS or `Name (District)`.
- **"NINA (warnung.bund.de) is unreachable"**: the integration keeps the last
  reading and tries again at every refresh.
- A warning shown by the NINA app for your **current position** (the app's
  location function) may concern a neighbouring municipality: the integration
  follows the municipality of the house.
- Logs: the integration's log level is set with the `LOG_LEVEL` variable.

## Privacy

The location of the house never leaves the integration: it is turned into a
municipality locally, with the files of the official app. warnung.bund.de only
receives requests for the district warnings, the municipality files and the
outline of the municipalities around the house.
