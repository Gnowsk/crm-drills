# CRM drills

Crew resource management training drills for the crew room. Each drill is a branching scenario: the player makes calls, can hit **PAUSE** at any moment to see "next best action" options, and finishes with a Swiss-cheese debrief, a CRM skills score and facilitator questions.

The site is plain static files. There is no server, no login and no database, so it runs on GitHub Pages for free.

```
index.html              Home page: the menu of drills
drill.html              Plays one drill (drill.html?s=wheel-chock)
assets/engine.js        The shared engine. You never need to edit this.
assets/style.css        The olive / sand / safety-yellow look
scenarios/list.json     Which drills appear on the home page, in order
scenarios/*.json        One file per drill: all the words and choices
pictures/*.svg          The drawing beside each drill
```

---

## Writing a new drill (no coding needed)

A drill is one text file in the `scenarios` folder. You don't write any code. You fill in labelled boxes: the scenes, the choices, the feedback and the debrief questions.

### The quickest way

1. Copy `scenarios/two-metres-up.json` (the simpler of the two) and give the copy a short name with no spaces, for example `scenarios/radio-check.json`.
2. Change the words. Keep the structure.
3. Open the site, click **Try a scenario file**, and pick your file. It plays your drill straight from your computer. If something is wrong, you get a plain list of what to fix and where.
4. When it plays properly, add its name (without `.json`) to `scenarios/list.json`:
   ```json
   ["wheel-chock", "two-metres-up", "radio-check"]
   ```
5. Upload both files to GitHub (see "Publishing a change" below). The new drill appears on the home page within a minute or two.

### Five rules for JSON files

JSON is fussy about punctuation. Almost every mistake is one of these:

1. **Text goes in straight double quotes:** `"title": "Two metres up"`.
2. **Items are separated by commas, but there is no comma after the last one** in a list `[ ]` or a group `{ }`.
3. **Inside your text, use curly quotes** `“ ”` and the curly apostrophe `’`, not straight `"`. A straight `"` inside text ends the text early. (Straight apostrophes `'` are fine, but curly ones match the existing drills.)
4. **Numbers and true/false have no quotes:** `"minutes": 12`, `"alert": true`.
5. **Names must match exactly**, including capitals. If a choice says `"next": "esc"`, there must be a scene called `"esc"`.

A good free editor such as VS Code, or the GitHub website's own editor, colours the text and underlines punctuation mistakes. The **Try a scenario file** page also tells you the line number of a punctuation mistake.

---

## What goes in a scenario file

Here is the outline. Each part is explained below.

```json
{
  "title": "...",
  "kicker": "...",
  "duration": "...",
  "summary": "...",
  "subtitle": "...",
  "steps": [ ... ],
  "skills": { ... },
  "people": { ... },
  "state": { ... },
  "clock": { ... },
  "picture": { ... },
  "checklist": { ... },
  "start": "intro",
  "scenes": { ... },
  "debrief": { ... }
}
```

### About the drill

| Box | What it's for |
|---|---|
| `title` | The drill's name, shown big at the top. |
| `kicker` | A short label above the title on the home page, such as `"Speak-up drill"`. |
| `duration` | Shown on the home page, such as `"About 8 minutes"`. |
| `summary` | Two sentences for the home page card. |
| `subtitle` | The line under the title inside the drill. |

### `steps`: the bar across the top

The names of the stages, in order. Each scene says which step it belongs to.

```json
"steps": ["Spot it", "Speak up", "Escalate", "Make it safe", "Close out"]
```

The bar never moves backwards. If a bad choice loops the player back to an earlier scene, the bar stays at the furthest step they reached.

### `skills`: what gets scored

A short code for each CRM skill, its full name, and the best score a player could reasonably get (this sets how full the bar is in the debrief).

```json
"skills": {
  "COM": { "name": "Communication", "max": 7 },
  "DM":  { "name": "Decision making", "max": 6 }
}
```

### `people`: who speaks

A short code for each speaker and the name shown on their speech bubble. Add `"me": true` to the player, so their bubbles sit on the right.

```json
"people": {
  "RV": { "name": "Ravi" },
  "ME": { "name": "You", "me": true }
}
```

### `scenes`: the story

Each scene has a short id (letters, numbers, `-` or `_`, no spaces) and looks like this:

