"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function updateProfileImage(base64Image: string) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  // Basic validation (though frontend should handle size limit, backend should too strictly speaking, 
  // but checking base64 length is a rough proxy. 1MB ~ 1.33MB base64 string)
  if (base64Image.length > 2 * 1024 * 1024) { // Generous 2MB limit for base64 string overhead
     throw new Error("Image too large");
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { image: base64Image },
  });

  revalidatePath("/profile");
}
