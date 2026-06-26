import type { Role } from "@prisma/client";
import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      role: Role;
      twoFactorVerified: boolean;
      profileComplete: boolean;
    };
  }

  interface User {
    id: string;
    email: string;
    role: Role;
    twoFactorVerified: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId: string;
    role: Role;
    twoFactorVerified: boolean;
    profileComplete: boolean;
    jti: string;
  }
}
