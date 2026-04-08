import { createUserFormSchema, type CreateUserFormValues, type CreateUserPayload } from "@/features/user-create/schema";

export type SubmitCreateUserResult =
  | { ok: true }
  | {
      ok: false;
      reason: "validation" | "submitting" | "request";
      fieldErrors?: Record<string, string[] | undefined>;
      message?: string;
    };

type CreateSubmitCreateUserOptions = {
  createUser: (payload: CreateUserPayload) => Promise<unknown>;
  onSuccess?: () => void;
  onError?: (message: string) => void;
};

export function createSubmitCreateUser(options: CreateSubmitCreateUserOptions) {
  let isSubmitting = false;

  return async function submitCreateUser(values: CreateUserFormValues): Promise<SubmitCreateUserResult> {
    if (isSubmitting) {
      return {
        ok: false,
        reason: "submitting",
        message: "正在提交，请稍候",
      };
    }

    const parsed = createUserFormSchema.safeParse(values);
    if (!parsed.success) {
      return {
        ok: false,
        reason: "validation",
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }

    const { confirmPassword: _confirmPassword, ...payload } = parsed.data;

    isSubmitting = true;
    try {
      await options.createUser(payload);
      options.onSuccess?.();
      return { ok: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : "创建用户失败";
      options.onError?.(message);
      return {
        ok: false,
        reason: "request",
        message,
      };
    } finally {
      isSubmitting = false;
    }
  };
}
