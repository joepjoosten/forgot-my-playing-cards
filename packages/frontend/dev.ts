/**
 * Local development page: loads the table in one iframe and a couple of
 * players in separate iframes, each with their own session — like having
 * a tablet and several phones on your desk.
 */

const tableFrame = document.getElementById("table-frame") as HTMLIFrameElement;
const playersDiv = document.getElementById("players") as HTMLDivElement;
const addButton = document.getElementById("add-player") as HTMLButtonElement;

const appUrl = (hash: string) => {
  const base = new URL(".", window.location.href);
  return `${base.href}#${hash}`;
};

let tableId: string | null = null;
let playerCount = 0;

const addPlayer = () => {
  if (tableId === null) return;
  playerCount++;
  const frame = document.createElement("iframe");
  frame.title = `Player ${playerCount}`;
  frame.src = appUrl(
    `/join/${tableId}?name=${encodeURIComponent(`Player ${playerCount}`)}&auto=1`,
  );
  playersDiv.appendChild(frame);
};

window.addEventListener("message", (event: MessageEvent) => {
  const data: unknown = event.data;
  if (
    typeof data === "object" &&
    data !== null &&
    "type" in data &&
    (data as { type: unknown }).type === "fmpc:table-created" &&
    "tableId" in data
  ) {
    tableId = String((data as { tableId: unknown }).tableId);
    addButton.disabled = false;
    // Two players out of the box; add more with the button.
    addPlayer();
    addPlayer();
  }
});

addButton.addEventListener("click", addPlayer);

// The table iframe starts on the landing screen; tapping "create a table"
// carries the dev flag through to the form, which posts `fmpc:table-created`
// back up so the player iframes spawn on create.
tableFrame.src = appUrl("/?dev=1");
