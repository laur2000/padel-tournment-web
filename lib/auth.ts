import { NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import * as argon2 from "argon2";
import { prisma } from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as any, // Cast to any because of type mismatch between next-auth v4 and @auth/prisma-adapter
  session: {
    strategy: "jwt",
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      allowDangerousEmailAccountLinking: true,
    }),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Missing credentials");
        }

        const user = await prisma.user.findUnique({
          where: {
            email: credentials.email,
          },
        });

        if (!user || !user.hashedPassword) {
          throw new Error("Invalid credentials");
        }

        const isValid = await argon2.verify(user.hashedPassword, credentials.password);

        if (!isValid) {
          throw new Error("Invalid credentials");
        }

        return user;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.is_admin = user.is_admin;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
        
        // Fetch fresh data from DB to ensure image is up-to-date
        // This avoids storing large base64 images in the JWT cookie
        try {
            const dbUser = await prisma.user.findUnique({
                where: { id: token.id as string },
                select: { image: true, is_admin: true, name: true }
            });

            if (dbUser) {
                session.user.image = dbUser.image;
                session.user.is_admin = dbUser.is_admin;
                session.user.name = dbUser.name;
            }
        } catch (error) {
            console.error("Error fetching user session data:", error);
        }
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
