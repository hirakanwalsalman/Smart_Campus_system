"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/useProfile";
import EquipmentForm from "@/components/EquipmentForm";

export default function EditEquipmentPage() {
  const { id } = useParams();
  const router = useRouter();
  const { loading, profile } = useProfile();
  const [item, setItem] = useState(null);
  const [fetching, setFetching] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!profile) return;

    async function loadItem() {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("equipment")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        setError("Could not load this equipment: " + error.message);
      } else {
        setItem(data);
      }
      setFetching(false);
    }
    loadItem();
  }, [profile, id]);

  async function handleSubmit(values) {
    setSaving(true);
    setError("");

    const supabase = createClient();
    const { data, error } = await supabase
      .from("equipment")
      .update(values)
      .eq("id", id)
      .select();

    setSaving(false);

    if (error) {
      // 23505 is the database's code for "this value already exists"
      setError(
        error.code === "23505"
          ? "That equipment ID is already used by another item."
          : error.message
      );
      return;
    }

    if (!data || data.length === 0) {
      setError("Nothing was updated. You may not have permission.");
      return;
    }

    router.push("/equipment");
  }

  if (loading || fetching) {
    return <main className="p-6">Loading...</main>;
  }

  if (profile?.role !== "admin") {
    return (
      <main className="p-6">
        <p>Only admins can edit equipment.</p>
        <Link href="/equipment" className="text-blue-700 underline">
          Back to equipment list
        </Link>
      </main>
    );
  }

  if (!item) {
    return (
      <main className="p-6">
        <p className="text-red-600">{error || "Equipment not found."}</p>
        <Link href="/equipment" className="text-blue-700 underline">
          Back to equipment list
        </Link>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-lg">
        <h1 className="text-2xl font-bold text-blue-700">Edit equipment</h1>
        <div className="mt-6">
          <EquipmentForm
            initialValues={{
              code: item.code,
              name: item.name,
              category: item.category,
              location: item.location,
              status: item.status,
            }}
            onSubmit={handleSubmit}
            submitLabel="Save changes"
            saving={saving}
            error={error}
          />
        </div>
        <Link href="/equipment" className="mt-4 block text-sm text-blue-700 underline">
          Cancel
        </Link>
      </div>
    </main>
  );
}