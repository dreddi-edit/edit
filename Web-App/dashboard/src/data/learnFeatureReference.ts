export type LearnFeatureArea =
  | "core"
  | "projects"
  | "editor-basics"
  | "editor-advanced"
  | "ai"
  | "seo"
  | "media"
  | "publishing"
  | "team-security"
  | "settings-admin"

export type LearnFeatureReference = {
  id: string
  area: LearnFeatureArea
  title: string
  summary: string
}

function pack(
  area: LearnFeatureArea,
  entries: Array<[id: string, title: string, summary: string]>,
): LearnFeatureReference[] {
  return entries.map(([id, title, summary]) => ({ id, area, title, summary }))
}

export const LEARN_FEATURE_AREAS: Array<{ id: LearnFeatureArea; label: string; order: number }> = [
  { id: "core", label: "Core Workspace", order: 1 },
  { id: "projects", label: "Projects & Import", order: 2 },
  { id: "editor-basics", label: "Editor Basics", order: 3 },
  { id: "editor-advanced", label: "Editor Advanced", order: 4 },
  { id: "ai", label: "AI Workflows", order: 5 },
  { id: "seo", label: "SEO & Audits", order: 6 },
  { id: "media", label: "Media & Design", order: 7 },
  { id: "publishing", label: "Publishing & Export", order: 8 },
  { id: "team-security", label: "Team & Security", order: 9 },
  { id: "settings-admin", label: "Settings & Admin", order: 10 },
]

const CORE_FEATURES = pack("core", [
  ["landing-cta", "Landing Call-to-Action", "Bringt neue Nutzer von der Landing direkt in Login, Learn oder den Free-Start-Flow."],
  ["learn-entry", "Learn-Einstieg", "Öffnet die komplette Lernoberfläche, damit Nutzer Funktionen nach Workflows statt nach Zufall verstehen."],
  ["auth-screen", "Login- und Signup-Screen", "Bündelt Anmeldung, Kontoerstellung und Rückweg zur Landing in einer klaren Einstiegsebene."],
  ["password-reset", "Passwort-Reset", "Erlaubt das Zurücksetzen des Kontos über Token-Link, ohne dass das Produkt manuell betreut werden muss."],
  ["dashboard-home", "Projekt-Dashboard", "Ist die operative Startseite für Projekte, Nutzung, Credits, Importe und zuletzt bearbeitete Arbeit."],
  ["workspace-stats", "Workspace-Statistiken", "Zeigen sofort, wie viele Projekte, Credits, Aktionen und Ausgaben gerade relevant sind."],
  ["onboarding-checklist", "Onboarding-Checkliste", "Führt neue Nutzer durch die ersten produktiven Schritte statt sie mit einer leeren Oberfläche allein zu lassen."],
  ["header-navigation", "Globale Kopf-Navigation", "Gibt schnellen Zugriff auf Hauptbereiche, ohne in tiefe Menüs wechseln zu müssen."],
  ["command-palette", "Command Palette", "Springt per Suche direkt zu Aktionen, Projekten oder Tools und spart viel UI-Klickstrecke."],
  ["global-search", "Globale Suche", "Durchsucht Projekte und Arbeitskontext, damit große Workspaces nicht unübersichtlich werden."],
  ["keyboard-shortcuts", "Keyboard Shortcuts", "Beschleunigen häufige Aktionen wie Vorschau, Snapshots, Gerätewechsel oder Assistentenaufrufe."],
  ["shortcuts-legend", "Shortcut-Legende", "Erklärt die verfügbaren Tastenkürzel an einer Stelle, statt versteckte Power-Features unsichtbar zu lassen."],
  ["toast-feedback", "Toast-Benachrichtigungen", "Geben unmittelbares Feedback nach Speichern, Importen, Fehlern oder Bestätigungen."],
  ["presence-avatars", "Presence Avatare", "Machen sichtbar, wer sonst noch im Workspace aktiv ist, was Teamarbeit verständlicher macht."],
  ["interaction-timeline", "Interaktions-Timeline", "Zeigt, welche relevanten Änderungen oder Aktionen zuletzt gelaufen sind."],
  ["activity-audit", "Aktivitätsprotokoll", "Dokumentiert Nutzeraktionen nachvollziehbar und hilft bei Übergaben oder Fehlersuche."],
  ["folder-manager", "Ordnerverwaltung", "Ordnet Projekte oder Artefakte in klare Strukturen, wenn der Workspace wächst."],
  ["main-view-switch", "View-Wechsel", "Schaltet sauber zwischen Landing, Learn, Auth, Dashboard, Editor und Admin um."],
  ["theme-toggle", "Theme-Umschalter", "Wechselt zwischen heller und dunkler Darstellung, damit die Oberfläche in verschiedenen Umgebungen angenehm bleibt."],
  ["region-selector", "Region Selector", "Hilft, regionale Einstellungen oder Zielmärkte sichtbar zu halten, wenn Workflows international laufen."],
])

