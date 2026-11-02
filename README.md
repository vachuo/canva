# Vachuo website

Static site for Vachuo, built from the "Vachuo — End-to-End AI School" design canvas.

## Run locally

```bash
python -m http.server 5180
```

Then open http://localhost:5180.

## Pages

| Section | Page | File |
| --- | --- | --- |
| Website | Thesis landing page | `index.html` |
| Website | Vision, mission & values | `vision.html` |
| Website | White paper | `white-paper.html` |
| Website | Pricing | `pricing.html` |
| Website | Careers | `careers.html` |
| Website | Sign in | `sign-in.html` |
| Website | Blog (Vachuo Journal) | `blog.html` |
| Website | Newsroom | `newsroom.html` |
| Journal | Sixteen essays | `blog-<topic>.html` |
| Learner | Today | `today.html` |
| Learner | Tutor session | `session.html` |
| Learner | My map | `map.html` |
| Learner | My notes | `notes.html` |
| Learner | Learning Passport | `passport.html` |
| World | Connects | `connects.html` |
| World | Connects profile | `profile.html` (`?pid=library`, `?pid=grace`, …) |
| Family | Parent copilot | `copilot.html` |
| Inside Vachuo | The loop | `loop.html` |

## How a page is built

Each page keeps its markup in `<template id="dc-<Name>">` and its data and behaviour in a
component class registered with `DC.component()` at the bottom of the file.
`assets/js/dc.js` renders the template into `#app` and patches the DOM in place whenever the
component calls `setState()`, so elements keep their identity across updates (CSS
transitions, focus, typing and scroll-reveal state survive).

- `{{name}}` fills text or an attribute from `renderVals()` (or the current loop item).
- `onclick="{{handler}}"` binds any `on*` event to a function; `onchange` fires on every input.
- `value="{{v}}"` and `checked="{{b}}"` on form fields stay in sync with component state.
- `<template data-for="{{list}}" data-as="item">` repeats; `<template data-if="{{flag}}">` shows conditionally.
- `<dc-import name="Profile" pid="{{id}}" on-back="{{fn}}">` embeds another component
  (its template and class are included in the same page).
- Components can use `componentDidMount`, `componentDidUpdate(prevProps, prevState)` and
  `componentWillUnmount`.

Shared base styles live in `assets/css/site.css`; page-specific styles sit in each page's
`<head>`. Images are in `assets/img/`.
