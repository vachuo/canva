"""Site edits applied after every rebuild from the design canvas.

The pages are regenerated from the canvas on each refresh, so changes that the
canvas doesn't have yet live here and are re-applied to the built HTML each time.

Run from the repository root after a rebuild:

    python tools/site_edits.py

Each edit is idempotent. If its target is no longer in a page (for example
because the canvas itself has dropped it), it prints a note and moves on.
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else pathlib.Path(__file__).resolve().parent.parent
notes = []


def remove_template_block(html, condition):
    """Remove <template data-if="{{condition}}"> ... </template>, including nested templates."""
    start = html.find(f'<template data-if="{{{{{condition}}}}}">')
    if start < 0:
        return html, 0
    depth = 0
    for m in re.finditer(r'<template\b|</template>', html[start:]):
        depth += 1 if m.group(0).startswith('<template') else -1
        if depth == 0:
            end = start + m.end()
            return html[:start] + html[end:].lstrip('\n'), 1
    return html, 0


def sub(html, pattern, repl, label, flags=0):
    new, n = re.subn(pattern, repl, html, flags=flags)
    if not n:
        notes.append(label)
    return new


# --- Press: remove the media portal sign-in, press contacts and press-kit wording ---

# The Company menu's Newsroom description, without "press kit", in every language.
NEWS_DESC = {
    'News, press kit and channels': 'News and channels',
    'Habari, vifaa vya wanahabari na chaneli': 'Habari na chaneli',
    'Actualités, kit presse et canaux': 'Actualités et canaux',
    'Noticias, kit de prensa y canales': 'Noticias y canales',
    'Notícias, kit de imprensa e canais': 'Notícias e canais',
    'الأخبار والحقيبة الصحفية والقنوات': 'الأخبار والقنوات',
    'ዜና፣ የፕሬስ ኪት እና ቻናሎች': 'ዜና እና ቻናሎች',
    'Warar, xirmada saxaafadda iyo kanaalada': 'Warar iyo kanaalada',
    "Labarai, kayan 'yan jarida da tashoshi": 'Labarai da tashoshi',
    'Izindaba, iphakethe labezindaba neziteshi': 'Izindaba neziteshi',
    "Amakuru, ibikoresho by'abanyamakuru n'imiyoboro": "Amakuru n'imiyoboro",
    'Neuigkeiten, Pressemappe und Kanäle': 'Neuigkeiten und Kanäle',
    '新闻、媒体资料包与频道': '新闻与频道',
    'समाचार, प्रेस किट और चैनल': 'समाचार और चैनल',
    'ニュース、プレスキット、各種チャンネル': 'ニュースと各種チャンネル',
}


def press_everywhere(html):
    for old, new in NEWS_DESC.items():
        html = html.replace(f'"abNewsD": "{old}"', f'"abNewsD": "{new}"')
    # The footer's (unused) "Press kit" label.
    html = re.sub(r'"fPress": "[^"]*", ?', '', html)
    return html


def press_sign_in(html):
    html, n = remove_template_block(html, 'isPress')
    if not n:
        notes.append('sign-in.html: Media portal form')
    html = sub(html, r"\['press', 'Press'\],\s*", '', 'sign-in.html: Press role')
    html = html.replace("'school', 'press', 'staff'", "'school', 'staff'")
    html = html.replace("isPress: r === 'press', ", '')
    return html


def press_newsroom(html):
    html = sub(html, r'\n?<a href="sign-in\.html"[^>]*>Media portal sign-in</a>', '', 'newsroom.html: Media portal sign-in link')
    html = sub(html, r'\n?<span[^>]*>Press enquiries: press@vachuo\.com</span>', '', 'newsroom.html: Press enquiries line')
    html = sub(html, r'\n?<p[^>]*>Press contact: [^<]*</p>', '', 'newsroom.html: Press contact line')
    html = sub(html, r'\n?<p[^>]*>Press, partnerships and speaking:.*?</p>', '', 'newsroom.html: Press, partnerships and speaking line', re.S)
    return html


PAGE_EDITS = {'sign-in.html': press_sign_in, 'newsroom.html': press_newsroom}


def main():
    pages = sorted(ROOT.glob('*.html'))
    if not pages:
        sys.exit(f'No pages found in {ROOT}')
    changed = 0
    for f in pages:
        html = f.read_text(encoding='utf-8')
        new = press_everywhere(html)
        if f.name in PAGE_EDITS:
            new = PAGE_EDITS[f.name](new)
        if new != html:
            f.write_text(new, encoding='utf-8', newline='\n')
            changed += 1
    print(f'site_edits: updated {changed} of {len(pages)} pages')
    for n in notes:
        print(f'site_edits: not found (already gone?): {n}')


if __name__ == '__main__':
    main()
