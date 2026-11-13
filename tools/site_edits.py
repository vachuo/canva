"""Site edits applied after every rebuild from the design canvas.

The pages are regenerated from the canvas on each refresh, so changes that the
canvas doesn't have yet live here and are re-applied to the built HTML each time.

Run from the repository root after a rebuild:

    python tools/site_edits.py

Each edit is idempotent. If its target is no longer in a page (for example
because the canvas itself has dropped it), it prints a note and moves on.

Current edits
-------------
Temporary home page (since 12 Nov 2026). The "Coming soon" page is the site's
home page, index.html, and nothing links to it. The thesis landing page that the
canvas builds as index.html lives at landing.html instead, and every link that
pointed to index.html (index.html#access, #signed-out, #schole, ...) points to
landing.html. The Coming soon page's "Alpha Testing" button opens landing.html.

The Coming soon page is a board on the design canvas (ComingSoon.dc.html, next
to the thesis landing page), so it is rebuilt like every other page.

  - swap_home(): when a rebuild has written the thesis landing page to
    index.html, it moves it to landing.html. It then moves the rebuilt Coming
    soon page (whatever file name the builder gave it) to index.html, so it
    exists only as index.html. If a rebuild has no Coming soon page and
    index.html is missing, it copies the older hand-made version from
    tools/coming-soon.html as a fallback.
  - link_landing(): rewrites links to index.html as landing.html on every page,
    including the rebuilt Coming soon page (its Alpha Testing button). Only the
    hand-made fallback is skipped; its links are already right.

To change the Coming soon page, edit its board on the canvas and rebuild.
tools/coming-soon.html is only the fallback. Once a rebuild has produced the
canvas version (the script says so), the fallback can be deleted.

To end the arrangement: empty SWAP_HOME_ON and EVERY_PAGE below, delete
tools/coming-soon.html, then rebuild from the canvas.

The press removals that used to live here (Sign in's Media portal, Newsroom's
press contacts and the "press kit" wording) are now in the canvas itself.

To add a page edit, write a function that takes and returns a page's HTML, then
list it in EVERY_PAGE (runs on all pages) or PAGE_EDITS (runs on one page), e.g.

    def drop_banner(html):
        return sub(html, r'<div class="banner">.*?</div>', '', 'landing.html: banner', re.S)

    PAGE_EDITS = {'landing.html': [drop_banner]}
"""
import pathlib
import re
import shutil
import sys

ROOT = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else pathlib.Path(__file__).resolve().parent.parent
notes = []


def remove_template_block(html, condition, label):
    """Remove <template data-if="{{condition}}"> ... </template>, including nested templates."""
    start = html.find(f'<template data-if="{{{{{condition}}}}}">')
    if start >= 0:
        depth = 0
        for m in re.finditer(r'<template\b|</template>', html[start:]):
            depth += 1 if m.group(0).startswith('<template') else -1
            if depth == 0:
                return html[:start] + html[start + m.end():].lstrip('\n')
    notes.append(label)
    return html


def sub(html, pattern, repl, label, flags=0):
    """re.sub that records a note when the pattern isn't found."""
    new, n = re.subn(pattern, repl, html, flags=flags)
    if not n:
        notes.append(label)
    return new


# --- Temporary home page: Coming soon at index.html, thesis landing at landing.html ---
COMING_SOON = ROOT / 'tools' / 'coming-soon.html'  # fallback: the older hand-made page
LANDING_MARK = '<template id="dc-Landing"'  # only the canvas-built thesis landing page has this
SOON_MARK = '<template id="dc-ComingSoon"'  # only the canvas-built Coming soon page has this


def swap_home():
    index, landing = ROOT / 'index.html', ROOT / 'landing.html'
    if index.exists() and LANDING_MARK in index.read_text(encoding='utf-8'):
        index.replace(landing)
        print('site_edits: moved the rebuilt thesis landing page from index.html to landing.html')
    built = [f for f in sorted(ROOT.glob('*.html')) if f.name != 'index.html' and SOON_MARK in f.read_text(encoding='utf-8')]
    if built:
        built[0].replace(index)
        print(f'site_edits: index.html is the Coming soon page from the canvas (was {built[0].name})')
        for extra in built[1:]:
            extra.unlink()
            print(f'site_edits: removed a second copy of the Coming soon page: {extra.name}')
    elif not index.exists():
        if COMING_SOON.exists():
            shutil.copyfile(COMING_SOON, index)
            print('site_edits: index.html is the Coming soon page (hand-made fallback from tools/coming-soon.html)')
        else:
            notes.append('tools/coming-soon.html (index.html is missing)')


def link_landing(html):
    """index.html, index.html#access, ... -> landing.html, landing.html#access, ..."""
    return re.sub(r'(?<![\w./-])index\.html', 'landing.html', html)


SWAP_HOME_ON = True
EVERY_PAGE = [link_landing]


def skip_every_page(name, html):
    """The hand-made fallback at index.html keeps its own text; the canvas-built one gets the edits."""
    return name == 'index.html' and SOON_MARK not in html

PAGE_EDITS = {}


def main():
    if SWAP_HOME_ON:
        swap_home()
    pages = sorted(ROOT.glob('*.html'))
    if not pages:
        sys.exit(f'No pages found in {ROOT}')
    changed = 0
    for f in pages:
        html = f.read_text(encoding='utf-8')
        new = html
        edits = ([] if skip_every_page(f.name, html) else EVERY_PAGE) + PAGE_EDITS.get(f.name, [])
        for edit in edits:
            new = edit(new)
        if new != html:
            f.write_text(new, encoding='utf-8', newline='\n')
            changed += 1
    print(f'site_edits: updated {changed} of {len(pages)} pages')
    for n in notes:
        print(f'site_edits: not found (already gone?): {n}')


if __name__ == '__main__':
    main()
