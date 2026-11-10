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
| Website | How Vachuo works | `how-it-works.html` |
| Website | About (our plan and the Vachuo Charter) | `about.html` |
| Website | Vision, mission & values | `vision.html` |
| Website | White paper | `white-paper.html` |
| Website | Pricing | `pricing.html` |
| Website | Careers | `careers.html` |
| Website | Sign in | `sign-in.html` |
| Website | Blog (Vachuo Journal) | `blog.html` |
| Website | Newsroom | `newsroom.html` |
| Journal | Thirty-two essays | `blog-<topic>.html` |
| Learner | Today | `today.html` |
| Learner | Tutor session | `session.html` |
| Learner | My map | `map.html` |
| Learner | My classes | `notes.html` |
| Learner | My assessments | `assessments.html` |
| Learner | Set up a learner | `onboarding.html` |
| Learner | Portfolio | `passport.html` |
| World | Connects | `connects.html` |
| World | Connects profile | `profile.html` (`?pid=library`, `?pid=grace`, …) |
| Family | Parent copilot | `copilot.html` |
| Family | Learner profile | `learner.html` |
| People | Messages | `messages.html` |
| Community | Clubs | `clubs.html` |
| Community | Showcase | `showcase.html` |
| Website | Join as a guide or school | `join.html` |
| Website | Contribute curriculum materials (Pre-K to Grade 12) | `contribute.html` |
| Website | Terms of use | `terms.html` |
| Website | Privacy policy | `privacy.html` |
| Parent | Approvals (rules by age, decision record) | `parent-approvals.html` |
| Parent | Money (plan, earnings held, spending limits) | `parent-money.html` |
| Parent | Family and settings | `parent-family.html` |
| Live | Live room (class, club and check-in) | `live-room.html` |
| Design system | Tokens and components | `design-system.html` |
| Component | Shared calendar | `calendar.html` |
| Component | Strengths radar and misconception heatmap | `strengths.html` |
| Guide | Guide workspace (learners, marking queue, schedule, create a lesson) | `guide.html` |
| School | School and microschool console | `school.html` |
| Internal | Ops console (moderation, accounts, AI cost and safety) | `ops.html` |
| Admin | Organisation admin (people, roles, policies, connections, billing, audit) | `admin.html` |
| Internal | Super admin (organisations, plans, flags, models, regions, staff access) | `super-admin.html` |
| Internal | Blog admin (posts, editor, review, categories, media, newsletter) | `blog-admin.html` |
| Internal | Content studio (item bank, model lab, test bench, experiments, revenue share) | `studio.html` |
| Component | Curriculum comparison | `compare.html` |
| Component | Approvals | `approvals.html` |
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
- `ref="{{fn}}"` calls `fn(element)` after render and `fn(null)` once the element is gone.
- `<template data-for="{{list}}" data-as="item">` repeats; `<template data-if="{{flag}}">` shows conditionally.
- `<dc-import name="Profile" pid="{{id}}" on-back="{{fn}}">` embeds another component
  (its template and class are included in the same page).
- Components can use `componentDidMount`, `componentDidUpdate(prevProps, prevState)` and
  `componentWillUnmount`.

Shared base styles live in `assets/css/site.css`; page-specific styles sit in each page's
`<head>`. `assets/css/theme.css` is the dark theme: pages set `data-theme="dark"` (saved in
`localStorage` as `vachuo-theme`), and the theme recolours inline styles by matching their
serialized form, which is why the runtime writes `style` attributes the way the browser does.
Images are in `assets/img/`; lesson PDFs, videos and data files are in `assets/files/`.
