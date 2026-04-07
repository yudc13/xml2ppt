import { describe, expect, mock, test } from "bun:test";

import { createSubmitCreateUser } from "@/features/user-create/submit";

const validValues = {
  username: "validname",
  email: "user@example.com",
  role: "admin" as const,
  password: "password123",
  confirmPassword: "password123",
};

describe("createSubmitCreateUser", () => {
  test("does not submit when validation fails", async () => {
    const createUser = mock(async () => ({ id: "user-1" }));
    const submitCreateUser = createSubmitCreateUser({ createUser });

    const result = await submitCreateUser({ ...validValues, email: "invalid-email" });

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.reason).toBe("validation");
    expect(createUser).toHaveBeenCalledTimes(0);
  });

  test("calls createUser when validation passes", async () => {
    const createUser = mock(async () => ({ id: "user-1" }));
    const submitCreateUser = createSubmitCreateUser({ createUser });

    const result = await submitCreateUser(validValues);

    expect(result.ok).toBe(true);
    expect(createUser).toHaveBeenCalledTimes(1);
  });

  test("submits payload without confirmPassword", async () => {
    const createUser = mock(async () => ({ id: "user-1" }));
    const submitCreateUser = createSubmitCreateUser({ createUser });

    await submitCreateUser(validValues);

    const payload = createUser.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload).toBeDefined();
    expect(Object.hasOwn(payload, "confirmPassword")).toBe(false);
    expect(payload.username).toBe(validValues.username);
    expect(payload.email).toBe(validValues.email);
    expect(payload.role).toBe(validValues.role);
    expect(payload.password).toBe(validValues.password);
  });

  test("prevents duplicate submission while pending", async () => {
    let resolveRequest: (value: { id: string }) => void = () => {};
    const createUser = mock(
      () =>
        new Promise<{ id: string }>((resolve) => {
          resolveRequest = resolve;
        }),
    );

    const submitCreateUser = createSubmitCreateUser({ createUser });

    const first = submitCreateUser(validValues);
    const second = await submitCreateUser(validValues);

    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.reason).toBe("submitting");
    }

    expect(createUser).toHaveBeenCalledTimes(1);

    resolveRequest({ id: "user-1" });
    await first;
  });

  test("triggers success callback", async () => {
    const createUser = mock(async () => ({ id: "user-1" }));
    const onSuccess = mock(() => {});
    const onError = mock((_message: string) => {});
    const submitCreateUser = createSubmitCreateUser({ createUser, onSuccess, onError });

    await submitCreateUser(validValues);

    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledTimes(0);
  });

  test("triggers error callback on submit failure", async () => {
    const createUser = mock(async () => {
      throw new Error("create failed");
    });
    const onSuccess = mock(() => {});
    const onError = mock((_message: string) => {});
    const submitCreateUser = createSubmitCreateUser({ createUser, onSuccess, onError });

    const result = await submitCreateUser(validValues);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("request");
    }
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledTimes(0);
  });
});