const PROJECT_FEATURES = pack("projects", [
  ["project-create", "Projekt anlegen", "Erstellt eine neue Arbeitsfläche für einen Kunden, eine Migration oder einen einzelnen Redesign-Job."],
  ["project-open", "Projekt öffnen", "Lädt ein bestehendes Projekt in seinen letzten nutzbaren Zustand statt bei null zu starten."],
  ["project-rename", "Projekt umbenennen", "Hält Kunden- oder Kampagnennamen aktuell, damit Exporte und Teamkommunikation sauber bleiben."],
  ["project-archive", "Projekt archivieren", "Verschiebt abgeschlossene Arbeit aus dem aktiven Alltag, ohne sie zu löschen."],
  ["project-transfer", "Projekt übertragen", "Übernimmt Eigentum oder Verantwortung für ein Projekt zwischen Nutzern oder Bereichen."],
  ["project-sharing", "Projekt teilen", "Erzeugt kontrollierte Freigaben für Kunden oder Teammitglieder ohne chaotische Dateiversionen."],
  ["project-pages", "Seitenliste im Projekt", "Zeigt alle importierten oder erzeugten Seiten, damit Navigation und Bearbeitung strukturiert bleiben."],
  ["project-page-create", "Neue Projektseite", "Ergänzt zusätzliche Seiten in einem Projekt, wenn eine Migration oder Kampagne erweitert wird."],
  ["project-page-delete", "Projektseite löschen", "Entfernt Seiten, die nicht mehr benötigt werden oder versehentlich entstanden sind."],
  ["page-scan", "Seiten neu scannen", "Liest Projektseiten erneut ein, wenn der Import aktualisiert oder vervollständigt werden muss."],
  ["import-url", "Import per URL", "Zieht eine Live-Seite direkt aus dem Netz in den Projektfluss, ohne manuelle Zwischenschritte."],
  ["import-crawl", "Mehrseiten-Crawl", "Folgt internen Links, damit aus einer Startseite ein vollständigeres Projektmodell wird."],
  ["import-sitemap", "Sitemap-Import", "Nutzt eine Sitemap, wenn viele Seiten systematisch übernommen werden sollen."],
  ["import-zip", "ZIP-Upload", "Verarbeitet gepackte Web- oder Handoff-Dateien in einem Schritt."],
  ["import-html", "HTML-Upload", "Erlaubt den Import einzelner HTML-Dateien für kleinere oder manuell vorbereitete Projekte."],
  ["import-pdf", "PDF-Import", "Nutzt PDF-Briefings oder Vorlagen als Ausgangsmaterial für spätere Rekonstruktion und Bearbeitung."],
  ["import-screenshot", "Screenshot-Import", "Erfasst visuelle Referenzen, wenn keine saubere Website oder kein HTML vorliegt."],
  ["import-folder", "Ordner-Import", "Nimmt lokale Asset- oder Webstrukturen in einem Stück entgegen, statt Datei für Datei."],
  ["import-auth", "Authentifizierter Import", "Hilft bei Quellen, die nur mit Zugangsdaten oder Headern erreichbar sind."],
  ["import-fidelity", "Import-Fidelity-Panel", "Erklärt, was beim Import erkannt wurde und wo Struktur, Assets oder Plattformlogik schwächer sind."],
])

