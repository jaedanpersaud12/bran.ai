"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ArrowLeft, FileUp, ImagePlus } from "lucide-react";
import { extractCatalogDraft, importCatalog } from "@/actions/catalog-import";
import {
  Attachment,
  AttachmentInfo,
  AttachmentPreview,
  AttachmentRemove,
  Attachments,
} from "@/components/ai-elements/attachments";
import {
  PromptInput,
  PromptInputBody,
  PromptInputButton,
  PromptInputFooter,
  PromptInputHeader,
  PromptInputProvider,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  usePromptInputAttachments,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";
import { AiMark } from "@/components/bran/AiMark";
import { LoadingButton } from "@/components/bran/LoadingButton";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { StatusPill } from "@/components/ui/status-pill";
import type { CatalogRow } from "@/lib/catalog";
import {
  canImport,
  checkDraft,
  type DraftField,
  type DraftRow,
  type ExistingCatalog,
  type SupplierInput,
} from "@/lib/catalog-import";
import type { FieldErrors, ProductFields } from "@/lib/catalog-input";

/**
 * Sizes tried in turn until the photo fits under `MAX_PHOTO_CHARS`: the first
 * is plenty to read print; the smaller ones are for dense, detailed shots.
 */
const PHOTO_STEPS = [
  { edge: 1600, quality: 0.85 },
  { edge: 1600, quality: 0.7 },
  { edge: 1280, quality: 0.7 },
  { edge: 1024, quality: 0.65 },
];
/** Below the action's 900k-character ceiling, leaving room for a typed note. */
const MAX_PHOTO_CHARS = 850_000;
const DEFAULT_SUPPLIER: SupplierInput = { leadTimeDays: "21", supplierEmail: "" };
/** What the file picker accepts before downsizing; a phone photo is 3–12 MB. */
const MAX_PHOTO_BYTES = 20 * 1024 * 1024;

const AI_TITLE =
  "Read from your document by AI. Blank fields are ones it didn't state — check every row; nothing is added until you import.";

/** What was sent, so Back can put it back in the input. */
type Sent = { text: string; photo: { url: string; filename?: string; mediaType: string } | null };

type Draft = {
  rows: DraftRow[];
  currency: string | null;
  truncated: boolean;
};

/**
 * Catalogue import: paste a price list or snap one, check what bran read,
 * import the rows you keep.
 *
 * Two steps in one modal. The first sends the document to the model; the
 * second is a table of drafts the owner edits, checked on every keystroke
 * with the same rules the server runs at import. Loaded with `next/dynamic`
 * from the catalogue, so AI Elements only ships to someone who opens it.
 */
export function CatalogImport({
  open,
  onClose,
  catalog,
  available,
}: {
  open: boolean;
  onClose: () => void;
  catalog: CatalogRow[];
  /** False without an AI key: the dialog says so instead of offering an input. */
  available: boolean;
}) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [sent, setSent] = useState<Sent | null>(null);
  const [supplier, setSupplier] = useState<SupplierInput>(DEFAULT_SUPPLIER);

  // The dialog stays mounted between opens; each import starts clean, so one
  // supplier's email and lead time never carry over to the next document.
  const close = () => {
    onClose();
    setDraft(null);
    setSent(null);
    setSupplier(DEFAULT_SUPPLIER);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? null : close())}>
      <DialogContent className={`p-5 ${draft ? "sm:max-w-6xl" : "sm:max-w-lg"}`}>
        {draft ? (
          <Review
            draft={draft}
            setRows={(rows) => setDraft({ ...draft, rows })}
            supplier={supplier}
            setSupplier={setSupplier}
            catalog={catalog}
            onBack={() => setDraft(null)}
            onDone={close}
          />
        ) : (
          <Source
            available={available}
            initial={sent}
            onDraft={(next, found, from) => {
              setDraft(next);
              setSent(from);
              // From this document alone — never the last import's values.
              setSupplier({
                leadTimeDays:
                  found.leadTimeDays === null ? DEFAULT_SUPPLIER.leadTimeDays : String(found.leadTimeDays),
                supplierEmail: found.supplierEmail ?? "",
              });
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function Heading({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground [&_svg]:size-4">
        <FileUp />
      </span>
      <div className="min-w-0">
        <DialogTitle className="text-base font-semibold">{title}</DialogTitle>
        <DialogDescription className="text-xs text-muted-foreground">{description}</DialogDescription>
      </div>
    </div>
  );
}

// -------------------------------------------------------------- step 1 --

function Source({
  available,
  initial,
  onDraft,
}: {
  available: boolean;
  /** What was sent last time, restored after Back. */
  initial: Sent | null;
  onDraft: (
    draft: Draft,
    found: { supplierEmail: string | null; leadTimeDays: number | null },
    sent: Sent,
  ) => void;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async ({ text, files }: PromptInputMessage) => {
    setMessage(null);
    setPending(true);
    try {
      const image = files[0]?.url ? await downsize(files[0].url) : undefined;
      const result = await extractCatalogDraft({ text, image });
      if (!result.ok) {
        setMessage(result.message);
        // Thrown so the input keeps what was typed and attached, ready to retry.
        throw new Error(result.message);
      }
      const photo = files[0]?.url
        ? { url: files[0].url, filename: files[0].filename, mediaType: files[0].mediaType }
        : null;
      onDraft(
        { rows: result.rows, currency: result.currency, truncated: result.truncated },
        { supplierEmail: result.supplierEmail, leadTimeDays: result.leadTimeDays },
        { text, photo },
      );
    } catch (error) {
      setMessage((current) =>
        current ?? (error instanceof PhotoError ? error.message : "Couldn't reach bran. Try again."),
      );
      throw error;
    } finally {
      setPending(false);
    }
  };

  return (
    <div>
      <Heading
        title="Import products"
        description="Paste a supplier's price list, an invoice or a message, or add a photo of one. You check every row before anything is added."
      />

      {available ? (
        <PromptInputProvider initialInput={initial?.text ?? ""}>
          <PromptInput
            className="mt-5"
            accept="image/*"
            maxFiles={1}
            maxFileSize={MAX_PHOTO_BYTES}
            onError={(error) =>
              setMessage(
                error.code === "max_files"
                  ? "One photo at a time."
                  : error.code === "max_file_size"
                    ? "That photo is over 20 MB."
                    : "Photos only — JPEG, PNG or WebP.",
              )
            }
            onSubmit={submit}
          >
            <RestorePhoto photo={initial?.photo ?? null} />
            <AttachedPhoto />
            <PromptInputBody>
              <PromptInputTextarea
                aria-label="The price list, invoice or message"
                placeholder={"Linen shirt, white, S/M/L — $85, MOQ 12\nWrap dress, one size — $142.50…"}
                className="min-h-32 text-[13px]"
                disabled={pending}
              />
            </PromptInputBody>
            <PromptInputFooter>
              <PromptInputTools>
                <AddPhoto disabled={pending} />
              </PromptInputTools>
              <PromptInputSubmit status={pending ? "submitted" : "ready"} disabled={pending} />
            </PromptInputFooter>
          </PromptInput>
          <p className="mt-2 text-[11px] text-muted-foreground">
            {pending
              ? "Reading… a long list can take half a minute."
              : "A photo is read and then discarded; bran doesn't keep it."}
          </p>
        </PromptInputProvider>
      ) : (
        // AI off is a normal state, said plainly — no input that goes nowhere.
        <p className="mt-5 text-[13px] text-muted-foreground">
          Import reads documents with AI, which isn&apos;t set up for this workspace. Use Add
          product to enter them one at a time.
        </p>
      )}

      {message ? (
        <p role="alert" className="mt-3 text-[12.5px] text-negative">
          {message}
        </p>
      ) : null}
    </div>
  );
}

function AddPhoto({ disabled }: { disabled: boolean }) {
  const attachments = usePromptInputAttachments();
  // Hidden rather than disabled once a photo is in: the input group fades
  // whole when any control in it is disabled, which should mean "busy".
  if (attachments.files.length > 0) return null;
  return (
    <PromptInputButton
      disabled={disabled}
      onClick={() => attachments.openFileDialog()}
      tooltip="Add a photo"
    >
      <ImagePlus className="size-4" />
      <span className="text-xs">Photo</span>
    </PromptInputButton>
  );
}

function AttachedPhoto() {
  const attachments = usePromptInputAttachments();
  if (attachments.files.length === 0) return null;
  return (
    <PromptInputHeader>
      <Attachments variant="inline">
        {attachments.files.map((file) => (
          <Attachment key={file.id} data={file} onRemove={() => attachments.remove(file.id)}>
            <AttachmentPreview />
            <AttachmentInfo />
            <AttachmentRemove />
          </Attachment>
        ))}
      </Attachments>
    </PromptInputHeader>
  );
}

/** Puts the photo from the last read back in the input after Back, once. */
function RestorePhoto({ photo }: { photo: Sent["photo"] }) {
  const attachments = usePromptInputAttachments();
  const restored = useRef(false);
  useEffect(() => {
    if (!photo || restored.current) return;
    restored.current = true;
    fetch(photo.url)
      .then((response) => response.blob())
      .then((blob) =>
        attachments.add([new File([blob], photo.filename ?? "photo", { type: photo.mediaType })]),
      )
      .catch(() => {
        // Losing the restored photo only means adding it again.
      });
  }, [photo, attachments]);
  return null;
}

class PhotoError extends Error {}

/**
 * A phone photo, shrunk and re-encoded as JPEG until it fits the Server
 * Action body limit: a few hundred KB instead of several MB, still plenty to
 * read print from. Drawn over white, so a transparent PNG doesn't turn into
 * dark text on black.
 */
async function downsize(url: string): Promise<string> {
  const image = new Image();
  image.src = url;
  try {
    await image.decode();
  } catch {
    throw new PhotoError("This browser can't open that photo. Try a JPEG or PNG.");
  }
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) throw new PhotoError("This browser can't prepare the photo. Paste the text instead.");

  for (const step of PHOTO_STEPS) {
    const scale = Math.min(1, step.edge / Math.max(image.naturalWidth, image.naturalHeight));
    canvas.width = Math.round(image.naturalWidth * scale);
    canvas.height = Math.round(image.naturalHeight * scale);
    context.fillStyle = "white";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", step.quality);
    if (dataUrl.length <= MAX_PHOTO_CHARS) return dataUrl;
  }
  throw new PhotoError("That photo is too detailed to send. Crop it to the list, or paste the text.");
}

// -------------------------------------------------------------- step 2 --

const COLUMNS: { field: DraftField; label: string; width: string; inputMode?: "decimal" | "numeric" }[] = [
  { field: "product", label: "Product", width: "w-56" },
  { field: "label", label: "Variant", width: "w-40" },
  { field: "sku", label: "SKU", width: "w-44" },
  { field: "unitCost", label: "Cost (TT$)", width: "w-24", inputMode: "decimal" },
  { field: "price", label: "Price (TT$)", width: "w-24", inputMode: "decimal" },
  { field: "onHand", label: "On hand", width: "w-20", inputMode: "numeric" },
  { field: "minOrderQty", label: "Min order", width: "w-20", inputMode: "numeric" },
];

function Review({
  draft,
  setRows,
  supplier,
  setSupplier,
  catalog,
  onBack,
  onDone,
}: {
  draft: Draft;
  setRows: (rows: DraftRow[]) => void;
  supplier: SupplierInput;
  setSupplier: (next: SupplierInput) => void;
  catalog: CatalogRow[];
  onBack: () => void;
  onDone: () => void;
}) {
  const [serverErrors, setServerErrors] = useState<Record<string, FieldErrors<DraftField>>>({});
  const [supplierErrors, setSupplierErrors] = useState<FieldErrors<ProductFields>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const existing = useMemo<ExistingCatalog>(() => {
    const products = new Map(catalog.map((row) => [row.productId, { id: row.productId, name: row.product }]));
    return { products: [...products.values()], skus: catalog.map((row) => row.sku) };
  }, [catalog]);

  const { rows } = draft;
  const check = checkDraft(rows, supplier, existing);
  // The server knows things the browser can't (a SKU taken since the draft);
  // a row it refused isn't ready until it's edited.
  const refused = rows.filter(
    (row) =>
      row.keep &&
      serverErrors[row.key] &&
      Object.keys(check.rows.get(row.key)?.errors ?? {}).length === 0,
  ).length;
  const readyRows = check.ready - refused;
  const ready = canImport(check) && refused === 0;
  // Shown whenever a new product needs them — or the server refused them anyway.
  const shownSupplierErrors = { ...check.supplier, ...supplierErrors };
  const needsSupplier =
    rows.some((row) => row.keep && !check.rows.get(row.key)?.joins) ||
    Object.keys(supplierErrors).length > 0;
  const foreign = draft.currency && draft.currency.toUpperCase() !== "TTD" ? draft.currency : null;

  const edit = (key: string, patch: Partial<DraftRow>) => {
    setRows(rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
    // What the server said about this row was about its old values.
    setServerErrors((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const submit = () => {
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await importCatalog({ rows, supplier });
        if (result.ok) {
          onDone();
          return;
        }
        setServerErrors(result.rowErrors ?? {});
        setSupplierErrors(result.supplierErrors ?? {});
        setMessage(result.message);
      } catch {
        setMessage("Couldn't reach bran. Nothing was imported — try again.");
      }
    });
  };

  if (rows.length === 0) {
    return (
      <div>
        <Heading title="No products found" description="bran couldn't find any products in that." />
        <p className="mt-5 text-[13px] text-muted-foreground">
          Try pasting just the rows of the list, or a clearer photo taken straight on.
        </p>
        <DialogFooter className="mt-5 -mx-5 -mb-5 px-5 pb-5">
          <Button type="button" variant="outline" onClick={onBack}>
            <ArrowLeft />
            Back
          </Button>
        </DialogFooter>
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <Heading
        title="Check the rows"
        description="Edit anything that's wrong and untick what you don't sell. Only ticked rows are imported."
      />

      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center">
          {rows.length} {rows.length === 1 ? "row" : "rows"} read from your document
          <AiMark title={AI_TITLE} label="Read by AI" />
        </span>
        {foreign ? (
          <StatusPill tone="warning">
            Money is in {foreign}. bran stores TT$ — convert cost and price first.
          </StatusPill>
        ) : null}
        {draft.truncated ? (
          <StatusPill tone="warning">Only the first 100 rows were read. Import the rest separately.</StatusPill>
        ) : null}
      </div>

      {needsSupplier ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-[10rem_18rem]">
          <SupplierField
            id="import-lead"
            label="Lead time (days)"
            value={supplier.leadTimeDays}
            error={shownSupplierErrors.leadTimeDays}
            hint="For every new product here."
            onChange={(leadTimeDays) => {
              setSupplier({ ...supplier, leadTimeDays });
              setSupplierErrors({});
            }}
            inputMode="numeric"
          />
          <SupplierField
            id="import-email"
            label="Supplier email"
            value={supplier.supplierEmail}
            error={shownSupplierErrors.supplierEmail}
            hint="Optional."
            onChange={(supplierEmail) => {
              setSupplier({ ...supplier, supplierEmail });
              setSupplierErrors({});
            }}
            inputMode="email"
          />
        </div>
      ) : null}

      <div className="mt-4 max-h-[55vh] overflow-auto rounded-lg border border-border">
        <table className="w-full table-fixed border-collapse text-xs">
          <colgroup>
            <col className="w-10" />
            {COLUMNS.map((column) => (
              <col key={column.field} className={column.width} />
            ))}
          </colgroup>
          <thead className="sticky top-0 z-10 bg-muted text-left text-[11px] font-medium text-muted-foreground">
            <tr>
              <th className="px-3 py-2">
                <span className="sr-only">Import</span>
              </th>
              {COLUMNS.map((column) => (
                <th key={column.field} className="px-1.5 py-2 font-medium">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const rowCheck = check.rows.get(row.key);
              const errors = { ...rowCheck?.errors, ...serverErrors[row.key] };
              return (
                <tr key={row.key} className="border-t border-border align-top">
                  <td className="px-3 py-2.5">
                    <Checkbox
                      checked={row.keep}
                      onCheckedChange={(checked) => edit(row.key, { keep: checked === true })}
                      aria-label={`Import row ${index + 1}`}
                    />
                  </td>
                  {COLUMNS.map((column) => (
                    <td key={column.field} className="px-1.5 py-1.5">
                      <Input
                        value={row[column.field]}
                        onChange={(event) =>
                          edit(row.key, {
                            [column.field]: event.target.value,
                            ...(column.field === "sku" ? { skuSuggested: false } : {}),
                          })
                        }
                        disabled={!row.keep}
                        inputMode={column.inputMode}
                        aria-label={`${column.label}, row ${index + 1}`}
                        aria-invalid={row.keep && errors[column.field] ? true : undefined}
                        className="h-8 px-2 text-xs"
                      />
                      {row.keep ? (
                        <CellNote
                          error={errors[column.field]}
                          note={
                            column.field === "product"
                              ? rowCheck?.joins
                                ? `Adds to ${rowCheck.joins.name}`
                                : "New product"
                              : column.field === "sku" && row.skuSuggested
                                ? "Suggested by bran"
                                : undefined
                          }
                        />
                      ) : null}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {message ? (
        <p role="alert" className="mt-3 text-[12.5px] text-negative">
          {message}
        </p>
      ) : null}

      <DialogFooter className="mt-5 -mx-5 -mb-5 items-center px-5 pb-5">
        <p className="mr-auto text-xs text-muted-foreground tabular-nums">
          {readyRows} of {check.kept} ticked {check.kept === 1 ? "row is" : "rows are"} ready
        </p>
        <Button type="button" variant="outline" onClick={onBack} disabled={pending}>
          <ArrowLeft />
          Back
        </Button>
        <LoadingButton type="button" pending={pending} pendingLabel="Importing" disabled={!ready} onClick={submit}>
          Import {check.kept}
        </LoadingButton>
      </DialogFooter>
    </div>
  );
}

function CellNote({ error, note }: { error?: string; note?: string }) {
  if (!error && !note) return null;
  return (
    <p className={`mt-1 px-0.5 text-[11px] leading-tight ${error ? "text-negative" : "text-muted-foreground"}`}>
      {error ?? note}
    </p>
  );
}

function SupplierField({
  id,
  label,
  value,
  error,
  hint,
  onChange,
  inputMode,
}: {
  id: string;
  label: string;
  value: string;
  error?: string;
  hint: string;
  onChange: (next: string) => void;
  inputMode: "numeric" | "email";
}) {
  return (
    <div>
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <Input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        inputMode={inputMode}
        aria-invalid={error ? true : undefined}
        aria-describedby={`${id}-note`}
        className="mt-1 h-9"
      />
      <p id={`${id}-note`} className={`mt-1 text-[11px] ${error ? "text-negative" : "text-muted-foreground"}`}>
        {error ?? hint}
      </p>
    </div>
  );
}
