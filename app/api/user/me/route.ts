import { prismaClient } from "@/app/lib/db";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession();
    
    if (!session?.user?.email) {
      return NextResponse.json({
        error: "Unauthorized"
      }, { status: 401 });
    }

    let user = await prismaClient.user.findFirst({
      where: {
        email: session.user.email
      }
    });

    // If user doesn't exist, create them
    if (!user) {
      user = await prismaClient.user.create({
        data: {
          email: session.user.email,
          provider: "Google" // Assuming Google OAuth
        }
      });
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        provider: user.provider
      }
    });
  } catch (error) {
    console.error("Failed to fetch/create user:", error);
    return NextResponse.json({
      error: "Internal server error"
    }, { status: 500 });
  }
}