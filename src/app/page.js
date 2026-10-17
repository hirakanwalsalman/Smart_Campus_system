import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl bg-white p-8 text-center shadow-lg">
        <h1 className="text-2xl font-bold text-blue-700">
          Smart Campus Maintenance
        </h1>
        <p className="mt-3 text-slate-600">
          Report campus issues and keep equipment working.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link
            href="/login"
            className="rounded-lg bg-blue-600 px-5 py-2 font-medium text-white hover:bg-blue-700"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="rounded-lg border border-blue-600 px-5 py-2 font-medium text-blue-700 hover:bg-blue-50"
          >
            Sign up
          </Link>
        </div>
      </div>
    </main>
  );
}