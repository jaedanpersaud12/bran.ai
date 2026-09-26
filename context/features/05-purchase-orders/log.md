# Log — 05 Purchase orders & supplier email

- **2026-09-26** — Opened on `feat/05-purchase-orders`, stacked on 04, under "keep
  building".
- **2026-09-26** — **Fixed a restock bug from 01**, found here: after sending exactly what
  restock suggested, every line flipped to Hold "Consider trimming that order" — restock
  orders for lead time + 30 days (44–65 days of cover here) but held anything over 35. Stock
  on order within lead + 30 + 7 days is now Watch ("N on order covers the wait"); trimming is
  only suggested beyond it. Two new tests, including "following restock's own suggestion
  never earns a trim".
- **2026-09-26** — Live DeepSeek output said "65 days of cover **plus** 47 on order" (the 65
  already includes them). The prompt field is now `days_of_cover_including_on_order`, and a
  `PROMPT_VERSION` is part of every explanation fingerprint so prompt changes re-explain.
- **2026-09-26** — Found in the browser: with two emails open the order dialog outgrew the
  screen and its footer actions were unreachable; it now scrolls itself. `LoadingButton` put
  icons on their own line above the label; its label is now a flex row. `AiMark` takes a
  screen-reader label ("Written by AI" for emails).

## Evidence

- **List + skeleton** — `/inventory/purchase-orders`: TableCard with ref, status pill,
  created, lines, units, cost, `⋯` menu; newest first. Skeleton 840.5px vs real 840.6px.
  *(browser)*
- **Links** — the card's "Draft order" produced "Drafted PO-0002" with "Open PO-0002", which
  landed on the list with PO-0002's dialog already open; Inventory's header has "Purchase
  orders"; the planner's confirmation carries the same link. *(browser)*
- **Detail** — five lines with piece, SKU, ordered, "Restock said", unit, line cost and the
  totals in the description. *(browser)*
- **Mark sent** — dialog status Sent, footer switched to "Receive into stock"; `/inventory`
  showed each line "+N coming" with cover including it. *(browser)*
- **Receive** — stock before 12/18/0/5/6, lines 61/47/59/76/51, after 73/65/59/81/57; status
  `received`, `received_at` set. *(SQL)*
- **Guards + tenancy** — temporary route (deleted): receiving PO-0002 again, sending or
  cancelling it, receiving/cancelling/emailing a throwaway workspace's sent order, and a
  non-UUID id all returned `ok: false`; SQL showed stock unchanged (no double receive) and
  the foreign order still `sent` with stock 10. Throwaway workspace deleted. *(harness + SQL)*
- **Cancel** — PO-0001 (sent): the confirmation read "Its units stop counting as on the way
  … can't be undone", "Keep order" / "Cancel order"; confirming set it Cancelled. *(browser)*
- **Supplier email, live DeepSeek** — PO-0002 gave two emails (Medellín Swim; Port of Spain
  Sewing), each AI-marked with its own `mailto:`. The model wrote greetings and closings with
  no numbers of its own; the line lists were exact (51×76 + 61×74 + 59×68 + 76×68 =
  TT$17,570, 247 units; 47×96 = TT$4,512). `bran.ai_runs`: 2 ok `po-email` runs, 517 in /
  232 out tokens. *(browser + SQL)*
- **Email tests** — `pnpm test`: 32 pass; the email step's 6 tests cover grouping, exact line
  list, assembly, refusing prose with quantities/prices, length limits, and the template.
  *(test)*
- **Checks** — `pnpm check`: 0 errors, 4 pre-existing warnings. *(script)*
- **Clean-up** — harness removed, throwaway workspace deleted, demo reseeded. *(SQL)*
