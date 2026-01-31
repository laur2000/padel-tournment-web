"use server";

import { z } from "zod";
import * as argon2 from "argon2";
import { prisma } from "@/lib/prisma";

const RegisterSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export async function registerUser(prevState: any, formData: FormData) {
  const validatedFields = RegisterSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: "Missing Fields. Failed to Register.",
    };
  }

  const { name, email, password } = validatedFields.data;

  try {
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return {
        message: "Email already in use.",
      };
    }

    const hashedPassword = await argon2.hash(password);

    await prisma.user.create({
      data: {
        name,
        email,
        hashedPassword,
      },
    });

    return { message: "User created successfully." };
  } catch (error) {
    console.error("Registration error:", error);
    return {
      message: "Database Error: Failed to Create User.",
    };
  }
}
