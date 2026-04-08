import { UserCreateForm } from "@/features/user-create/components/user-create-form";

export default function UserCreatePage() {
  return (
    <main className="min-h-screen bg-[#000000] text-[#E8E8E8]">
      <div className="relative mx-auto w-full max-w-4xl px-6 py-12">
        <div
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            backgroundImage: "radial-gradient(circle, #333333 1px, transparent 1px)",
            backgroundSize: "16px 16px",
          }}
          aria-hidden
        />
        <UserCreateForm />
      </div>
    </main>
  );
}