const EDITOR_BASICS_FEATURES = pack("editor-basics", [
  ["editor-view", "Editor-Hauptansicht", "Ist die zentrale Fläche für visuelles Bearbeiten, Prüfen und Umsetzen von Seiten."],
  ["editor-sidebar", "Editor-Sidebar", "Bündelt wichtige Werkzeuge und Einstellungen, ohne den Canvas zu überladen."],
  ["blocks-sidebar", "Blocks Sidebar", "Listet bearbeitbare Blöcke und hilft, gezielt nur die richtige Einheit zu verändern."],
  ["block-overlay", "Block Overlay", "Markiert Blöcke direkt auf der Seite, damit Auswahl und Kontext visuell klar bleiben."],
  ["editor-overlay", "Editor Overlay", "Legt Steuer- und Analysehilfen über den Canvas, ohne die eigentliche Seite zu zerstören."],
  ["editor-structure", "Strukturansicht", "Zeigt die Seitenhierarchie statt nur das visuelle Ergebnis und erleichtert präzise Navigation."],
  ["visual-node-tree", "Visual Node Tree", "Macht DOM-ähnliche Knoten und deren Beziehungen sichtbar, wenn Seiten komplex werden."],
  ["selected-component", "Komponentenauswahl", "Zeigt, welches Element gerade aktiv bearbeitet wird, damit Änderungen nicht versehentlich falsch landen."],
  ["device-toggle", "Geräte-Umschalter", "Wechselt zwischen Desktop-, Tablet- und Mobile-Vorschau in einem Klick."],
  ["viewport-presets", "Viewport-Presets", "Setzen feste Breiten, damit Responsive-Probleme reproduzierbar statt subjektiv geprüft werden."],
  ["mode-switch", "View- und Edit-Modus", "Trennt sicheres Betrachten von aktivem Bearbeiten, damit Nutzer nicht ständig versehentlich ändern."],
  ["hover-state-toggle", "Hover-State-Toggle", "Macht interaktive Zustände sichtbar, die man auf statischen Screens oft übersieht."],
  ["undo-redo", "Undo und Redo", "Nehmen letzte Änderungen zurück oder stellen sie wieder her, ohne Snapshots laden zu müssen."],
  ["manual-snapshot", "Manueller Snapshot", "Erzeugt vor riskanten Änderungen einen bewussten Wiederherstellungspunkt."],
  ["snapshot-gallery", "Snapshot-Galerie", "Zeigt gespeicherte Versionen als Verlauf, damit man nicht im Blindflug iteriert."],
  ["snapshot-diff", "Snapshot-Diff-Viewer", "Vergleicht Stände sichtbar, statt zwei Versionen manuell nebeneinander interpretieren zu müssen."],
  ["version-history", "Versionshistorie", "Sammelt Projektstände nachvollziehbar und unterstützt Review, Rollback und Dokumentation."],
  ["full-preview", "Vollvorschau", "Öffnet eine saubere Vorschau ohne Editor-Chrome, damit das Ergebnis wie eine echte Seite gelesen werden kann."],
  ["translation-split-view", "Translation Split View", "Vergleicht Varianten nebeneinander, wenn Sprache oder Marktversionen geprüft werden."],
  ["active-page-switch", "Aktive Seite wechseln", "Springt im Editor zwischen Seiten eines Projekts, ohne den gesamten Kontext zu verlieren."],
])

const EDITOR_ADVANCED_FEATURES = pack("editor-advanced", [
  ["component-library", "Component Library", "Bietet wiederverwendbare Bausteine, damit häufige Muster nicht immer neu gebaut werden müssen."],
  ["responsive-grid", "Responsive Grid Controls", "Passen Raster und Layout-Verhalten an, wenn Inhalte zwischen Geräten kippen."],
  ["design-rulers", "Design Rulers", "Zeigen Abstände und Ausrichtung, damit Layout-Arbeit nicht nach Augenmaß passiert."],
  ["z-index-inspector", "Z-Index Inspector", "Hilft bei überlappenden Elementen und Schichtungsproblemen, die visuell schwer zu greifen sind."],
  ["pseudo-editor", "Pseudo-Element-Editor", "Macht before- und after-ähnliche Gestaltung editierbar, ohne direkt Rohcode anzufassen."],
  ["dom-logic-control", "DOM Logic Control", "Greift in strukturelle Verhaltensebenen ein, wenn die Seite nicht nur optisch korrigiert werden muss."],
  ["code-injection", "Code Injection", "Fügt gezielte Scripts oder Styles ein, wenn reine UI-Bedienung nicht ausreicht."],
  ["theme-sync", "Theme Sync", "Spiegelt Theme-Entscheidungen sauber in die Seite, damit Preview und Ergebnis konsistent bleiben."],
  ["style-mirror", "Style Mirror", "Überträgt Stilmuster von einem Bereich auf andere, um Konsistenz schneller herzustellen."],
  ["design-system-settings", "Design-System-Einstellungen", "Zentralisieren Farben, Typo und wiederkehrende Regeln für ein Projekt."],
  ["css-variable-extractor", "CSS-Variablen-Extraktion", "Liest vorhandene Variablen aus, damit bestehende Systeme nicht neu erfunden werden."],
  ["global-style-overrides", "Globale Style Overrides", "Setzen projektweite Anpassungen für Schrift, Farben oder Akzente in einem Zug."],
  ["block-filtering", "Block-Filter", "Beschränken große Seiten auf relevante Blocktypen wie Buttons, Formulare oder Navigation."],
  ["drag-state-guard", "Drag-State-Schutz", "Verhindert verwirrende Interaktionen während Blöcke gezogen oder neu sortiert werden."],
  ["comparison-preview", "Vergleichsvorschau", "Hält Basis- und Zielzustand parallel sichtbar, wenn Varianten oder Versionen geprüft werden."],
  ["workflow-stage-control", "Workflow-Stufensteuerung", "Markiert, in welcher Produktionsphase sich ein Projekt befindet, damit Teams sauber übergeben."],
  ["page-label-mapping", "Seiten-Metadaten im Verlauf", "Ordnet Versionen und Aktionen den richtigen Seiten zu, damit History verständlich bleibt."],
  ["font-asset-binding", "Font-Asset-Bindung", "Verknüpft Schriften bewusst mit Projekten, statt sie zufällig aus dem Quellmaterial zu übernehmen."],
  ["asset-library-merge", "Asset-Library-Merge", "Führt importierte und gefundene Assets zusammen, damit die Medienbasis vollständig bleibt."],
  ["editor-chrome-detection", "Editor-Chrome-Erkennung", "Sorgt dafür, dass Vorschau und Editor-Rahmen visuell zum Dokument und Theme passen."],
])

