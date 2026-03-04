import { SignUp } from "@clerk/nextjs";

import { AuthShell } from "@/features/auth/components/auth-shell";

export default function SignUpPage() {
  return (
    <AuthShell title="创建账号" subtitle="使用 Google 或 GitHub 创建账号，立即进入演示文稿工作区。">
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
            rootBox: "w-full",
            cardBox: "w-full",
            card: "w-full rounded-2xl border border-slate-200 bg-white shadow-none",
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
    </AuthShell>
  );
}
