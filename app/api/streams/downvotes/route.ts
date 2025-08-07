import { NextRequest, NextResponse } from "next/server";
import { prismaClient } from "@/app/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user from database
    const user = await prismaClient.user.findUnique({
      where: { email: session.user.email },
      select: { id: true }
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const data = await req.json();
    const { streamId } = data;

    if (!streamId) {
      return NextResponse.json({ error: "Stream ID is required" }, { status: 400 });
    }

    // Check if user has upvoted this stream
    const existingUpvote = await prismaClient.upvotes.findUnique({
      where: {
        userId_streamId: {
          userId: user.id,
          streamId: streamId,
        },
      },
    });

    if (existingUpvote) {
      // Remove the upvote (this acts as a downvote)
      await prismaClient.upvotes.delete({
        where: {
          userId_streamId: {
            userId: user.id,
            streamId: streamId,
          },
        },
      });
      return NextResponse.json({ message: "Downvoted successfully" });
    } else {
      return NextResponse.json({ message: "No upvote to remove" }, { status: 400 });
    }
  } catch (error) {
    console.error("Error handling downvote:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}