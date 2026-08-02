export type Language = "en" | "nl";

/** All selectable languages, labelled in their own language. */
export const languages: ReadonlyArray<{ value: Language; label: string }> = [
  { value: "en", label: "English" },
  { value: "nl", label: "Nederlands" },
];

/** The language advertised by this browser, mapped to a supported one. */
export const detectLanguage = (): Language =>
  navigator.language?.toLowerCase().startsWith("nl") ? "nl" : "en";

const en = {
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
  "home.playToBoard": "Play cards onto the table",
  "home.playFaceUp": "Play cards face up",
  "home.create": "Create table",
  "home.creating": "Creating…",
  "home.hint":
    "Open the table on a TV or tablet in the middle, then everyone joins by scanning the QR code with their phone.",

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
  "table.waitingForPlayers": "Waiting for players…",
  "table.dealAndStart": "Deal & start",
  "table.close": "Close",

  // Join
  "join.yourName": "Your name",
  "join.join": "Join table",
  "join.joining": "Joining…",
  "join.continue": "Continue previous session",
  "join.defaultPlayerName": "Player",

  // Player
  "player.loading": "Loading your hand…",
  "player.notAtTable": "You are no longer at this table.",
  "player.joinAgain": "Join again",
  "player.draw": "Draw ({count})",
  "player.takeBurn": "Take burn",
  "player.cards": "{count} cards",
  "player.waiting": "You're in! Waiting for the table to deal…",
  "player.hint": "Drag sideways to sort · flick a card up to throw it on the table",
  "player.hintBurnOnly": "Drag sideways to sort · flick a card up to discard it",
  "player.emptyHand": "No cards in hand",
  "player.play": "Play",
  "player.playFaceDown": "Play face down",
  "player.burn": "Burn",
} as const;

const nl: Record<MessageKey, string> = {
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
  "home.playToBoard": "Kaarten op tafel spelen",
  "home.playFaceUp": "Kaarten open spelen",
  "home.create": "Tafel aanmaken",
  "home.creating": "Aanmaken…",
  "home.hint":
    "Open de tafel op een tv of tablet in het midden; iedereen doet mee door de QR-code met hun telefoon te scannen.",

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
  "table.waitingForPlayers": "Wachten op spelers…",
  "table.dealAndStart": "Delen & starten",
  "table.close": "Sluiten",

  // Join
  "join.yourName": "Je naam",
  "join.join": "Meedoen",
  "join.joining": "Meedoen…",
  "join.continue": "Vorige sessie voortzetten",
  "join.defaultPlayerName": "Speler",

  // Player
  "player.loading": "Je hand laden…",
  "player.notAtTable": "Je zit niet meer aan deze tafel.",
  "player.joinAgain": "Opnieuw meedoen",
  "player.draw": "Pakken ({count})",
  "player.takeBurn": "Pak afleg",
  "player.cards": "{count} kaarten",
  "player.waiting": "Je doet mee! Wachten tot de tafel deelt…",
  "player.hint":
    "Sleep opzij om te sorteren · veeg een kaart omhoog om hem op tafel te gooien",
  "player.hintBurnOnly": "Sleep opzij om te sorteren · veeg een kaart omhoog om af te leggen",
  "player.emptyHand": "Geen kaarten in je hand",
  "player.play": "Spelen",
  "player.playFaceDown": "Gesloten spelen",
  "player.burn": "Afleggen",
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
