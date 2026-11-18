import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { RestaurantCover, RestaurantLogo } from "./RestaurantLogo";

const BUCKET = "restaurant-media";
const MEDIA_PREFIX = "/api/public/media/";
const MAX_BYTES = 8 * 1024 * 1024;

type Kind = "logo" | "cover";

/** Resize in the browser so uploads stay small: logos to a 512px square (PNG keeps transparency), covers to 1600px wide JPEG. */
async function prepareImage(file: File, kind: Kind): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  if (kind === "logo") {
    const size = 512;
    canvas.width = size;
    canvas.height = size;
    const scale = Math.max(size / bitmap.width, size / bitmap.height);
    const w = bitmap.width * scale, h = bitmap.height * scale;
    canvas.getContext("2d")!.drawImage(bitmap, (size - w) / 2, (size - h) / 2, w, h);
  } else {
    const w = Math.min(1600, bitmap.width);
    const h = Math.round((bitmap.height * w) / bitmap.width);
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
  }
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not read this image."))), kind === "logo" ? "image/png" : "image/jpeg", 0.85),
  );
}

export function RestaurantPhotosForm({
  restaurant,
}: {
  restaurant: { id: string; name: string; logo_url: string | null; cover_url: string | null };
}) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState<Kind | null>(null);
  const logoInput = useRef<HTMLInputElement>(null);
  const coverInput = useRef<HTMLInputElement>(null);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["my-restaurant"] });
    qc.invalidateQueries({ queryKey: ["restaurants"] });
    qc.invalidateQueries({ queryKey: ["restaurant"] });
  };

  const removeOld = async (url: string | null) => {
    if (!url?.startsWith(`${MEDIA_PREFIX}${restaurant.id}/`)) return;
    await supabase.storage.from(BUCKET).remove([url.slice(MEDIA_PREFIX.length)]);
  };

  const upload = async (kind: Kind, file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Please choose an image under 8 MB.");
      return;
    }
    setBusy(kind);
    try {
      const blob = await prepareImage(file, kind);
      const path = `${restaurant.id}/${kind}-${Date.now()}.${kind === "logo" ? "png" : "jpg"}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: blob.type, upsert: false });
      if (upErr) throw upErr;
      const url = `${MEDIA_PREFIX}${path}`;
      const { error } = await supabase.from("restaurants").update(kind === "logo" ? { logo_url: url } : { cover_url: url }).eq("id", restaurant.id);
      if (error) {
        await supabase.storage.from(BUCKET).remove([path]);
        throw error;
      }
      await removeOld(kind === "logo" ? restaurant.logo_url : restaurant.cover_url);
      toast.success(kind === "logo" ? "Logo updated." : "Cover photo updated.");
      refresh();
    } catch (e) {
      console.error(e);
      toast.error("The image could not be uploaded. Please try another one.");
    } finally {
      setBusy(null);
    }
  };

  const clear = async (kind: Kind) => {
    setBusy(kind);
    const old = kind === "logo" ? restaurant.logo_url : restaurant.cover_url;
    const { error } = await supabase.from("restaurants").update(kind === "logo" ? { logo_url: null } : { cover_url: null }).eq("id", restaurant.id);
    if (!error) await removeOld(old);
    setBusy(null);
    if (error) {
      toast.error("Could not remove the image.");
      return;
    }
    refresh();
  };

  return (
    <section className="surface space-y-5 p-5">
      <div>
        <h2 className="text-lg font-semibold">Logo and photo</h2>
        <p className="mt-1 text-xs text-muted-foreground">Shown to students next to your name and at the top of your page.</p>
      </div>

      <div className="flex items-center gap-4">
        <RestaurantLogo name={restaurant.name} logoUrl={restaurant.logo_url} size="lg" />
        <div className="flex flex-col items-start gap-1">
          <Button type="button" size="sm" variant="outline" disabled={busy !== null} onClick={() => logoInput.current?.click()}>
            {busy === "logo" ? "Uploading…" : restaurant.logo_url ? "Change logo" : "Upload logo"}
          </Button>
          {restaurant.logo_url ? (
            <Button type="button" size="sm" variant="ghost" disabled={busy !== null} onClick={() => clear("logo")}>Remove</Button>
          ) : null}
          <span className="text-xs text-muted-foreground">Square works best.</span>
        </div>
        <input ref={logoInput} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" aria-label="Upload logo"
          onChange={(e) => { void upload("logo", e.target.files?.[0]); e.target.value = ""; }} />
      </div>

      <div className="space-y-2">
        <RestaurantCover url={restaurant.cover_url} className="aspect-[16/9] rounded-lg border" />
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" variant="outline" disabled={busy !== null} onClick={() => coverInput.current?.click()}>
            {busy === "cover" ? "Uploading…" : restaurant.cover_url ? "Change cover photo" : "Upload cover photo"}
          </Button>
          {restaurant.cover_url ? (
            <Button type="button" size="sm" variant="ghost" disabled={busy !== null} onClick={() => clear("cover")}>Remove</Button>
          ) : null}
        </div>
        <span className="text-xs text-muted-foreground">A wide photo of your food, at least 1200 px across.</span>
        <input ref={coverInput} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" aria-label="Upload cover photo"
          onChange={(e) => { void upload("cover", e.target.files?.[0]); e.target.value = ""; }} />
      </div>
    </section>
  );
}
