# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Static HTML / CSS / JS, no build step (user-chosen). Hosts anywhere (Netlify drop,
GitHub Pages). Chosen for a scroll-driven showcase that must run on every guest's
browser, iOS Safari included.

## Users

Wedding guests across a wide age range, the majority opening the link on a phone
(largely iPhone). They arrive from a text or paper invite, want the essentials
quickly (when, where, what to wear), and need to RSVP without creating an account.
Secondary users: the couple/hosts, who track replies in a Google Sheet.

## Product Purpose

A single-page wedding invitation site that (1) tells guests the story and the day's
details beautifully, and (2) collects RSVPs into a Google Sheet so the couple can
see who's coming, who declined, and who hasn't replied.

## Operating Context

Guest journey: open link on phone → read hero/story/details/schedule → submit RSVP.
Host journey: RSVPs land in a linked Google Sheet (Responses tab) via a Google Apps
Script Web App; a Dashboard tab counts replied / attending / declined / no-reply and
lists who still hasn't answered (see GOOGLE-SHEET-SETUP.md).

## Capabilities and Constraints

- RSVP form posts to a Google Apps Script `/exec` endpoint (fire-and-forget, no CORS
  read-back) which appends a row to the Sheet. No server, no database.
- Form captures: name, attending (yes/no), headcount, meal preference, note.
- Must degrade gracefully: `prefers-reduced-motion`, no-JS still readable.
- **Undecided product facts (placeholders, not invented):** the two names, the
  wedding date, venue + address + city, ceremony/reception times, dress code, and
  RSVP deadline. Marked with `{{...}}` in source for the couple to fill.

## Brand Commitments

- **Palette is pinned by the client: bottle green & gold.** Deep bottle/forest green
  ground with gold as the accent/ornament. This is a binding constraint, not a
  default to reconsider.

## Evidence on Hand

- No real photographs yet; tasteful licensed stand-ins are used and must be swapped.
- No real names/date/venue yet; these are open decisions above, not to be fabricated.

## Product Principles

1. Mobile-first and universally compatible — a guest on a 5-year-old iPhone sees the
   full experience, animations included.
2. Beautiful but effortless — the RSVP is one short, obvious action.
3. Honest content — placeholders stay visible until the couple supplies real facts;
   nothing (dates, venues, quotes) is invented.
4. The Sheet is the backend — no infrastructure the couple has to maintain.

## Accessibility & Inclusion

Wide guest age range: legible type at real sizes, AA contrast on the green ground,
full keyboard access on the form, and motion that fully stands down under
`prefers-reduced-motion`.
