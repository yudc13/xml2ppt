import { z } from "zod";

export const createUserRoleOptions = ["admin", "editor", "viewer"] as const;

const createUserRoleSchema = z.enum(createUserRoleOptions, {
  error: "请选择有效角色",
});

export const createUserFormSchema = z
  .object({
    username: z
      .string({ error: "请输入用户名" })
      .trim()
      .min(1, "请输入用户名")
      .min(3, "用户名长度至少 3 位")
      .max(20, "用户名长度不能超过 20 位"),
    email: z
      .string({ error: "请输入邮箱" })
      .trim()
      .min(1, "请输入邮箱")
      .email("请输入有效邮箱地址"),
    role: z
      .string({ error: "请选择角色" })
      .trim()
      .min(1, "请选择角色")
      .pipe(createUserRoleSchema),
    password: z
      .string({ error: "请输入密码" })
      .min(1, "请输入密码")
      .min(8, "密码长度至少 8 位"),
    confirmPassword: z.string({ error: "请确认密码" }).min(1, "请确认密码"),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "两次密码输入必须一致",
  });

export type CreateUserRole = z.infer<typeof createUserRoleSchema>;
export type CreateUserFormValues = z.input<typeof createUserFormSchema>;
export type CreateUserFormOutput = z.output<typeof createUserFormSchema>;
export type CreateUserPayload = Omit<CreateUserFormOutput, "confirmPassword">;