const AI_FEATURES = pack("ai", [
  ["assistant-widget", "Assistant Widget", "Öffnet den KI-Assistenten direkt aus dem Editor, ohne den Arbeitsfluss zu verlassen."],
  ["assistant-container", "Assistant Container", "Hält Assistentenstatus, Verlauf und Einbettung konsistent über den gesamten Editor."],
  ["editor-ai-assistant", "Editor AI Assistant", "Verarbeitet KI-Aktionen mit Seiten- und Blockkontext statt mit isolierten Textschnipseln."],
  ["ai-prompt", "AI Prompt-Eingabe", "Nimmt genaue Anweisungen entgegen, damit Rewrites nicht generisch oder zu breit ausfallen."],
  ["ai-presets", "AI Preset Manager", "Speichert wiederverwendbare Prompt-Muster für typische Aufgaben wie SEO, CRO oder Copy."],
  ["ai-settings", "AI Settings", "Legt fest, wie Modelle, Genehmigungen und Provider sich im Alltag verhalten sollen."],
  ["ai-approval-queue", "AI Approval Queue", "Sammelt KI-Vorschläge zur Freigabe, damit teure oder riskante Aktionen nicht blind live gehen."],
  ["ai-command-center", "AI Command Center", "Bündelt KI-Werkzeuge in einer operativen Zentrale statt in verstreuten Buttons."],
  ["ai-suggestion-chip", "AI Suggestion Chips", "Bieten schnelle Einstiege in sinnvolle Folgeaktionen, ohne jedes Mal neu prompten zu müssen."],
  ["ai-image-generator", "AI Image Generator", "Erstellt passende Bilder oder Varianten, wenn vorhandene Assets fehlen oder schwach sind."],
  ["alt-text-generator", "Alt-Text Generator", "Erzeugt beschreibende Alternativtexte für Barrierefreiheit und SEO aus dem Bildkontext."],
  ["auto-layout-refactor", "Auto Layout Refactor", "Schlägt strukturelle Layout-Verbesserungen vor, wenn die Seite visuell nicht sauber trägt."],
  ["search-grounding", "Search Grounding Toggle", "Steuert, ob KI-Antworten stärker auf Such- oder Kontextsignale abgestützt werden."],
  ["ab-test-manager", "A/B-Test Manager", "Hilft, Varianten kontrolliert gegeneinander zu vergleichen statt Änderungen nur nach Gefühl zu bewerten."],
  ["brand-brain-ui", "Brand-Brain-Workflow", "Extrahiert Stil- und Sprachmuster, damit spätere KI-Arbeit markenkonsistent bleibt."],
  ["cro-audit-ui", "CRO Audit Workflow", "Analysiert Seiten auf Conversion-Hürden und priorisiert Verbesserungen nach Wirkung."],
  ["copy-improvement-ui", "Copy Improvement Workflow", "Verbessert Positionierung und Klarheit, ohne den Seitenkontext aus den Augen zu verlieren."],
  ["translation-workflow-ui", "KI-Übersetzungsworkflow", "Erzeugt sprachliche Varianten, ohne die Seitenstruktur manuell nachbauen zu müssen."],
  ["seo-workflow-ui", "SEO Workflow", "Leitet strukturierte SEO-Arbeit aus Projektkontext ab, statt nur Keywords zu streuen."],
  ["refactor-workflow-ui", "Refactor Workflow", "Hilft bei größeren strukturellen Umbauten, wenn einzelne Copy-Fixes nicht mehr reichen."],
])

