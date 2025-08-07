import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prismaClient } from "./db";

export const authOptions: NextAuthOptions = {
  adapter: {
    ...PrismaAdapter(prismaClient),
    createUser: async (data: any) => {
      const user = await prismaClient.user.create({
        data: {
          ...data,
          provider: "Google",
        },
      });
      return user;
    },
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "database",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async session({ session, user }) {
      // Ensure user ID is set in session
      if (session.user && user) {
        session.user.id = user.id;
      }
      return session;
    },
  },
};