```json
"brush": {
  "step": 2,
  "time": "1644",
  "title": "Speak up",
  "text": "Ravi stops on the first rung and looks over at Aaron.",
  "say": [
    { "who": "RV", "line": "Relax lah, I’ve done this a hundred times." },
    { "who": "AA", "line": "Just be quick." }
  ],
  "question": "You say:",
  "choices": [ ... ],
  "pause": { ... },
  "next": "esc"
}
```

| Box | What it's for |
|---|---|
| `step` | Which step of the bar this scene is in (1 for the first). Use `0` for the opening tasking scene. |
| `time` | The 24-hour clock time shown above the title. Optional. |
| `title` | The scene's heading. |
| `text` | What's happening. Optional. |
| `say` | Speech bubbles, in order. `who` is a code from `people`. Optional. |
| `question` | The prompt above the choices. Leave it out to get "Your call:". |
| `choices` | The options the player picks from (see below). |
| `pause` | What the PAUSE button offers in this scene (see below). Optional. |
| `next` | Where to go after this scene, unless a choice says otherwise. |
| `alert` | `true` makes the PAUSE button pulse and the picture shake: use it for the moment something is going wrong. |
| `onEnter` | Facts to set as soon as the player arrives (see "Remembering what happened"). |

The first scene is the one named in `"start"` (usually `"intro"`). To end the drill, send the player to `"debrief"`. That name is reserved: the engine builds the debrief page itself.

### Choices

```json
{
  "text": "“Ravi, stop. Come down for a sec. Two metres is work at height.”",
  "grade": "good",
  "skills": { "COM": 2, "LEAD": 1 },
  "minutes": 0,
  "say": [ { "who": "RV", "line": "Ok ok, coming down." } ],
  "feedback": "Clear and direct: you named the action, the reason, and what you want him to do.",
  "set": { "speak": "held" },
  "next": "esc"
}
```

| Box | What it's for |
|---|---|
| `text` | The words on the button. |
| `grade` | `"good"` (Strong call), `"ok"` (Workable, with gaps) or `"poor"` (Risky). |
| `feedback` | The coaching shown after the choice. Required when there's a grade. |
| `skills` | Points added to (or, with a minus, taken from) each skill. Optional. |
| `minutes` | Extra minutes this choice costs, for the clock (see `clock`). Optional. |
| `say` | Replies shown after the choice. Optional. |
| `set` | Facts to remember (see below). Optional. |
| `next` | Where this choice leads. Leave it out to use the scene's `next`. |

A choice **without a grade** is a plain button that moves straight on, with no feedback and no score. Use it for "Start the drill" or "Continue to Bravo":

```json
{ "text": "Start the drill", "next": "spot" }
```

### The PAUSE button

Every scene has a PAUSE button. If the scene has a `pause` box, pressing PAUSE shows its prompt and choices, which work exactly like normal choices. If it doesn't, PAUSE says "Nothing out of place right now. Breathe, scan, carry on." and offers to resume. Put a `pause` on the scenes where stopping to think would change the outcome.

```json
"pause": {
  "prompt": "Ladder up, no harness, everyone in a rush. What’s your next best action?",
  "choices": [
    { "text": "Stop the work and call it out, now.", "grade": "good", "skills": { "DM": 2 }, "feedback": "...", "next": "brush" }
  ]
}
```

---

## Remembering what happened

Branching drills need to remember earlier choices. You do this with **facts**: a name and a value, set by `set` on a choice or `onEnter` on a scene.

```json
"set": { "knows": true, "bos": "held" }
```

List every fact and its starting value in `state`:

```json
"state": { "chocks": true, "knows": false, "pos": "ground" }
```

### Checking a fact

Anywhere the guide says **condition**, you can write:

| Condition | Means |
|---|---|
| `"knows"` | the fact `knows` is true |
| `"!knows"` | the fact `knows` is false or not set |
| `"pos=top"` | the fact `pos` is `top` |
| `"pos!=top"` | the fact `pos` is anything but `top` |
| `["harness", "pos=top"]` | all of these at once |

### Saying different things depending on a fact

Any text, speech list, `set` or `next` can be replaced with an **if / then / else** box:

```json
"text": {
  "if": "brief",
  "then": "Approaching the school zone, Darren slows to 40 without a prompt.",
  "else": "At the school zone you call “slow down” late, and Darren brakes hard."
}
```

