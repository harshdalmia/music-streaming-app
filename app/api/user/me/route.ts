import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/app/lib/auth";
import { prismaClient } from "@/app/lib/db";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    console.log("Session data:", JSON.stringify(session, null, 2));
    
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if we have user.id in session, if not, fetch from database
    let userId = session.user.id;
    
    if (!userId && session.user.email) {
      const dbUser = await prismaClient.user.findUnique({
        where: { email: session.user.email },
        select: { id: true }
      });
      if (dbUser?.id) {
        userId = dbUser.id;
      }
    }

    if (!userId) {
      return NextResponse.json({ error: "User ID not found" }, { status: 404 });
    }

    // Get full user data
    const user = await prismaClient.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        provider: true,
      }
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error("Error in /api/user/me:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}