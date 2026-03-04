import { ClerkLoaded, ClerkLoading, SignUp } from "@clerk/nextjs";

import { AuthFormSkeleton } from "@/features/auth/components/auth-form-skeleton";
import { AuthShell } from "@/features/auth/components/auth-shell";

export default function SignUpPage() {
  return (
    <AuthShell title="创建账号" subtitle="使用 Google 或 GitHub 创建账号，立即进入演示文稿工作区。">
      <ClerkLoading>
        <AuthFormSkeleton />
      </ClerkLoading>
      <ClerkLoaded>
        <div className="min-h-[520px] md:min-h-[560px]">
          <SignUp
            path="/sign-up"
            routing="path"
            signInUrl="/sign-in"
            fallbackRedirectUrl="/"
            appearance={{
              variables: {
                colorPrimary: "#0f172a",
                colorText: "#0f172a",
                borderRadius: "12px",
                fontFamily: "var(--font-open-sans)",
              },
              elements: {
                rootBox: "h-full w-full",
                cardBox: "h-full w-full",
                card: "h-full w-full rounded-2xl border border-slate-200 bg-white shadow-none",
                headerTitle: "font-semibold text-slate-900",
                headerSubtitle: "text-slate-500",
                socialButtonsBlockButton:
                  "h-11 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors",
                socialButtonsBlockButtonText: "text-sm font-medium text-slate-700",
                dividerText: "text-xs text-slate-400",
                footerActionText: "text-slate-500",
                footerActionLink: "text-slate-900 hover:text-slate-700",
              },
            }}
          />
        </div>
      </ClerkLoaded>
    </AuthShell>
  );
}
