"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/useProfile";
import EquipmentForm from "@/components/EquipmentForm";

export default function NewEquipmentPage() {
  const router = useRouter();
  const { loading, profile } = useProfile();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(values) {
    setSaving(true);
    setError("");

    const supabase = createClient();
    const { error } = await supabase.from("equipment").insert(values);

    setSaving(false);

    if (error) {
      // 23505 is the database's code for "this value already exists"
      setError(
        error.code === "23505"
          ? "That equipment ID already exists. Please use a different one."
          : error.message
      );
      return;
    }

    router.push("/equipment");
  }

  if (loading) {
    return <main className="p-6">Loading...</main>;
  }

  if (profile?.role !== "admin") {
    return (
      <main className="p-6">
        <p>Only admins can add equipment.</p>
        <Link href="/equipment" className="text-blue-700 underline">
          Back to equipment list
        </Link>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-lg">
        <h1 className="text-2xl font-bold text-blue-700">Add equipment</h1>
        <div className="mt-6">
          <EquipmentForm
            initialValues={{
              code: "",
              name: "",
              category: "",
              location: "",
              status: "working",
            }}
            onSubmit={handleSubmit}
            submitLabel="Add equipment"
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