const SEO_FEATURES = pack("seo", [
  ["seo-settings", "SEO Settings", "Bündeln zentrale SEO-Konfiguration, damit wichtige Signale nicht über das Projekt verstreut sind."],
  ["canonical-manager", "Canonical Manager", "Setzt oder prüft Canonicals, damit ähnliche Seiten nicht gegeneinander ranken."],
  ["hreflang-manager", "Hreflang Manager", "Ordnet Sprachvarianten sauber zu, damit Suchmaschinen Märkte korrekt verstehen."],
  ["redirect-manager", "Redirect Manager", "Verwaltet Weiterleitungen bei Relaunches, damit Rankings und Links nicht ins Leere laufen."],
  ["schema-generator", "Schema Generator", "Erzeugt strukturierte Daten, damit Inhalte für Suchmaschinen klarer klassifiziert werden."],
  ["seo-files-generator", "SEO Files Generator", "Hilft bei robots-, sitemap- oder ähnlichen SEO-Dateien für saubere Auslieferung."],
  ["custom-meta-manager", "Custom Meta Manager", "Pflegt Meta-Titel, Descriptions und Spezialfelder pro Seite oder Kontext."],
  ["technical-audit", "Technical Audit", "Prüft Seiten auf technische Probleme, die Performance, SEO oder Stabilität schwächen."],
  ["accessibility-scorecard", "Accessibility Scorecard", "Macht Barrierefreiheitsprobleme sichtbar und priorisiert sie in verständlicher Form."],
  ["contrast-auditor", "Contrast Auditor", "Findet Kontrastschwächen bei Texten und UI-Elementen, bevor sie produktiv schaden."],
  ["editor-audits", "Editor Audits", "Bringt Audit-Ergebnisse direkt in den Bearbeitungskontext statt in externe Reports."],
  ["search-snippet-preview", "Search Snippet Preview", "Zeigt, wie Suchergebnisse ungefähr erscheinen könnten, bevor Änderungen live sind."],
  ["seo-score-badges", "SEO Score Badges", "Verdichten wichtige Audit-Signale, damit Nutzer nicht jeden Detailreport einzeln lesen müssen."],
  ["language-variant-check", "Sprachvarianten-Prüfung", "Kontrolliert, ob SEO und Inhalt zwischen Sprachversionen sauber getrennt bleiben."],
  ["local-audit-builder", "Lokale Audit-Berechnung", "Erzeugt schnelle Prüfwerte direkt im Produkt, ohne auf externe Tools zu warten."],
  ["form-config-check", "Formular-Konfigurationsprüfung", "Hilft, Formulare funktional und suchmaschinenfreundlich korrekt einzubinden."],
  ["cookie-manager", "Cookie Manager", "Verwaltet Cookie-Hinweise oder Zustimmungslogik, die rechtlich und technisch relevant sind."],
  ["legal-generator", "Legal Generator", "Unterstützt bei rechtlichen Standardtexten, wenn Seiten schnell abgesichert werden müssen."],
  ["canonical-translation-sync", "Canonical- und Sprach-Sync", "Verhindert, dass Übersetzungen und Canonicals gegeneinander arbeiten."],
  ["seo-readiness", "SEO Readiness Signal", "Macht sichtbar, ob ein Projekt vor Export oder Publish noch kritische SEO-Lücken hat."],
])

