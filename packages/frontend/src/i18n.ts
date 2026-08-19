export type Language = "en" | "nl";

/** All selectable languages, labelled in their own language. */
export const languages: ReadonlyArray<{ value: Language; label: string }> = [
  { value: "en", label: "English" },
  { value: "nl", label: "Nederlands" },
];

/** The language advertised by this browser, mapped to a supported one. */
export const detectLanguage = (): Language =>
  navigator.language?.toLowerCase().startsWith("nl") ? "nl" : "en";

/** A `?lang=` param if it names a supported language, else the browser default. */
export const langFromParam = (value: string | null | undefined): Language =>
  value === "nl" || value === "en" ? value : detectLanguage();

const en = {
  // App
  "app.fullscreen": "Full screen",

  // Home
  "home.language": "Language",
  "home.subtitle":
    "A shared card table for any game — the table handles decks, shuffling and dealing, you bring the rules.",
  "home.tableName": "Table name",
  "home.tableNamePlaceholder": "Friday night rummy",
  "home.defaultTableName": "My table",
  "home.fallbackTableName": "Card table",
  "home.decks": "Decks",
  "home.jokersPerDeck": "Jokers / deck",
  "home.shuffle": "Shuffle",
  "home.shuffle.riffle": "Riffle shuffle",
  "home.shuffle.overhand": "Overhand shuffle",
  "home.shuffle.fisher-yates": "Perfect random",
  "home.shuffle.cut": "Cut only",
  "home.shuffle.none": "No shuffle",
  "home.passes": "Passes",
  "home.dealPerPlayer": "Cards dealt per player",
  "home.cardColors": "Card colors",
  "home.colors2": "2 colors (classic)",
  "home.colors4": "4 colors (♥ ♦ ♣ ♠)",
  "home.stockPile": "Stock pile (draw cards)",
  "home.burnPile": "Burn pile (discard)",
  "home.startBurnCount": "Open cards at start",
  "home.turnMarker": "Turn marker (tap a player to pass it)",
  "home.dealerButton": "Dealer button (drag it onto a player)",
  "home.playToBoard": "Play cards onto the table",
  "home.playFaceUp": "Play cards face up",
  "home.create": "Create table",
  "home.creating": "Creating…",
  "home.hint":
    "Open the table on a TV or tablet in the middle, then everyone joins by scanning the QR code with their phone.",
  "home.joinTitle": "Join a table",
  "home.joinCode": "Table code",
  "home.joinGo": "Join",
  "home.codeNotFound": "No table found with that code.",

  // Landing
  "home.tileJoin": "Join a table",
  "home.tileJoinSub": "Enter a table code",
  "home.tileCreate": "Create a table",
  "home.tileCreateSub": "Set up a new game",
  "common.back": "← Back",

  // Create sections + card sets
  "home.sectionCards": "Cards",
  "home.sectionShuffle": "Shuffle & dealing",
  "home.sectionBoard": "Board & piles",
  "home.deckType": "Card set",
  "home.deckStandard": "Playing cards",
  "home.deckUno": "UNO",
  "home.unoNote":
    "A full UNO set: 4 colours, action cards and wilds (108 cards per deck). The table just shuffles and deals — you bring the rules.",

  // Presets
  "home.presets": "Quick setups",
  "preset.uno": "UNO",
  "preset.pesten": "Crazy Eights",
  "preset.poker": "Poker",
  "preset.rummy": "Rummy",
  "preset.duizenden": "Duizenden",
  "preset.hearts": "Hearts",
  "preset.gofish": "Go Fish",
  "preset.free": "Free play",

  // Table
  "table.loading": "Loading table…",
  "table.gone": "This table no longer exists.",
  "table.startRound": "Start round",
  "table.newRound": "New round ({round})",
  "table.gatherBurn": "Gather → burn",
  "table.gatherStock": "Gather → stock",
  "table.reshuffleBurn": "Reshuffle burn → stock",
  "table.circle": "Circle",
  "table.stock": "Stock",
  "table.burn": "Burn",
  "table.scanToJoin": "Scan to join",
  "table.code": "Code",
  "table.waitingForPlayers": "Waiting for players…",
  "table.dealAndStart": "Deal & start",
  "table.close": "Close",
  "table.scores": "Scores",
  "table.scoreAdd": "Add",
  "table.scoreReset": "Reset scores",
  "table.scoreResetConfirm": "Clear all scores?",
  "table.turnHint": "Tap a player on the board to pass the turn marker.",

  // Join
  "join.yourName": "Your name",
  "join.join": "Join table",
  "join.joining": "Joining…",
  "join.defaultPlayerName": "Player",

  // Player
  "player.loading": "Loading your hand…",
  "player.notAtTable": "You are no longer at this table.",
  "player.joinAgain": "Join again",
  "player.draw": "Draw ({count})",
  "player.takeBurn": "Take burn",
  "player.takeBurnAll": "Take pile ({count})",
  "player.cards": "{count} cards",
  "player.waiting": "You're in! Waiting for the table to deal…",
  "player.hint":
    "Tap cards to select (several form a set) · drag sideways to sort · flick up to throw",
  "player.hintBurnOnly": "Drag sideways to sort · flick a card up to discard it",
  "player.emptyHand": "No cards in hand",
  "player.play": "Play",
  "player.playSet": "Play set ({count})",
  "player.playFaceDown": "Play face down",
  "player.burn": "Burn",
  "player.revealHand": "Lay your hand open on the table",
  "player.revealConfirm": "Lay your whole hand face up on the table?",
  "player.yourTurn": "Your turn",
  "player.dealer": "Dealer",
  "player.takeBack": "Take back",
  "player.tapTable":
    "Tap a row on the table to add your cards · tap a loose card to start a row · tap empty felt to lay them there",
  "player.leave": "Leave table",
  "player.leaveConfirm": "Leave this table? Your cards go back into the stock pile.",
  "player.showTable": "Show the table",
} as const;

