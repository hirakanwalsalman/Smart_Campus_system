"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/useProfile";

const MAX_PHOTO_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export default function ReportPage() {
  const { loading, profile } = useProfile();

  const [equipment, setEquipment] = useState([]);
  const [equipmentId, setEquipmentId] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [photo, setPhoto] = useState(null);
  const [fileInputKey, setFileInputKey] = useState(0);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  // Load the equipment list for the dropdown
  useEffect(() => {
    if (!profile) return;

    async function loadEquipment() {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("equipment")
        .select("id, code, name, location")
        .neq("status", "retired")
        .order("code");

      if (error) {
        setError("Could not load equipment: " + error.message);
      } else {
        setEquipment(data);
      }
    }
    loadEquipment();
  }, [profile]);

  function resetForm() {
    setEquipmentId("");
    setDescription("");
    setPriority("medium");
    setPhoto(null);
    setFileInputKey((k) => k + 1); // clears the file picker
    setError("");
    setSubmitted(false);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (description.trim().length < 10) {
      setError("Please describe the problem in at least 10 characters.");
      return;
    }

    if (photo) {
      if (!ALLOWED_TYPES[photo.type]) {
        setError("The photo must be a JPG, PNG or WebP image.");
        return;
      }
      if (photo.size > MAX_PHOTO_BYTES) {
        setError("The photo is too large. Please choose one under 10 MB.");
        return;
      }
    }

    setSaving(true);
    const supabase = createClient();

    // Step 1: upload the photo (if there is one) into this user's own folder
    let photoPath = null;
    if (photo) {
      photoPath = `${profile.id}/${crypto.randomUUID()}.${ALLOWED_TYPES[photo.type]}`;
      const { error: uploadError } = await supabase.storage
        .from("complaint-photos")
        .upload(photoPath, photo, { contentType: photo.type });

      if (uploadError) {
        setSaving(false);
        setError("Photo upload failed: " + uploadError.message);
        return;
      }
    }

    // Step 2: save the complaint
    const { error: insertError } = await supabase.from("complaints").insert({
      equipment_id: equipmentId,
      description: description.trim(),
      priority,
      photo_path: photoPath,
    });

    if (insertError) {
      // Clean up the photo so we don't leave an unused file behind
      if (photoPath) {
        await supabase.storage.from("complaint-photos").remove([photoPath]);
      }
      setSaving(false);
      setError("Could not submit your report: " + insertError.message);
      return;
    }

    setSaving(false);
    setSubmitted(true);
  }

  if (loading) {
    return <main className="p-6">Loading...</main>;
  }

  if (submitted) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-md rounded-xl bg-white p-8 text-center shadow-lg">
          <h1 className="text-2xl font-bold text-green-700">Report submitted</h1>
          <p className="mt-3 text-slate-600">
            Thank you. Your complaint has been recorded with the status Pending.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              onClick={resetForm}
              className="rounded-lg bg-blue-600 px-5 py-2 font-medium text-white hover:bg-blue-700"
            >
              Report another issue
            </button>
            <Link
              href="/dashboard"
              className="rounded-lg border border-slate-300 px-5 py-2 font-medium hover:bg-slate-100"
            >
              Back to dashboard
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const inputClass = "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2";

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-lg">
        <h1 className="text-2xl font-bold text-blue-700">Report an issue</h1>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium">Which equipment has the problem?</label>
            <select
              required
              value={equipmentId}
              onChange={(e) => setEquipmentId(e.target.value)}
              className={inputClass}
            >
              <option value="">Select equipment...</option>
              {equipment.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.code} - {item.name} ({item.location})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium">What is the problem?</label>
            <textarea
              required
              rows={4}
              placeholder="Describe what is wrong, for example: projector turns on but shows no image."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-sm font-medium">Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className={inputClass}
            >
              <option value="low">Low - can wait</option>
              <option value="medium">Medium - normal</option>
              <option value="high">High - urgent</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium">Photo (optional)</label>
            <input
              key={fileInputKey}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => setPhoto(e.target.files[0] ?? null)}
              className="mt-1 block w-full text-sm"
            />
            <p className="mt-1 text-xs text-slate-500">
              JPG, PNG or WebP, up to 10 MB. Please photograph the equipment, not people.
            </p>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-lg bg-blue-600 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Submitting..." : "Submit report"}
          </button>
        </form>

        <Link href="/dashboard" className="mt-4 block text-sm text-blue-700 underline">
          Cancel
        </Link>
      </div>
    </main>
  );
}