const MEDIA_FEATURES = pack("media", [
  ["media-library", "Media Library", "Sammelt Bilder, Icons, Fonts und weitere Dateien an einer Stelle für schnellere Bearbeitung."],
  ["font-manager", "Font Manager", "Verwaltet Schriftdateien und Zuordnungen, damit Typografie stabil statt zufällig bleibt."],
  ["icon-manager", "Icon Manager", "Ordnet und ersetzt Icon-Sets, ohne dass einzelne Stellen manuell nachgezogen werden müssen."],
  ["image-enhancer", "Image Enhancer", "Verbessert visuelle Qualität oder Lesbarkeit von Bildern, wenn importiertes Material schwach ist."],
  ["image-optimizer", "Image Optimizer", "Reduziert Bildgewicht und verbessert Auslieferung, ohne manuell externe Tools zu bemühen."],
  ["asset-health-checker", "Asset Health Checker", "Findet fehlende, defekte oder problematische Medien, bevor Exporte brechen."],
  ["style-guide-generator", "Style Guide Generator", "Leitet aus einem Projekt wiederkehrende Designregeln ab, die das Team nutzen kann."],
  ["style-mirror-ui-2", "Style Mirror Kopierlogik", "Überträgt Gestaltungsmuster von einer Stelle auf andere passende Bereiche."],
  ["css-variable-browser", "CSS-Variablen-Browser", "Macht vorhandene Design-Tokens sichtbar und editierbar, statt sie im Code suchen zu müssen."],
  ["lazy-loading-toggle", "Lazy Loading Toggle", "Steuert Bild- oder Medien-Ladeverhalten, wenn Performance und Sichtbarkeit gegeneinander abgewogen werden."],
  ["design-token-use", "Design-Token-Nutzung", "Hält Farben und Größen über wiederholte Elemente hinweg konsistent."],
  ["asset-localisation", "Asset-Lokalisierung", "Zieht referenzierte Assets lokal ins Projekt, damit Exporte unabhängig von Fremdquellen bleiben."],
  ["logo-replacement", "Logo-Austausch", "Ersetzt Markenlogos sauber über Projektvarianten oder Relaunch-Stände hinweg."],
  ["font-preview", "Font Preview", "Zeigt die Wirkung von Schriften vor dem finalen Commit oder Export."],
  ["icon-consistency-check", "Icon-Konsistenzprüfung", "Hilft, uneinheitliche oder gemischte Icon-Sprachen zu bereinigen."],
  ["visual-crop-review", "Bildzuschnitt-Prüfung", "Macht sichtbar, wenn Bilder in Responsive-Layouts ungünstig beschnitten werden."],
  ["asset-search", "Asset-Suche", "Findet Medien im Projekt schnell über Name, Typ oder Quelle."],
  ["media-usage-context", "Medien-Nutzungskontext", "Zeigt, wo ein Asset eingesetzt wird, damit Änderungen nicht überraschend an vielen Stellen auftauchen."],
  ["background-asset-control", "Background-Asset-Steuerung", "Verwaltet dekorative oder flächige Bildnutzung kontrolliert im Layout."],
  ["design-system-sync", "Design-System-Sync für Medien", "Bindet Medienentscheidungen enger an das allgemeine Designsystem des Projekts."],
])

const PUBLISHING_FEATURES = pack("publishing", [
  ["export-selector", "Export-Modus-Auswahl", "Wählt das Zielformat passend zur Kundenplattform statt alles in einen generischen Export zu pressen."],
  ["html-clean-export", "Clean HTML Export", "Erzeugt bereinigtes HTML für einfache Hand-offs oder statische Nutzung."],
  ["html-raw-export", "Raw HTML Export", "Gibt eine nähere Rohfassung aus, wenn maximale Kontrolle wichtiger ist als Vereinfachung."],
  ["wp-theme-export", "WordPress Theme Export", "Erstellt ein installierbares Theme für klassische WordPress-Workflows."],
  ["wp-block-export", "WordPress Block Export", "Erzeugt Gutenberg-nahe Inhalte oder Blöcke statt eines kompletten Themes."],
  ["shopify-export", "Shopify Section Export", "Formt Projektarbeit in ein Shopify-kompatibles Format für Storefront-Nutzung."],
  ["react-export", "React Component Export", "Gibt Seiten oder Bausteine als React-Komponenten für Entwickler-Stacks aus."],
  ["web-component-export", "Web Component Export", "Verpackt Inhalte in eine portable Komponente für flexiblere Integrationen."],
  ["webflow-json-export", "Webflow JSON Export", "Erlaubt Übergaben in Workflows, die mit Webflow-Datenstrukturen arbeiten."],
  ["email-export", "Email Newsletter Export", "Baut aus Inhalten ein E-Mail-taugliches HTML statt nur eine Webseitenansicht."],
  ["markdown-export", "Markdown Export", "Reduziert Inhalte auf portable Textstruktur für Doku, CMS oder Content-Handoffs."],
  ["pdf-export", "PDF Export", "Erzeugt druck- oder freigabefähige PDFs, wenn Stakeholder keine interaktive Vorschau brauchen."],
  ["headless-export", "Headless Export", "Stellt Inhalte für headless oder API-nahe Ausgabeszenarien bereit."],
  ["export-audit-log", "Export Audit Log", "Dokumentiert, wann welches Artefakt erzeugt wurde und mit welchem Kontext."],
  ["publish-preview", "Publish Preview", "Erzeugt prüfbare Voransichten, bevor Inhalte an ein echtes Zielsystem gehen."],
  ["publish-targets", "Publish Targets", "Listet verfügbare Deploy-Ziele und ihre Eigenschaften für kontrollierte Auslieferung."],
  ["publish-history", "Publish History", "Macht frühere Deployments sichtbar, damit Status und Verantwortung nachvollziehbar bleiben."],
  ["rollback-deployment", "Rollback Deployment", "Setzt auf einen älteren Stand zurück, wenn ein Publish schiefging oder abgelehnt wurde."],
  ["custom-domain-guide", "Custom Domain Guide", "Erklärt die Domain-Anbindung konkret, damit DNS-Arbeit nicht erraten werden muss."],
  ["ssl-monitor", "SSL Monitor", "Warnt, wenn Zertifikate oder HTTPS-Sicherheit am Ziel problematisch werden."],
])