```json
"next": { "if": "knows", "then": "risk_known", "else": "risk_unknown" }
```

You can leave out `else`. Text and speech are read **before** the choice's `set` takes effect, and `next` is worked out **after**, so a choice can change a fact and then branch on its new value.

### The Swiss-cheese layers

The debrief draws one slice of cheese per safety barrier. Each barrier is a fact that you set to `"held"` or `"missed"` in the choices. The arrow stops at the first barrier that held; barriers after that show "not reached".

---

## The debrief

```json
"debrief": {
  "verdicts": [
    { "if": "fall", "title": "Ravi fell.", "text": "Each chance to stop the job was waved through." },
    { "if": "late", "title": "Caught late.", "text": "Light fitted at {finish}." },
    { "title": "Stopped, escalated, made safe, and still on time.", "text": "Doing it properly cost about {minutes} minutes." }
  ],
  "cheese": {
    "label": "Swiss cheese view of the barriers against a fall",
    "hazard": "Unprotected at 2 m",
    "hazardShort": "Fall risk",
    "outcome": "Fall",
    "layers": [
      { "flag": "speak", "label": "Speak up and stop", "short": "Speak up" },
      { "flag": "esc",   "label": "Escalate and hold", "short": "Escalate" }
    ]
  },
  "skillsNote": "Optional extra sentence under the skills scores.",
  "questions": [ "Facilitator question 1", "Facilitator question 2" ],
  "footnote": "Fictional people, timings and locations for training use."
}
```

- **verdicts**: the headline. The first one whose `if` is true is used, so put the most specific first and finish with one that has no `if`.
- **cheese**: `hazard` is the arrow's label, `outcome` is shown if every layer failed, and `short` labels are used on phones.
- **questions**: shown as a numbered list for the facilitator.

---

## Times: `clock` and `{tokens}`

Choices can cost time with `"minutes"`. A `clock` entry turns that into an arrival or finish time:

```json
"clock": { "finish": "1708" }
```

Now `{finish}` anywhere in your text shows 1708 plus the minutes spent, such as `1723`. `{minutes}` shows the total minutes, and `{factname}` shows any fact's value.

---

## The picture and the checklist (optional)

Beside the scene there's a drawing and a checklist. You can leave either out.

### Picture

```json
"picture": {
  "file": "pictures/ladder.svg",
  "alt": "A colleague on a ladder against a 2 metre shelter roof",
  "shake": "ladder",
  "show": { "har": "harness" },
  "move": { "fig": [ { "if": "pos=top", "to": "translate(124 104)" }, { "to": "translate(76 176)" } ] },
  "caption": [
    { "if": "fall", "text": "Work stopped. Medic called." },
    { "text": "Shelter roof edge, two metres up." }
  ]
}
```

- `file`: an SVG drawing in the `pictures` folder. Reusing an existing drawing is fine. A new drawing needs someone comfortable with SVG, or you can leave the picture out.
- `show`: show the part of the drawing with that id only while the condition is true.
- `move`: reposition a part of the drawing (first matching case wins).
- `shake`: the part that shakes on `alert` scenes.
- `caption`: the line under the picture (first matching case wins).

### Checklist

```json
"checklist": {
  "title": "Work at height",
  "showWhen": "bosStarted",
  "items": [
    { "text": "Harness worn", "tick": "harness" },
    { "text": "Wheel chocks out", "tick": "chocksOut", "highlight": true }
  ],
  "note": "Fills in as the crew makes it safe."
}
```

Each item gets a tick while its condition is true. `highlight` shades the row. `showWhen` hides the checklist on phones until the condition is true.

---

## Publishing a change

Once the site is on GitHub:

1. Open the repository on github.com and go into the `scenarios` folder.
2. To add a drill: **Add file → Upload files**, drag your `.json` file in, and click **Commit changes**.
   To edit one: click the file, click the pencil icon, edit, and click **Commit changes**.
3. Don't forget to add the new name to `scenarios/list.json` the same way.
4. Wait a minute or two, then refresh the site.

## Previewing on your own computer

Opening `index.html` by double-clicking won't work, because browsers block a page from reading files off your disk. Either use **Try a scenario file** on the live site, or, if Python is installed, run this in the site folder and visit http://localhost:8000:

```
python3 -m http.server 8000
```
