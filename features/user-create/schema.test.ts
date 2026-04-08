import { describe, expect, test } from "bun:test";

import { createUserFormSchema } from "@/features/user-create/schema";

describe("createUserFormSchema", () => {
  test("requires all required fields", () => {
    const parsed = createUserFormSchema.safeParse({});

    expect(parsed.success).toBe(false);
    if (parsed.success) return;

    expect(parsed.error.flatten().fieldErrors.username?.length).toBeGreaterThan(0);
    expect(parsed.error.flatten().fieldErrors.email?.length).toBeGreaterThan(0);
    expect(parsed.error.flatten().fieldErrors.role?.length).toBeGreaterThan(0);
    expect(parsed.error.flatten().fieldErrors.password?.length).toBeGreaterThan(0);
    expect(parsed.error.flatten().fieldErrors.confirmPassword?.length).toBeGreaterThan(0);
  });

  test("validates username length", () => {
    const tooShort = createUserFormSchema.safeParse({
      username: "ab",
      email: "user@example.com",
      role: "admin",
      password: "password123",
      confirmPassword: "password123",
    });

    expect(tooShort.success).toBe(false);

    const tooLong = createUserFormSchema.safeParse({
      username: "a".repeat(21),
      email: "user@example.com",
      role: "admin",
      password: "password123",
      confirmPassword: "password123",
    });

    expect(tooLong.success).toBe(false);
  });

  test("validates email format", () => {
    const parsed = createUserFormSchema.safeParse({
      username: "validname",
      email: "not-an-email",
      role: "admin",
      password: "password123",
      confirmPassword: "password123",
    });

    expect(parsed.success).toBe(false);
  });

  test("requires role selection", () => {
    const parsed = createUserFormSchema.safeParse({
      username: "validname",
      email: "user@example.com",
      role: "",
      password: "password123",
      confirmPassword: "password123",
    });

    expect(parsed.success).toBe(false);
  });

  test("validates password length", () => {
    const parsed = createUserFormSchema.safeParse({
      username: "validname",
      email: "user@example.com",
      role: "admin",
      password: "1234567",
      confirmPassword: "1234567",
    });

    expect(parsed.success).toBe(false);
  });

  test("requires confirmPassword to match password", () => {
    const parsed = createUserFormSchema.safeParse({
      username: "validname",
      email: "user@example.com",
      role: "admin",
      password: "password123",
      confirmPassword: "password456",
    });

    expect(parsed.success).toBe(false);
    if (parsed.success) return;

    expect(parsed.error.flatten().fieldErrors.confirmPassword?.[0]).toContain("一致");
  });
});