const nl: Record<MessageKey, string> = {
  // App
  "app.fullscreen": "Volledig scherm",

  // Home
  "home.language": "Taal",
  "home.subtitle":
    "Een gedeelde kaarttafel voor elk spel — de tafel regelt de stokken, het schudden en het delen, jij brengt de regels mee.",
  "home.tableName": "Tafelnaam",
  "home.tableNamePlaceholder": "Vrijdagavond rummy",
  "home.defaultTableName": "Mijn tafel",
  "home.fallbackTableName": "Kaarttafel",
  "home.decks": "Stokken",
  "home.jokersPerDeck": "Jokers per stok",
  "home.shuffle": "Schudden",
  "home.shuffle.riffle": "Riffelen",
  "home.shuffle.overhand": "Overhands schudden",
  "home.shuffle.fisher-yates": "Perfect willekeurig",
  "home.shuffle.cut": "Alleen couperen",
  "home.shuffle.none": "Niet schudden",
  "home.passes": "Keren",
  "home.dealPerPlayer": "Kaarten per speler",
  "home.cardColors": "Kaartkleuren",
  "home.colors2": "2 kleuren (klassiek)",
  "home.colors4": "4 kleuren (♥ ♦ ♣ ♠)",
  "home.stockPile": "Trekstapel (kaarten pakken)",
  "home.burnPile": "Aflegstapel (weggooien)",
  "home.startBurnCount": "Open kaarten bij start",
  "home.turnMarker": "Beurt-markering (tik op een speler om door te geven)",
  "home.dealerButton": "Dealerknop (sleep hem naar een speler)",
  "home.playToBoard": "Kaarten op tafel spelen",
  "home.playFaceUp": "Kaarten open spelen",
  "home.create": "Tafel aanmaken",
  "home.creating": "Aanmaken…",
  "home.hint":
    "Open de tafel op een tv of tablet in het midden; iedereen doet mee door de QR-code met hun telefoon te scannen.",
  "home.joinTitle": "Meedoen aan een tafel",
  "home.joinCode": "Tafelcode",
  "home.joinGo": "Meedoen",
  "home.codeNotFound": "Geen tafel gevonden met die code.",

  // Landing
  "home.tileJoin": "Tafel joinen",
  "home.tileJoinSub": "Voer een tafelcode in",
  "home.tileCreate": "Tafel maken",
  "home.tileCreateSub": "Zet een nieuw spel op",
  "common.back": "← Terug",

  // Create sections + card sets
  "home.sectionCards": "Kaarten",
  "home.sectionShuffle": "Schudden & delen",
  "home.sectionBoard": "Tafel & stapels",
  "home.deckType": "Kaartset",
  "home.deckStandard": "Speelkaarten",
  "home.deckUno": "UNO",
  "home.unoNote":
    "Een volledige UNO-set: 4 kleuren, actiekaarten en jokers (108 kaarten per stok). De tafel schudt en deelt alleen — jij brengt de regels mee.",

  // Presets
  "home.presets": "Snel opzetten",
  "preset.uno": "UNO",
  "preset.pesten": "Pesten",
  "preset.poker": "Poker",
  "preset.rummy": "Rummy",
  "preset.duizenden": "Duizenden",
  "preset.hearts": "Hartenjagen",
  "preset.gofish": "Kwartet",
  "preset.free": "Vrij spelen",

  // Table
  "table.loading": "Tafel laden…",
  "table.gone": "Deze tafel bestaat niet meer.",
  "table.startRound": "Ronde starten",
  "table.newRound": "Nieuwe ronde ({round})",
  "table.gatherBurn": "Verzamelen → afleg",
  "table.gatherStock": "Verzamelen → trekstapel",
  "table.reshuffleBurn": "Afleg schudden → trekstapel",
  "table.circle": "Cirkel",
  "table.stock": "Trekstapel",
  "table.burn": "Afleg",
  "table.scanToJoin": "Scan om mee te doen",
  "table.code": "Code",
  "table.waitingForPlayers": "Wachten op spelers…",
  "table.dealAndStart": "Delen & starten",
  "table.close": "Sluiten",
  "table.scores": "Scores",
  "table.scoreAdd": "Erbij",
  "table.scoreReset": "Scores wissen",
  "table.scoreResetConfirm": "Alle scores wissen?",
  "table.turnHint": "Tik op een speler op het bord om de beurt door te geven.",

  // Join
  "join.yourName": "Je naam",
  "join.join": "Meedoen",
  "join.joining": "Meedoen…",
  "join.defaultPlayerName": "Speler",

  // Player
  "player.loading": "Je hand laden…",
  "player.notAtTable": "Je zit niet meer aan deze tafel.",
  "player.joinAgain": "Opnieuw meedoen",
  "player.draw": "Pakken ({count})",
  "player.takeBurn": "Pak afleg",
  "player.takeBurnAll": "Pak stapel ({count})",
  "player.cards": "{count} kaarten",
  "player.waiting": "Je doet mee! Wachten tot de tafel deelt…",
  "player.hint":
    "Tik kaarten aan om te selecteren (meerdere = serie) · sleep opzij om te sorteren · veeg omhoog om te gooien",
  "player.hintBurnOnly": "Sleep opzij om te sorteren · veeg een kaart omhoog om af te leggen",
  "player.emptyHand": "Geen kaarten in je hand",
  "player.play": "Spelen",
  "player.playSet": "Serie spelen ({count})",
  "player.playFaceDown": "Gesloten spelen",
  "player.burn": "Afleggen",
  "player.revealHand": "Je hand open op tafel leggen",
  "player.revealConfirm": "Je hele hand open op tafel leggen?",
  "player.yourTurn": "Jouw beurt",
  "player.dealer": "Deler",
  "player.takeBack": "Terugnemen",
  "player.tapTable":
    "Tik op een serie om aan te leggen · tik op een losse kaart om een serie te starten · tik op leeg vilt om ze daar neer te leggen",
  "player.leave": "Tafel verlaten",
  "player.leaveConfirm":
    "Deze tafel verlaten? Je kaarten gaan terug in de trekstapel.",
  "player.showTable": "Tafel bekijken",
};

export type MessageKey = keyof typeof en;

const dictionaries: Record<Language, Record<MessageKey, string>> = { en, nl };

export const t = (
  lang: Language,
  key: MessageKey,
  params?: Record<string, string | number>,
): string => {
  let message = dictionaries[lang][key] ?? en[key];
  if (params !== undefined) {
    for (const [name, value] of Object.entries(params)) {
      message = message.replace(`{${name}}`, String(value));
    }
  }
  return message;
};