const TEAM_SECURITY_FEATURES = pack("team-security", [
  ["team-settings", "Team Settings", "Verwalten Mitglieder, Rollen und organisatorische Grundregeln an einer Stelle."],
  ["role-manager", "Role Manager", "Weist Rechte bewusst zu, statt mit überbreiten Admin-Rechten zu arbeiten."],
  ["organisation-setup", "Organisations-Setup", "Schafft eine gemeinsame Arbeitsbasis für Teams statt verstreuter Einzelprojekte."],
  ["member-invites", "Mitglieder einladen", "Bringt neue Nutzer mit passender Rolle direkt in den richtigen Arbeitskontext."],
  ["sso-config", "SSO-Konfiguration", "Bindet Single Sign-On an, wenn Zugänge zentral und sicher verwaltet werden sollen."],
  ["two-factor", "Two-Factor Settings", "Erhöhen die Kontosicherheit, besonders bei sensiblen Projekten oder Admin-Zugängen."],
  ["login-history", "Login History", "Zeigt, wann und von wo Konten genutzt wurden, um Missbrauch schneller zu erkennen."],
  ["ip-whitelist", "IP Whitelist", "Begrenzt kritische Zugriffe auf bekannte Netze oder Umgebungen."],
  ["privacy-settings", "Privacy Settings", "Steuern Datenschutz-relevante Produktoptionen und helfen bei Compliance-Anforderungen."],
  ["account-deletion", "Account Deletion", "Erlaubt kontrollierte Kontolöschung statt unklarer Restzustände im System."],
  ["project-share-links", "Share Links", "Geben externen Stakeholdern Zugang auf genau dem nötigen Niveau statt per Vollkonto."],
  ["approval-workflows", "Freigabe-Workflows", "Stellen sicher, dass sensible Änderungen nicht ohne Review live gehen."],
  ["audit-log-security", "Sicherheitsrelevante Audit-Spur", "Dokumentiert kritische Aktionen nachvollziehbar für Teams oder Betreiber."],
  ["presence-coordination", "Live-Präsenzkoordination", "Verhindert, dass Teammitglieder unabsichtlich gegeneinander arbeiten."],
  ["fraud-monitor", "Fraud Monitor", "Erkennt verdächtige Verhaltensmuster bei Nutzung, Anmeldungen oder finanziellen Aktionen."],
  ["access-control", "Zugriffskontrolle", "Begrenzt Sichtbarkeit und Bearbeitung so, dass Projekte nicht unnötig offen liegen."],
  ["client-review-mode", "Client Review Modus", "Gibt Kunden einen klaren Freigabekanal, ohne die interne Bedienoberfläche zu überladen."],
  ["sensitive-action-approval", "Freigabe sensibler Aktionen", "Verhindert, dass teure oder riskante Aktionen still und leise passieren."],
  ["security-surface-visibility", "Sicherheitsoberfläche sichtbar machen", "Bringt sicherheitsrelevante Optionen in die UI, statt sie nur technisch zu verstecken."],
  ["workspace-governance", "Workspace Governance", "Ordnet Rollen, Freigaben und Verantwortungen so, dass Teams kontrolliert skalieren können."],
])

