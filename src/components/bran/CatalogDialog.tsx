"use client";

import { useState, useTransition } from "react";
import { Package, Pencil, Plus, SquarePen } from "lucide-react";
import { createProduct, createVariant, updateProduct, updateVariant } from "@/actions/catalog";
import { LoadingButton } from "@/components/bran/LoadingButton";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { CatalogRow } from "@/lib/catalog";
import {
  formatMoneyInput,
  parseProduct,
  parseVariant,
  type FieldErrors,
  type ProductFields,
  type ProductInput,
  type VariantFields,
  type VariantInput,
} from "@/lib/catalog-input";

export type DialogState =
  | { kind: "create-product" }
  | { kind: "edit-product"; row: CatalogRow }
  | { kind: "add-variant"; row: CatalogRow }
  | { kind: "edit-variant"; row: CatalogRow }
  | null;

type Fields = ProductFields | VariantFields;

const EMPTY_PRODUCT: ProductInput = { name: "", leadTimeDays: "21", supplierEmail: "" };
const EMPTY_VARIANT: VariantInput = {
  label: "",
  sku: "",
  unitCost: "",
  price: "",
  onHand: "0",
  minOrderQty: "5",
};

/**
 * Create and edit, in one modal over the list (app-ui §7).
 *
 * Keyed on what it's editing, so reopening it on another row never shows the
 * last row's values. The form validates with the same parser the server
 * runs, so most mistakes are caught before the round trip; the server's
 * answer still wins (a duplicate SKU is only knowable there).
 */
