"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createUser } from "@/features/user-create/api/create-user";
import {
  createUserFormSchema,
  createUserRoleOptions,
  type CreateUserFormValues,
} from "@/features/user-create/schema";
import { createSubmitCreateUser } from "@/features/user-create/submit";

const defaultValues: CreateUserFormValues = {
  username: "",
  email: "",
  role: "",
  password: "",
  confirmPassword: "",
};

type InlineStatus = {
  tone: "neutral" | "success" | "error";
  text: string;
};

export function UserCreateForm() {
  const [status, setStatus] = useState<InlineStatus | null>(null);
  const form = useForm<CreateUserFormValues>({
    resolver: zodResolver(createUserFormSchema),
    defaultValues,
  });

  const submitCreateUser = useMemo(
    () =>
      createSubmitCreateUser({
        createUser,
        onSuccess: () => {
          setStatus({ tone: "success", text: "[SAVED]" });
        },
        onError: (message) => {
          setStatus({ tone: "error", text: `[ERROR: ${message || "创建用户失败"}]` });
        },
      }),
    [],
  );

  const onSubmit = form.handleSubmit(async (values) => {
    const result = await submitCreateUser(values);

    if (!result.ok) {
      if (result.reason === "submitting") {
        setStatus({ tone: "neutral", text: "[LOADING...]" });
      }
      if (result.reason === "validation" && result.fieldErrors) {
        for (const [name, messages] of Object.entries(result.fieldErrors)) {
          if (!messages?.length) continue;
          form.setError(name as keyof CreateUserFormValues, { message: messages[0] });
        }
      }
      return;
    }

    form.reset(defaultValues);
  });

  return (
    <form
      onSubmit={onSubmit}
      className="relative grid gap-8 rounded-2xl border border-[#333333] bg-[#111111] p-6 md:p-8"
      style={{ fontFamily: "var(--font-space-grotesk)" }}
    >
      <div className="grid gap-2">
        <p
          className="text-[11px] tracking-[0.08em] text-[#999999] uppercase"
          style={{ fontFamily: "var(--font-space-mono)" }}
        >
          SYSTEM / USER PROVISION
        </p>
        <h1 className="text-4xl leading-none font-medium tracking-[-0.02em] text-[#FFFFFF] md:text-5xl">
          CREATE USER
        </h1>
        <p className="max-w-xl text-sm text-[#999999]">
          使用严格参数创建用户记录。输入值会在提交前执行本地校验，确认后写入 API payload。
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div className="grid gap-2">
          <label
            htmlFor="username"
            className="text-[11px] tracking-[0.08em] text-[#999999] uppercase"
            style={{ fontFamily: "var(--font-space-mono)" }}
          >
            USERNAME
          </label>
          <Input
            id="username"
            placeholder="operator_01"
            className="h-11 rounded-lg border-[#333333] bg-[#111111] px-0 text-[15px] text-[#E8E8E8] shadow-none [font-family:var(--font-space-mono)] placeholder:text-[#666666] focus-visible:border-[#E8E8E8] focus-visible:ring-0"
            {...form.register("username")}
          />
          {form.formState.errors.username ? (
            <p
              className="text-[12px] tracking-[0.04em] text-[#D71921] uppercase"
              style={{ fontFamily: "var(--font-space-mono)" }}
            >
              [ERROR: {form.formState.errors.username.message}]
            </p>
          ) : null}
        </div>

        <div className="grid gap-2">
          <label
            htmlFor="email"
            className="text-[11px] tracking-[0.08em] text-[#999999] uppercase"
            style={{ fontFamily: "var(--font-space-mono)" }}
          >
            EMAIL
          </label>
          <Input
            id="email"
            type="email"
            placeholder="user@example.com"
            className="h-11 rounded-lg border-[#333333] bg-[#111111] px-0 text-[15px] text-[#E8E8E8] shadow-none [font-family:var(--font-space-mono)] placeholder:text-[#666666] focus-visible:border-[#E8E8E8] focus-visible:ring-0"
            {...form.register("email")}
          />
          {form.formState.errors.email ? (
            <p
              className="text-[12px] tracking-[0.04em] text-[#D71921] uppercase"
              style={{ fontFamily: "var(--font-space-mono)" }}
            >
              [ERROR: {form.formState.errors.email.message}]
            </p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        <div className="grid gap-2 md:col-span-1">
          <label
            htmlFor="role"
            className="text-[11px] tracking-[0.08em] text-[#999999] uppercase"
            style={{ fontFamily: "var(--font-space-mono)" }}
          >
            ROLE
          </label>
          <select
            id="role"
            className="h-11 rounded-lg border border-[#333333] bg-[#111111] px-3 text-[14px] text-[#E8E8E8] outline-none transition-colors [font-family:var(--font-space-mono)] focus:border-[#E8E8E8]"
            {...form.register("role")}
          >
            <option className="bg-[#111111]" value="">
              SELECT
            </option>
            {createUserRoleOptions.map((role) => (
              <option className="bg-[#111111]" key={role} value={role}>
                {role.toUpperCase()}
              </option>
            ))}
          </select>
          {form.formState.errors.role ? (
            <p
              className="text-[12px] tracking-[0.04em] text-[#D71921] uppercase"
              style={{ fontFamily: "var(--font-space-mono)" }}
            >
              [ERROR: {form.formState.errors.role.message}]
            </p>
          ) : null}
        </div>

        <div className="grid gap-2">
          <label
            htmlFor="password"
            className="text-[11px] tracking-[0.08em] text-[#999999] uppercase"
            style={{ fontFamily: "var(--font-space-mono)" }}
          >
            PASSWORD
          </label>
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            className="h-11 rounded-lg border-[#333333] bg-[#111111] px-0 text-[15px] text-[#E8E8E8] shadow-none [font-family:var(--font-space-mono)] placeholder:text-[#666666] focus-visible:border-[#E8E8E8] focus-visible:ring-0"
            {...form.register("password")}
          />
          {form.formState.errors.password ? (
            <p
              className="text-[12px] tracking-[0.04em] text-[#D71921] uppercase"
              style={{ fontFamily: "var(--font-space-mono)" }}
            >
              [ERROR: {form.formState.errors.password.message}]
            </p>
          ) : null}
        </div>

        <div className="grid gap-2">
          <label
            htmlFor="confirmPassword"
            className="text-[11px] tracking-[0.08em] text-[#999999] uppercase"
            style={{ fontFamily: "var(--font-space-mono)" }}
          >
            CONFIRM
          </label>
          <Input
            id="confirmPassword"
            type="password"
            placeholder="••••••••"
            className="h-11 rounded-lg border-[#333333] bg-[#111111] px-0 text-[15px] text-[#E8E8E8] shadow-none [font-family:var(--font-space-mono)] placeholder:text-[#666666] focus-visible:border-[#E8E8E8] focus-visible:ring-0"
            {...form.register("confirmPassword")}
          />
          {form.formState.errors.confirmPassword ? (
            <p
              className="text-[12px] tracking-[0.04em] text-[#D71921] uppercase"
              style={{ fontFamily: "var(--font-space-mono)" }}
            >
              [ERROR: {form.formState.errors.confirmPassword.message}]
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-[#222222] pt-5">
        <p
          className={`text-[11px] tracking-[0.08em] uppercase ${
            status?.tone === "error"
              ? "text-[#D71921]"
              : status?.tone === "success"
                ? "text-[#E8E8E8]"
                : "text-[#666666]"
          }`}
          style={{ fontFamily: "var(--font-space-mono)" }}
        >
          {status?.text ?? "[READY]"}
        </p>

        <Button
          type="submit"
          disabled={form.formState.isSubmitting}
          className="h-11 rounded-full border border-[#E8E8E8] bg-[#E8E8E8] px-6 text-[12px] tracking-[0.08em] text-[#000000] uppercase transition-colors [font-family:var(--font-space-mono)] hover:bg-[#FFFFFF]"
        >
          {form.formState.isSubmitting ? "SUBMITTING" : "CREATE USER"}
        </Button>
      </div>
    </form>
  );
}