const SETTINGS_ADMIN_FEATURES = pack("settings-admin", [
  ["api-key-manager", "API Key Manager", "Verwaltet Provider-Schlüssel zentral, damit Modelle und Dienste zuverlässig verbunden sind."],
  ["model-management", "Model-Verwaltung", "Steuert, welche Modelle wirklich nutzbar sind und welche nur theoretisch verfügbar wären."],
  ["billing-settings", "Billing Settings", "Machen Ausgaben, Planstatus und Abrechnung transparent statt nachträglich erklärungsbedürftig."],
  ["credits-panel", "Credits Panel", "Zeigt, wie viele Credits noch verfügbar sind und wodurch sie verbraucht wurden."],
  ["credit-topup", "Credits aufladen", "Erlaubt das gezielte Nachkaufen von Nutzung statt pauschaler Planwechsel."],
  ["invoice-list", "Rechnungsliste", "Hält Abrechnungen zentral abrufbar für Buchhaltung oder interne Kontrolle."],
  ["usage-quotas", "Usage Quotas", "Setzen Grenzen für Nutzung, damit Kosten oder Auslastung nicht unkontrolliert steigen."],
  ["cloud-sync", "Cloud Sync Settings", "Regeln, wie Projektstände oder Artefakte zwischen lokalem und cloudbasiertem Zustand gespiegelt werden."],
  ["white-label", "White Label Manager", "Passt Branding an, wenn das Produkt in kundennahen oder agentureigenen Umgebungen läuft."],
  ["general-settings-ui", "Allgemeine Einstellungen", "Steuern Sprache, Theme, Defaults und zentrale Verhaltensoptionen der App."],
  ["maintenance-mode", "Maintenance Mode", "Schränkt Nutzung kontrolliert ein, wenn Wartung oder Migrationen stabil durchgeführt werden müssen."],
  ["system-health", "System Health", "Zeigt, ob zentrale Produktdienste stabil laufen oder ob operative Probleme anstehen."],
  ["platform-help-guide", "Platform Help Guide", "Erklärt plattformspezifische Besonderheiten, damit Exporte und Importe nicht falsch interpretiert werden."],
  ["admin-dashboard", "Admin Dashboard", "Bietet eine Betreiberansicht für Nutzer, Pläne, Credits und Support-nahe Aktionen."],
  ["admin-user-management", "Admin User Management", "Erlaubt Erstellen, Sperren, Freigeben oder Anpassen von Nutzern durch Betreiber."],
  ["admin-plan-assignment", "Plan-Zuweisung", "Ändert Nutzertarife kontrolliert, wenn Support oder Vertrieb eingreifen müssen."],
  ["admin-credit-adjustment", "Credit-Anpassung", "Erhöht oder korrigiert Credits gezielt, ohne versteckte Datenbankarbeit."],
  ["reset-rate-limit", "Rate-Limit-Reset", "Hebt temporäre Begrenzungen auf, wenn legitime Nutzer blockiert wurden."],
  ["error-boundary", "Error Boundary", "Fängt UI-Fehler kontrolliert ab, damit ein Absturz nicht die komplette Oberfläche zerstört."],
  ["feature-flag-surface", "Feature-Flag-Sichtbarkeit", "Hilft, experimentelle oder optionale Bereiche kontrolliert freizuschalten."],
])

export const LEARN_FEATURE_REFERENCES: LearnFeatureReference[] = [
  ...CORE_FEATURES,
  ...PROJECT_FEATURES,
  ...EDITOR_BASICS_FEATURES,
  ...EDITOR_ADVANCED_FEATURES,
  ...AI_FEATURES,
  ...SEO_FEATURES,
  ...MEDIA_FEATURES,
  ...PUBLISHING_FEATURES,
  ...TEAM_SECURITY_FEATURES,
  ...SETTINGS_ADMIN_FEATURES,
]

export const LEARN_FEATURE_REFERENCE_RUNTIME_STRINGS = Array.from(
  new Set([
    ...LEARN_FEATURE_AREAS.map((area) => area.label),
    ...LEARN_FEATURE_REFERENCES.flatMap((item) => [item.title, item.summary]),
  ]),
)

if (LEARN_FEATURE_REFERENCES.length < 200) {
  throw new Error(`Learn feature reference is incomplete: expected at least 200 entries, got ${LEARN_FEATURE_REFERENCES.length}`)
}

const ids = new Set<string>()
for (const item of LEARN_FEATURE_REFERENCES) {
  if (ids.has(item.id)) throw new Error(`Duplicate learn feature id: ${item.id}`)
  ids.add(item.id)
}

export function getLearnFeatureAreaLabel(area: LearnFeatureArea) {
  return LEARN_FEATURE_AREAS.find((item) => item.id === area)?.label || area
}
