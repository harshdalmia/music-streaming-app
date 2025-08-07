import { NextRequest, NextResponse } from "next/server";
import { prismaClient } from "@/app/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Await the params in Next.js 15
    const { id } = await params;
    const data = await req.json();
    const { active } = data;

    // Update the stream
    const updatedStream = await prismaClient.stream.update({
      where: { id },
      data: { active },
    });

    return NextResponse.json({ stream: updatedStream });
  } catch (error) {
    console.error("Error updating stream:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Await the params in Next.js 15
    const { id } = await params;

    // Mark stream as inactive instead of deleting
    const updatedStream = await prismaClient.stream.update({
      where: { id },
      data: { active: false },
    });

    return NextResponse.json({ message: "Stream removed from queue" });
  } catch (error) {
    console.error("Error removing stream:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}