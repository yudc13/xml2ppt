import { requestJson } from "@/features/shared/api/request-json";
import type { CreateUserPayload, CreateUserRole } from "@/features/user-create/schema";

export type CreateUserResponse = {
  ok: true;
  user: {
    id: string;
    username: string;
    email: string;
    role: CreateUserRole;
  };
};

export async function createUser(payload: CreateUserPayload) {
  return requestJson<CreateUserResponse>("/api/users", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}
