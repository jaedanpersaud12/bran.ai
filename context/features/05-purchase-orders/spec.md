# 05 Purchase orders & supplier email

## What
Drafted purchase orders get a home: a list at `/inventory/purchase-orders` and a detail
dialog, with the lifecycle draft → sent → received (or cancelled). Receiving adds the
quantities to stock. From any order, "Draft supplier email" produces an email per supplier
that the owner edits, copies or opens in their mail app — AI writes the greeting and the
closing, bran writes the line list.

## Why
Since 01, "Draft purchase order" ends at "Drafted PO-0002" and the draft is never seen
again — the AI review's "gives the draft nowhere to land". Receiving is also the missing
half of stock: without it, restock's "on order" never turns into "on hand".

## Done when
- [x] `/inventory/purchase-orders` lists the workspace's orders in a paged `TableCard` (ref, status, created, lines, units, cost, `⋯` menu), newest first; a `loading.tsx` skeleton matches it
- [x] The planner's and the card's "Drafted PO-000N" link to the list; Inventory's header links to it
- [x] The detail dialog shows each line: piece, quantity, restock's suggestion, unit cost, line cost, and the totals
- [x] Mark sent: status `sent`, `sent_at` set, and on `/inventory` those units show as "+N coming" and count toward cover
- [x] Mark received: status `received`, and every line's quantity is added to its variant's `on_hand` in the same statement; receiving twice is impossible
- [x] Cancel works from draft or sent; received orders can't be cancelled; each transition only applies from its allowed status
- [x] "Draft supplier email" groups the lines by the product's supplier email (lines with none grouped as "No supplier set"), and for each group shows a subject and body in an editable field, with Copy and "Open in mail app" (mailto)
- [x] The line list, quantities and PO reference in the email come from the database, never from the model; the AI part is marked with the AI mark; with AI off or failing, a plain template is used and nothing is marked
- [x] The email step's AI output is tested against a mock model, including rejecting text that invents numbers
- [x] Every action scopes by the session's workspace; another workspace's PO id changes nothing
- [x] `pnpm check` and `pnpm test` pass

## Out of scope
- Sending email from bran (the owner sends from their own mail)
- Editing a PO's lines after drafting, partial receiving
- Splitting one PO into one per supplier at drafting time
