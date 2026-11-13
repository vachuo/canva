"""Site edits applied after every rebuild from the design canvas.

The pages are regenerated from the canvas on each refresh, so changes that the
canvas doesn't have yet live here and are re-applied to the built HTML each time.

Run from the repository root after a rebuild:

    python tools/site_edits.py

Each edit is idempotent. If its target is no longer in a page (for example
because the canvas itself has dropped it), it prints a note and moves on.

There are no edits at the moment. The press removals that used to live here
(Sign in's Media portal, Newsroom's press contacts and the "press kit" wording)
are now in the canvas itself.

To add one, write a function that takes and returns a page's HTML, then list it
in EVERY_PAGE (runs on all pages) or PAGE_EDITS (runs on one page), e.g.

    def drop_banner(html):
        return sub(html, r'<div class="banner">.*?</div>', '', 'index.html: banner', re.S)

    PAGE_EDITS = {'index.html': [drop_banner]}
"""
import pathlib
import re
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


EVERY_PAGE = []
PAGE_EDITS = {}


def main():
    pages = sorted(ROOT.glob('*.html'))
    if not pages:
        sys.exit(f'No pages found in {ROOT}')
    changed = 0
    for f in pages:
        html = f.read_text(encoding='utf-8')
        new = html
        for edit in EVERY_PAGE + PAGE_EDITS.get(f.name, []):
            new = edit(new)
        if new != html:
            f.write_text(new, encoding='utf-8', newline='\n')
            changed += 1
    print(f'site_edits: updated {changed} of {len(pages)} pages')
    for n in notes:
        print(f'site_edits: not found (already gone?): {n}')


if __name__ == '__main__':
    main()
