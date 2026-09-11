# project-view/

The owner's window into the project. It reads the canonical Markdown files at load time and draws
them: a front page from `PROJECT.md`, `STATUS.md` and `NEXT.md`, one page per canonical file, the
research register and a library view of the material behind it, and the inputs as received.

It is derived and disposable. It writes nothing back and keeps no copy of project state. If this
interface and the files disagree, the files are right, and the page says so in its sidebar. Delete
the folder and nothing about the project is lost.

## How to run it

A browser will not fetch local files from a `file://` address, so it needs a static server. From
the project root:

    python3 -m http.server 5179

Then open `http://localhost:5179/project-view/`. The same server also serves `prototype/`, so the
links between the two work. `.claude/launch.json` carries this as the `project-root` entry.

Serve the project root, not this folder on its own. The interface fetches the files with `../`,
and a server rooted here cannot reach them.

If the prototype is served somewhere else, open the interface once with
`?prototype=http://host:port/prototype/` and it remembers the address in the browser. The
prototype's launchpads accept `?view=` the same way for the link back.

## What it is made of

Plain HTML, CSS and JavaScript with no build step and no dependencies. `md.js` is a small
Markdown parser and renderer written for the shapes these files use. `app.js` loads the files,
builds the index of IDs, and draws each view. `style.css` is the look. Nothing is fetched from a
CDN.

## What it resolves into links

Record IDs of the forms `U-`, `UJ-`, `F-`, `WF-`, `US-`, `Q-`, `A-`, `C-`, `DEP-`, `R-`, `D-` and
`RS-` link to their record when a heading of the form `## ID — Title` exists for them (`###` in
`USERS.md`). `FR-nn` and `BR-nn` link to their bullet in the specification. A range written as
"F-001 to F-016" links its two ends only.

Names of the canonical files link to their page, wherever they appear. Files listed in
`RESEARCH/manifest.json` link to the library. A few other project documents (`Framework -
Mahjong.md`, `MOBILE.md`, `TABLE-VARIANTS.md`, `JARGON.md`, `RULES.md`, `README.md`, `CLAUDE.md`,
`P-Starter.md`) are linked only if the interface finds them on the server at load time. Relative
links inside a research document are resolved against that document's folder, so
`knowledge/README.md` reaches `PLAYBOOK.md` and `sources/`. A prototype route written as
`prototype/app.html#tab` opens that screen.

Left as plain text, on purpose: `../CLAUDE.md` and anything else above the project root, which the
server cannot serve; paths into `web/`, `solver/`, `datagen/` and `data/`, which are code and data
rather than reading; files that are neither canonical, nor in the manifest, nor in the list above;
and citations of the form `SPEC.md § 4.3`, which link to the file but not to the section.

## Known limitations

These are properties of the file formats as they stand. None of them called for changing a
canonical file.

- The Markdown renderer covers headings, paragraphs, ordered and unordered lists with wrapped and
  nested items, pipe tables with a separator row, fenced code, block quotes, rules, and inline
  code, bold, italic, links and bare URLs. It does not render raw HTML, reference-style links,
  setext headings or task lists; those show as written.
- Journey diagrams are drawn from Mermaid `flowchart` and `graph` blocks with `[box]`, `{decision}`
  and `(round)` nodes and `-->` edges, with or without `|labels|`. Loops are drawn as an arc back
  over the row. Any other Mermaid syntax, and any drawing that fails, falls back to the source
  shown in a code block. The drawing is a derived aid; the prose is canonical.
- A journey's status in `USER-JOURNEYS.md` is a sentence rather than one word, so journeys carry no
  single status chip; the sentence is shown with its evidence words chipped.
- Evidence and status chips are matched on the uppercase words the files use. An uppercase word
  used in another sense, such as "FINDINGS," meaning the file, will be chipped too.
- Records are recognised by the `## ID — Title` heading shape. A record whose heading departs from
  it renders as ordinary text inside the previous section.
- A status chip is the first recognised word of the Status field; the rest of the field is shown
  beside it, so "BUILT, with one gap" reads as BUILT with the qualifier visible.
- Two headings with the same text in one document get ids ending `-2`, `-3` and so on, so the table
  of contents can reach both.
- The library depends on `RESEARCH/manifest.json`. A file listed there but missing from the folder
  shows an error; a file in the folder but not listed is not shown. The folder is right in both
  cases; regenerate the manifest.
- The screenshot tool in the in-app browser returns a blank image for a page scrolled below its
  first screen. The page is drawn; the capture is not. This is not a fault in the interface.
