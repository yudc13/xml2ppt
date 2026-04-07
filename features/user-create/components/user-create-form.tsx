"use client";

import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createUser } from "@/features/user-create/api/create-user";
import {
  createUserFormSchema,
  createUserRoleOptions,
  type CreateUserFormValues,
} from "@/features/user-create/schema";
import { createSubmitCreateUser } from "@/features/user-create/submit";

const roleLabelMap: Record<(typeof createUserRoleOptions)[number], string> = {
  admin: "管理员",
  editor: "编辑者",
  viewer: "只读用户",
};

const defaultValues: CreateUserFormValues = {
  username: "",
  email: "",
  role: "",
  password: "",
  confirmPassword: "",
};

export function UserCreateForm() {
  const form = useForm<CreateUserFormValues>({
    resolver: zodResolver(createUserFormSchema),
    defaultValues,
  });

  const submitCreateUser = useMemo(
    () =>
      createSubmitCreateUser({
        createUser,
        onSuccess: () => {
          toast.success("用户创建成功");
        },
        onError: (message) => {
          toast.error(message || "创建用户失败");
        },
      }),
    [],
  );

  const onSubmit = form.handleSubmit(async (values) => {
    const result = await submitCreateUser(values);

    if (!result.ok) {
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
    <form onSubmit={onSubmit} className="grid gap-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">创建用户</h1>
        <p className="mt-1 text-sm text-slate-500">填写以下信息，创建一个新用户账号。</p>
      </div>

      <div className="grid gap-2">
        <label htmlFor="username" className="text-sm font-medium text-slate-700">
          用户名
        </label>
        <Input id="username" placeholder="请输入用户名" {...form.register("username")} />
        {form.formState.errors.username ? (
          <p className="text-sm text-rose-600">{form.formState.errors.username.message}</p>
        ) : null}
      </div>

      <div className="grid gap-2">
        <label htmlFor="email" className="text-sm font-medium text-slate-700">
          邮箱
        </label>
        <Input id="email" type="email" placeholder="user@example.com" {...form.register("email")} />
        {form.formState.errors.email ? (
          <p className="text-sm text-rose-600">{form.formState.errors.email.message}</p>
        ) : null}
      </div>

      <div className="grid gap-2">
        <label htmlFor="role" className="text-sm font-medium text-slate-700">
          角色
        </label>
        <select
          id="role"
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring"
          {...form.register("role")}
        >
          <option value="">请选择角色</option>
          {createUserRoleOptions.map((role) => (
            <option key={role} value={role}>
              {roleLabelMap[role]}
            </option>
          ))}
        </select>
        {form.formState.errors.role ? (
          <p className="text-sm text-rose-600">{form.formState.errors.role.message}</p>
        ) : null}
      </div>

      <div className="grid gap-2">
        <label htmlFor="password" className="text-sm font-medium text-slate-700">
          密码
        </label>
        <Input id="password" type="password" placeholder="请输入密码" {...form.register("password")} />
        {form.formState.errors.password ? (
          <p className="text-sm text-rose-600">{form.formState.errors.password.message}</p>
        ) : null}
      </div>

      <div className="grid gap-2">
        <label htmlFor="confirmPassword" className="text-sm font-medium text-slate-700">
          确认密码
        </label>
        <Input
          id="confirmPassword"
          type="password"
          placeholder="请再次输入密码"
          {...form.register("confirmPassword")}
        />
        {form.formState.errors.confirmPassword ? (
          <p className="text-sm text-rose-600">{form.formState.errors.confirmPassword.message}</p>
        ) : null}
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "创建中..." : "创建用户"}
        </Button>
      </div>
    </form>
  );
}