export function CatalogDialog({ state, onClose }: { state: DialogState; onClose: () => void }) {
  const key = state ? `${state.kind}:${"row" in state ? state.row.variantId : "new"}` : "closed";
  return (
    <Dialog open={state !== null} onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent className="p-5 sm:max-w-lg">
        {state ? <CatalogForm key={key} state={state} onDone={onClose} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function CatalogForm({
  state,
  onDone,
}: {
  state: NonNullable<DialogState>;
  onDone: () => void;
}) {
  const row = "row" in state ? state.row : null;
  const showsProduct = state.kind === "create-product" || state.kind === "edit-product";
  const showsVariant = state.kind !== "edit-product";

  const [product, setProduct] = useState<ProductInput>(() =>
    row
      ? {
          name: row.product,
          leadTimeDays: String(row.leadTimeDays),
          supplierEmail: row.supplierEmail ?? "",
        }
      : EMPTY_PRODUCT,
  );
  const [variant, setVariant] = useState<VariantInput>(() =>
    row && state.kind === "edit-variant"
      ? {
          label: row.label,
          sku: row.sku,
          unitCost: formatMoneyInput(row.unitCostCents),
          price: formatMoneyInput(row.priceCents),
          onHand: String(row.onHand),
          minOrderQty: String(row.minOrderQty),
        }
      : row
        ? // A new size of an existing product usually costs and sells the same.
          {
            ...EMPTY_VARIANT,
            unitCost: formatMoneyInput(row.unitCostCents),
            price: formatMoneyInput(row.priceCents),
            minOrderQty: String(row.minOrderQty),
          }
        : EMPTY_VARIANT,
  );
  const [errors, setErrors] = useState<FieldErrors<Fields>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const copy = COPY[state.kind](row);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const local: FieldErrors<Fields> = {
      ...(showsProduct ? errorsOf(parseProduct(product)) : {}),
      ...(showsVariant ? errorsOf(parseVariant(variant)) : {}),
    };
    setErrors(local);
    setMessage(null);
    if (Object.keys(local).length > 0) return;

    startTransition(async () => {
      const result =
        state.kind === "create-product"
          ? await createProduct(product, variant)
          : state.kind === "edit-product"
            ? await updateProduct(state.row.productId, product)
            : state.kind === "add-variant"
              ? await createVariant(state.row.productId, variant)
              : await updateVariant(state.row.variantId, variant);
      if (result.ok) {
        onDone();
        return;
      }
      setErrors(result.errors);
      setMessage(result.message ?? null);
    });
  };

  const field = <K extends Fields>(
    name: K,
    label: string,
    value: string,
    onChange: (next: string) => void,
    options: { hint?: string; inputMode?: "numeric" | "decimal" | "email"; placeholder?: string } = {},
  ) => {
    // The label names the field and nothing else; the hint or the error is
    // read after it, as its description, rather than folded into its name.
    const id = `catalog-${name}`;
    const note = errors[name] ?? options.hint;
    return (
      <div>
        <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
          {label}
        </label>
        <Input
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          inputMode={options.inputMode}
          placeholder={options.placeholder}
          aria-invalid={errors[name] ? true : undefined}
          aria-describedby={note ? `${id}-note` : undefined}
          className="mt-1 h-9"
        />
        {note ? (
          <p
            id={`${id}-note`}
            className={`mt-1 text-[11px] ${errors[name] ? "text-negative" : "text-muted-foreground"}`}
          >
            {note}
          </p>
        ) : null}
      </div>
    );
  };

  const setP = (key: keyof ProductInput) => (next: string) => setProduct((p) => ({ ...p, [key]: next }));
  const setV = (key: keyof VariantInput) => (next: string) => setVariant((v) => ({ ...v, [key]: next }));

  return (
    <form onSubmit={submit} noValidate>
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground [&_svg]:size-4">
          {copy.icon}
        </span>
        <div className="min-w-0">
          <DialogTitle className="text-base font-semibold">{copy.title}</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {copy.description}
          </DialogDescription>
        </div>
      </div>

      <div className="mt-5 space-y-3.5">
        {showsProduct ? (
          <>
            {field("name", "Product name", product.name, setP("name"), {
              placeholder: "Tobago triangle top",
            })}
            <div className="grid gap-3.5 sm:grid-cols-2">
              {field("leadTimeDays", "Lead time (days)", product.leadTimeDays, setP("leadTimeDays"), {
                inputMode: "numeric",
                hint: "Order to shelf. Restock orders for this plus a month.",
              })}
              {field("supplierEmail", "Supplier email", product.supplierEmail, setP("supplierEmail"), {
                inputMode: "email",
                hint: "Optional.",
              })}
            </div>
          </>
        ) : null}

        {showsProduct && showsVariant ? (
          <p className="border-t border-border pt-3.5 text-xs font-medium">First variant</p>
        ) : null}

        {showsVariant ? (
          <>
            <div className="grid gap-3.5 sm:grid-cols-2">
              {field("label", "Variant", variant.label, setV("label"), { placeholder: "Black · S" })}
              {field("sku", "SKU", variant.sku, setV("sku"), { placeholder: "FLV-TRI-BLK-S" })}
            </div>
            <div className="grid gap-3.5 sm:grid-cols-2">
              {field("unitCost", "Unit cost (TT$)", variant.unitCost, setV("unitCost"), {
                inputMode: "decimal",
                hint: "What one costs you, landed.",
              })}
              {field("price", "Price (TT$)", variant.price, setV("price"), { inputMode: "decimal" })}
            </div>
            <div className="grid gap-3.5 sm:grid-cols-2">
              {field("onHand", "On hand", variant.onHand, setV("onHand"), {
                inputMode: "numeric",
                hint: "What's on the shelf now.",
              })}
              {field("minOrderQty", "Minimum order", variant.minOrderQty, setV("minOrderQty"), {
                inputMode: "numeric",
                hint: "The supplier's smallest run.",
              })}
            </div>
          </>
        ) : null}
      </div>

      {message ? (
        <p role="alert" className="mt-4 text-[12.5px] text-negative">
          {message}
        </p>
      ) : null}

      <DialogFooter className="mt-5 -mx-5 -mb-5 px-5 pb-5">
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <LoadingButton type="submit" pending={pending} pendingLabel="Saving">
          {copy.submit}
        </LoadingButton>
      </DialogFooter>
    </form>
  );
}

const COPY: Record<
  NonNullable<DialogState>["kind"],
  (row: CatalogRow | null) => { icon: React.ReactNode; title: string; description: string; submit: string }
> = {
  "create-product": () => ({
    icon: <Package />,
    title: "Add a product",
    description: "The product and its first size or colour. Add more variants from its row.",
    submit: "Add product",
  }),
  "edit-product": (row) => ({
    icon: <SquarePen />,
    title: row?.product ?? "Edit product",
    description: "Changes apply to every variant of this product.",
    submit: "Save product",
  }),
  "add-variant": (row) => ({
    icon: <Plus />,
    title: `Add a variant to ${row?.product ?? "this product"}`,
    description: "Cost, price and minimum order start from the row you picked.",
    submit: "Add variant",
  }),
  "edit-variant": (row) => ({
    icon: <Pencil />,
    title: row ? `${row.product} · ${row.label}` : "Edit variant",
    description: "Stock, cost and price feed restock on the next load.",
    submit: "Save variant",
  }),
};

function errorsOf<K extends string>(
  result: { ok: true } | { ok: false; errors: FieldErrors<K> },
): FieldErrors<K> {
  return result.ok ? {} : result.errors;
}
