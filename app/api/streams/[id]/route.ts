import { prismaClient } from "@/app/lib/db";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession();
  
  const user = await prismaClient.user.findFirst({
    where: {
      email: session?.user?.email ?? ""
    }
  });
  
  if (!user) {
    return NextResponse.json({
      error: "Unauthorized"
    }, { status: 401 });
  }

  try {
    const { active } = await req.json();
    
    // Update the stream
    const stream = await prismaClient.stream.update({
      where: {
        id: params.id
      },
      data: {
        active: active
      }
    });

    return NextResponse.json({ 
      message: "Stream updated successfully",
      stream 
    });
  } catch (error) {
    console.error("Failed to update stream:", error);
    return NextResponse.json({
      error: "Failed to update stream"
    }, { status: 500 });
  }
}