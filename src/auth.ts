import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { supabase } from "@/lib/supabase";

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const email = credentials?.email;
        const password = credentials?.password;
        if (typeof email !== "string" || typeof password !== "string") {
          return null;
        }

        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error || !data.user) return null;

        return {
          id: data.user.id,
          email: data.user.email ?? email,
          name:
            (data.user.user_metadata?.full_name as string | undefined) ??
            data.user.email ??
            email,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    session({ session, token }) {
      if (token?.id && session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
});
