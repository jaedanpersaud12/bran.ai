# Plan — 05 Purchase orders & supplier email

## Decisions
- **Route `/inventory/purchase-orders`**, not `/inventory/orders` — "Orders" is the customer
  queue in the nav; a supplier order is Inventory's.
- **Transitions are guarded in SQL**: each update has `where status = <from>`, so a stale
  click or a double submit matches nothing. Receiving is one statement (a CTE updates the
  order and adds to `on_hand` for its lines), so stock and status can't disagree.
- **AI writes the words, bran writes the numbers.** The model returns `{ subject, opening,
  closing }` for a supplier; bran assembles the email with the exact line list between the
  opening and the closing. Opening/closing are rejected if they contain any number other
  than the PO reference's — the lines are the only place quantities appear.
- **One email per supplier** within an order: restock's draft spans products, and products
  can have different suppliers. Lines without a supplier email are grouped and the
  "Open in mail app" link has no recipient.
- **Generated on demand, not stored**: one DeepSeek call per supplier group per click, logged
  through `runAI` as `po-email`. The owner edits in a textarea; nothing is saved.
- **Template fallback** is the prototype's PO email, reworded — used when AI is off or the
  output fails the checks, and not marked as AI.

## How to build it
1. `src/lib/purchase-orders.ts` (list + detail loaders), `src/actions/purchase-orders.ts`
   gains `markSent`, `markReceived`, `cancelOrder`, `draftSupplierEmails`.
2. `src/lib/po-email.ts` (pure: grouping, template, assembly, validation, the model call)
   + tests with the mock model.
3. The page, table, detail dialog, email panel, `loading.tsx`; links from Inventory.
4. Verify in browser and SQL; log.
