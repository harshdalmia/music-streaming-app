import { prismaClient } from "@/app/lib/db";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    try {
        const { streamId } = await req.json();
        
        if (!streamId) {
            return NextResponse.json({
                error: "Stream ID is required"
            }, { status: 400 });
        }

        const session = await getServerSession();

        if (session?.user?.email) {
            // Registered user downvoting
            const user = await prismaClient.user.findFirst({
                where: {
                    email: session.user.email
                }
            });

            if (!user) {
                return NextResponse.json({
                    error: "User not found"
                }, { status: 404 });
            }

            // Remove upvote if exists
            await prismaClient.upvotes.deleteMany({
                where: {
                    userId: user.id,
                    streamId: streamId
                }
            });
        } else {
            // Anonymous user downvoting - decrement anonymousVotes (minimum 0)
            const stream = await prismaClient.stream.findUnique({
                where: { id: streamId }
            });

            if (stream && stream.anonymousVotes > 0) {
                await prismaClient.stream.update({
                    where: {
                        id: streamId
                    },
                    data: {
                        anonymousVotes: {
                            decrement: 1
                        }
                    }
                });
            }
        }

        // Get updated stream data
        const stream = await prismaClient.stream.findUnique({
            where: { id: streamId },
            include: {
                _count: {
                    select: { upvotes: true }
                }
            }
        });

        const totalVotes = (stream?._count.upvotes || 0) + (stream?.anonymousVotes || 0);

        return NextResponse.json({
            message: "Vote removed successfully",
            upvotes: totalVotes
        });
    } catch (error) {
        console.error("Failed to downvote:", error);
        return NextResponse.json({
            error: "Failed to downvote"
        }, { status: 500 });
    }
}